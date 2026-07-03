import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GroqAdapter } from './groq.adapter';
import type { ChatChunk, ChatRequest } from '../../domain/types/message';

const validKey = 'gsk_' + 'A'.repeat(52);

function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  });
}

describe('GroqAdapter static contract', () => {
  it('exposes PROVIDER_ID and KEY_PATTERN per AD-3/AD-11', () => {
    expect(GroqAdapter.PROVIDER_ID).toBe('groq');
    expect(GroqAdapter.KEY_PATTERN.test(validKey)).toBe(true);
    expect(GroqAdapter.KEY_PATTERN.test('AIza-not-groq')).toBe(false);
  });
});

describe('GroqAdapter.streamChat', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => vi.restoreAllMocks());

  const request: ChatRequest = {
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: 'Hi' }],
  };

  it('parses OpenAI-compatible SSE deltas', async () => {
    const body = makeSseStream([
      'data: {"choices":[{"delta":{"content":"Hey "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"there"}}]}\n\n',
      'data: {"x_groq":{"usage":{"total_tokens":7}}}\n\n',
      'data: [DONE]\n\n',
    ]);
    fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));
    const out: ChatChunk[] = [];
    for await (const c of new GroqAdapter().streamChat(
      request,
      validKey,
      new AbortController().signal,
    )) {
      out.push(c);
    }
    const deltas = out.filter((c) => c.type === 'delta');
    expect(deltas.map((c) => c.text).join('')).toBe('Hey there');
    const done = out.find((c) => c.type === 'done');
    expect(done?.meta?.tokens).toBe(7);
  });

  it('emits invalid_request on HTTP 400', async () => {
    fetchSpy.mockResolvedValue(new Response('bad', { status: 400 }));
    const [chunk] = await collect(
      new GroqAdapter().streamChat(
        request,
        validKey,
        new AbortController().signal,
      ),
    );
    expect(chunk.meta?.error).toBe('invalid_request');
    expect(chunk.meta?.retryable).toBe(false);
  });

  it('emits server_error retryable on HTTP 5xx', async () => {
    fetchSpy.mockResolvedValue(new Response('oops', { status: 503 }));
    const [chunk] = await collect(
      new GroqAdapter().streamChat(
        request,
        validKey,
        new AbortController().signal,
      ),
    );
    expect(chunk.meta?.error).toBe('server_error');
    expect(chunk.meta?.retryable).toBe(true);
  });
});

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}
