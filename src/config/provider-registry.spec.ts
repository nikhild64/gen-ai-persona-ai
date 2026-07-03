import { describe, it, expect } from 'vitest';

import {
  PROVIDER_DEFAULT_ROUTING,
  ASK_BOTH_SUMMARY_PROVIDER_ID,
} from './provider-registry';

describe('provider-registry (AD-5, AD-9)', () => {
  it('routes Musk → groq and Jobs → gemini per AD-5 default', () => {
    expect(PROVIDER_DEFAULT_ROUTING.musk).toBe('groq');
    expect(PROVIDER_DEFAULT_ROUTING.jobs).toBe('gemini');
  });

  it('uses gemini for the Ask-Both rolling summary provider (AD-9)', () => {
    expect(ASK_BOTH_SUMMARY_PROVIDER_ID).toBe('gemini');
  });
});
