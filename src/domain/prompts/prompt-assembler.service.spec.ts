import { describe, it, expect } from 'vitest';

import { PromptAssembler } from './prompt-assembler.service';
import type { PromptMode } from './types';
import type { Thread, Message } from '../types/message';

function threadFrom(messages: Message[]): Thread {
  return {
    id: 't-test',
    scope: 'musk',
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
    ...(role === 'assistant' ? { status: 'complete', persona: 'musk' } : {}),
  } as Message;
}

describe('PromptAssembler solo mode', () => {
  const assembler = new PromptAssembler();

  it('returns 2 messages (system + user) and wraps current user message in XML delimiters', () => {
    const thread = threadFrom([msg('user', 'hello', 1)]);
    const out = assembler.compose('musk', thread, 'solo');
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[1]?.role).toBe('user');
    expect(out.messages[1]?.content).toBe(
      '<user_message>hello</user_message>',
    );
  });

  it('sources model + params from PERSONA_MODEL_PARAMS (Musk → groq)', () => {
    const out = assembler.compose('musk', threadFrom([]), 'solo');
    expect(out.model).toBe('openai/gpt-oss-120b');
    expect(out.temperature).toBe(0.7);
    expect(out.topP).toBe(0.9);
    expect(out.maxOutputTokens).toBe(500);
    expect(out.frequencyPenalty).toBe(0.1);
    expect(out.presencePenalty).toBe(0.15);
  });

  it('sources model + params from PERSONA_MODEL_PARAMS (Jobs → gemini)', () => {
    const out = assembler.compose('jobs', threadFrom([]), 'solo');
    expect(out.model).toBe('gemini-2.5-flash');
    expect(out.temperature).toBe(0.55);
    expect(out.topP).toBe(0.92);
    expect(out.maxOutputTokens).toBe(500);
  });

  it('populates OutboundPrompt.meta correctly for a fresh thread', () => {
    const out = assembler.compose('musk', threadFrom([]), 'solo');
    expect(out.meta.mode).toBe('solo');
    expect(out.meta.hasSummary).toBe(false);
    expect(out.meta.hasDriftRefresh).toBe(false);
    expect(out.meta.estimatedTokens).toBeGreaterThan(0);
  });

  it('injects rolling summary + last-8 verbatim tail when thread is long', () => {
    const messages: Message[] = [];
    for (let i = 0; i < 20; i += 1) {
      messages.push(msg(i % 2 === 0 ? 'user' : 'assistant', `m-${i}`, i));
    }
    const thread: Thread = {
      ...threadFrom(messages),
      rollingSummary: 'PRIOR SUMMARY OF 12 TURNS',
    };
    const out = assembler.compose('musk', thread, 'solo');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('PRIOR SUMMARY OF 12 TURNS');
    expect(system).toContain('m-11');
    expect(system).toContain('m-18');
    expect(system).not.toContain('m-10');
  });

  it('embeds fewShots block from persona registry', () => {
    const out = assembler.compose('musk', threadFrom([]), 'solo');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('FEW-SHOT EXAMPLES');
    expect(system).toContain('electric cars still so expensive');
  });

  it('reports hasSummary=true when thread.rollingSummary is set', () => {
    const thread: Thread = {
      ...threadFrom([msg('user', 'q', 1)]),
      rollingSummary: 'summary',
    };
    const out = assembler.compose('musk', thread, 'solo');
    expect(out.meta.hasSummary).toBe(true);
  });

  it('composes a valid summarize prompt (E5-S2 real impl)', () => {
    const thread = threadFrom([msg('user', 'first', 1), msg('assistant', 'reply', 2)]);
    const out = assembler.compose('musk', thread, 'summarize');
    expect(out.meta.mode).toBe('summarize');
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[0]?.content).toContain('Compress');
    expect(out.temperature).toBe(0.2);
  });

  it('composes a valid ask-both-a prompt (E9-S2 real impl)', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('musk', thread, 'ask-both-a');
    expect(out.meta.mode).toBe('ask-both-a');
  });

  it('assertNever fires runtime on an invented mode', () => {
    const thread = threadFrom([]);
    expect(() =>
      assembler.compose('musk', thread, 'foo' as unknown as PromptMode),
    ).toThrowError(/Unhandled variant/);
  });
});

describe('PromptAssembler ask-both-blended mode (post-sprint)', () => {
  const assembler = new PromptAssembler();

  it('AC-3: returns exactly one system + one user message; user wrapped in <user_message>', () => {
    const thread = threadFrom([msg('user', 'how do rockets work?', 1)]);
    const out = assembler.compose('musk', thread, 'ask-both-blended');
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[1]?.role).toBe('user');
    expect(out.messages[1]?.content).toBe(
      '<user_message>how do rockets work?</user_message>',
    );
    expect(out.meta.mode).toBe('ask-both-blended');
  });

  it('AC-3: system block preserves AD-8 9-block order sourced from blended composition', () => {
    const thread = threadFrom([msg('user', 'hi', 1)]);
    const out = assembler.compose('musk', thread, 'ask-both-blended');
    const system = out.messages[0]?.content ?? '';

    const indices = {
      identity: system.indexOf('FUSED VOICE'),
      voice: system.indexOf('VOICE RULES'),
      refusal: system.indexOf('REFUSAL RULES:'),
      fewShots: system.indexOf('FEW-SHOT EXAMPLES'),
      reminder: system.indexOf('REPEAT CRITICAL RULES'),
      summary: system.indexOf('ROLLING SUMMARY'),
      tail: system.indexOf('VERBATIM TAIL'),
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
    expect(indices.summary).toBeLessThan(indices.tail);
    expect(indices.tail).toBeLessThan(indices.selfCheck);
  });

  it('AC-8: fusion identityBlock includes the SCRIPT rule when Gandhi is in pair', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('musk', thread, 'ask-both-blended', {
      blendedPair: { a: 'musk', b: 'gandhi' },
    });
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('SCRIPT: Roman/Latin transliteration');
    expect(system).toContain('NEVER emit Devanagari');
    const identityStart = system.indexOf('FUSED VOICE');
    const identityEnd = system.indexOf('VOICE RULES');
    const beforeIdentity = system.slice(0, identityStart);
    const afterIdentity = system.slice(identityEnd);
    const devanagari = /[\u0900-\u097F]/;
    expect(devanagari.test(beforeIdentity)).toBe(false);
    expect(devanagari.test(afterIdentity)).toBe(false);
  });

  it('AC-3: few-shots are Musk Q1+Q2 + Jobs Q1+Q2 (default musk+jobs pair)', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('musk', thread, 'ask-both-blended');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('electric cars still so expensive');
    expect(system).toContain('learn to code or just focus on AI prompts');
    expect(system).toContain('right career');
    expect(system).toContain('too many features and users are confused');
  });

  it('AC-5: keep-going path synthesises a "continue" user message when last thread msg is assistant', () => {
    const thread = threadFrom([
      msg('user', 'original question', 1),
      msg('assistant', 'first blended reply', 2),
    ]);
    const out = assembler.compose('musk', thread, 'ask-both-blended');
    const userMsg = out.messages[1]?.content ?? '';
    expect(userMsg).toContain('Continue this Blended discussion');
    expect(userMsg).toContain('fresh angle');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('first blended reply');
  });

  it('populates OutboundPrompt.meta.estimatedTokens for the blended composition', () => {
    const thread = threadFrom([msg('user', 'q', 1)]);
    const out = assembler.compose('musk', thread, 'ask-both-blended');
    expect(out.meta.estimatedTokens).toBeGreaterThan(0);
    expect(out.meta.hasSummary).toBe(false);
    expect(out.meta.hasDriftRefresh).toBe(false);
  });
});
