import { describe, it, expect } from 'vitest';

import type {
  ProviderPort,
  ProviderPortAdapterClass,
  ProviderId,
} from './provider.port';
import type { ChatRequest, ChatChunk } from '../types/message';

class MockAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'gemini';
  static readonly KEY_PATTERN = /^AIza[0-9A-Za-z_-]{35}$/;

  async *streamChat(
    _request: ChatRequest,
    _key: string,
    _signal: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    yield { type: 'delta', text: 'hi ' };
    yield { type: 'delta', text: 'there' };
    yield { type: 'done', meta: { tokens: 2 } };
  }
}

describe('ProviderPort', () => {
  it('a mock class implements the interface and can be for-await-iterated', async () => {
    const adapter: ProviderPort = new MockAdapter();
    const chunks: ChatChunk[] = [];
    const controller = new AbortController();
    const req: ChatRequest = {
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'test' }],
    };
    for await (const chunk of adapter.streamChat(
      req,
      'AIza-mock',
      controller.signal,
    )) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(3);
    expect(chunks[2]?.type).toBe('done');
  });

  it('exposes the AD-11 class-side statics via ProviderPortAdapterClass', () => {
    const AdapterCtor: ProviderPortAdapterClass = MockAdapter;
    expect(AdapterCtor.PROVIDER_ID).toBe('gemini');
    expect(AdapterCtor.KEY_PATTERN).toBeInstanceOf(RegExp);
  });
});
