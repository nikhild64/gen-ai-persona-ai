import type { PersonaId } from '../domain/types/persona';

/**
 * AD-5 provider identifiers. Re-exported from the port module (which is the
 * type SSOT); imports may pick either — canonical citation is `provider.port.ts`.
 */
export type { ProviderId } from '../domain/ports/provider.port';
import type { ProviderId } from '../domain/ports/provider.port';

/**
 * AD-5 default persona → provider routing.
 */
export const PROVIDER_DEFAULT_ROUTING: Record<PersonaId, ProviderId> = {
  musk: 'groq',
  jobs: 'gemini',
  gandhi: 'gemini',
  einstein: 'gemini',
  newton: 'gemini',
};

/**
 * AD-9 — Ask-Both rolling summary provider. Fixed to Gemini so summary latency
 * matches Persona-A's turn order.
 */
export const ASK_BOTH_SUMMARY_PROVIDER_ID: ProviderId = 'gemini';

export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'openai/gpt-oss-120b',
};
