import { describe, it, expect } from 'vitest';

import { PERSONA_MODEL_PARAMS } from './model-params';
import { PERSONA_IDS } from '../domain/types/persona';

describe('model-params (V2)', () => {
  it('populates Musk Groq params', () => {
    const p = PERSONA_MODEL_PARAMS.musk;
    expect(p.modelName).toBe('openai/gpt-oss-120b');
    expect(p.temperature).toBe(0.7);
  });

  it('populates Jobs Gemini params', () => {
    const p = PERSONA_MODEL_PARAMS.jobs;
    expect(p.modelName).toBe('gemini-3.1-flash-lite');
    expect(p.temperature).toBe(0.55);
  });

  it('defines params for every active persona', () => {
    for (const id of PERSONA_IDS) {
      expect(PERSONA_MODEL_PARAMS[id].modelName.length).toBeGreaterThan(0);
      expect(PERSONA_MODEL_PARAMS[id].maxOutputTokens).toBe(500);
    }
  });
});
