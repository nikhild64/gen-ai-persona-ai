/**
 * AD-12 (Layered moderation defence): closed category union. Adapters in
 * `src/infrastructure/moderation/*` map each category to persona-specific
 * refusal templates via `persona.registry.ts` (E2-S2 / E8-S1).
 */
export type ModerationCategory =
  | 'jailbreak'
  | 'off_domain'
  | 'adult'
  | 'political'
  | 'hate'
  | 'self_harm';

export type ModerationVerdict = {
  allowed: boolean;
  category?: ModerationCategory;
  suggested_refusal?: string;
};

/**
 * AD-12: `direction` distinguishes pre-flight input checks from
 * post-stream output checks. Both directions call the same port.
 */
export interface ModerationPort {
  check(
    text: string,
    direction: 'input' | 'output',
  ): Promise<ModerationVerdict>;
}
