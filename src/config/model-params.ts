import type { PersonaId } from '../domain/types/persona';
import type { ChatRequestParams } from '../domain/types/message';

export type PersonaModelParams = ChatRequestParams & {
  modelName: string;
};

/**
 * Addendum §B.4 — per-persona model params. Read at request-build time by the
 * PromptAssembler (E2-S2) so adapter code stays generic.
 */
export const PERSONA_MODEL_PARAMS: Record<PersonaId, PersonaModelParams> = {
  hitesh: {
    modelName: 'gemini-2.5-flash',
    temperature: 0.75,
    topP: 0.95,
    // Trimmed from 1200 → 500. Chat-UX-first: users read short bursts, not
    // essays. The prompt-assembler also injects a "keep it short" directive
    // so the model self-limits before hitting this ceiling.
    maxOutputTokens: 500,
    frequencyPenalty: 0.2,
    presencePenalty: 0.3,
  },
  /*
   * INTENTIONAL: Piyush's low frequency + presence penalty is a feature, not
   * a bug. His repetition of `dekho`, `yaar`, `OK?` is a signature-phrase
   * behaviour we want preserved — penalising it would flatten the persona.
   * (Mid-sprint fix: transliterated from Devanagari to Latin for readability.)
   * Reference: Addendum §B.4.
   */
  piyush: {
    modelName: 'openai/gpt-oss-120b',
    temperature: 0.55,
    topP: 0.9,
    maxOutputTokens: 500,
    frequencyPenalty: 0.05,
    presencePenalty: 0.1,
  },
};
