import { describe, it, expect } from 'vitest';

import {
  assistantMessageCount,
  expectedAssistantMessagesForMode,
} from './turn-counting';
import type { Thread, Message } from '../types/message';
import type { PromptMode } from '../prompts/types';

function thread(messages: Message[]): Thread {
  return {
    id: 't',
    scope: 'musk',
    messages,
    rollingSummary: null,
    turnsSinceLastSummary: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}
function u(id: string, text = 'u'): Message {
  return { id, role: 'user', content: text, timestamp: 0 };
}
function a(id: string, text = 'a'): Message {
  return {
    id,
    role: 'assistant',
    persona: 'musk',
    content: text,
    timestamp: 0,
    status: 'complete',
  };
}

describe('assistantMessageCount', () => {
  it('counts only assistant-role messages', () => {
    expect(
      assistantMessageCount(thread([u('1'), a('2'), u('3'), a('4'), a('5')])),
    ).toBe(3);
  });
  it('returns 0 for an empty thread', () => {
    expect(assistantMessageCount(thread([]))).toBe(0);
  });
});

describe('expectedAssistantMessagesForMode', () => {
  it('returns the AD-9-defined counts', () => {
    expect(expectedAssistantMessagesForMode('solo')).toBe(1);
    expect(expectedAssistantMessagesForMode('ask-both-a')).toBe(2);
    expect(expectedAssistantMessagesForMode('ask-both-b')).toBe(0);
    expect(expectedAssistantMessagesForMode('ask-both-keep-going')).toBe(1);
    expect(expectedAssistantMessagesForMode('summarize')).toBe(0);
  });

  it('throws for an invented mode via assertNever', () => {
    expect(() =>
      expectedAssistantMessagesForMode('foo' as unknown as PromptMode),
    ).toThrowError(/Unhandled variant/);
  });
});
