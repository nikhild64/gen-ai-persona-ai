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

  it('has providerId matching PROVIDER_DEFAULT_ROUTING', () => {
    expect(PERSONA_REGISTRY.hitesh.providerId).toBe(
      PROVIDER_DEFAULT_ROUTING.hitesh,
    );
    expect(PERSONA_REGISTRY.piyush.providerId).toBe(
      PROVIDER_DEFAULT_ROUTING.piyush,
    );
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

  it('exposes personaDisplayName helper', () => {
    expect(personaDisplayName('hitesh')).toBe('Hitesh');
    expect(personaDisplayName('piyush')).toBe('Piyush');
  });
});
