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
  /** Tap-to-send suggested prompts shown above the chat input. */
  starterQuestions: readonly string[];
  providerId: ProviderId;
  fullDisplayName: string;
  tagline: string;
  era: PersonaEra;
  disclaimerTier: PersonaDisclaimerTier;
  /** Runtime custom personas supply this; builtins use voiceReminderFor(). */
  voiceReminder?: string;
};

export const PERSONA_REGISTRY: Record<PersonaId, PersonaRegistryEntry> = {
  // hitesh: {
  //   prompt: hiteshPromptComposition,
  //   greeting:
  //     'Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.',
  //   inputPlaceholder: 'Kya doubt hai bhai? Type karo...',
  //   providerId: PROVIDER_DEFAULT_ROUTING.hitesh,
  //   fullDisplayName: 'Hitesh Choudhary',
  //   tagline:
  //     'Chai aur Code. Story sunata hun — phir tech samajhte hain saath mein.',
  //   era: 'Living',
  //   disclaimerTier: 'cohort',
  // },
  // piyush: {
  //   prompt: piyushPromptComposition,
  //   greeting:
  //     'Hey everyone, welcome back. Welcome back to another exciting chat. Dekho, kya haal? Kuch banana hai? Koi concept clear nahi hai? Ya system design ka doubt? Type karo — ek kaam karte hain.',
  //   inputPlaceholder: 'Dekho, kya doubt hai? Type karo...',
  //   providerId: PROVIDER_DEFAULT_ROUTING.piyush,
  //   fullDisplayName: 'Piyush Garg',
  //   tagline: 'I build devs, not just apps. Dekho — chalo build karte hain.',
  //   era: 'Living',
  //   disclaimerTier: 'cohort',
  // },
  musk: {
    prompt: muskPromptComposition,
    greeting:
      'Look — first principles. What are we trying to build or understand today? Ask about engineering, manufacturing, rockets, or how systems actually work.',
    inputPlaceholder: 'Ask about first principles, physics, Mars...',
    starterQuestions: [
      'Why are electric cars still so expensive?',
      'Is Mars realistic in our lifetime?',
      'Should I learn to code or focus on AI prompts?',
    ],
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
    starterQuestions: [
      'How do I know if I am in the right career?',
      'My app has too many features and users are confused.',
      'I failed at my startup. Should I quit?',
    ],
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
    starterQuestions: [
      'How can one person make a difference?',
      'Is violence ever justified when people are oppressed?',
      'What should I do about stress and anger?',
    ],
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
    starterQuestions: [
      'How did you come up with relativity?',
      'Should students memorize formulas or explore?',
      'What would you think about quantum computers?',
    ],
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
    starterQuestions: [
      'Did an apple really fall on your head?',
      'How should I study physics today?',
      'Why does a prism make a rainbow?',
    ],
    providerId: PROVIDER_DEFAULT_ROUTING.newton,
    fullDisplayName: 'Isaac Newton',
    tagline: 'On the shoulders of giants — force, motion, light.',
    era: '17th century',
    disclaimerTier: 'historical',
  },
};

const DISPLAY_NAMES: Record<PersonaId, string> = {
  // hitesh: 'Hitesh',
  // piyush: 'Piyush',
  musk: 'Musk',
  jobs: 'Jobs',
  gandhi: 'Gandhi',
  einstein: 'Einstein',
  newton: 'Newton',
};

export const personaDisplayName = (p: PersonaId): string => DISPLAY_NAMES[p];

export const personaFullDisplayName = (p: PersonaId): string =>
  PERSONA_REGISTRY[p].fullDisplayName;

/** Landing bento grid placement (4-column desktop layout). */
export const PERSONA_BENTO_PLACEMENT: Record<
  PersonaId,
  { gridColumn: string; gridRow: string }
> = {
  // hitesh: { gridColumn: '1 / 3', gridRow: '1 / 3' },
  // piyush: { gridColumn: '3 / 5', gridRow: '1 / 2' },
  musk: { gridColumn: '3 / 4', gridRow: '2 / 4' },
  jobs: { gridColumn: '1 / 2', gridRow: '3 / 4' },
  gandhi: { gridColumn: '2 / 3', gridRow: '3 / 4' },
  einstein: { gridColumn: '4 / 5', gridRow: '2 / 3' },
  newton: { gridColumn: '1 / 3', gridRow: '4 / 5' },
};

export const ASK_BOTH_BENTO_PLACEMENT = {
  gridColumn: '3 / 5',
  gridRow: '4 / 5',
} as const;

/** @deprecated Use PERSONA_IDS with bento layout instead. */
export const PERSONA_LANDING_GROUPS: ReadonlyArray<{
  title: string;
  personas: PersonaId[];
}> = [
  { title: 'Contemporary', personas: [ 'musk'] },
  {
    title: '20th Century Icons',
    personas: ['jobs', 'gandhi', 'einstein'],
  },
  { title: 'Historical', personas: ['newton'] },
];
