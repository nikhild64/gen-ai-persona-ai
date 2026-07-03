import type { PersonaId } from '../types/persona';
import type { CustomPersonaId } from '../types/custom-persona';
import type { ProviderId } from './provider.port';
import type { ChatChunkError } from '../types/message';

/**
 * AD-15: typed AnalyticsEvent discriminated union. Every emitter passes
 * through `AnalyticsPort.emit` — Vercel Web Analytics adapter (E2-S4)
 * translates each variant to a beacon.
 *
 * Adding an arm is a compile error at every switch site — including the
 * adapter's translation code — until every case handles it. Do NOT add
 * `| string` or `| { name: string; payload: unknown }` escape hatches.
 */
export type AnalyticsEvent =
  | { name: 'persona_selected'; payload: { persona: PersonaId } }
  | {
      name: 'persona_switched';
      payload: {
        from: PersonaId | CustomPersonaId;
        to: PersonaId | CustomPersonaId;
      };
    }
  | {
      name: 'mode_switched';
      payload: { from: 'solo' | 'ask-both'; to: 'solo' | 'ask-both' };
    }
  | {
      name: 'message_sent';
      payload: {
        persona: PersonaId | 'custom';
        mode: 'solo' | 'ask-both';
        charCount: number;
      };
    }
  | { name: 'ask_both_message_sent'; payload: { charCount: number } }
  | {
      name: 'ask_both_blended_message_sent';
      payload: { sessionId: string; threadId: string; tokenEstimate: number };
    }
  | { name: 'keep_going_clicked'; payload: Record<string, never> }
  | { name: 'byo_key_saved'; payload: { provider: ProviderId } }
  | {
      name: 'moderation_blocked';
      payload: { direction: 'input' | 'output'; category?: string };
    }
  | {
      name: 'persona_regex_miss';
      payload: { persona: PersonaId | 'blended' };
    }
  | {
      name: 'summary_failed';
      payload: { provider: ProviderId; category: ChatChunkError };
    }
  | {
      name: 'provider_429_surfaced';
      payload: { provider: ProviderId; retryAfterSec?: number };
    }
  | { name: 'parallel_fallback_triggered'; payload: Record<string, never> }
  | {
      name: 'stream_stall_detected';
      payload: { persona: PersonaId | 'custom'; elapsedMs: number };
    }
  | {
      name: 'spike_zero_gemini_cors_result';
      payload: { succeeded: boolean; error?: string };
    };

export interface AnalyticsPort {
  emit(event: AnalyticsEvent): void;
}
