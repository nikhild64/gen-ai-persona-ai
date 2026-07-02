/**
 * AD-1 — flags baked at build time. A flip requires rebuild + redeploy
 * (~1 min on Vercel Hobby). No runtime flag reads: the Pure-FE bundle
 * doesn't call home, so flag values are fixed for the lifetime of the loaded
 * SPA. E10-S1 wires up build-time env replacement.
 *
 * These booleans are the kill-switches per PRD FR-32; the ASK_BOTH_MODE
 * const at the bottom is a SEPARATE selector per AD-13.
 */

type EnvMap = Record<string, string | undefined>;

// Angular 21 CLI (ESBuild application-builder) exposes `import.meta.env` when
// `.env` variables prefixed `NG_APP_` are set. We tolerate the property being
// absent (jsdom tests, non-Vite bundlers, older Angular versions).
const env: EnvMap =
  (import.meta as unknown as { env?: EnvMap }).env ?? {};

const readBooleanFlag = (key: string, defaultValue: boolean): boolean => {
  const raw = env[key];
  if (raw === undefined) return defaultValue;
  return raw !== 'false' && raw !== '0';
};

/** FR-32 kill-switch. Default ON; flip to false to hide the mode-switcher. */
export const FEATURE_ASK_BOTH_MODE: boolean = readBooleanFlag(
  'NG_APP_FEATURE_ASK_BOTH_MODE',
  true,
);

/** FR-32 kill-switch. Default ON; flip to false to disable summary generation. */
export const FEATURE_ROLLING_SUMMARY: boolean = readBooleanFlag(
  'NG_APP_FEATURE_ROLLING_SUMMARY',
  true,
);

/** FR-32 kill-switch. Default ON; flip to false to bypass HeuristicModerationAdapter. */
export const FEATURE_MODERATION: boolean = readBooleanFlag(
  'NG_APP_FEATURE_MODERATION',
  true,
);

/**
 * FR-32 kill-switch. Vestigial in Pure FE per PRD §11.3 — BYO-Key is mandatory,
 * no Dev-Key alternative exists. Retained as an always-true const to preserve
 * the flag surface for a hypothetical future BE-proxy pivot.
 */
export const FEATURE_BYO_KEY: boolean = true;

/**
 * AD-13 — Ask-Both interaction model selector. DISTINCT from the kill-switch
 * above: this picks 'sequential' (Persona A → sees → Persona B),
 * 'parallel' (both fire together, no cross-awareness), or 'blended' (single
 * LLM call producing one fused-voice response).
 *
 * Semantics with the runtime toggle: this constant is now the DEFAULT SEED
 * for the user's session preference. `AskBothModeService` layers a
 * localStorage-persisted override on top — the user's chosen variant wins
 * once set, and this value only applies to fresh sessions (no override
 * saved yet). The env-flag change surface stays intact for build-time
 * defaulting; adding `blended` here is the only change per the post-sprint
 * Blended-mode task.
 */
export type AskBothMode = 'sequential' | 'parallel' | 'blended';

export const ASK_BOTH_MODE: AskBothMode = ((): AskBothMode => {
  const raw = env['NG_APP_ASK_BOTH_MODE'];
  return 'blended';
})();

/**
 * Dev-only feature flag guarding routes that must not appear in production.
 * Currently used by `/spike/gemini-cors` (E0.5-S1). NG_APP_DEV_SPIKE_ROUTES
 * defaults ON in development and OFF in production; production builds should
 * explicitly set `NG_APP_DEV_SPIKE_ROUTES=false`.
 */
export const FEATURE_SPIKE_ROUTES: boolean = readBooleanFlag(
  'NG_APP_DEV_SPIKE_ROUTES',
  env['NG_APP_ENV'] !== 'production',
);
