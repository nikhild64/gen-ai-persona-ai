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
      'Hey everyone, welcome back. Welcome back to another exciting chat. देखो, kya haal? कुछ बनाना है? कोई concept clear नहीं है? या system design का doubt? Type करो — एक काम करते हैं.',
    );
  });

  it('has Hitesh self-identification response BYTE-IDENTICAL to Addendum §C.2', () => {
    expect(PERSONA_REGISTRY.hitesh.prompt.selfIdentificationResponse).toBe(
      'Nahi yaar, main ek AI hun jo Hitesh ki style copy karta hai — ye ChaiCode cohort ka project hai. Real Hitesh ke channel pe zaroor jao.',
    );
  });

  it('has Piyush self-identification response BYTE-IDENTICAL to Addendum §C.3', () => {
    expect(PERSONA_REGISTRY.piyush.prompt.selfIdentificationResponse).toBe(
      'देखो actually मैं एक AI हूं जो Piyush की style copy करता है — this is a ChaiCode cohort project. Real Piyush के channel पे जाओ.',
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

  it('leaves E0-S3 skeleton placeholders empty until later stories populate', () => {
    const p = PERSONA_REGISTRY.hitesh.prompt;
    expect(p.identityBlock.length).toBeGreaterThan(0);
    expect(p.voiceRules.length).toBeGreaterThan(0);
    expect(p.selfVerificationChecklist.length).toBeGreaterThan(0);
    expect(p.fewShots).toEqual([]);
    expect(p.askBothCollabExamples).toEqual([]);
    expect(p.driftRefresh).toBe('');
    expect(p.capRefusalTemplate).toBe('');
    expect(p.quotaExhaustedTemplate).toBe('');
    expect(p.offDomainTemplate).toBe('');
    expect(p.politicalTemplate).toBe('');
    expect(p.adultTemplate).toBe('');
    expect(p.promptInjectionTemplate).toBe('');
  });

  it('exposes personaDisplayName helper', () => {
    expect(personaDisplayName('hitesh')).toBe('Hitesh');
    expect(personaDisplayName('piyush')).toBe('Piyush');
  });
});
