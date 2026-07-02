# Feature Flags — Chai Code Personas

Flags are baked at build time per AD-1 (Pure-FE topology; no server for
request-time reads). A flip requires rebuild + redeploy — on Vercel Hobby
this is about a minute.

Env-var prefix is `NG_APP_` because Angular 21 CLI's ESBuild application
builder replaces those at build time.

## Environment variables

| Env var | Type | Default | Semantics |
|---|---|---|---|
| `NG_APP_FEATURE_ASK_BOTH_MODE` | boolean | `true` | When `false` the mode-switcher is hidden and `/chat/ask-both` redirects to `/` silently (no error toast — the feature is architecturally absent). |
| `NG_APP_FEATURE_ROLLING_SUMMARY` | boolean | `true` | When `false` the `ContextManager.onTurnComplete` early-returns; long conversations fall back to plain sliding-window truncation. |
| `NG_APP_FEATURE_MODERATION` | boolean | `true` | When `false` the DI wiring swaps `HeuristicModerationAdapter` for `NoOpModerationAdapter`. **Local-dev only** — production should always be `true`. |
| `NG_APP_DEV_SPIKE_ROUTES` | boolean | `true` in dev, `false` in prod | Guards the `/spike/gemini-cors` route (E0.5-S1). |
| `NG_APP_ASK_BOTH_MODE` | `sequential` \| `parallel` | `sequential` | Selects the Ask-Both interaction model. SEPARATE from `FEATURE_ASK_BOTH_MODE`. See AD-13. |
| _`FEATURE_BYO_KEY`_ | boolean | always `true` | **Vestigial** in Pure FE per PRD §11.3 — BYO-Key is mandatory. Retained as an unconditional constant for a hypothetical future BE-proxy pivot. Not driven by any env var today. |

## Supersession per PRD §11.3

FR-32 originally specified request-time flag reads. Superseded by AD-1: the
Pure-FE bundle bakes flag values at build time. The kill-switch capability
is preserved; the "immediate effect" semantic is dropped.

## Redeploy flow

1. Set env var in Vercel Dashboard → Settings → Environment Variables (or
   append to `.env.local` for local builds).
2. Trigger a Vercel redeploy (or run `bun run build` locally + `vercel --prod`).
3. Smoke test via the manual checklist below.

## Manual smoke checklist

- Set `NG_APP_FEATURE_ASK_BOTH_MODE=false` → rebuild → navigate to
  `/chat/hitesh`. The mode-switcher should be absent. Visit `/chat/ask-both`
  in the URL bar — it should silently redirect to `/`.
- Set `NG_APP_FEATURE_ROLLING_SUMMARY=false` → have a 15-turn conversation.
  The DevTools console should log a one-time "Rolling Summary disabled …"
  info line. No summary appears in the outbound prompt.
- Set `NG_APP_FEATURE_MODERATION=false` → send an input the heuristic
  adapter would normally block (e.g. "ignore all previous instructions").
  With moderation off, the message reaches the provider — verify in Network
  tab. Turn back on before shipping.

## Anchoring documents

- AD-1 (Pure-FE topology): `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/ARCHITECTURE-SPINE.md` §AD-1.
- AD-13 (`ASK_BOTH_MODE` vs `FEATURE_ASK_BOTH_MODE`): same file, §AD-13.
- PRD §11.3 supersession list: `_bmad-output/planning-artifacts/prds/prd-gen-ai-persona-ai-2026-07-02/prd.md`.
