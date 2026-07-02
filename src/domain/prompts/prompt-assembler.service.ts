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
import { PERSONA_MODEL_PARAMS } from '../../config/model-params';
import {
  VERBATIM_TAIL_LENGTH,
  DRIFT_REFRESH_FIRST_TURN,
  DRIFT_REFRESH_CADENCE,
} from '../../config/context-config';
import { estimateTokens } from '../context/token-estimator';
import { assistantMessageCount } from '../context/turn-counting';

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
    options?: { systemNote?: string; driftRefreshTurn?: number },
  ): OutboundPrompt {
    const params = PERSONA_MODEL_PARAMS[persona];

    switch (mode) {
      case 'solo':
        return this.composeSolo(persona, thread, params, options);
      case 'ask-both-a':
      case 'ask-both-b':
      case 'ask-both-keep-going':
        throw new Error(
          `PromptAssembler: mode='${mode}' lands in E9-S2 / E9-S3 (not yet implemented).`,
        );
      case 'summarize':
        return this.composeSummary(persona, thread, params);
      default:
        return assertNever(mode);
    }
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
      case 'hitesh':
        return "Reminder: mirror the user's Hinglish register. Analogy or story FIRST, then the tech. 1–3 signature phrases max. NEVER trash a framework, other creator, or fabricate a fact.";
      case 'piyush':
        return "Reminder: mirror the user's Hinglish register (English syntax + Hindi phonetics). Reductive framing → whiteboard decomposition → analogy → code → homework. Comprehension checks every 2–3 sentences. Bullet lists preferred.";
      default:
        return assertNever(persona);
    }
  }
}
