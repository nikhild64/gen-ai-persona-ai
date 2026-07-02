# Testing Framework Decision

## Runner: Vitest + jsdom (Angular 21 CLI default)

**Chosen by Angular 21 CLI scaffold on 2026-07-02.** The Karma-vs-Vitest deferred decision from `ARCHITECTURE-SPINE.md` §Deferred is resolved in favour of Vitest — the framework itself resolved it: `ng new` in Angular 21.2 no longer scaffolds Karma+Jasmine, it lands `vitest` + `jsdom` + the `@angular/build:unit-test` builder.

## Why Vitest here

- Angular 21 CLI default (E0-S1 half-hour timebox: zero minutes spent because it was the scaffold output — 30-min budget respected).
- Native ESM + TypeScript with no compile step for specs.
- Fast startup; watches only changed files.
- Shares Vite's `import.meta.env` build-time env-var pipeline that E0-S3 `feature-flags.ts` targets.

## Runner mechanics (Angular 21 + Vitest)

- Builder `@angular/build:unit-test` bridges `ng test` → Vitest. `ng test --watch=false` is the CI mode.
- Specs use `import { describe, it, expect } from 'vitest';` (no globals implicit — imports are explicit).
- Test environment: `jsdom`.
- Angular TestBed still works (E0-S1 verified with `App` spec).

## Scripts (see `package.json`)

- `bun run test` → interactive watch (`ng test`).
- `bun run test:ci` → single-run for CI + end-of-sprint validation (`ng test --watch=false`).
- `bun run lint` → `eslint` on `src/**/*.ts` + `stylelint` on `src/**/*.scss`.
- `bun run typecheck` → strict `tsc --noEmit` for both `tsconfig.app.json` and `tsconfig.spec.json`.

## Not chosen

- **Karma+Jasmine** — no longer the Angular 21 default; adding it back requires unwinding the scaffold. Not worth the ~1 hour on a solo sprint.
- **Vitest via `@analogjs/vitest-angular`** — not needed; Angular 21's own `@angular/build:unit-test` covers Vitest integration.
