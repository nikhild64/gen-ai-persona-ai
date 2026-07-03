import type { ProviderId } from '../../config/provider-registry';
import type { PersonaId } from './persona';
import type {
  PersonaDisclaimerTier,
  PersonaEra,
} from '../../personas/persona.registry';

export type CustomPersonaId = `custom:${string}`;

export function isCustomPersonaId(value: string): value is CustomPersonaId {
  return value.startsWith('custom:');
}

export function newCustomPersonaId(): CustomPersonaId {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `custom:${uuid}`;
}

export type CustomPersonaPromptFields = {
  identityBlock: string;
  voiceRules: string;
  refusalRules: string;
  voiceReminder: string;
  fewShots: Array<{ user: string; assistant: string }>;
  driftRefresh: string;
  selfVerificationChecklist: string;
};

export type CustomPersonaRecord = {
  id: CustomPersonaId;
  createdAt: string;
  fullDisplayName: string;
  tagline: string;
  era: PersonaEra;
  disclaimerTier: PersonaDisclaimerTier;
  greeting: string;
  inputPlaceholder: string;
  starterQuestions: string[];
  providerId: ProviderId;
  prompt: CustomPersonaPromptFields;
  sourceInput: { name: string; details?: string };
};

/** LLM output shape before id/createdAt assignment. */
export type GeneratedCustomPersonaPayload = Omit<
  CustomPersonaRecord,
  'id' | 'createdAt' | 'providerId' | 'sourceInput'
>;

export type ChatPersonaRef =
  | { kind: 'builtin'; id: PersonaId }
  | { kind: 'custom'; id: CustomPersonaId };

export function builtinRef(id: PersonaId): ChatPersonaRef {
  return { kind: 'builtin', id };
}

export function customRef(id: CustomPersonaId): ChatPersonaRef {
  return { kind: 'custom', id };
}
