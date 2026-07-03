import { describe, it, expect } from 'vitest';

import blendedComposition, {
  buildBlendedComposition,
} from './blended.prompt';
import muskPromptComposition from './musk.prompt';
import jobsPromptComposition from './jobs.prompt';

describe('blended.prompt (V2 pair-aware fusion)', () => {
  it('default export is Musk + Jobs pair', () => {
    expect(blendedComposition.attributionLabel).toBe('Musk + Jobs');
    expect(blendedComposition.fewShots.length).toBe(4);
  });

  it('buildBlendedComposition produces dynamic attribution', () => {
    const muskJobs = buildBlendedComposition('musk', 'jobs');
    expect(muskJobs.attributionLabel).toBe('Musk + Jobs');
    expect(muskJobs.fewShots.length).toBe(4);
  });

  it('Musk+Jobs few-shots match V2 subset', () => {
    const pair = buildBlendedComposition('musk', 'jobs');
    expect(pair.fewShots[0]).toBe(muskPromptComposition.fewShots[0]);
    expect(pair.fewShots[1]).toBe(muskPromptComposition.fewShots[1]);
    expect(pair.fewShots[2]).toBe(jobsPromptComposition.fewShots[0]);
    expect(pair.fewShots[3]).toBe(jobsPromptComposition.fewShots[1]);
  });

  it('Gandhi pairs include SCRIPT rule', () => {
    expect(buildBlendedComposition('gandhi', 'einstein').identityBlock).toContain(
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
