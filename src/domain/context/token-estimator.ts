/**
 * AD-9 canonical single-source token estimator. This STUB is landed in E2-S2
 * so the PromptAssembler can populate `OutboundPrompt.meta.estimatedTokens`
 * without waiting for the full context-management layer. E5-S1 refines
 * without changing the signature.
 *
 * Heuristic: ~4 characters per token for English/Hinglish mixed text. Good
 * enough for the AD-9 budget-safety-net trigger (SUMMARY_TOKEN_BUDGET_PCT).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
