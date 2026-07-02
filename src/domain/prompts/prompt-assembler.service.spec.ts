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

  it('returns 2 messages (system + user) and wraps current user message in XML delimiters', () => {
    const thread = threadFrom([msg('user', 'hello', 1)]);
    const out = assembler.compose('hitesh', thread, 'solo');
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]?.role).toBe('system');
    expect(out.messages[1]?.role).toBe('user');
    expect(out.messages[1]?.content).toBe(
      '<user_message>hello</user_message>',
    );
  });

  it('sources model + params from PERSONA_MODEL_PARAMS (Hitesh → gemini)', () => {
    const out = assembler.compose('hitesh', threadFrom([]), 'solo');
    expect(out.model).toBe('gemini-2.5-flash');
    expect(out.temperature).toBe(0.75);
    expect(out.topP).toBe(0.95);
    expect(out.maxOutputTokens).toBe(1200);
    expect(out.frequencyPenalty).toBe(0.2);
    expect(out.presencePenalty).toBe(0.3);
  });

  it('sources model + params from PERSONA_MODEL_PARAMS (Piyush → groq)', () => {
    const out = assembler.compose('piyush', threadFrom([]), 'solo');
    expect(out.model).toBe('openai/gpt-oss-120b');
    expect(out.temperature).toBe(0.55);
    expect(out.topP).toBe(0.9);
    expect(out.maxOutputTokens).toBe(1000);
  });

  it('populates OutboundPrompt.meta correctly for a fresh thread', () => {
    const out = assembler.compose('hitesh', threadFrom([]), 'solo');
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
    const out = assembler.compose('hitesh', thread, 'solo');
    const system = out.messages[0]?.content ?? '';
    expect(system).toContain('PRIOR SUMMARY OF 12 TURNS');
    // Tail is last 8 messages excluding the current user (which is message index 19)
    expect(system).toContain('m-11');
    expect(system).toContain('m-18');
    expect(system).not.toContain('m-10');
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
