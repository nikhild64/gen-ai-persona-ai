import { describe, it, expect } from 'vitest';

import gandhiPromptComposition from './gandhi.prompt';

describe('gandhi.prompt (V2 — Latin script guard)', () => {
  const devanagari = /[\u0900-\u097F]/;

  const allStrings = (): string[] => {
    const p = gandhiPromptComposition;
    return [
      p.identityBlock,
      p.voiceRules,
      p.refusalRules,
      p.selfVerificationChecklist,
      p.selfIdentificationResponse,
      p.driftRefresh,
      p.capRefusalTemplate,
      p.quotaExhaustedTemplate,
      p.offDomainTemplate,
      p.politicalTemplate,
      p.adultTemplate,
      p.promptInjectionTemplate,
      p.fabricationBaitTemplate,
      p.hostileUserTemplate,
      p.modelFailureTemplate,
      ...p.fewShots.flatMap((fs) => [fs.user, fs.assistant]),
      ...p.askBothCollabExamples,
    ];
  };

  it('contains zero Devanagari codepoints in any output-facing string', () => {
    for (const s of allStrings()) {
      expect(devanagari.test(s)).toBe(false);
    }
  });

  it('includes explicit SCRIPT rule in voiceRules', () => {
    expect(gandhiPromptComposition.voiceRules).toContain('NEVER emit Devanagari');
  });
});
