import { describe, it, expect } from 'vitest';

import {
  PROVIDER_DEFAULT_ROUTING,
  ASK_BOTH_SUMMARY_PROVIDER_ID,
} from './provider-registry';

describe('provider-registry (AD-5, AD-9)', () => {
  it('routes Hitesh → gemini and Piyush → groq per AD-5 default', () => {
    expect(PROVIDER_DEFAULT_ROUTING.hitesh).toBe('gemini');
    expect(PROVIDER_DEFAULT_ROUTING.piyush).toBe('groq');
  });

  it('uses gemini for the Ask-Both rolling summary provider (AD-9)', () => {
    expect(ASK_BOTH_SUMMARY_PROVIDER_ID).toBe('gemini');
  });
});
