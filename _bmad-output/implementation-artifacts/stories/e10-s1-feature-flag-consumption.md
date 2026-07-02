# Story E10-S1: Feature flag consumption points + build-time env-var integration

Status: ready-for-dev

- **Epic:** 10 — Feature Flags & Kill-Switches
- **Critical-path position:** 31 of 37 (Day 7 morning)
- **Blocks:** none
- **Depends on:** E0-S3, E5-S2, E6-S2, E8-S2, E9-S1, E9-S2, E9-S4

## Story

As a **solo developer at demo-day**,
I want **to flip `FEATURE_ASK_BOTH_MODE=false` in Vercel's environment variables, redeploy (~1 minute), and have the app ship Solo-only — mode-switcher hidden, deep link to `/chat/ask-both` redirects to `/`**,
So that **if Ask-Both misbehaves in eval or during grader review, I have a working escape hatch that doesn't require a code push**.

## Acceptance Criteria

**Given** Epic 0 landed `src/config/feature-flags.ts` with the flag skeleton,
**When** the developer extends the file to read from Vercel's build environment,
**Then** each flag reads from `import.meta.env.VITE_FEATURE_ASK_BOTH_MODE` / `import.meta.env.VITE_FEATURE_ROLLING_SUMMARY` / etc. (Vite convention, or Angular equivalent via `angular.json` `fileReplacements` for `environments/environment.ts`) with a fallback to the production-safe default (`true`). Values are baked into the JS bundle at `ng build` time per AD-1 — a flag flip requires rebuild + redeploy.

**Given** `FEATURE_ASK_BOTH_MODE=false` is set in Vercel build env,
**When** the app boots,
**Then** the mode-switcher control (from Epic 9 story E9-S1) is HIDDEN entirely from the chat header — verified by inspecting the DOM at `/chat/hitesh` and confirming no `<mode-switcher>` element exists. A deep link to `/chat/ask-both` in the browser URL bar redirects to `/` (landing) per EXPERIENCE.md.State Patterns — no error toast, the mode is architecturally absent.

**Given** `FEATURE_ROLLING_SUMMARY=false` is set,
**When** the app boots,
**Then** the ContextManager (from Epic 5 story E5-S2) skips its `onTurnComplete` summary-generation call — the `if (!FEATURE_ROLLING_SUMMARY) return;` early-return short-circuits the trigger evaluation. Sliding-window truncation fallback is used silently on long conversations (Verbatim Tail still populated, Rolling Summary slot stays empty in the assembled prompt); a dev-time `LoggerService.info` note fires: `"Rolling Summary disabled via feature flag; using sliding-window truncation"`.

**Given** `FEATURE_MODERATION=false` is set,
**When** the app boots,
**Then** the moderation port is wired via Angular DI to a `NoOpModerationAdapter` (`{allowed: true}` unconditionally) — an alternative concrete implementation that lives in `src/infrastructure/moderation/no-op.adapter.ts`. `HeuristicModerationAdapter` (Epic 8) is not used. Only appropriate for local dev; production must keep this on. Documented as such in `docs/feature-flags.md`.

**Given** `ASK_BOTH_MODE = 'parallel'` is set,
**When** the AskBothSequencer runs (from Epic 9 story E9-S4),
**Then** the Parallel branch fires per that story's contract; `parallel_fallback_triggered` analytics event emits per AD-15. This is SEPARATE from `FEATURE_ASK_BOTH_MODE` — the mode is still ENABLED, just running in Parallel mode.

**Given** `FEATURE_BYO_KEY=true` (vestigial in Pure FE — always true),
**When** the developer inspects `feature-flags.ts`,
**Then** the flag is declared with a comment: `// FEATURE_BYO_KEY: Vestigial in Pure FE per PRD §11.3 — BYO-Key is mandatory; retained as unconditional true for future BE-proxy pivot`. No conditional gating fires on this flag; the settings modal + KeyVaultService always operate.

**Given** the developer writes `docs/feature-flags.md` (as part of Epic 12 story E12-S1 but the CONTENT is scoped here),
**When** the doc is authored,
**Then** it lists each env-var name (`FEATURE_ASK_BOTH_MODE`, `FEATURE_ROLLING_SUMMARY`, `FEATURE_MODERATION`, `FEATURE_BYO_KEY`, `ASK_BOTH_MODE`), their truthy/falsy semantics, defaults, and includes the supersession note per PRD §11.3: "Flags are baked at build time (Vercel `ng build` reads env vars); a flip requires rebuild + redeploy (~1 minute). Request-time flag reads are not possible in Pure FE per AD-1."

**verifies:** FR-32 (feature flag mechanism preserved per AD-1 build-time semantics), AD-1 (build-time flag baking as the topology reality), AD-13 (ASK_BOTH_MODE selector distinct from kill-switch)

**touches:** `src/config/feature-flags.ts` (extend from Epic 0 skeleton with build-env-var reads), `angular.json` (fileReplacements for environments/environment.ts if using Angular convention; OR ensure `import.meta.env` works with the chosen Vite-in-Angular setup), `src/environments/environment.ts` + `src/environments/environment.production.ts` (if using Angular file-replacement pattern), `src/features/mode-switcher/mode-switcher.component.ts` (hide when `!FEATURE_ASK_BOTH_MODE`), `src/app/app.routes.ts` (redirect `/chat/ask-both` to `/` when `!FEATURE_ASK_BOTH_MODE`), `src/domain/context/context-manager.service.ts` (early-return when `!FEATURE_ROLLING_SUMMARY`), `src/infrastructure/moderation/no-op.adapter.ts` (new file — `NoOpModerationAdapter implements ModerationPort`), `src/app/app.config.ts` (Angular DI conditional wiring: `{ provide: MODERATION_PORT, useClass: FEATURE_MODERATION ? HeuristicModerationAdapter : NoOpModerationAdapter }`), `docs/feature-flags.md` (Epic 12 hosts the file; the content lives here)

**test target:** unit test (each flag consumer branches correctly based on the flag value — mock the flag import, verify the DOM / DI wiring changes accordingly) + manual smoke test (build with `.env.local` FEATURE_ASK_BOTH_MODE=false, verify mode-switcher gone in built app; repeat for each flag)

## Developer Context

Wires the build-time flag system. E0-S3 landed the constants + skeleton reads; E5-S2/E6-S2/E8-S2/E9-S1/S2/S4 conditionally check the flags. This story adds the actual `import.meta.env` reads + DI-time swaps + the redirect logic + the doc content.

**One story to unify all flag consumption:** each consumer references the flag from `feature-flags.ts`, but this story ensures the flag value is actually driven by env vars at build time (not hardcoded).

**No-op adapter DI conditional:** since Angular DI is static at bootstrap, use an `APP_INITIALIZER` or a factory provider that reads the flag once and returns the correct class.

## Technical Requirements

### `src/config/feature-flags.ts` — final version

```ts
// Vite / Angular ESBuild reads env vars at build time.
// If Angular 21 doesn't support import.meta.env natively, use fileReplacements per angular.json.
type EnvSource = { [k: string]: string | undefined };
const env: EnvSource = (import.meta as { env?: EnvSource }).env ?? (process?.env ?? {});

export const FEATURE_ASK_BOTH_MODE: boolean = env['VITE_FEATURE_ASK_BOTH_MODE'] !== 'false';
export const FEATURE_ROLLING_SUMMARY: boolean = env['VITE_FEATURE_ROLLING_SUMMARY'] !== 'false';
export const FEATURE_MODERATION: boolean = env['VITE_FEATURE_MODERATION'] !== 'false';

// FEATURE_BYO_KEY: Vestigial in Pure FE per PRD §11.3 — BYO-Key is mandatory;
// retained as unconditional true for future BE-proxy pivot.
export const FEATURE_BYO_KEY: boolean = true;

// SEPARATE from the kill-switch — AD-13. Selects Sequential vs Parallel branch of Ask-Both.
export const ASK_BOTH_MODE: 'sequential' | 'parallel' =
  env['VITE_ASK_BOTH_MODE'] === 'parallel' ? 'parallel' : 'sequential';
```

**Angular fileReplacements alternative** (if `import.meta.env` doesn't work cleanly with Angular 21's ESBuild builder):

`angular.json` `production` config:
```json
"fileReplacements": [
  { "replace": "src/environments/environment.ts", "with": "src/environments/environment.production.ts" }
]
```

Then `feature-flags.ts` imports from `@environments/environment` — deployed builds use `environment.production.ts` values.

### Flag consumption sites

**`mode-switcher.component.ts`:**
```ts
readonly modeSwitcherVisible = FEATURE_ASK_BOTH_MODE;
```
Template: `<div *ngIf="modeSwitcherVisible">...</div>`.

**`app.routes.ts` — redirect:**
```ts
const routes: Routes = [
  { path: '', ... },
  { path: 'chat/ask-both', canActivate: [() => FEATURE_ASK_BOTH_MODE ? true : inject(Router).parseUrl('/')], ... },
];
```

Or simpler: within `ChatComponent` or `AskBothComponent`'s `ngOnInit`, if `!FEATURE_ASK_BOTH_MODE`, router.navigate(['/']).

**`context-manager.service.ts`:**
```ts
async onTurnComplete(threadKey): Promise<void> {
  if (!FEATURE_ROLLING_SUMMARY) {
    this.logger.info('Rolling Summary disabled via feature flag; using sliding-window truncation');
    return;
  }
  // ...trigger evaluation
}
```

**`app.config.ts` — DI conditional:**
```ts
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: STORAGE_PORT, useClass: IdbKeyvalStorageAdapter },
    { provide: MODERATION_PORT, useClass: FEATURE_MODERATION ? HeuristicModerationAdapter : NoOpModerationAdapter },
    { provide: ANALYTICS_PORT, useClass: VercelAnalyticsAdapter },
  ],
};
```

### `no-op.adapter.ts` — from E8-S2

Already landed per E8-S2. Verify import in app.config.

### `docs/feature-flags.md` — content scoped here (E12-S1 hosts the file creation)

```markdown
# Feature Flags — Chai Code Personas

All flags are baked at build time per AD-1 (Pure-FE topology, no server for request-time reads).
A flag flip requires rebuild + redeploy (~1 minute via Vercel).

## Env vars

| Env var | Type | Default | Semantics |
|---|---|---|---|
| `VITE_FEATURE_ASK_BOTH_MODE` | boolean | `true` | Hide mode-switcher + redirect `/chat/ask-both` to `/` when `false`. |
| `VITE_FEATURE_ROLLING_SUMMARY` | boolean | `true` | Skip ContextManager summary generation; sliding-window truncation fallback. |
| `VITE_FEATURE_MODERATION` | boolean | `true` | Swap DI from HeuristicModerationAdapter → NoOpModerationAdapter. Local dev only; production always true. |
| `FEATURE_BYO_KEY` | boolean | `true` (vestigial) | Retained for future BE-proxy pivot. No conditional gating currently. |
| `VITE_ASK_BOTH_MODE` | `'sequential' \| 'parallel'` | `'sequential'` | Selects Ask-Both flow; SEPARATE from kill-switch. See AD-13. |

## Supersession per PRD §11.3

FR-32 originally specified request-time flag reads. Superseded by AD-1: Pure FE bundles flags at build time. This is a documented supersession — the KILL-SWITCH capability is preserved; the IMMEDIATE-EFFECT semantic is dropped.

## Redeploy flow

1. Set env var in Vercel dashboard OR local `.env.local`.
2. Trigger a Vercel redeploy (or `npm run build`).
3. Verify via manual smoke: navigate to `/chat/ask-both` when `FEATURE_ASK_BOTH_MODE=false` → should redirect to `/`.
```

E12-S1 places this file at `docs/feature-flags.md`; this story authors the content.

## Architecture Compliance

- **AD-1:** flags baked at build time.
- **AD-13:** `ASK_BOTH_MODE` separate from `FEATURE_ASK_BOTH_MODE`.
- **AD-2:** DI swap via Angular provider factory keeps ports/adapters clean.

## File Structure Requirements

```
src/config/feature-flags.ts          # UPDATE — env-var reads + comment on vestigial FEATURE_BYO_KEY
src/environments/environment.ts       # NEW (if using file-replacement approach)
src/environments/environment.production.ts  # NEW
angular.json                          # UPDATE fileReplacements
src/features/mode-switcher/mode-switcher.component.ts  # UPDATE — hide when flag off
src/app/app.routes.ts                 # UPDATE — canActivate guard or redirect for /chat/ask-both
src/domain/context/context-manager.service.ts  # UPDATE — early-return when flag off
src/infrastructure/moderation/no-op.adapter.ts  # verify from E8-S2
src/app/app.config.ts                 # UPDATE — DI conditional wiring
docs/feature-flags.md                 # CONTENT scoped here; E12-S1 places the file
```

## Testing Requirements

- Unit tests per consumer: mock `feature-flags` module + verify branching.
- Manual smoke: build with each flag combo → verify UI behavior.

## Latest Tech Information

- Angular 21 ESBuild Application Builder supports `import.meta.env` via Vite plugin OR the classic fileReplacements pattern.

## Previous Story Intelligence

**E0-S3:** flags declared with skeleton reads. This story finalizes.
**E5-S2:** ContextManager reads `FEATURE_ROLLING_SUMMARY`.
**E6-S2:** BYO-Key settings modal (unconditional per FEATURE_BYO_KEY vestigial).
**E8-S2:** NoOpModerationAdapter exists.
**E9-S1:** mode-switcher component.
**E9-S2 + S4:** ASK_BOTH_MODE Sequential vs Parallel.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-1` supersedes FR-32 request-time (lines 66–71), `AD-13` mode selector distinct (lines 189–208).
- PRD §11.3 supersession list.
- Sprint status: key `e10-s1-feature-flag-consumption`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-1] Build-time flag baking is the topology reality.
- [Source: prd.md#FR-32 revised] Kill-switch preserved; immediate-effect superseded.

## Story Completion Status

- [ ] `feature-flags.ts` reads build env vars with production-safe defaults.
- [ ] mode-switcher hidden when `!FEATURE_ASK_BOTH_MODE`.
- [ ] `/chat/ask-both` redirects to `/` when flag off.
- [ ] ContextManager early-returns when `!FEATURE_ROLLING_SUMMARY`.
- [ ] `app.config.ts` DI conditional for MODERATION_PORT.
- [ ] `docs/feature-flags.md` content authored (E12-S1 places the file).
- [ ] Unit tests + manual smoke per each flag combo.
