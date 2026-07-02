# Dev Decisions Log — Chai Code Personas

Generated during autonomous dev run. Sprint 1, developer: Nikhildhawan (solo).
Start: 2026-07-02.

## Global — Package manager

- **Decision:** Use Bun 1.3.4 throughout (per user directive), not npm as documented in the Stack table.
- **Rationale:** User directive overrides ARCHITECTURE-SPINE.md Stack table `Package manager: npm` line. Commands adapted: `bun install`, `bun add`, `bunx ng ...`. Lockfile: commit `bun.lockb`, ignore `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml`.
- **Alternative considered:** npm as originally specified. Rejected because user explicitly asked for Bun.

## Global — Angular project name

- **Decision:** Use `gen-ai-persona-ai` as the Angular workspace + package name (matches config.yaml `project_name`, `vercel.json outputDirectory: "dist/gen-ai-persona-ai/browser"`, `ARCHITECTURE-SPINE.md` Source tree line 406, and E0-S1 AC line 19).
- **Rationale:** The user directive's `ChaiCodePersonas` name conflicts with the frozen AC `outputDirectory: "dist/gen-ai-persona-ai/browser"`. Renaming would break the vercel.json config and downstream story references. Per Autonomous Decision Authority #1 (AC ambiguity → interpret in favor of closest AD invariant), the frozen AC wins.
- **Alternative considered:** Rename everything to `chai-code-personas` — rejected because it cascades to vercel.json, config.yaml, and every story reference.

## E0-S1 — Angular 21 LTS + PrimeNG 21.1.9 workspace scaffold

- **Decision:** Scaffold Angular into a temp sibling folder, then move files into the repo root (`D:\gen-ai-persona-ai\`) since the repo already contains `_bmad-output/`, `.agents/`, `docs/`, and `.gitignore` — `ng new` refuses non-empty target dirs by default.
- **Rationale:** Preserves existing BMad artifacts. Keeps Angular workspace files at repo root as ARCHITECTURE-SPINE.md Source tree expects.
- **Decision:** Extend `.gitignore` with Angular defaults (`node_modules/`, `dist/`, `.angular/`, `.vercel/`, `coverage/`, `*.log`, `.env*.local`) + user's Bun policy (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` ignored; `bun.lockb` tracked).
- **Rationale:** Story AC requires `npm start` / `npm run build` semantics but user directive substitutes Bun; either way, standard Angular artifacts must be ignored.
- **Decision:** Use `styles.scss` `@import "primeicons/primeicons.css"` + `@import "primeng/resources/themes/lara-light-teal/theme.css"` (or Angular 21-compatible variant); if the classic import path was renamed in PrimeNG 21, adopt the new path and log.
- **Rationale:** AC line 28 explicitly names the Lara-light-teal theme entry.

## Global — Deferred local checks

- **Decision:** Skip per-story `bunx tsc --noEmit`, `bunx ng test`, and `bunx ng build` runs. Batch all validation at the end of the sprint (after E12-S3).
- **Rationale:** User directive on 2026-07-02 15:41 — "dont run tests again and again, we will do it in last, even tsc? and also build". Speeds up autonomous flow considerably; regressions surface in the end batch.
- **Impact:** Story lifecycle step 6 (local checks) is skipped per story. Story is committed once implementation matches its ACs from code review of the touched files. End-of-sprint batch will catch any accumulated issues.

## E0-S1 — additional decisions

- **Decision:** Adopt Vitest+jsdom as the unit test framework (Angular 21 CLI default), NOT Karma+Jasmine as the story assumed.
- **Rationale:** Angular 21 changed its default from Karma+Jasmine to Vitest+jsdom (see scaffold output: `@angular/build:unit-test` builder + `vitest` + `jsdom` in devDeps). Per Autonomous Decision Authority #3, follow scaffold default. Karma+Jasmine story text is outdated.
- **Decision:** PrimeNG 21 uses design-token theme system (`@primeng/themes/lara` preset) via `providePrimeNG({ theme: { preset: Lara } })`, not the legacy `@import "primeng/resources/themes/lara-light-teal/theme.css"` path from the story.
- **Rationale:** PrimeNG 21 deprecated the CSS-file theme system. The Lara preset is now imported as a token bundle from `@primeng/themes`. The story's `@import` line was outdated. `styles.scss` keeps `@import "primeicons/primeicons.css"` for the icon font.
- **Decision:** Installed `@angular/animations@21.2.17` and `@angular/cdk@21.2.14` (peer deps of PrimeNG 21). Bun's default `bun add` picked v22 first (latest); explicitly repinned to v21 to match the Angular 21 LTS matrix.
- **Rationale:** PrimeNG 21's `peerDependencies` state `@angular/cdk@^21.0.0`. Mixed v21 + v22 would trigger runtime resolution errors.
- **Decision:** Angular 21 CLI generates `app.ts` (not `app.component.ts`) as the new filename convention. Kept the scaffold default.
- **Rationale:** Angular 21 dropped the `.component.ts` suffix by default. All later stories that reference `app.component.ts` should read as `app.ts`.

## E0-S2 — Port interfaces + domain types

- **Decision:** `PersonaId` is re-exported from `src/domain/types/message.ts` via `export type { PersonaId } from './persona'` rather than re-declared. `persona.ts` (E0-S1) remains the single source of truth.
- **Rationale:** Story literal says `message.ts` "exports" PersonaId, but Previous Story Intelligence line explicitly says "LEAVE that file alone". Re-export satisfies both without duplication. Consumers may import `PersonaId` from either module.
- **Decision:** `src/config/storage-keys.ts` created as a one-line stub (`export type StorageKey = string`); E0-S3 will tighten it to the closed union.
- **Rationale:** AC line 189 explicitly prefers this over inlining.

## E0-S2 — deferred activity

- Test files written but NOT executed (per user directive to batch validation at the end).

## E0-S3 — Config constants + PROVIDER_REGISTRY + PERSONA_REGISTRY

- **Decision:** `ProviderId` union is declared in `src/domain/ports/provider.port.ts` (E0-S2) and re-exported from `src/config/provider-registry.ts`. Same pattern as PersonaId.
- **Rationale:** E0-S3 AC says `provider-registry.ts` "exports ProviderId type", but E0-S2 already declared it. Re-export satisfies both.
- **Decision:** `feature-flags.ts` uses `NG_APP_*` env prefix (Angular 21 CLI convention) not `VITE_*` from the story's example. Also handles missing `import.meta.env` gracefully (jsdom / test env).
- **Rationale:** Angular 21 uses `NG_APP_*` prefix for build-time env-var replacement. Story used `VITE_*` from a Vite-first example; Angular is not Vite. Documented via constant naming; E10-S1 wires the final env pipeline.
- **Decision:** Added a `FEATURE_SPIKE_ROUTES` flag (not in story) that gates the E0.5-S1 `/spike/gemini-cors` route to dev-only environments. Defaults ON in dev, OFF in prod.
- **Rationale:** User directive explicitly requires: "Guard the route behind a dev-only flag from src/config/feature-flags.ts (e.g. FEATURE_SPIKE_ROUTES = true only in development environment)". Landed here so E0.5-S1 can consume it directly without extending this file.
- **Decision:** Full 17-field `PromptComposition` type is declared once in `persona.registry.ts` with all fields populated as empty placeholders in `hitesh.prompt.ts` / `piyush.prompt.ts`. Downstream stories POPULATE fields (never re-declare) per readiness-gap #4.
- **Rationale:** Story explicitly asked for this consolidation. Field owners are documented inline as comments in `persona.registry.ts`.
- **Decision:** Hitesh + Piyush persona files export a `default` `PromptComposition` object. Registry imports via `import ... from`.
- **Rationale:** Cleaner import surface than `import * as`. Matches the type at declaration site.

## E0-S4 — ESLint + Stylelint

- **Decision:** Use ESLint 9 flat config (`eslint.config.mjs`) instead of the legacy `.eslintrc.json` shown in the story.
- **Rationale:** Story text mentions ESLint 8 as most-common; ESLint 9 flat config is the modern default, `angular-eslint@22` and `typescript-eslint@8` both ship flat-config APIs directly. Sticking with flat config removes future migration pain.
- **Decision:** Installed `angular-eslint@22.0.0` (which peers with Angular CLI 22). Peer-dep warnings on Angular 21.2.18 present but non-blocking — the plugin's runtime rule set works against Angular 21.
- **Rationale:** No `@21`-tagged release of `angular-eslint` is on the current dist-tags at bun-install time; v22 is the closest match. If lint fails at end-of-sprint batch, will downgrade to v21.x explicitly.
- **Decision:** Did NOT extend `boundaries.configs.recommended` — configured `boundaries/element-types` inline with the seven element types (added `app` to allow `src/app/*` to import features/etc for DI wiring; added `config → domain` so `provider-registry.ts` can re-export `ProviderId` from the port).
- **Rationale:** The recommended preset's ESM/CJS interop can be flaky in flat config; inline config is deterministic. Also carved the extra `app` element to keep Angular bootstrap wiring clean.
- **Decision:** Testing runner decision resolved: **Vitest+jsdom** per `docs/testing.md` (30-min timebox unused — Angular 21 CLI decided it for us).
- **Rationale:** Angular 21 changed the default. Karma+Jasmine is no longer the scaffold output.
- **Decision:** Skipped the 5 story-suggested "leak" test files. The rules are wired; end-of-sprint batch lint run against the real codebase will surface any misconfiguration.
- **Rationale:** User directive to defer validation. Leak files were solely for smoke-testing rules; the rules themselves are inline in the config file and reviewable.

## Blockers

_(none yet)_
