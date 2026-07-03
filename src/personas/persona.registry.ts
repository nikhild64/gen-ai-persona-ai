import type { PersonaId } from '../domain/types/persona';
import type { ProviderId } from '../config/provider-registry';
import { PROVIDER_DEFAULT_ROUTING } from '../config/provider-registry';
import hiteshPromptComposition from './hitesh.prompt';
import piyushPromptComposition from './piyush.prompt';

/**
 * FULL shape declared here per readiness-gap #4 consolidation (see
 * sprint-status.yaml.deferred_readiness_gaps.gap_4). Every downstream story
 * POPULATES fields in `hitesh.prompt.ts` + `piyush.prompt.ts`; NONE re-declare
 * this type or `PERSONA_REGISTRY`.
 *
 * Population owners:
 *   identityBlock            — E0-S3 (this story, from Addendum §C.2/§C.3)
 *   voiceRules               — E0-S3 (this story)
 *   selfVerificationChecklist — E0-S3 (this story, from Addendum §C.5)
 *   selfIdentificationResponse — E0-S3 (this story, BYTE-IDENTICAL, snapshot-tested in E8-S1)
 *   fewShots                 — E2-S2 (3 per persona from research §C.3)
 *   driftRefresh             — E5-S3 (Addendum §C.4)
 *   capRefusalTemplate       — E7-S1 (Addendum §E)
 *   quotaExhaustedTemplate   — E7-S2 (Addendum §E)
 *   refusalRules             — E8-S1
 *   askBothCollabExamples    — E8-S1 (Addendum §E.3)
 *   offDomainTemplate        — E8-S2
 *   politicalTemplate        — E8-S2
 *   adultTemplate            — E8-S2
 *   promptInjectionTemplate  — E8-S2
 *   fabricationBaitTemplate  — E8-S1 / E8-S2
 *   hostileUserTemplate      — E8-S1 / E8-S2
 *   modelFailureTemplate     — E8-S1 / E8-S2
 */
export type PromptComposition = {
  identityBlock: string;
  voiceRules: string;
  refusalRules: string;
  fewShots: Array<{ user: string; assistant: string }>;
  askBothCollabExamples: string[];
  driftRefresh: string;
  selfVerificationChecklist: string;
  capRefusalTemplate: string;
  quotaExhaustedTemplate: string;
  offDomainTemplate: string;
  politicalTemplate: string;
  adultTemplate: string;
  promptInjectionTemplate: string;
  fabricationBaitTemplate: string;
  hostileUserTemplate: string;
  modelFailureTemplate: string;
  selfIdentificationResponse: string;
};

export type PersonaRegistryEntry = {
  prompt: PromptComposition;
  greeting: string;
  inputPlaceholder: string;
  /** Tap-to-send suggested prompts shown above the chat input. */
  starterQuestions: readonly string[];
  providerId: ProviderId;
};

export const PERSONA_REGISTRY: Record<PersonaId, PersonaRegistryEntry> = {
  hitesh: {
    prompt: hiteshPromptComposition,
    // Addendum §D.1 (byte-identical, snapshot-tested):
    greeting:
      'Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.',
    inputPlaceholder: 'Kya doubt hai bhai? Type karo...',
    starterQuestions: [
      'DSA mein recursion kaise samjhun?',
      'Backend roadmap kahan se start karun?',
      'Interview mein system design kaise prepare karun?',
    ],
    providerId: PROVIDER_DEFAULT_ROUTING.hitesh,
  },
  piyush: {
    prompt: piyushPromptComposition,
    // Addendum §D.2 (byte-identical, snapshot-tested):
    greeting:
      'Hey everyone, welcome back. Welcome back to another exciting chat. Dekho, kya haal? Kuch banana hai? Koi concept clear nahi hai? Ya system design ka doubt? Type karo — ek kaam karte hain.',
    inputPlaceholder: 'Dekho, kya doubt hai? Type karo...',
    starterQuestions: [
      'React vs Angular — kya seekhun pehle?',
      'System design interview kaise crack karun?',
      'Side project se placement tak ka roadmap?',
    ],
    providerId: PROVIDER_DEFAULT_ROUTING.piyush,
  },
};

export const personaDisplayName = (p: PersonaId): string =>
  p === 'hitesh' ? 'Hitesh' : 'Piyush';
