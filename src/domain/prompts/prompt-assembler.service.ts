import { Injectable } from '@angular/core';

import type { PersonaId } from '../types/persona';
import { assertNever } from '../types/persona';
import type {
  ChatRequest,
  Message,
  PromptMessage,
  Thread,
} from '../types/message';
import type { OutboundPrompt, PromptMode } from './types';
import { PERSONA_REGISTRY, type PersonaRegistryEntry } from '../../personas/persona.registry';
import { buildBlendedComposition } from '../../personas/blended.prompt';
import { PERSONA_MODEL_PARAMS, CUSTOM_PERSONA_DEFAULT_PARAMS } from '../../config/model-params';
import {
  VERBATIM_TAIL_LENGTH,
  DRIFT_REFRESH_FIRST_TURN,
  DRIFT_REFRESH_CADENCE,
} from '../../config/context-config';
import { estimateTokens } from '../context/token-estimator';
import { assistantMessageCount } from '../context/turn-counting';

/**
 * Prepended to every solo / ask-both / keep-going system prompt so the
 * model self-shapes to a chat-friendly length. Sits above the persona
 * identity block on purpose — it's a hard constraint the persona voice
 * must respect. The corresponding `maxOutputTokens` in
 * `PERSONA_MODEL_PARAMS` is the safety ceiling; this directive is what
 * actually shapes the response.
 */
const RESPONSE_LENGTH_DIRECTIVE = [
  '# ---- RESPONSE LENGTH ----',
  'Keep every answer short and chat-friendly:',
  '  • Aim for 3-6 short sentences total, or a compact bullet list.',
  '  • One brief analogy or code snippet is fine; skip long ones.',
  '  • If the topic truly needs more depth, offer to expand instead of dumping it.',
  '  • No wall-of-text explanations. No repeating the question back verbatim.',
  '  • Preserve persona voice inside this length budget.',
].join('\n');

/**
 * AD-8 — the sole prompt composer. Every LLM call in Solo, Ask-Both, Rolling
 * Summary, and Drift Refresh flows funnels through here. Feature code never
 * hand-rolls prompt strings; ESLint from E0-S4 backs this up.
 *
 * Solo mode is the only mode this story implements. The other four modes are
 * declared in the exhaustive switch; they throw not-yet-implemented until
 * their owning stories land (E5-S2 summarize, E5-S3 drift refresh injection,
 * E9-S2/E9-S3 ask-both).
 */
@Injectable({ providedIn: 'root' })
export class PromptAssembler {
  compose(
    persona: PersonaId,
    thread: Thread,
    mode: PromptMode,
    options?: {
      systemNote?: string;
      driftRefreshTurn?: number;
      blendedPair?: { a: PersonaId; b: PersonaId };
    },
  ): OutboundPrompt {
    const params = PERSONA_MODEL_PARAMS[persona];

    switch (mode) {
      case 'solo':
        return this.composeSolo(persona, thread, params, options);
      case 'ask-both-a':
        return this.composeAskBothA(persona, thread, params);
      case 'ask-both-b':
        return this.composeAskBothB(persona, thread, params, options?.systemNote);
      case 'ask-both-keep-going':
        return this.composeAskBothKeepGoing(
          persona,
          thread,
          params,
          options?.systemNote,
        );
      case 'ask-both-blended': {
        const pair = options?.blendedPair ?? { a: 'musk' as PersonaId, b: 'jobs' as PersonaId };
        const blendedParams = this.blendedModelParams(pair.a, pair.b);
        return this.composeAskBothBlended(thread, blendedParams, pair);
      }
      case 'summarize':
        return this.composeSummary(persona, thread, params);
      default:
        return assertNever(mode);
    }
  }

  /** Solo compose from a resolved registry entry (built-in or custom). */
  composeFromEntry(
    entry: PersonaRegistryEntry,
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId] = CUSTOM_PERSONA_DEFAULT_PARAMS,
  ): OutboundPrompt {
    const currentTurn = assistantMessageCount(thread) + 1;
    const shouldInjectDrift =
      currentTurn >= DRIFT_REFRESH_FIRST_TURN &&
      (currentTurn - DRIFT_REFRESH_FIRST_TURN) % DRIFT_REFRESH_CADENCE === 0;
    const driftBlock: string | null = shouldInjectDrift
      ? entry.prompt.driftRefresh || null
      : null;

    const systemContent = this.buildSystemBlockFromEntry(entry, thread, driftBlock);

    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...this.buildNativeHistory(thread),
    ];

    const historyText = messages
      .slice(1)
      .map((m) => m.content)
      .join('\n');

    return {
      messages,
      model: params.modelName,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
      meta: {
        mode: 'solo',
        hasSummary: !!thread.rollingSummary,
        hasDriftRefresh: shouldInjectDrift && driftBlock !== null,
        estimatedTokens: estimateTokens(systemContent + historyText),
      },
    };
  }

  private composeAskBothA(
    persona: PersonaId,
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId],
  ): OutboundPrompt {
    const solo = this.composeSolo(persona, thread, params);
    return {
      ...solo,
      meta: { ...solo.meta, mode: 'ask-both-a' },
    };
  }

  private composeAskBothB(
    persona: PersonaId,
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId],
    systemNote: string | undefined,
  ): OutboundPrompt {
    const systemContent = this.buildSystemBlock(persona, thread, null);
    const history = this.buildNativeHistory(thread);
    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...(systemNote && systemNote.length > 0
        ? [{ role: 'system' as const, content: systemNote }]
        : []),
      ...history,
    ];
    const historyText = history.map((m) => m.content).join('\n');
    return {
      messages,
      model: params.modelName,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
      meta: {
        mode: 'ask-both-b',
        hasSummary: !!thread.rollingSummary,
        hasDriftRefresh: false,
        estimatedTokens: estimateTokens(
          systemContent + (systemNote ?? '') + historyText,
        ),
      },
    };
  }

  /**
   * Post-sprint Blended arm. AC-3: returns a single `role:'system'` message
   * (9-block order sourced from `blendedComposition` instead of persona
   * registry) plus a single `role:'user'` message wrapped in
   * `<user_message>` delimiters. `persona` arg is deliberately absent — the
   * fusion is persona-agnostic; the sequencer owns provider routing and
   * model params selection separately (uses Hitesh's slot as the canonical
   * carrier).
   *
   * When the current thread's last message is an assistant reply (Keep
   * Going in Blended mode per AC-5), we synthesise the user message as a
   * "continue with a fresh angle" prompt so the model produces a follow-up
   * take on the original question rather than paraphrasing itself. When it
   * is a user message (initial Blended send per AC-3), that message goes
   * through verbatim.
   */
  private blendedModelParams(
    a: PersonaId,
    b: PersonaId,
  ): (typeof PERSONA_MODEL_PARAMS)[PersonaId] {
    const paramsA = PERSONA_MODEL_PARAMS[a];
    const paramsB = PERSONA_MODEL_PARAMS[b];
    const carrierParams = PERSONA_MODEL_PARAMS[a];
    const tempA = paramsA.temperature ?? 0.7;
    const tempB = paramsB.temperature ?? 0.7;
    return {
      ...carrierParams,
      temperature: (tempA + tempB) / 2,
    };
  }

  private composeAskBothBlended(
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId],
    pair: { a: PersonaId; b: PersonaId },
  ): OutboundPrompt {
    const systemContent = this.buildBlendedSystemBlock(thread, pair);
    const lastMessage = thread.messages[thread.messages.length - 1];
    const appendUser =
      lastMessage && lastMessage.role === 'user'
        ? undefined
        : 'Continue this Blended discussion with a second fused-voice take — offer a fresh angle or expand on a point you glossed. Keep the same warm-hook + reductive-breakdown + build-push structure.';
    const history = this.buildNativeHistory(thread, { appendUser });
    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...history,
    ];
    const historyText = history.map((m) => m.content).join('\n');

    return {
      messages,
      model: params.modelName,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
      meta: {
        mode: 'ask-both-blended',
        hasSummary: !!thread.rollingSummary,
        hasDriftRefresh: false,
        estimatedTokens: estimateTokens(systemContent + historyText),
      },
    };
  }

  private composeAskBothKeepGoing(
    persona: PersonaId,
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId],
    systemNote: string | undefined,
  ): OutboundPrompt {
    const systemContent = this.buildSystemBlock(persona, thread, null);
    const history = this.buildNativeHistory(thread, {
      appendUser: 'Respond with your additional take.',
    });
    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...(systemNote && systemNote.length > 0
        ? [{ role: 'system' as const, content: systemNote }]
        : []),
      ...history,
    ];
    const historyText = history.map((m) => m.content).join('\n');
    return {
      messages,
      model: params.modelName,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
      meta: {
        mode: 'ask-both-keep-going',
        hasSummary: !!thread.rollingSummary,
        hasDriftRefresh: false,
        estimatedTokens: estimateTokens(systemContent + (systemNote ?? '') + historyText),
      },
    };
  }

  private composeSolo(
    persona: PersonaId,
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId],
    _options?: { systemNote?: string; driftRefreshTurn?: number },
  ): OutboundPrompt {
    // AD-9 drift-refresh cadence: current turn = imminent assistant message.
    const currentTurn = assistantMessageCount(thread) + 1;
    const shouldInjectDrift =
      currentTurn >= DRIFT_REFRESH_FIRST_TURN &&
      (currentTurn - DRIFT_REFRESH_FIRST_TURN) % DRIFT_REFRESH_CADENCE === 0;
    const driftBlock: string | null = shouldInjectDrift
      ? PERSONA_REGISTRY[persona].prompt.driftRefresh || null
      : null;

    const systemContent = this.buildSystemBlock(persona, thread, driftBlock);
    const history = this.buildNativeHistory(thread);
    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...history,
    ];
    const historyText = history.map((m) => m.content).join('\n');

    const chat: ChatRequest = {
      messages,
      model: params.modelName,
      temperature: params.temperature,
      topP: params.topP,
      maxOutputTokens: params.maxOutputTokens,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
    };

    return {
      ...chat,
      meta: {
        mode: 'solo',
        hasSummary: !!thread.rollingSummary,
        hasDriftRefresh: shouldInjectDrift && driftBlock !== null,
        estimatedTokens: estimateTokens(systemContent + historyText),
      },
    };
  }

  private composeSummary(
    _persona: PersonaId,
    thread: Thread,
    params: (typeof PERSONA_MODEL_PARAMS)[PersonaId],
  ): OutboundPrompt {
    const systemPrompt =
      'Compress the conversation below into ~200 tokens preserving facts, ' +
      'user context (stack, project, error), and open threads. ' +
      'Do NOT preserve verbatim wording.';
    const historyBlock = thread.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    const messages: PromptMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: historyBlock },
    ];
    return {
      messages,
      model: params.modelName,
      temperature: 0.2, // lower temp for consistent summarisation
      topP: params.topP,
      maxOutputTokens: 300,
      meta: {
        mode: 'summarize',
        hasSummary: false,
        hasDriftRefresh: false,
        estimatedTokens: estimateTokens(systemPrompt + historyBlock),
      },
    };
  }

  private buildSystemBlock(
    persona: PersonaId,
    thread: Thread,
    driftRefresh: string | null,
  ): string {
    return this.buildSystemBlockFromEntry(
      PERSONA_REGISTRY[persona],
      thread,
      driftRefresh,
      persona,
    );
  }

  private buildSystemBlockFromEntry(
    entry: PersonaRegistryEntry,
    thread: Thread,
    driftRefresh: string | null,
    builtinPersona?: PersonaId,
  ): string {
    const p = entry.prompt;
    const parts: string[] = [];

    parts.push(RESPONSE_LENGTH_DIRECTIVE);
    parts.push('\n---\n');
    parts.push(p.identityBlock);
    parts.push('\n---\n');
    parts.push(p.voiceRules);
    parts.push('\n---\n');
    parts.push(
      p.refusalRules.length > 0
        ? `REFUSAL RULES:\n${p.refusalRules}`
        : 'REFUSAL RULES:\n(refusal templates load in E8-S1)',
    );
    parts.push('\n---\n');

    parts.push('# ---- FEW-SHOT EXAMPLES ----');
    if (p.fewShots.length === 0) {
      parts.push('(no few-shots populated yet — E2-S2 slot)');
    } else {
      for (const fs of p.fewShots) {
        parts.push(`User: ${fs.user}\nAssistant: ${fs.assistant}\n`);
      }
    }
    parts.push('\n---\n');

    parts.push('# ---- REPEAT CRITICAL RULES ----');
    const voiceReminder =
      entry.voiceReminder ??
      (builtinPersona ? this.voiceReminderFor(builtinPersona) : 'Stay in character.');
    parts.push(voiceReminder);
    parts.push('\n---\n');

    parts.push('# ---- ROLLING SUMMARY (injected by system) ----');
    parts.push(thread.rollingSummary && thread.rollingSummary.length > 0
      ? thread.rollingSummary
      : '(none)');
    parts.push('\n---\n');

    if (driftRefresh) {
      parts.push(driftRefresh);
      parts.push('\n---\n');
    }

    parts.push('# ---- PRE-RESPONSE SELF-VERIFICATION ----');
    parts.push(p.selfVerificationChecklist);

    return parts.join('\n');
  }

  /**
   * Maps the last `VERBATIM_TAIL_LENGTH` persisted turns into native
   * chat-api roles. User turns stay wrapped in `<user_message>` delimiters;
   * assistant turns pass through as `role:'assistant'`.
   */
  private buildNativeHistory(
    thread: Thread,
    options?: { appendUser?: string },
  ): PromptMessage[] {
    const eligible = thread.messages.filter((m) => this.isEligibleForHistory(m));
    const capped = eligible.slice(-VERBATIM_TAIL_LENGTH);
    const history: PromptMessage[] = capped.map((m) =>
      this.threadMessageToPromptMessage(m),
    );

    if (options?.appendUser) {
      history.push({
        role: 'user',
        content: `<user_message>${options.appendUser}</user_message>`,
      });
    }

    if (history.length === 0) {
      history.push({ role: 'user', content: '<user_message></user_message>' });
    }

    return history;
  }

  private isEligibleForHistory(message: Message): boolean {
    if (message.role === 'user') return true;
    return !message.status || message.status === 'complete';
  }

  private threadMessageToPromptMessage(message: Message): PromptMessage {
    if (message.role === 'user') {
      return {
        role: 'user',
        content: `<user_message>${message.content}</user_message>`,
      };
    }
    return { role: 'assistant', content: message.content };
  }

  private voiceReminderFor(persona: PersonaId): string {
    switch (persona) {
      case 'musk':
        return 'Reminder: First principles first — physics over analogy, manufacturing realism. Refuse financial or political bait in Musk voice ("physics is the law"), never as a generic policy bot. Concise punchy English.';
      case 'jobs':
        return 'Reminder: Minimalist eloquence — design is how it works, say no to clutter. Refuse product pitches with principles, not shopping lists. Stay hungry. Stay foolish.';
      case 'gandhi':
        return 'Reminder: Humble moral tone — ahimsa, satyagraha, truth, service. Latin transliteration ONLY, zero Devanagari. Deflect modern politics to principles in prayerful voice.';
      case 'einstein':
        return 'Reminder: Curious warmth — thought experiments, wonder before certainty. No post-1955 physics as your opinion. Refuse tricks with gentle humility, not assistant boilerplate.';
      case 'newton':
        return 'Reminder: Formal natural philosophy — define terms, demonstration over hypothesis. Distinguish myth from verified writing. Refuse modern engineering leaps in 17th-c voice.';
      default:
        return assertNever(persona);
    }
  }

  /**
   * Post-sprint AD-8 9-block order for the Blended arm — mirrors
   * `buildSystemBlock` structurally but sources every persona-shaped block
   * from `blendedComposition` instead of the persona registry. The output
   * is folded into a single `role:'system'` message per AC-3.
   */
  private buildBlendedSystemBlock(
    thread: Thread,
    pair: { a: PersonaId; b: PersonaId },
  ): string {
    const blendedComposition = buildBlendedComposition(pair.a, pair.b);
    const parts: string[] = [];

    parts.push(RESPONSE_LENGTH_DIRECTIVE);
    parts.push('\n---\n');
    parts.push(blendedComposition.identityBlock);
    parts.push('\n---\n');
    parts.push(blendedComposition.voiceRules);
    parts.push('\n---\n');
    parts.push(`REFUSAL RULES:\n${blendedComposition.refusalRules}`);
    parts.push('\n---\n');

    parts.push('# ---- FEW-SHOT EXAMPLES ----');
    for (const fs of blendedComposition.fewShots) {
      parts.push(`User: ${fs.user}\nAssistant: ${fs.assistant}\n`);
    }
    parts.push('\n---\n');

    parts.push('# ---- REPEAT CRITICAL RULES ----');
    parts.push(blendedComposition.voiceReminder);
    parts.push('\n---\n');

    parts.push('# ---- ROLLING SUMMARY (injected by system) ----');
    parts.push(
      thread.rollingSummary && thread.rollingSummary.length > 0
        ? thread.rollingSummary
        : '(none)',
    );
    parts.push('\n---\n');

    parts.push('# ---- PRE-RESPONSE SELF-VERIFICATION ----');
    parts.push(blendedComposition.selfVerificationChecklist);

    return parts.join('\n');
  }
}
