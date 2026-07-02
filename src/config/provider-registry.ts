import type { PersonaId } from '../domain/types/persona';

/**
 * AD-5 provider identifiers. Re-exported from the port module (which is the
 * type SSOT); imports may pick either — canonical citation is `provider.port.ts`.
 */
export type { ProviderId } from '../domain/ports/provider.port';
import type { ProviderId } from '../domain/ports/provider.port';

/**
 * AD-5 default persona → provider routing.
 * SUBJECT TO SPIKE-0 OUTCOME (E0.5-S1): if browser-direct Gemini SSE fails
 * with CORS, Fallback (a) flips `hitesh: 'groq'` (single-provider variant).
 * See dev-decisions.md after E0.5-S1 completes.
 */
export const PROVIDER_DEFAULT_ROUTING: Record<PersonaId, ProviderId> = {
  hitesh: 'gemini',
  piyush: 'groq',
};

/**
 * AD-9 — Ask-Both rolling summary provider. Fixed to Gemini so summary latency
 * matches Persona-A's turn order.
 */
export const ASK_BOTH_SUMMARY_PROVIDER_ID: ProviderId = 'gemini';

/**
 * Default model name per provider. `PERSONA_MODEL_PARAMS` sets a persona-tied
 * default that assumes the persona's default provider, but if the user routes
 * a persona to a different provider, that model name is wrong (Gemini can't
 * serve `openai/gpt-oss-120b` and vice-versa). ChatOrchestrator +
 * AskBothSequencer override the persona-tied model with this provider-tied
 * default at request-build time so cross-provider routing works.
 */
export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'openai/gpt-oss-120b',
};

/**
 * PROVIDER_REGISTRY (Map<ProviderId, ProviderPortAdapterClass>) is populated
 * in E2-S1 with GeminiAdapter + GroqAdapter classes. This file lands types
 * and default routing only; adapter classes land later.
 */
