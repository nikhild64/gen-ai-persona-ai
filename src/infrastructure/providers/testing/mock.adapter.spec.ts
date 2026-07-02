import { describe, it, expect } from 'vitest';

import { MockAdapter } from './mock.adapter';
import type { ChatChunk, ChatRequest } from '../../../domain/types/message';

const request: ChatRequest = {
  model: 'mock',
  messages: [{ role: 'user', content: 'hi' }],
};

describe('MockAdapter', () => {
  it('yields the scripted chunks in order', async () => {
    const script: ChatChunk[] = [
      { type: 'delta', text: 'Hi ' },
      { type: 'delta', text: 'there' },
      { type: 'done', meta: { tokens: 2, model: 'mock' } },
    ];
    const adapter = new MockAdapter().configure(script, 0);
    const out: ChatChunk[] = [];
    for await (const c of adapter.streamChat(
      request,
      'irrelevant',
      new AbortController().signal,
    )) {
      out.push(c);
    }
    expect(out).toEqual(script);
  });

  it('emits an aborted error when signal is pre-aborted', async () => {
    const adapter = new MockAdapter().configure(
      [{ type: 'delta', text: 'a' }],
      5,
    );
    const controller = new AbortController();
    controller.abort();
    const out: ChatChunk[] = [];
    for await (const c of adapter.streamChat(
      request,
      'k',
      controller.signal,
    )) {
      out.push(c);
    }
    expect(out).toEqual([
      { type: 'error', meta: { error: 'aborted', retryable: false } },
    ]);
  });
});
