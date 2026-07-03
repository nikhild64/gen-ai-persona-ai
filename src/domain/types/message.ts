/**
 * Core domain message + thread shapes. Per AD-4 (ChatChunk contract) and
 * AD-10 (Message/Thread invariants).
 *
 * PersonaId is re-exported from `./persona` (which is the single source of
 * truth per E0-S1). Downstream code MAY import PersonaId from either module.
 */
export type { PersonaId } from './persona';
import type { PersonaId } from './persona';

export type PromptMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatRequestParams = {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export type ChatRequest = {
  messages: PromptMessage[];
  model: string;
} & ChatRequestParams;

/**
 * AD-4: closed union — NO `| string` escape hatch. Adding a new error
 * category is an AD update that cascades to every switch site.
 */
export type ChatChunkError =
  | 'quota_exhausted'
  | 'network_error'
  | 'moderation_blocked'
  | 'aborted'
  | 'auth_failed'
  | 'invalid_request'
  | 'server_error'
  | 'unknown';

export type ChatChunk = {
  type: 'delta' | 'done' | 'error';
  text?: string;
  meta?: {
    tokens?: number;
    model?: string;
    error?: ChatChunkError;
    retryable?: boolean;
    retryAfterSec?: number;
  };
};

/**
 * Domain error shape — mirrors AD-4's closed ChatChunkError union.
 */
export type ChatError = {
  kind: ChatChunkError;
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
};

/**
 * AD-10: `status` is REQUIRED when `role === 'assistant'`. Ad-hoc booleans
 * (e.g. `isStreaming`, `isCancelled`) are banned in favour of this discriminator.
 *
 * `attributionLabel` is a purely presentational override for the bubble
 * header. Blended Ask-Both messages set it to something like
 * `'Hitesh + Piyush'` — the message has no single-persona owner but the
 * user should still see who authored it. When absent, `MessageBubble` falls
 * back to `personaDisplayName(persona)` (or `'Assistant'` when `persona`
 * is also absent). Additive/back-compat: pre-existing persisted messages
 * carry no field and render unchanged.
 */
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  persona?: PersonaId;
  content: string;
  timestamp: number;
  status?: 'streaming' | 'complete' | 'cancelled' | 'error';
  error?: ChatError;
  attributionLabel?: string;
};

/**
 * AD-10: canonical persisted-thread shape. `rollingSummary` is `string | null`
 * (not `string | undefined`) — `null` explicitly means "not yet generated".
 */
export type ThreadScope = PersonaId | 'ask-both' | `custom:${string}`;

export type Thread = {
  id: string;
  scope: ThreadScope;
  messages: Message[];
  rollingSummary: string | null;
  turnsSinceLastSummary: number;
  createdAt: number;
  updatedAt: number;
};
