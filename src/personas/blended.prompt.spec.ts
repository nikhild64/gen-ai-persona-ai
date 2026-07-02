import { describe, it, expect } from 'vitest';

import blendedComposition from './blended.prompt';
import hiteshPromptComposition from './hitesh.prompt';
import piyushPromptComposition from './piyush.prompt';

describe('blended.prompt (post-sprint Blended Ask-Both fusion composition)', () => {
  it('exports all required composition fields', () => {
    expect(blendedComposition.identityBlock.length).toBeGreaterThan(0);
    expect(blendedComposition.voiceRules.length).toBeGreaterThan(0);
    expect(blendedComposition.refusalRules.length).toBeGreaterThan(0);
    expect(blendedComposition.fewShots.length).toBe(4);
    expect(blendedComposition.selfVerificationChecklist.length).toBeGreaterThan(
      0,
    );
    expect(blendedComposition.voiceReminder.length).toBeGreaterThan(0);
    expect(blendedComposition.attributionLabel.length).toBeGreaterThan(0);
    expect(blendedComposition.moderationFallbackTemplate.length).toBeGreaterThan(
      0,
    );
  });

  it('AC-8: identityBlock includes the SCRIPT rule verbatim (Latin-only enforcement)', () => {
    expect(blendedComposition.identityBlock).toContain(
      'SCRIPT: Roman/Latin transliteration for ALL content',
    );
    expect(blendedComposition.identityBlock).toContain('NEVER emit');
    expect(blendedComposition.identityBlock).toContain('Devanagari');
  });

  it('AC-8: pedagogical Devanagari confined to identityBlock; all other fields Latin-only', () => {
    // Same pattern as Piyush persona: the "write X not Y" teaching block MAY
    // contain Devanagari to show the model what NOT to emit. Every other
    // field must be 100% Latin so nothing accidentally seeds Devanagari
    // production output.
    const devanagari = /[\u0900-\u097F]/;
    expect(devanagari.test(blendedComposition.voiceRules)).toBe(false);
    expect(devanagari.test(blendedComposition.refusalRules)).toBe(false);
    expect(devanagari.test(blendedComposition.selfVerificationChecklist)).toBe(
      false,
    );
    expect(devanagari.test(blendedComposition.voiceReminder)).toBe(false);
    expect(devanagari.test(blendedComposition.moderationFallbackTemplate)).toBe(
      false,
    );
    // Identity block is allowed to contain pedagogical Devanagari
    // ("write dekho not ..."). The critical assertion is the accompanying
    // "NEVER emit Devanagari" clause is present so the model reads the
    // examples as anti-patterns rather than seed data.
    expect(blendedComposition.identityBlock).toContain('NEVER emit');
    expect(blendedComposition.identityBlock).toContain('Devanagari');
  });

  it('AC-3: few-shots are the exact Hitesh Q1+Q3 + Piyush Q2+Q4 subset', () => {
    expect(blendedComposition.fewShots[0]).toBe(
      hiteshPromptComposition.fewShots[0],
    );
    expect(blendedComposition.fewShots[1]).toBe(
      hiteshPromptComposition.fewShots[1],
    );
    expect(blendedComposition.fewShots[2]).toBe(
      piyushPromptComposition.fewShots[0],
    );
    expect(blendedComposition.fewShots[3]).toBe(
      piyushPromptComposition.fewShots[1],
    );
  });

  it('AC-4: attribution label surfaces both mentors (not a single persona name)', () => {
    expect(blendedComposition.attributionLabel).toContain('Hitesh');
    expect(blendedComposition.attributionLabel).toContain('Piyush');
    expect(blendedComposition.attributionLabel).not.toBe('Hitesh');
    expect(blendedComposition.attributionLabel).not.toBe('Piyush');
  });

  it('refusalRules superset protects both creators + prevents fabrication for both', () => {
    expect(blendedComposition.refusalRules).toContain('Hitesh Choudhary');
    expect(blendedComposition.refusalRules).toContain('Piyush Garg');
    expect(blendedComposition.refusalRules).toContain('NEVER fabricate');
    expect(blendedComposition.refusalRules).toContain('AI parody');
  });

  it('voiceRules instruct simultaneous adoption of both persona voices', () => {
    expect(blendedComposition.voiceRules).toContain('BOTH');
    expect(blendedComposition.voiceRules).toContain('simultaneously');
    // The 5-beat teaching structure from the fusion.
    expect(blendedComposition.voiceRules).toContain('Warm hook');
    expect(blendedComposition.voiceRules).toContain('Reductive');
  });
});
