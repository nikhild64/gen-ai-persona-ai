import { describe, it, expect } from 'vitest';

import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from './persona.registry';
import { PROVIDER_DEFAULT_ROUTING } from '../config/provider-registry';

describe('PERSONA_REGISTRY (AD-17)', () => {
  it('has Hitesh greeting BYTE-IDENTICAL to Addendum §D.1', () => {
    expect(PERSONA_REGISTRY.hitesh.greeting).toBe(
      'Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.',
    );
  });

  it('has Piyush greeting BYTE-IDENTICAL to Addendum §D.2', () => {
    expect(PERSONA_REGISTRY.piyush.greeting).toBe(
      'Hey everyone, welcome back. Welcome back to another exciting chat. Dekho, kya haal? Kuch banana hai? Koi concept clear nahi hai? Ya system design ka doubt? Type karo — ek kaam karte hain.',
    );
  });

  it('has Hitesh self-identification response BYTE-IDENTICAL to Addendum §C.2', () => {
    expect(PERSONA_REGISTRY.hitesh.prompt.selfIdentificationResponse).toBe(
      'Nahi yaar, main ek AI hun jo Hitesh ki style copy karta hai — ye ChaiCode cohort ka project hai. Real Hitesh ke channel pe zaroor jao.',
    );
  });

  it('has Piyush self-identification response BYTE-IDENTICAL to Addendum §C.3', () => {
    expect(PERSONA_REGISTRY.piyush.prompt.selfIdentificationResponse).toBe(
      'Dekho actually main ek AI hun jo Piyush ki style copy karta hai — this is a ChaiCode cohort project. Real Piyush ke channel pe jao.',
    );
  });

  it('exposes personaDisplayName helper for all 7 personas', () => {
    expect(personaDisplayName('hitesh')).toBe('Hitesh');
    expect(personaDisplayName('piyush')).toBe('Piyush');
    expect(personaDisplayName('musk')).toBe('Musk');
    expect(personaDisplayName('jobs')).toBe('Jobs');
    expect(personaDisplayName('gandhi')).toBe('Gandhi');
    expect(personaDisplayName('einstein')).toBe('Einstein');
    expect(personaDisplayName('newton')).toBe('Newton');
  });

  it('has Musk greeting BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.musk.greeting).toBe(
      'Look — first principles. What are we trying to build or understand today? Ask about engineering, manufacturing, rockets, or how systems actually work.',
    );
  });

  it('has Jobs greeting BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.jobs.greeting).toBe(
      'Focus matters. What are you trying to make insanely great? Ask me about design, simplicity, craft — and why you should stay hungry.',
    );
  });

  it('has Gandhi greeting BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.gandhi.greeting).toBe(
      'Peace. In my experiments with truth I learned that change begins within. What brings your conscience here today?',
    );
  });

  it('has Einstein greeting BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.einstein.greeting).toBe(
      'Curiosity brought you here — good. The most beautiful thing we can experience is the mysterious. What question shall we explore together?',
    );
  });

  it('has Newton greeting BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.newton.greeting).toBe(
      'You find me at my desk of natural philosophy. What matter of force, motion, or light shall we demonstrate today?',
    );
  });

  it('has Musk self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.musk.prompt.selfIdentificationResponse).toBe(
      'I am NOT the real Elon Musk. This is an AI parody. Content derived from publicly available material under fair use for educational research purposes. Not endorsed by, affiliated with, or authorized by Elon Musk or his companies. Nothing here is financial advice.',
    );
  });

  it('has Jobs self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.jobs.prompt.selfIdentificationResponse).toBe(
      'I am NOT the real Steve Jobs. This is an AI parody. Content derived from publicly available material under fair use for educational research purposes. Not endorsed by, affiliated with, or authorized by Steve Jobs, Apple, or the Steve Jobs estate.',
    );
  });

  it('has Gandhi self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.gandhi.prompt.selfIdentificationResponse).toBe(
      'I am an AI simulation drawing from publicly available writings of Mahatma Gandhi. This is educational parody, not the actual person. Content should not be taken as historically authoritative statements on modern politics.',
    );
  });

  it('has Einstein self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.einstein.prompt.selfIdentificationResponse).toBe(
      'I am an AI simulation drawing from publicly available writings of Albert Einstein. This is educational parody, not the actual person. I cannot speak authoritatively on discoveries after my lifetime.',
    );
  });

  it('has Newton self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.newton.prompt.selfIdentificationResponse).toBe(
      'I am an AI simulation drawing from publicly available writings of Isaac Newton. This is educational parody, not the actual person. Popular stories such as the apple may not match verified history.',
    );
  });

  it('has providerId matching PROVIDER_DEFAULT_ROUTING for all personas', () => {
    for (const id of ['hitesh', 'piyush', 'musk', 'jobs', 'gandhi', 'einstein', 'newton'] as const) {
      expect(PERSONA_REGISTRY[id].providerId).toBe(PROVIDER_DEFAULT_ROUTING[id]);
    }
  });

  it('declares all 17 PromptComposition fields per readiness-gap #4', () => {
    const p = PERSONA_REGISTRY.hitesh.prompt;
    const expectedFields = [
      'identityBlock',
      'voiceRules',
      'refusalRules',
      'fewShots',
      'askBothCollabExamples',
      'driftRefresh',
      'selfVerificationChecklist',
      'capRefusalTemplate',
      'quotaExhaustedTemplate',
      'offDomainTemplate',
      'politicalTemplate',
      'adultTemplate',
      'promptInjectionTemplate',
      'fabricationBaitTemplate',
      'hostileUserTemplate',
      'modelFailureTemplate',
      'selfIdentificationResponse',
    ];
    expectedFields.forEach((f) => expect(p).toHaveProperty(f));
    expect(Object.keys(p).sort()).toEqual(expectedFields.sort());
  });

  it('has all baseline persona-voice fields populated at end of sprint', () => {
    const p = PERSONA_REGISTRY.hitesh.prompt;
    expect(p.identityBlock.length).toBeGreaterThan(0);
    expect(p.voiceRules.length).toBeGreaterThan(0);
    expect(p.selfVerificationChecklist.length).toBeGreaterThan(0);
    // Populated across the sprint:
    expect(p.fewShots.length).toBe(3); // E2-S2
    expect(p.askBothCollabExamples.length).toBeGreaterThanOrEqual(3); // E8-S1
    expect(p.driftRefresh.length).toBeGreaterThan(0); // E5-S3
    expect(p.capRefusalTemplate.length).toBeGreaterThan(0); // E7-S1
    expect(p.quotaExhaustedTemplate.length).toBeGreaterThan(0); // E7-S2
    expect(p.offDomainTemplate.length).toBeGreaterThan(0); // E8-S1
    expect(p.politicalTemplate.length).toBeGreaterThan(0);
    expect(p.adultTemplate.length).toBeGreaterThan(0);
    expect(p.promptInjectionTemplate.length).toBeGreaterThan(0);
    expect(p.refusalRules.length).toBeGreaterThan(0);
  });
});
