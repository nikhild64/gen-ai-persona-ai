import type { ChatRequest } from '../types/message';

/**
 * AD-8: exhaustively switchable via `assertNever(mode)` default. Adding a
 * mode is one compile error until every switch site is updated — that's the
 * design.
 */
export type PromptMode =
  | 'solo'
  | 'ask-both-a'
  | 'ask-both-b'
  | 'ask-both-keep-going'
  | 'summarize';

/**
 * AD-8: the composed outbound prompt that leaves the domain toward a
 * ProviderPort adapter. `meta` carries the composition context useful for
 * eval, analytics, and debugging.
 */
export type OutboundPrompt = ChatRequest & {
  meta: {
    mode: PromptMode;
    hasSummary: boolean;
    hasDriftRefresh: boolean;
    estimatedTokens: number;
  };
};
