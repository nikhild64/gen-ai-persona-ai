import { describe, it, expect } from 'vitest';

import { PROVIDER_REGISTRY, getProviderAdapter } from './provider.registry';
import { GeminiAdapter } from './gemini.adapter';
import { GroqAdapter } from './groq.adapter';

describe('PROVIDER_REGISTRY (AD-3)', () => {
  it('registers Gemini + Groq adapter classes', () => {
    expect(PROVIDER_REGISTRY.get('gemini')).toBe(GeminiAdapter);
    expect(PROVIDER_REGISTRY.get('groq')).toBe(GroqAdapter);
  });

  it('getProviderAdapter throws when the id is unknown', () => {
    expect(() =>
      getProviderAdapter('unknown' as unknown as 'gemini'),
    ).toThrowError(/No adapter registered/);
  });
});
