import { describe, it, expect } from 'vitest';

import { PromptAssembler } from './prompt-assembler.service';
import type { PromptMode } from './types';
import type { Thread, Message } from '../types/message';

function threadFrom(messages: Message[]): Thread {
  return {
    id: 't-test',
    scope: 'hitesh',
    messages,
    rollingSummary: null,
    turnsSinceLastSummary: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

function msg(role: 'user' | 'assistant', text: string, n: number): Message {
  return {
    id: `m-${n}`,
    role,
    content: text,
    timestamp: n,
    ...(role === 'assistant' ? { status: 'complete', persona: 'hitesh' } : {}),
  } as Message;
}

describe('PromptAssembler solo mode', () => {
  const assembler = new PromptAssembler();

  it('returns system + native user history and wraps user turns in XML delimiters', () => {
    const thread = threadFrom([msg('user', 'hello', 1)]);
    const out = assembler.compose('hitesh', thread, 'solo');
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[1]?.role).toBe('user');
    expect(out.messages[1]?.content).toBe(
      '<user_message>hello</user_message>',
    );
  });

  it('emits alternating native user/assistant history for multi-turn threads', () => {
    const thread = threadFrom([
      msg('user', 'first question', 1),
      msg('assistant', 'first answer', 2),
      msg('user', 'follow up', 3),
    ]);
    const out = assembler.compose('hitesh', thread, 'solo');
    expect(out.messages).toHaveLength(4);
    expect(out.messages[1]).toEqual({
      role: 'user',
      content: '<user_message>first question</user_message>',
    });
    expect(out.messages[2]).toEqual({
      role: 'assistant',
      content: 'first answer',
    });
    expect(out.messages[3]).toEqual({
      role: 'user',
      content: '<user_message>follow up</user_message>',
    });
  });

  it('sources model + params from PERSONA_MODEL_PARAMS (Hitesh → gemini)', () => {
    const out = assembler.compose('hitesh', threadFrom([]), 'solo');
    expect(out.model).toBe('gemini-3.1-flash-lite');
    expect(out.temperature).toBe(0.75);
    expect(out.topP).toBe(0.95);
    expect(out.maxOutputTokens).toBe(500);
    expect(out.frequencyPenalty).toBe(0.2);
    expect(out.presencePenalty).toBe(0.3);
  });

  it('sources model + params from PERSONA_MODEL_PARAMS (Piyush → groq)', () => {
    const out = assembler.compose('piyush', threadFrom([]), 'solo');
    expect(out.model).toBe('openai/gpt-oss-120b');
    expect(out.temperature).toBe(0.55);
    expect(out.topP).toBe(0.9);
    expect(out.maxOutputTokens).toBe(500);
  });

  it('populates OutboundPrompt.meta correctly for a fresh thread', () => {
    const out = assembler.compose('hitesh', threadFrom([]), 'solo');
    expect(out.meta.mode).toBe('solo');
    expect(out.meta.hasSummary).toBe(false);
    expect(out.meta.hasDriftRefresh).toBe(false);
    expect(out.meta.estimatedTokens).toBeGreaterThan(0);
  });

  it('injects rolling summary in system and recent turns as native history', () => {
    const messages: Message[] = [];
    for (let i = 0; i < 20; i += 1) {
      messages.push(msg(i % 2 === 0 ? 'user' : 'assistant', `m-${i}`, i));
    }
    messages.push(msg('user', 'current-q', 20));
    const thread: Thread = {
      ...threadFrom(messages),
      rollingSummary: 'PRIOR SUMMARY OF 12 TURNS',
    };
    const out = assembler.compose('hitesh', thread, 'solo');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('PRIOR SUMMARY OF 12 TURNS');
    expect(system).not.toContain('VERBATIM TAIL');
    const history = out.messages.slice(1);
    expect(history.some((m) => m.content.includes('m-18'))).toBe(true);
    expect(history.some((m) => m.content.includes('current-q'))).toBe(true);
    expect(history.some((m) => m.content.includes('m-10'))).toBe(false);
    expect(history.some((m) => m.content.includes('m-11'))).toBe(false);
  });

  it('embeds fewShots block from persona registry', () => {
    const out = assembler.compose('hitesh', threadFrom([]), 'solo');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('FEW-SHOT EXAMPLES');
    expect(system).toContain('Haanji, achhi baat hai ki soch rahe ho');
  });

  it('reports hasSummary=true when thread.rollingSummary is set', () => {
    const thread: Thread = {
      ...threadFrom([msg('user', 'q', 1)]),
      rollingSummary: 'summary',
    };
    const out = assembler.compose('hitesh', thread, 'solo');
    expect(out.meta.hasSummary).toBe(true);
  });

  it('composes a valid summarize prompt (E5-S2 real impl)', () => {
    const thread = threadFrom([msg('user', 'first', 1), msg('assistant', 'reply', 2)]);
    const out = assembler.compose('hitesh', thread, 'summarize');
    expect(out.meta.mode).toBe('summarize');
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[0]?.content).toContain('Compress');
    expect(out.temperature).toBe(0.2);
  });

  it('composes a valid ask-both-a prompt (E9-S2 real impl)', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('hitesh', thread, 'ask-both-a');
    expect(out.meta.mode).toBe('ask-both-a');
  });

  it('assertNever fires runtime on an invented mode', () => {
    const thread = threadFrom([]);
    expect(() =>
      assembler.compose('hitesh', thread, 'foo' as unknown as PromptMode),
    ).toThrowError(/Unhandled variant/);
  });
});

describe('PromptAssembler ask-both-blended mode (post-sprint)', () => {
  const assembler = new PromptAssembler();

  it('AC-3: returns exactly one system + one user message; user wrapped in <user_message>', () => {
    const thread = threadFrom([msg('user', 'system design kaise start karun?', 1)]);
    const out = assembler.compose('hitesh', thread, 'ask-both-blended');
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[1]?.role).toBe('user');
    expect(out.messages[1]?.content).toBe(
      '<user_message>system design kaise start karun?</user_message>',
    );
    expect(out.meta.mode).toBe('ask-both-blended');
  });

  it('AC-3: system block preserves AD-8 block order sourced from blended composition', () => {
    const thread = threadFrom([msg('user', 'hi', 1)]);
    const out = assembler.compose('hitesh', thread, 'ask-both-blended');
    const system = out.messages[0]?.content ?? '';

    const indices = {
      identity: system.indexOf('FUSED VOICE'),
      voice: system.indexOf('VOICE RULES'),
      refusal: system.indexOf('REFUSAL RULES:'),
      fewShots: system.indexOf('FEW-SHOT EXAMPLES'),
      reminder: system.indexOf('REPEAT CRITICAL RULES'),
      summary: system.indexOf('ROLLING SUMMARY'),
      selfCheck: system.indexOf('PRE-RESPONSE SELF-VERIFICATION'),
    };

    Object.values(indices).forEach((idx) =>
      expect(idx).toBeGreaterThanOrEqual(0),
    );
    expect(indices.identity).toBeLessThan(indices.voice);
    expect(indices.voice).toBeLessThan(indices.refusal);
    expect(indices.refusal).toBeLessThan(indices.fewShots);
    expect(indices.fewShots).toBeLessThan(indices.reminder);
    expect(indices.reminder).toBeLessThan(indices.summary);
    expect(indices.summary).toBeLessThan(indices.selfCheck);
    expect(system).not.toContain('VERBATIM TAIL');
  });

  it('AC-8: fusion identityBlock includes the SCRIPT rule and forbids Devanagari', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('hitesh', thread, 'ask-both-blended');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('SCRIPT: Roman/Latin transliteration for ALL content');
    expect(system).toContain('NEVER emit');
    expect(system).toContain('Devanagari');
    // Pedagogical Devanagari (in the "write X not Y" clause) is allowed
    // inside the identityBlock and the identity block only — same policy
    // as the Piyush persona post-mid-sprint-fix. The instruction
    // "NEVER emit Devanagari" makes the examples anti-patterns, not seeds.
    // Everything OUTSIDE that identity block should be Latin-only.
    const identityStart = system.indexOf('FUSED VOICE');
    const identityEnd = system.indexOf('VOICE RULES');
    const beforeIdentity = system.slice(0, identityStart);
    const afterIdentity = system.slice(identityEnd);
    const devanagari = /[\u0900-\u097F]/;
    expect(devanagari.test(beforeIdentity)).toBe(false);
    expect(devanagari.test(afterIdentity)).toBe(false);
  });

  it('AC-3: few-shots are the AC-3 subset — Hitesh Q1+Q3 + Piyush Q2+Q4', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('hitesh', thread, 'ask-both-blended');
    const system = out.messages[0]?.content ?? '';
    // Hitesh Q1 (React vs Next.js opener) + Q3 (job market)
    expect(system).toContain('React seekhna chahiye ya directly Next.js pe jaana chahiye');
    expect(system).toContain('Job market bahut kharaab hai');
    // Piyush Q2 (system design) + Q4 (Docker)
    expect(system).toContain('System design kaise start karun');
    expect(system).toContain('Docker seekhna hai, kahaan se start karun');
  });

  it('AC-5: keep-going path synthesises a "continue" user message when last thread msg is assistant', () => {
    const thread = threadFrom([
      msg('user', 'original question', 1),
      msg('assistant', 'first blended reply', 2),
    ]);
    const out = assembler.compose('hitesh', thread, 'ask-both-blended');
    const lastUser = out.messages[out.messages.length - 1];
    expect(lastUser?.role).toBe('user');
    expect(lastUser?.content).toContain('Continue this Blended discussion');
    expect(lastUser?.content).toContain('fresh angle');
    const assistantHistory = out.messages.find(
      (m) => m.role === 'assistant' && m.content === 'first blended reply',
    );
    expect(assistantHistory).toBeDefined();
  });

  it('AC-5: keep-going path appends a synthetic user turn after native history', () => {
    const thread = threadFrom([
      msg('user', 'original question', 1),
      msg('assistant', 'first blended reply', 2),
    ]);
    const out = assembler.compose('hitesh', thread, 'ask-both-keep-going');
    const last = out.messages[out.messages.length - 1];
    expect(last?.content).toContain('Respond with your additional take');
  });

  it('populates OutboundPrompt.meta.estimatedTokens for the blended composition', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('hitesh', thread, 'ask-both-blended');
    expect(out.meta.estimatedTokens).toBeGreaterThan(0);
    expect(out.meta.hasSummary).toBe(false);
    expect(out.meta.hasDriftRefresh).toBe(false);
  });
});
