import type { ChatRequest, ChatChunk } from '../types/message';

/**
 * AD-3: closed provider-id union. Adding a provider is an AD update.
 */
export type ProviderId = 'gemini' | 'groq';

/**
 * AD-3 (ProviderPort SSOT): every LLM call in the app funnels through this
 * one interface. Adapters live in `src/infrastructure/providers/*`.
 */
export interface ProviderPort {
  streamChat(
    request: ChatRequest,
    key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk>;
}

/**
 * AD-11 class-side constraint: adapter CLASSES must expose these statics.
 * The redaction registry (LoggerService, VercelAnalyticsAdapter) walks
 * PROVIDER_REGISTRY.entries() and reads KEY_PATTERN off each class to strip
 * API keys from any string logged in dev or emitted in analytics.
 */
export interface ProviderPortAdapterClass {
  new (): ProviderPort;
  readonly PROVIDER_ID: ProviderId;
  readonly KEY_PATTERN: RegExp;
}
