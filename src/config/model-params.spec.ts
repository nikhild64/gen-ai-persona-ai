import { describe, it, expect } from 'vitest';

import { PERSONA_MODEL_PARAMS } from './model-params';

describe('model-params (Addendum §B.4)', () => {
  it('populates Hitesh Gemini params exactly per §B.4', () => {
    const p = PERSONA_MODEL_PARAMS.hitesh;
    expect(p.modelName).toBe('gemini-2.5-flash');
    expect(p.temperature).toBe(0.75);
    expect(p.topP).toBe(0.95);
    expect(p.maxOutputTokens).toBe(1200);
    expect(p.frequencyPenalty).toBe(0.2);
    expect(p.presencePenalty).toBe(0.3);
  });

  it('populates Piyush Groq params exactly per §B.4 (low penalties intentional)', () => {
    const p = PERSONA_MODEL_PARAMS.piyush;
    expect(p.modelName).toBe('openai/gpt-oss-120b');
    expect(p.temperature).toBe(0.55);
    expect(p.topP).toBe(0.9);
    expect(p.maxOutputTokens).toBe(1000);
    expect(p.frequencyPenalty).toBe(0.05);
    expect(p.presencePenalty).toBe(0.1);
  });
});
