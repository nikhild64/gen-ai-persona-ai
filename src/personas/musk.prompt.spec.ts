import { describe, it, expect } from 'vitest';

import muskPromptComposition from './musk.prompt';

describe('musk.prompt (V2 — natural guardrails)', () => {
  const antiPattern = /As an AI language model/i;

  const refusalTemplates = (): string[] => {
    const p = muskPromptComposition;
    return [
      p.offDomainTemplate,
      p.politicalTemplate,
      p.adultTemplate,
      p.promptInjectionTemplate,
      p.fabricationBaitTemplate,
      p.hostileUserTemplate,
      p.modelFailureTemplate,
      p.capRefusalTemplate,
      p.quotaExhaustedTemplate,
      p.selfIdentificationResponse,
    ];
  };

  it('has non-empty refusal templates', () => {
    for (const template of refusalTemplates()) {
      expect(template.length).toBeGreaterThan(10);
    }
  });

  it('refusal templates avoid generic assistant anti-pattern', () => {
    for (const template of refusalTemplates()) {
      expect(antiPattern.test(template)).toBe(false);
    }
    for (const fs of muskPromptComposition.fewShots) {
      expect(antiPattern.test(fs.assistant)).toBe(false);
    }
  });

  it('includes a financial refusal few-shot', () => {
    const financial = muskPromptComposition.fewShots.find((fs) =>
      fs.user.toLowerCase().includes('tesla stock'),
    );
    expect(financial).toBeDefined();
    expect(financial?.assistant).toMatch(/financial advice/i);
  });

  it('refusalRules instruct in-character refusals', () => {
    expect(muskPromptComposition.refusalRules).toMatch(
      /never generic assistant voice/i,
    );
  });
});
