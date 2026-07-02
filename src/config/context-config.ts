/**
 * AD-9 — the single source of truth for context-management thresholds.
 * ESLint `no-restricted-syntax` (E0-S4) bans re-declaration of these names
 * anywhere else in the codebase; feature code always `import`s from here.
 */

/** FR-11: last N assistant+user messages kept verbatim regardless of mode. */
export const VERBATIM_TAIL_LENGTH = 8;

/** FR-12 hybrid trigger cadence — regenerate the rolling summary every N turns. */
export const SUMMARY_REFRESH_CADENCE = 10;

/** FR-12: switch to summary mode when estimated tokens exceed this pct of context. */
export const SUMMARY_TOKEN_BUDGET_PCT = 70;

/** FR-13: first drift-refresh injection point (turn index, 1-based). */
export const DRIFT_REFRESH_FIRST_TURN = 15;

/** FR-13: subsequent drift-refresh cadence after the first. */
export const DRIFT_REFRESH_CADENCE = 10;

/** FR-21: max user+assistant messages per thread before cap-refusal fires. */
export const MAX_TURNS_PER_THREAD = 40;

/** FR-29: Ask-Both keep-going additional rounds per user click. */
export const KEEP_GOING_ROUNDS = 1;

/** AD-4: no new chunk within this many ms => surface stall UI. */
export const STREAM_STALL_TIMEOUT_MS = 30000;
