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
 * PROVIDER_REGISTRY (Map<ProviderId, ProviderPortAdapterClass>) is populated
 * in E2-S1 with GeminiAdapter + GroqAdapter classes. This file lands types
 * and default routing only; adapter classes land later.
 */
