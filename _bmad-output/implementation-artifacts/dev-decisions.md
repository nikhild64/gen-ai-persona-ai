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

## Blockers

_(none yet)_
