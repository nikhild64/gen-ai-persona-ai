import { describe, it, expect } from 'vitest';

import blendedComposition, {
  buildBlendedComposition,
} from './blended.prompt';
import hiteshPromptComposition from './hitesh.prompt';
import piyushPromptComposition from './piyush.prompt';

describe('blended.prompt (V2 pair-aware fusion)', () => {
  it('default export is Hitesh + Piyush pair', () => {
    expect(blendedComposition.attributionLabel).toBe('Hitesh + Piyush');
    expect(blendedComposition.fewShots.length).toBe(4);
  });

  it('buildBlendedComposition produces dynamic attribution', () => {
    const muskJobs = buildBlendedComposition('musk', 'jobs');
    expect(muskJobs.attributionLabel).toBe('Musk + Jobs');
    expect(muskJobs.fewShots.length).toBe(4);
  });

  it('Hitesh+Piyush few-shots match legacy subset', () => {
    const pair = buildBlendedComposition('hitesh', 'piyush');
    expect(pair.fewShots[0]).toBe(hiteshPromptComposition.fewShots[0]);
    expect(pair.fewShots[1]).toBe(hiteshPromptComposition.fewShots[1]);
    expect(pair.fewShots[2]).toBe(piyushPromptComposition.fewShots[0]);
    expect(pair.fewShots[3]).toBe(piyushPromptComposition.fewShots[1]);
  });

  it('Hinglish pairs include SCRIPT rule', () => {
    expect(buildBlendedComposition('hitesh', 'piyush').identityBlock).toContain(
      'NEVER emit Devanagari',
    );
  });

  it('English pairs omit Devanagari in all fields', () => {
    const devanagari = /[\u0900-\u097F]/;
    const muskJobs = buildBlendedComposition('musk', 'jobs');
    expect(devanagari.test(muskJobs.identityBlock)).toBe(false);
    expect(devanagari.test(muskJobs.voiceRules)).toBe(false);
  });
});
