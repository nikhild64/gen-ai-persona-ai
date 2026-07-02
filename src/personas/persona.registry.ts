import type { PersonaId } from '../domain/types/persona';
import type { ProviderId } from '../config/provider-registry';
import { PROVIDER_DEFAULT_ROUTING } from '../config/provider-registry';
import hiteshPromptComposition from './hitesh.prompt';
import piyushPromptComposition from './piyush.prompt';
import muskPromptComposition from './musk.prompt';
import jobsPromptComposition from './jobs.prompt';
import gandhiPromptComposition from './gandhi.prompt';
import einsteinPromptComposition from './einstein.prompt';
import newtonPromptComposition from './newton.prompt';

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

export type PersonaEra = 'Living' | '20th century' | '17th century';

export type PersonaDisclaimerTier =
  | 'cohort'
  | 'contemporary'
  | 'deceased-recent'
  | 'historical';

export type PersonaRegistryEntry = {
  prompt: PromptComposition;
  greeting: string;
  inputPlaceholder: string;
  providerId: ProviderId;
  fullDisplayName: string;
  tagline: string;
  era: PersonaEra;
  disclaimerTier: PersonaDisclaimerTier;
};

export const PERSONA_REGISTRY: Record<PersonaId, PersonaRegistryEntry> = {
  hitesh: {
    prompt: hiteshPromptComposition,
    greeting:
      'Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.',
    inputPlaceholder: 'Kya doubt hai bhai? Type karo...',
    providerId: PROVIDER_DEFAULT_ROUTING.hitesh,
    fullDisplayName: 'Hitesh Choudhary',
    tagline:
      'Chai aur Code. Story sunata hun — phir tech samajhte hain saath mein.',
    era: 'Living',
    disclaimerTier: 'cohort',
  },
  piyush: {
    prompt: piyushPromptComposition,
    greeting:
      'Hey everyone, welcome back. Welcome back to another exciting chat. Dekho, kya haal? Kuch banana hai? Koi concept clear nahi hai? Ya system design ka doubt? Type karo — ek kaam karte hain.',
    inputPlaceholder: 'Dekho, kya doubt hai? Type karo...',
    providerId: PROVIDER_DEFAULT_ROUTING.piyush,
    fullDisplayName: 'Piyush Garg',
    tagline: 'I build devs, not just apps. Dekho — chalo build karte hain.',
    era: 'Living',
    disclaimerTier: 'cohort',
  },
  musk: {
    prompt: muskPromptComposition,
    greeting:
      'Look — first principles. What are we trying to build or understand today? Ask about engineering, manufacturing, rockets, or how systems actually work.',
    inputPlaceholder: 'Ask about first principles, physics, Mars...',
    providerId: PROVIDER_DEFAULT_ROUTING.musk,
    fullDisplayName: 'Elon Musk',
    tagline: 'First principles. Physics. Build what matters.',
    era: 'Living',
    disclaimerTier: 'contemporary',
  },
  jobs: {
    prompt: jobsPromptComposition,
    greeting:
      'Focus matters. What are you trying to make insanely great? Ask me about design, simplicity, craft — and why you should stay hungry.',
    inputPlaceholder: 'Ask about design, focus, simplicity...',
    providerId: PROVIDER_DEFAULT_ROUTING.jobs,
    fullDisplayName: 'Steve Jobs',
    tagline: 'Design is how it works. Stay hungry. Stay foolish.',
    era: '20th century',
    disclaimerTier: 'deceased-recent',
  },
  gandhi: {
    prompt: gandhiPromptComposition,
    greeting:
      'Peace. In my experiments with truth I learned that change begins within. What brings your conscience here today?',
    inputPlaceholder: 'Ask about truth, ahimsa, satyagraha, service...',
    providerId: PROVIDER_DEFAULT_ROUTING.gandhi,
    fullDisplayName: 'Mahatma Gandhi',
    tagline: 'Truth and non-violence. Be the change you seek.',
    era: '20th century',
    disclaimerTier: 'historical',
  },
  einstein: {
    prompt: einsteinPromptComposition,
    greeting:
      'Curiosity brought you here — good. The most beautiful thing we can experience is the mysterious. What question shall we explore together?',
    inputPlaceholder: 'Ask about curiosity, imagination, science...',
    providerId: PROVIDER_DEFAULT_ROUTING.einstein,
    fullDisplayName: 'Albert Einstein',
    tagline: 'Imagination, curiosity, and thought experiments.',
    era: '20th century',
    disclaimerTier: 'historical',
  },
  newton: {
    prompt: newtonPromptComposition,
    greeting:
      'You find me at my desk of natural philosophy. What matter of force, motion, or light shall we demonstrate today?',
    inputPlaceholder: 'Ask about force, motion, natural philosophy...',
    providerId: PROVIDER_DEFAULT_ROUTING.newton,
    fullDisplayName: 'Isaac Newton',
    tagline: 'On the shoulders of giants — force, motion, light.',
    era: '17th century',
    disclaimerTier: 'historical',
  },
};

const DISPLAY_NAMES: Record<PersonaId, string> = {
  hitesh: 'Hitesh',
  piyush: 'Piyush',
  musk: 'Musk',
  jobs: 'Jobs',
  gandhi: 'Gandhi',
  einstein: 'Einstein',
  newton: 'Newton',
};

export const personaDisplayName = (p: PersonaId): string => DISPLAY_NAMES[p];

export const personaFullDisplayName = (p: PersonaId): string =>
  PERSONA_REGISTRY[p].fullDisplayName;

/** Landing page category groupings (V2 Council). */
export const PERSONA_LANDING_GROUPS: ReadonlyArray<{
  title: string;
  personas: PersonaId[];
}> = [
  { title: 'Contemporary', personas: ['hitesh', 'piyush', 'musk'] },
  {
    title: '20th Century Icons',
    personas: ['jobs', 'gandhi', 'einstein'],
  },
  { title: 'Historical', personas: ['newton'] },
];
