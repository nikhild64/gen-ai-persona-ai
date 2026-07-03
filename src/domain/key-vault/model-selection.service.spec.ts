import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ModelSelectionService } from './model-selection.service';

describe('ModelSelectionService', () => {
  const storageKey = 'settings:model-selection:v1';

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('persists model choice to sessionStorage when setModelFor is called', () => {
    const service = new ModelSelectionService();
    service.setModelFor('gemini', 'gemini-2.5-pro');

    const raw = sessionStorage.getItem(storageKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Record<string, string>;
    expect(parsed['gemini']).toBe('gemini-2.5-pro');
  });

  it('restores persisted models on construction', () => {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ gemini: 'gemini-1.5-flash', groq: 'openai/gpt-oss-120b' }),
    );

    const service = new ModelSelectionService();
    expect(service.getModelFor('gemini')).toBe('gemini-1.5-flash');
    expect(service.getModelFor('groq')).toBe('openai/gpt-oss-120b');
  });

  it('reset() writes defaults back to sessionStorage', () => {
    const service = new ModelSelectionService();
    service.setModelFor('groq', 'custom-model');
    service.reset();

    const raw = sessionStorage.getItem(storageKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Record<string, string>;
    expect(parsed['groq']).not.toBe('custom-model');
  });
});
