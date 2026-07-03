import { describe, it, expect } from 'vitest';

import { assertNever } from './persona';
import type {
  ChatChunkError,
  ChatChunk,
  ChatError,
  Message,
  Thread,
} from './message';

describe('ChatChunkError', () => {
  it('is exhaustively switchable via assertNever default', () => {
    const label = (err: ChatChunkError): string => {
      switch (err) {
        case 'quota_exhausted':
          return 'quota';
        case 'network_error':
          return 'network';
        case 'moderation_blocked':
          return 'moderation';
        case 'aborted':
          return 'aborted';
        case 'auth_failed':
          return 'auth';
        case 'invalid_request':
          return 'invalid';
        case 'server_error':
          return 'server';
        case 'unknown':
          return 'unknown';
        default:
          return assertNever(err);
      }
    };

    const errors: ChatChunkError[] = [
      'quota_exhausted',
      'network_error',
      'moderation_blocked',
      'aborted',
      'auth_failed',
      'invalid_request',
      'server_error',
      'unknown',
    ];
    errors.forEach((e) => {
      expect(() => label(e)).not.toThrow();
    });
  });
});

describe('Message + Thread structural shape', () => {
  it('allows a Message with role=user without status', () => {
    const m: Message = {
      id: 'x',
      role: 'user',
      content: 'hi',
      timestamp: 1,
    };
    expect(m.role).toBe('user');
  });

  it('allows a Message with role=assistant and status=complete', () => {
    const m: Message = {
      id: 'y',
      role: 'assistant',
      persona: 'hitesh',
      content: 'hello',
      timestamp: 2,
      status: 'complete',
    };
    expect(m.status).toBe('complete');
  });

  it('allows a Thread with rollingSummary=null', () => {
    const t: Thread = {
      id: 't',
      scope: 'hitesh',
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(t.rollingSummary).toBeNull();
  });
});

describe('ChatChunk + ChatError shape', () => {
  it('accepts a delta chunk with text and a done chunk with meta', () => {
    const delta: ChatChunk = { type: 'delta', text: 'foo' };
    const done: ChatChunk = { type: 'done', meta: { tokens: 12 } };
    expect(delta.text).toBe('foo');
    expect(done.meta?.tokens).toBe(12);
  });

  it('carries the closed ChatChunkError union in ChatError.kind', () => {
    const err: ChatError = {
      kind: 'moderation_blocked',
      message: 'blocked',
      retryable: false,
    };
    expect(err.kind).toBe('moderation_blocked');
  });
});
