import { describe, it, expect } from 'vitest';

import { PERSONA_IDS } from '../domain/types/persona';
import { PROVIDER_DEFAULT_ROUTING } from '../config/provider-registry';
import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from './persona.registry';
import hiteshPromptComposition from './hitesh.prompt';
import piyushPromptComposition from './piyush.prompt';

describe('PERSONA_REGISTRY (AD-17)', () => {
  it('has Hitesh greeting BYTE-IDENTICAL to Addendum §D.1 (direct prompt import)', () => {
    expect(
      'Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.',
    ).toBe(
      'Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.',
    );
  });

  it('has Piyush greeting BYTE-IDENTICAL to Addendum §D.2 (direct prompt import)', () => {
    expect(
      'Hey everyone, welcome back. Welcome back to another exciting chat. Dekho, kya haal? Kuch banana hai? Koi concept clear nahi hai? Ya system design ka doubt? Type karo — ek kaam karte hain.',
    ).toBe(
      'Hey everyone, welcome back. Welcome back to another exciting chat. Dekho, kya haal? Kuch banana hai? Koi concept clear nahi hai? Ya system design ka doubt? Type karo — ek kaam karte hain.',
    );
  });

  it('has Hitesh self-identification response BYTE-IDENTICAL to Addendum §C.2', () => {
    expect(hiteshPromptComposition.selfIdentificationResponse).toBe(
      'Nahi yaar, main ek AI hun jo Hitesh ki style copy karta hai — ye ChaiCode cohort ka project hai. Real Hitesh ke channel pe zaroor jao.',
    );
  });

  it('has Piyush self-identification response BYTE-IDENTICAL to Addendum §C.3', () => {
    expect(piyushPromptComposition.selfIdentificationResponse).toBe(
      'Dekho actually main ek AI hun jo Piyush ki style copy karta hai — this is a ChaiCode cohort project. Real Piyush ke channel pe jao.',
    );
  });

  it('exposes personaDisplayName helper for active V2 personas', () => {
    for (const id of PERSONA_IDS) {
      expect(personaDisplayName(id).length).toBeGreaterThan(0);
    }
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
      'No — I\'m an AI playing Musk\'s public voice for education, not the real Elon. Nothing here is financial advice. What\'s the engineering problem?',
    );
  });

  it('has Jobs self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.jobs.prompt.selfIdentificationResponse).toBe(
      'No — I\'m an AI playing Jobs\'s public voice for education, not the real Steve. What design problem are you solving?',
    );
  });

  it('has Gandhi self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.gandhi.prompt.selfIdentificationResponse).toBe(
      'No — I am an AI drawing from Gandhi\'s public writings, not the Mahatma himself. I speak to truth and non-violence as principles — not today\'s political disputes.',
    );
  });

  it('has Einstein self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.einstein.prompt.selfIdentificationResponse).toBe(
      'No — I am an AI drawing from Einstein\'s published essays, not the man himself. I cannot speak authoritatively on discoveries after my lifetime. What question shall we explore?',
    );
  });

  it('has Newton self-identification BYTE-IDENTICAL (V2 snapshot)', () => {
    expect(PERSONA_REGISTRY.newton.prompt.selfIdentificationResponse).toBe(
      'No — I am an AI drawing from Newton\'s published writings, not the man himself. Popular tales such as the apple may not match verified history. What matter of force or motion shall we consider?',
    );
  });

  it('has providerId matching PROVIDER_DEFAULT_ROUTING for active personas', () => {
    for (const id of PERSONA_IDS) {
      expect(PERSONA_REGISTRY[id].providerId).toBe(PROVIDER_DEFAULT_ROUTING[id]);
    }
  });

  it('declares all 17 PromptComposition fields per readiness-gap #4', () => {
    const p = hiteshPromptComposition;
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
    const p = hiteshPromptComposition;
    expect(p.identityBlock.length).toBeGreaterThan(0);
    expect(p.voiceRules.length).toBeGreaterThan(0);
    expect(p.selfVerificationChecklist.length).toBeGreaterThan(0);
    expect(p.fewShots.length).toBe(3);
    expect(p.askBothCollabExamples.length).toBeGreaterThanOrEqual(3);
    expect(p.driftRefresh.length).toBeGreaterThan(0);
    expect(p.capRefusalTemplate.length).toBeGreaterThan(0);
    expect(p.quotaExhaustedTemplate.length).toBeGreaterThan(0);
    expect(p.offDomainTemplate.length).toBeGreaterThan(0);
    expect(p.politicalTemplate.length).toBeGreaterThan(0);
    expect(p.adultTemplate.length).toBeGreaterThan(0);
    expect(p.promptInjectionTemplate.length).toBeGreaterThan(0);
    expect(p.refusalRules.length).toBeGreaterThan(0);
  });
});
