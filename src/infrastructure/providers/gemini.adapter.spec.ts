import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GeminiAdapter } from './gemini.adapter';
import type { ChatChunk, ChatRequest } from '../../domain/types/message';

function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  });
}

// Google API-key format: `AIza` + 35 base64-url-ish chars = 39 total.
const validKey = 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLan_Ps6U0uAis';

describe('GeminiAdapter static contract', () => {
  it('exposes AD-3 PROVIDER_ID and AD-11 KEY_PATTERN', () => {
    expect(GeminiAdapter.PROVIDER_ID).toBe('gemini');
    expect(GeminiAdapter.KEY_PATTERN.test(validKey)).toBe(true);
    expect(GeminiAdapter.KEY_PATTERN.test('AIza-too-short')).toBe(false);
    expect(GeminiAdapter.KEY_PATTERN.test('gsk_wrong-provider')).toBe(false);
  });
});

describe('GeminiAdapter.streamChat', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => vi.restoreAllMocks());

  const request: ChatRequest = {
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: 'Hi' }],
    temperature: 0.7,
  };

  it('yields delta chunks then a done chunk on a happy 200 SSE stream', async () => {
    const body = makeSseStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"world"}]}}],"usageMetadata":{"totalTokenCount":5}}\n\n',
    ]);
    fetchSpy.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const adapter = new GeminiAdapter();
    const out: ChatChunk[] = [];
    for await (const c of adapter.streamChat(
      request,
      validKey,
      new AbortController().signal,
    )) {
      out.push(c);
    }
    const deltas = out.filter((c) => c.type === 'delta');
    expect(deltas.map((c) => c.text).join('')).toBe('Hello world');
    const done = out.find((c) => c.type === 'done');
    expect(done?.meta?.tokens).toBe(5);
    expect(done?.meta?.model).toBe('gemini-2.5-flash');
  });

  it('maps HTTP 429 to quota_exhausted with retryable=true', async () => {
    fetchSpy.mockResolvedValue(
      new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '30' },
      }),
    );
    const adapter = new GeminiAdapter();
    const [chunk] = await collect(
      adapter.streamChat(request, validKey, new AbortController().signal),
    );
    expect(chunk.type).toBe('error');
    expect(chunk.meta?.error).toBe('quota_exhausted');
    expect(chunk.meta?.retryable).toBe(true);
    expect(chunk.meta?.retryAfterSec).toBe(30);
  });

  it('maps HTTP 401 to auth_failed non-retryable', async () => {
    fetchSpy.mockResolvedValue(new Response('bad key', { status: 401 }));
    const adapter = new GeminiAdapter();
    const [chunk] = await collect(
      adapter.streamChat(request, validKey, new AbortController().signal),
    );
    expect(chunk.meta?.error).toBe('auth_failed');
    expect(chunk.meta?.retryable).toBe(false);
  });

  it('emits aborted when the AbortSignal fires before fetch resolves', async () => {
    const controller = new AbortController();
    fetchSpy.mockImplementation(() =>
      Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    );
    controller.abort();
    const [chunk] = await collect(
      new GeminiAdapter().streamChat(request, validKey, controller.signal),
    );
    expect(chunk.meta?.error).toBe('aborted');
    expect(chunk.meta?.retryable).toBe(false);
  });
});

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}
