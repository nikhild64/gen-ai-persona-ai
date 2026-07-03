import type { PersonaId } from '../domain/types/persona';
import type { ChatRequestParams } from '../domain/types/message';

export type PersonaModelParams = ChatRequestParams & {
  modelName: string;
};

/**
 * Per-persona model params. Read at request-build time by the PromptAssembler
 * so adapter code stays generic.
 */
export const PERSONA_MODEL_PARAMS: Record<PersonaId, PersonaModelParams> = {
  musk: {
    modelName: 'openai/gpt-oss-120b',
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 1000,
    frequencyPenalty: 0.1,
    presencePenalty: 0.15,
  },
  jobs: {
    modelName: 'gemini-3.1-flash-lite',
    temperature: 0.55,
    topP: 0.92,
    maxOutputTokens: 1000,
    frequencyPenalty: 0.15,
    presencePenalty: 0.2,
  },
  gandhi: {
    modelName: 'gemini-3.1-flash-lite',
    temperature: 0.5,
    topP: 0.9,
    maxOutputTokens: 1000,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
  },
  einstein: {
    modelName: 'gemini-3.1-flash-lite',
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 1000,
    frequencyPenalty: 0.15,
    presencePenalty: 0.2,
  },
  newton: {
    modelName: 'gemini-3.1-flash-lite',
    temperature: 0.4,
    topP: 0.85,
    maxOutputTokens: 1000,
    frequencyPenalty: 0.05,
    presencePenalty: 0.05,
  },
};

/** Default params for runtime-generated custom personas (einstein-like). */
export const CUSTOM_PERSONA_DEFAULT_PARAMS: PersonaModelParams = {
  modelName: 'gemini-3.1-flash-lite',
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 1000,
  frequencyPenalty: 0.15,
  presencePenalty: 0.2,
};
