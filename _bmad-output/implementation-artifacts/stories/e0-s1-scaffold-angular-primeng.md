# Story E0-S1: Angular 21 LTS + PrimeNG 21.1.9 workspace scaffold

Status: ready-for-dev

- **Epic:** 0 — Foundation
- **Critical-path position:** 1 of 37 (Day 1)
- **Blocks:** E0-S2, E0.5-S1, E12-S1
- **Depends on:** none

## Story

As a **solo developer**,
I want **an Angular 21.2.x LTS workspace with PrimeNG 21.1.9, TypeScript 5.9.x, RxJS 7.x, and Vercel deploy config pre-wired**,
So that **all subsequent epics can `import` from a working framework without reworking build/deploy plumbing later**.

## Acceptance Criteria

**Given** an empty repo cloned on Node 22 LTS,
**When** the developer runs `npx @angular/cli@21 new gen-ai-persona-ai --standalone --routing --style=scss`,
**Then** the workspace is created with Angular 21.2.x and standalone components + signals enabled by default.

**Given** the fresh workspace,
**When** the developer runs `npm install primeng@21.1.9 primeicons idb-keyval@^6 @vercel/analytics @vercel/speed-insights`,
**Then** `package.json` lists exact versions (`primeng: "21.1.9"`, `idb-keyval: "^6.0.0"`) and `npm run start` (aliased to `ng serve`) launches a blank Angular shell on `http://localhost:4200` without errors.

**Given** the workspace is running,
**When** the developer imports one PrimeNG primitive (`p-button`) into `app.component.html`,
**Then** the button renders with PrimeNG's default theme wired via `styles.scss` `@import "primeng/resources/themes/lara-light-teal/theme.css";` (or equivalent Angular 21-compatible theme entry).

**Given** the developer has a Vercel account,
**When** they add `vercel.json` at repo root with `{ "framework": "angular", "outputDirectory": "dist/gen-ai-persona-ai/browser" }` and push to GitHub main,
**Then** Vercel builds the static bundle successfully (verified via Vercel dashboard or CLI).

**Given** `tsconfig.json` is set up,
**When** the developer defines `type PersonaId = 'hitesh' | 'piyush'` and `assertNever(x: never): never` in `src/domain/types/persona.ts`,
**Then** TypeScript compiles cleanly at `strict: true` and the type is importable from feature files.

**verifies:** AD-1 (Pure-FE topology enabled via static bundle deploy), Stack table (Angular 21.2.x, PrimeNG 21.1.9, RxJS 7, TypeScript 5.9, Node 22, idb-keyval 6, Vercel Hobby)

**touches:** `package.json`, `angular.json`, `tsconfig.json`, `vercel.json`, `styles.scss`, `src/app/app.component.ts`, `src/domain/types/persona.ts`

**test target:** manual smoke test (`ng serve` + `ng build` + Vercel deploy preview succeed) + unit test (`assertNever` compiles and traps at runtime for unknown persona value)

## Developer Context

This is the very first story — the scaffold that everything else builds on. AD-1 (Pure-FE Topology) makes the Angular static bundle the entire product. There is no BE except a possible Spike-0 fallback proxy at Epic 0.5. Every dependency choice here has been verified against live sources on 2026-07-02 (see ARCHITECTURE-SPINE.md Stack table).

**Persona-agnostic scaffold — no persona logic in this story.** Persona-specific work starts in E0-S3 (PERSONA_REGISTRY) and E2-S2 (PromptAssembler).

**One-time bootstrap moves:**
1. `npx @angular/cli@21 new gen-ai-persona-ai --standalone --routing --style=scss` — must pin `@angular/cli@21` (not `latest`), and pass the three flags (standalone/routing/scss). Do NOT accept the CLI's interactive "SSR?" prompt — this app is Pure-FE static build only per AD-1.
2. Install PrimeNG **exactly** at 21.1.9 (not `^21.1.9` — the exact pin matches AD Stack table LTS combo with Angular 21.2.x per https://primeng.org/lts).
3. Wire `styles.scss` for PrimeNG's Lara theme entry (Angular 21 uses newer style-registration paths than Angular 17 — check PrimeNG 21.1.9 CHANGELOG if the classic `@import` doesn't resolve).
4. `vercel.json` at repo root — Angular framework preset + explicit `outputDirectory: "dist/gen-ai-persona-ai/browser"` (Angular 21 outputs into a `browser/` subfolder; this trips people up).

## Technical Requirements

- **Angular 21.2.x LTS** with **standalone components + signals** enabled by default (that's the `--standalone` flag).
- **TypeScript 5.9.x** at `strict: true` (Angular 21 requires it per https://angular.dev/reference/versions).
- **RxJS 7.x** (Angular 21 supports only `^6.5.3 || ^7.4.0`; use 7 for future-compat).
- **Node 22 LTS or newer** for build + eval.
- **idb-keyval 6.x** installed now (used in Epic 3, but land dep here).
- `tsconfig.json` `strict: true` with `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noFallthroughCasesInSwitch` all enabled.
- Repo scripts required in `package.json`: `start`, `build`, `lint`, `test`. `test:ci` and `test:watch` land in E0-S4 alongside runner pick.
- Vercel deploy config: `framework: "angular"`, `outputDirectory: "dist/gen-ai-persona-ai/browser"`. No serverless functions here; that's an E0.5 conditional.

## Architecture Compliance

**AD-1 (Pure-FE Topology):** The Angular static bundle IS the entire product. No SSR, no server-side runtime, no backend services in this scaffold. Any `.ts` file that touches `fs`, `http server`, or Node-specific APIs is a violation. (One narrow exception: a `api/gemini.ts` Vercel Serverless Function IF Spike-0 fallback (b) fires at Epic 0.5 — but that's a conditional future story, not this one.)

**Directory structure per ARCHITECTURE-SPINE.md Source tree:**
- Create `src/domain/`, `src/personas/`, `src/infrastructure/`, `src/features/`, `src/shared/`, `src/config/` as empty top-level folders (or with `.gitkeep`) — subsequent stories populate them.
- `src/domain/types/persona.ts` is the ONLY domain file created in this story (holds `PersonaId` + `assertNever`).
- `src/app/app.component.ts` renders one PrimeNG `<p-button>` as the smoke-test proof.

**`assertNever` shape (canonical):**

```ts
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

This function is referenced by every discriminated-union switch in the codebase (AD-7 for PersonaId, AD-8 for PromptMode, AD-15 for AnalyticsEvent). Land it here as a shared helper that later stories can `import { assertNever } from '@domain/types/persona'` (or wherever the eventual barrel lands — a single file is fine at this point).

## Library / Framework Requirements

Exact versions to install (per ARCHITECTURE-SPINE.md Stack table + PrimeNG LTS matrix):

```
@angular/cli@21          # via npx one-time
@angular/core@21.2.x     # scaffolded by CLI
@angular/router@21.2.x   # scaffolded
typescript@5.9.x         # Angular 21 dep
rxjs@7.x                 # explicit
primeng@21.1.9           # EXACT pin, LTS combo
primeicons               # PrimeNG icon set
idb-keyval@^6            # Epic 3 dep, land here
@vercel/analytics        # AD-15 impl in Epic 2
@vercel/speed-insights   # AD-21 measurement
```

**Do NOT install yet (defer to later epics):**
- `eslint-plugin-boundaries` — E0-S4
- `stylelint` + plugins — E0-S4
- `playwright` — E11-S3
- `tsx` — Epic 11 eval runner
- `highlight.js` OR `shiki` — E2-S4 (bundle-budget conscious pick)

## File Structure Requirements

Empty scaffolded folders at end of story:

```
gen-ai-persona-ai/
  src/
    app/
      app.component.ts       # renders <p-button>test</p-button> smoke
      app.component.html
      app.config.ts          # Angular 21 standalone bootstrap
      app.routes.ts          # empty [], child routes added in later stories
    domain/
      types/
        persona.ts           # PersonaId + assertNever (ONLY file this story creates in domain/)
    personas/                # .gitkeep only
    infrastructure/          # .gitkeep only
    features/                # .gitkeep only
    shared/                  # .gitkeep only
    config/                  # .gitkeep only
    styles.scss              # PrimeNG theme @import
  public/                    # avatar placeholders live here later (E1-S1)
  angular.json
  package.json
  tsconfig.json
  vercel.json
  README.md                  # placeholder — E12-S1 authors the real one
```

## Testing Requirements

- **Manual smoke test:** `npm start` serves `localhost:4200` without console errors; `<p-button>` renders with Lara theme; `npm run build` produces `dist/gen-ai-persona-ai/browser/index.html` + JS bundles; `vercel dev` (if CLI installed) or a Vercel deploy preview from `main` push succeeds.
- **Unit test:** `src/domain/types/persona.spec.ts` — `assertNever` with a `never`-cast value throws at runtime; TypeScript refuses to compile a call to `assertNever` with a legitimate `PersonaId` value in the default arm of a switch (compile-error test via `// @ts-expect-error`).
- Karma+Jasmine is the Angular 21 default; do NOT swap for Vitest here — that decision lands in E0-S4.

## Latest Tech Information

- **Angular 21** released Nov 2025, LTS through Nov 2027 (active until May 2027 per https://angular.dev/reference/versions).
- **PrimeNG 21.1.9** released 2026-06-04 per https://github.com/primefaces/primeng/blob/master/CHANGELOG.md — LTS combo with Angular 21 per https://primeng.org/lts.
- **Vercel Angular framework preset** for Angular 17+ uses `outputDirectory: dist/<project>/browser` (double-check via `vercel dev` output on first deploy).
- **Signals** and **standalone components** are Angular 21 defaults — no `NgModules` needed for anything this scaffold creates.

## Previous Story Intelligence

None — this is story 1 of 37.

## Project Context Reference

- Full source tree: `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/ARCHITECTURE-SPINE.md` (Source tree section, lines 405–510).
- Stack table: same file, lines 340–356.
- AD-1 (Pure FE): same file, lines 66–71.
- Consistency conventions: same file, lines 311–335 (kebab-case files, PascalCase classes, camelCase functions, SCREAMING_SNAKE_CASE constants).
- Sprint status entry: `_bmad-output/implementation-artifacts/sprint-status.yaml` key `e0-s1-scaffold-angular-primeng`.

## References

- [Source: ARCHITECTURE-SPINE.md#Stack] Angular 21.2.x LTS, PrimeNG 21.1.9, TypeScript 5.9.x, RxJS 7, Node 22, idb-keyval 6, Vercel Hobby.
- [Source: ARCHITECTURE-SPINE.md#AD-1] Pure-FE topology; static Angular bundle IS the entire product.
- [Source: epics/stories/epic-00-foundation.md#Story E0-S1] Full AC list + touches + test target.
- [Source: sprint-status.yaml#dependency_chain.e0-s1-scaffold-angular-primeng] `blocks: [e0-s2-port-interfaces-domain-types, e0-5-s1-spike-zero-gemini-cors, e12-s1-readme-license-and-core-docs]`.

## Story Completion Status

- [ ] Angular 21.2.x workspace created via CLI at `npx @angular/cli@21 new` with `--standalone --routing --style=scss`.
- [ ] PrimeNG 21.1.9 pinned + PrimeIcons + idb-keyval@^6 + @vercel/analytics + @vercel/speed-insights installed.
- [ ] `styles.scss` wires Lara-light-teal (or Angular 21-compatible variant) PrimeNG theme.
- [ ] `vercel.json` at repo root with `framework: "angular"` + `outputDirectory: "dist/gen-ai-persona-ai/browser"`.
- [ ] `src/domain/types/persona.ts` exports `PersonaId` union + `assertNever` helper; compiles at `strict: true`.
- [ ] `npm start` renders `<p-button>` on `localhost:4200` without console errors.
- [ ] `npm run build` produces the browser bundle at the expected path.
- [ ] Vercel deploy preview from `main` push succeeds (or `vercel dev` succeeds locally).
- [ ] Empty scaffolded folders (`personas/`, `infrastructure/`, `features/`, `shared/`, `config/`) exist per Source tree.
- [ ] Unit test on `assertNever` in place under Karma+Jasmine default.
