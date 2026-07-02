import { Injectable } from '@angular/core';

import type { PersonaId } from '../types/persona';
import { assertNever } from '../types/persona';
import type {
  ChatRequest,
  PromptMessage,
  Thread,
} from '../types/message';
import type { OutboundPrompt, PromptMode } from './types';
import { PERSONA_REGISTRY } from '../../personas/persona.registry';
import { buildBlendedComposition } from '../../personas/blended.prompt';
import { PERSONA_MODEL_PARAMS } from '../../config/model-params';
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
        const pair = options?.blendedPair ?? { a: 'hitesh' as PersonaId, b: 'piyush' as PersonaId };
        const blendedParams = this.blendedModelParams(pair.a, pair.b);
        return this.composeAskBothBlended(thread, blendedParams, pair);
      }
      case 'summarize':
        return this.composeSummary(persona, thread, params);
      default:
        return assertNever(mode);
    }
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
    const lastMessage = thread.messages[thread.messages.length - 1];
    const currentUserText =
      lastMessage && lastMessage.role === 'user' ? lastMessage.content : '';

    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...(systemNote && systemNote.length > 0
        ? [{ role: 'system' as const, content: systemNote }]
        : []),
      { role: 'user', content: `<user_message>${currentUserText}</user_message>` },
    ];

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
          systemContent + (systemNote ?? '') + currentUserText,
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
    const currentUserText =
      lastMessage && lastMessage.role === 'user'
        ? lastMessage.content
        : 'Continue this Blended discussion with a second fused-voice take — offer a fresh angle or expand on a point you glossed. Keep the same warm-hook + reductive-breakdown + build-push structure.';
    const userContent = `<user_message>${currentUserText}</user_message>`;

    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];

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
        estimatedTokens: estimateTokens(systemContent + userContent),
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
    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      ...(systemNote && systemNote.length > 0
        ? [{ role: 'system' as const, content: systemNote }]
        : []),
      {
        role: 'user',
        content: '<user_message>Respond with your additional take.</user_message>',
      },
    ];
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
        estimatedTokens: estimateTokens(systemContent + (systemNote ?? '')),
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

    const lastMessage = thread.messages[thread.messages.length - 1];
    const currentUserText =
      lastMessage && lastMessage.role === 'user' ? lastMessage.content : '';
    const userContent = `<user_message>${currentUserText}</user_message>`;

    const messages: PromptMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];

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
        estimatedTokens: estimateTokens(systemContent + userContent),
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
    const p = PERSONA_REGISTRY[persona].prompt;
    const parts: string[] = [];

    // Response-length directive first so it colours the whole persona block.
    // Enforced above `maxOutputTokens` so the model self-shapes instead of
    // getting truncated mid-sentence.
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
    parts.push(this.voiceReminderFor(persona));
    parts.push('\n---\n');

    parts.push('# ---- ROLLING SUMMARY (injected by system) ----');
    parts.push(thread.rollingSummary && thread.rollingSummary.length > 0
      ? thread.rollingSummary
      : '(none)');
    parts.push('\n---\n');

    parts.push('# ---- VERBATIM TAIL (last N turns) ----');
    // Exclude the current user message (last one) — that goes into Block 9.
    const totalMsgs = thread.messages.length;
    const tailEnd = Math.max(0, totalMsgs - 1);
    const tailStart = Math.max(0, tailEnd - VERBATIM_TAIL_LENGTH);
    const tail = thread.messages.slice(tailStart, tailEnd);
    if (tail.length === 0) {
      parts.push('(no prior turns)');
    } else {
      for (const m of tail) {
        parts.push(`${m.role}: ${m.content}`);
      }
    }
    parts.push('\n---\n');

    if (driftRefresh) {
      parts.push(driftRefresh);
      parts.push('\n---\n');
    }

    parts.push('# ---- PRE-RESPONSE SELF-VERIFICATION ----');
    parts.push(p.selfVerificationChecklist);

    return parts.join('\n');
  }

  private voiceReminderFor(persona: PersonaId): string {
    switch (persona) {
      case 'musk':
        return 'Reminder: English only. First-principles decomposition first, then engineering realism. Concise punchy sentences. NEVER give financial advice or political commentary.';
      case 'jobs':
        return 'Reminder: English only. Design-first storytelling — simplicity, taste, user experience. Short elegant paragraphs. NEVER recommend current Apple products or claim to be the real Steve Jobs.';
      case 'gandhi':
        return 'Reminder: Philosophical humility and moral clarity. Sanskrit/Hindi terms in Latin transliteration ONLY — no Devanagari. NEVER engage modern political disputes.';
      case 'einstein':
        return 'Reminder: Curious warmth with thought-experiment pedagogy. English reflective paragraphs. NEVER speculate on post-1955 physics or claim to be the real Einstein.';
      case 'newton':
        return 'Reminder: Formal but readable 17th-century English. Precise definitions and demonstrated truth. NEVER present apple-on-head as verified biography or claim to be the real Newton.';
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

    parts.push('# ---- VERBATIM TAIL (last N turns) ----');
    const totalMsgs = thread.messages.length;
    // Exclude the last message from the tail when it's a user message
    // (goes into Block 9 via `<user_message>`); include it when it's an
    // assistant message so Keep-Going Blended sees its own prior take.
    const lastMsg = thread.messages[totalMsgs - 1];
    const dropLast = lastMsg?.role === 'user';
    const tailEnd = Math.max(0, dropLast ? totalMsgs - 1 : totalMsgs);
    const tailStart = Math.max(0, tailEnd - VERBATIM_TAIL_LENGTH);
    const tail = thread.messages.slice(tailStart, tailEnd);
    if (tail.length === 0) {
      parts.push('(no prior turns)');
    } else {
      for (const m of tail) {
        parts.push(`${m.role}: ${m.content}`);
      }
    }
    parts.push('\n---\n');

    parts.push('# ---- PRE-RESPONSE SELF-VERIFICATION ----');
    parts.push(blendedComposition.selfVerificationChecklist);

    return parts.join('\n');
  }
}
