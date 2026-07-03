import { describe, expect, it } from 'vitest';

import {
  BUILD_TIME_GEMINI_API_KEY,
  BUILD_TIME_GEMINI_MODEL,
  BUILD_TIME_GROQ_API_KEY,
  BUILD_TIME_GROQ_MODEL,
  buildTimeKeyForProvider,
  buildTimeModelForProvider,
} from './build-env-config';
import { PROVIDER_DEFAULT_MODELS } from './provider-registry';

describe('build-env-config', () => {
  it('exposes build-time keys and models from NG_APP_* env', () => {
    expect(buildTimeKeyForProvider('gemini')).toBe(BUILD_TIME_GEMINI_API_KEY);
    expect(buildTimeKeyForProvider('groq')).toBe(BUILD_TIME_GROQ_API_KEY);
    expect(buildTimeModelForProvider('gemini')).toBe(
      BUILD_TIME_GEMINI_MODEL ?? PROVIDER_DEFAULT_MODELS.gemini,
    );
    expect(buildTimeModelForProvider('groq')).toBe(
      BUILD_TIME_GROQ_MODEL ?? PROVIDER_DEFAULT_MODELS.groq,
    );
  });

  it('model helper always returns a non-empty string', () => {
    expect(buildTimeModelForProvider('gemini').length).toBeGreaterThan(0);
    expect(buildTimeModelForProvider('groq').length).toBeGreaterThan(0);
  });
});
