import { describe, it, expect } from 'vitest';

import { assertNever } from '../types/persona';
import type { PromptMode, OutboundPrompt } from './types';

describe('PromptMode', () => {
  it('is exhaustively switchable via assertNever default', () => {
    const label = (mode: PromptMode): string => {
      switch (mode) {
        case 'solo':
          return 'solo';
        case 'ask-both-a':
          return 'aba';
        case 'ask-both-b':
          return 'abb';
        case 'ask-both-keep-going':
          return 'keep';
        case 'summarize':
          return 'sum';
        default:
          return assertNever(mode);
      }
    };

    const modes: PromptMode[] = [
      'solo',
      'ask-both-a',
      'ask-both-b',
      'ask-both-keep-going',
      'summarize',
    ];
    modes.forEach((m) => expect(() => label(m)).not.toThrow());
  });
});

describe('OutboundPrompt shape', () => {
  it('extends ChatRequest with a meta block', () => {
    const p: OutboundPrompt = {
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'hi' }],
      meta: {
        mode: 'solo',
        hasSummary: false,
        hasDriftRefresh: false,
        estimatedTokens: 42,
      },
    };
    expect(p.meta.mode).toBe('solo');
    expect(p.messages).toHaveLength(1);
  });
});
