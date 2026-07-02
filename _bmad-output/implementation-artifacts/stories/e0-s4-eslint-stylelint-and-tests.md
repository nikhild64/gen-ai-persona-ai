# Story E0-S4: ESLint boundary rules + Stylelint theme-vars rule + assertContrast test wiring

Status: ready-for-dev

- **Epic:** 0 — Foundation
- **Critical-path position:** 4 of 37 (Day 1)
- **Blocks:** E2-S1, E2-S2, E4-S2
- **Depends on:** E0-S3

## Story

As a **solo developer**,
I want **ESLint + Stylelint configured so a boundary-violating import, an unlisted CSS custom property, or a Hinglish signature phrase in feature code fails `npm run lint`**,
So that **every downstream epic's story cannot accidentally ship a violation — the enforcement is machine, not memory**.

## Acceptance Criteria

**Given** `.eslintrc.json` at repo root,
**When** the developer adds `eslint-plugin-boundaries` config restricting `src/domain/` from importing `src/infrastructure/` or `src/features/`, and `src/features/` from importing `src/infrastructure/`,
**Then** a test file at `src/features/chat/leak.ts` that does `import { GeminiAdapter } from '../../infrastructure/providers/gemini.adapter';` fails `npm run lint` with a boundary-violation error message.

**Given** the boundaries rule is wired,
**When** the developer adds `no-restricted-globals` in `.eslintrc.json` banning `localStorage`, `sessionStorage`, `caches`, `indexedDB`, `document.cookie` for every path except `src/infrastructure/storage/idb-keyval.adapter.ts` and `src/domain/key-vault/key-vault.service.ts`,
**Then** a test file at `src/features/settings/leak.ts` that references `localStorage.setItem('foo', 'bar')` fails `npm run lint`, and the same reference inside `src/domain/key-vault/key-vault.service.ts` passes.

**Given** `no-restricted-globals` is wired,
**When** the developer adds `no-restricted-imports` in `.eslintrc.json` banning `*.adapter.ts` direct-import from `src/features/**` and `src/domain/**`,
**Then** a test file at `src/features/chat/leak2.ts` that imports directly from `../../infrastructure/providers/gemini.adapter` fails `npm run lint`.

**Given** `no-restricted-imports` is wired,
**When** the developer adds `no-restricted-syntax` in `.eslintrc.json` banning string literals matching `/Haanji|Chai ke saath|देखो|यार|बात समझ आई|कुछ नहीं है/` inside `src/features/**` and `src/shared/**` (excluding `src/config/product-copy.ts`),
**Then** a test file at `src/features/settings/leak3.ts` that hard-codes `const greeting = 'Haanji';` fails `npm run lint`, and the same string literal inside `src/personas/hitesh.prompt.ts` passes.

**Given** `no-restricted-syntax` is wired,
**When** the developer adds a second `no-restricted-syntax` rule banning re-declaration of the AD-9 constants (`VERBATIM_TAIL_LENGTH`, `SUMMARY_REFRESH_CADENCE`, `SUMMARY_TOKEN_BUDGET_PCT`, `DRIFT_REFRESH_FIRST_TURN`, `DRIFT_REFRESH_CADENCE`, `MAX_TURNS_PER_THREAD`, `KEEP_GOING_ROUNDS`, `STREAM_STALL_TIMEOUT_MS`, `THEME_VARS`, `STORAGE_KEYS`, `PROVIDER_REGISTRY`) outside their canonical files,
**Then** a re-declaration in `src/features/chat/leak4.ts` fails lint.

**Given** `.stylelintrc.json` at repo root,
**When** the developer adds `declaration-property-value-allowed-list` for CSS custom properties matching `/^--persona-/` restricted to the five vars in `theme-vars.ts` (`--persona-accent`, `--persona-bubble-bg`, `--persona-avatar-url`, `--persona-code-block-emphasis`, `--persona-input-placeholder-style`),
**Then** a component `.scss` file that uses `--persona-madeup-var: red;` fails `npm run stylelint`, and one using `--persona-accent: red;` passes.

**Given** the Stylelint rule is wired,
**When** the developer authors `src/config/persona-theme-check.spec.ts`,
**Then** the test file imports `assertContrast` and asserts (a) throws for `#FFFFFF` on `#FEF3C7` (amber-100 with white text — contrast ~1.7:1, way below 4.5:1), (b) passes for `#1C1917` on `#FFFFFF` (stone-900 on white = 17.4:1), and (c) is included in the CI `ng test` run.

**Given** all lint + stylelint + test scripts are set up,
**When** the developer decides between Karma+Jasmine (Angular 21 default) or Vitest (per Deferred item in ARCHITECTURE-SPINE.md),
**Then** the decision is captured in `docs/testing.md` (or a `.memlog.md` entry) and `package.json` scripts (`test`, `test:ci`, `test:watch`) are wired to the chosen runner. Vitest is preferred for speed if it can be integrated with Angular 21 within a half-hour timebox; otherwise Karma+Jasmine stays as the default.

**verifies:** AD-2 (boundary enforcement machine-enforceable), AD-3 (no-restricted-imports on `*.adapter.ts`), AD-6 (no-restricted-globals on browser storage APIs), AD-8 + AD-9 (no-restricted-syntax on constant re-declaration), AD-17 (Stylelint restriction to THEME_VARS), AD-20 (assertContrast test), AD-22 (no-restricted-syntax on Hinglish signature phrases in features/shared)

**touches:** `.eslintrc.json`, `.stylelintrc.json`, `src/config/persona-theme-check.spec.ts`, `package.json` (scripts: `lint`, `stylelint`, `test`), `docs/testing.md` (or `.memlog.md` entry for the Karma-vs-Vitest pick)

**test target:** unit test (assertContrast passes / throws as expected) + manual smoke test (each of the 5 lint violation examples above triggers a lint failure when a temporary test file is added, then the test file is deleted)

## Developer Context

This story turns architecture invariants into **machine enforcement**. Every AD (2, 3, 6, 8, 9, 17, 22) that says "banned by ESLint" or "restricted by Stylelint" lands here. After this story, downstream stories cannot accidentally ship a violation — the lint fails.

**Golden path:** each lint rule gets a matching "leak" test file that PROVES the rule catches a violation. The 5 example leaks in the AC are throwaway files — write them, run lint, confirm failure, delete. Land the delete in the same commit as the rule.

**Karma vs Vitest:** Angular 21 default is Karma+Jasmine. Vitest integration exists via `@analogjs/vitest-angular` or similar but is not first-class in Angular 21.2.x. The half-hour timebox is real — if Vitest doesn't come up cleanly in 30 min, stick with Karma+Jasmine. Log the decision in `.memlog.md`.

## Technical Requirements

### `.eslintrc.json` — five rule groups

**1. `eslint-plugin-boundaries` (AD-2):**

```json
{
  "plugins": ["boundaries"],
  "settings": {
    "boundaries/elements": [
      { "type": "domain", "pattern": "src/domain/**" },
      { "type": "personas", "pattern": "src/personas/**" },
      { "type": "infrastructure", "pattern": "src/infrastructure/**" },
      { "type": "features", "pattern": "src/features/**" },
      { "type": "shared", "pattern": "src/shared/**" },
      { "type": "config", "pattern": "src/config/**" }
    ]
  },
  "rules": {
    "boundaries/element-types": [
      "error",
      {
        "default": "disallow",
        "rules": [
          { "from": "domain", "allow": ["domain", "personas", "config"] },
          { "from": "personas", "allow": ["domain", "config"] },
          { "from": "infrastructure", "allow": ["domain", "config"] },
          { "from": "features", "allow": ["domain", "personas", "shared", "config"] },
          { "from": "shared", "allow": ["domain", "config"] },
          { "from": "config", "allow": [] }
        ]
      }
    ]
  }
}
```

Domain cannot import infrastructure; features cannot import infrastructure; config imports nothing.

**2. `no-restricted-globals` (AD-6, AD-11):**

Ban `localStorage`, `sessionStorage`, `caches`, `indexedDB`, `document.cookie` everywhere EXCEPT:
- `src/infrastructure/storage/idb-keyval.adapter.ts` (StoragePort impl)
- `src/domain/key-vault/key-vault.service.ts` (BYO-Key sessionStorage per AD-11)

Use ESLint `overrides` to exempt those two files. Global rule + two overrides is the cleanest pattern.

**3. `no-restricted-imports` (AD-3):**

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/infrastructure/**/*.adapter"],
        "message": "Adapters must be accessed via PROVIDER_REGISTRY / STORAGE_PORT / MODERATION_PORT / ANALYTICS_PORT — never direct-import."
      }]
    }]
  }
}
```

Exempt `src/infrastructure/**` itself (adapters can import each other for shared helpers if needed) and `src/app/app.config.ts` (Angular DI wiring in E3-S1 needs to name the concrete class).

**4. `no-restricted-syntax` — Hinglish signature phrases (AD-22):**

```json
{
  "rules": {
    "no-restricted-syntax": ["error", {
      "selector": "Literal[value=/Haanji|Chai ke saath|देखो|यार|बात समझ आई|कुछ नहीं है/]",
      "message": "Hinglish signature phrases live in src/personas/*.prompt.ts or src/personas/persona.registry.ts — never in src/features/** or src/shared/**."
    }]
  },
  "overrides": [
    {
      "files": ["src/personas/**/*.ts", "src/config/product-copy.ts"],
      "rules": { "no-restricted-syntax": "off" }
    }
  ]
}
```

Also matches TemplateLiteral quasi text — use the AST selector for `TemplateElement` too if template strings need coverage.

**5. `no-restricted-syntax` — constant re-declaration (AD-8, AD-9, AD-17):**

Ban `const VERBATIM_TAIL_LENGTH`, `const SUMMARY_REFRESH_CADENCE`, `const SUMMARY_TOKEN_BUDGET_PCT`, `const DRIFT_REFRESH_FIRST_TURN`, `const DRIFT_REFRESH_CADENCE`, `const MAX_TURNS_PER_THREAD`, `const KEEP_GOING_ROUNDS`, `const STREAM_STALL_TIMEOUT_MS`, `const THEME_VARS`, `const PROVIDER_REGISTRY`, `const PROVIDER_DEFAULT_ROUTING`, `const ASK_BOTH_SYSTEM_NOTE_TEMPLATE`, `const ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE`, `const ASK_BOTH_SUMMARY_PROVIDER_ID`, `const HITESH_REGEX`, `const PIYUSH_REGEX`, `const PERSONA_REGISTRY`, `const PERSONA_MODEL_PARAMS` in every file EXCEPT their canonical files.

Selector: `VariableDeclarator[id.name=/^(VERBATIM_TAIL_LENGTH|...)$/]` with a specific override per canonical path. `estimateTokens`, `assistantMessageCount`, `expectedAssistantMessagesForMode` from E5-S1 join this list — but this story lands the initial set; E5-S1 EXTENDS.

### `.stylelintrc.json` (AD-17)

```json
{
  "rules": {
    "declaration-property-value-allowed-list": {
      "/^--persona-/": [
        "/.*/"
      ]
    },
    "at-rule-no-unknown": true,
    "custom-property-pattern": "^persona-(accent|bubble-bg|avatar-url|code-block-emphasis|input-placeholder-style)$"
  }
}
```

Use `custom-property-pattern` (Stylelint 15+) to restrict `--persona-*` names to the 5 in `theme-vars.ts`. Any `--persona-madeup-var` fails.

### `package.json` scripts

```json
{
  "scripts": {
    "start": "ng serve",
    "build": "ng build",
    "lint": "ng lint && stylelint 'src/**/*.scss'",
    "stylelint": "stylelint 'src/**/*.scss'",
    "test": "ng test",
    "test:ci": "ng test --watch=false --browsers=ChromeHeadless",
    "test:watch": "ng test"
  }
}
```

If Vitest is chosen, `test` invokes `vitest`; document in `docs/testing.md`.

### `src/config/persona-theme-check.spec.ts`

Full test:

```ts
import { assertContrast } from './persona-theme-check';

describe('assertContrast', () => {
  it('throws when contrast is below 4.5:1 for normal text', () => {
    expect(() => assertContrast('#FEF3C7', '#FFFFFF')).toThrow(); // amber-100 bg + white fg ~1.7:1
  });
  it('passes when contrast is >= 4.5:1', () => {
    expect(() => assertContrast('#FFFFFF', '#1C1917')).not.toThrow(); // white bg + stone-900 fg = 17.4:1
  });
  it('allows 3:1 for large-text mode (AA large-text)', () => {
    expect(() => assertContrast('#D97706', '#FFFFFF', 'large-text')).not.toThrow(); // amber-600 white 3.13:1
    expect(() => assertContrast('#D97706', '#FFFFFF')).toThrow(); // same combo fails normal-text threshold
  });
});
```

### `docs/testing.md` (or `.memlog.md` entry)

Document the runner pick (Karma+Jasmine or Vitest) with 2-line rationale + the 30-min timebox note.

## Architecture Compliance

- **AD-2:** `eslint-plugin-boundaries` enforces domain → not infrastructure; features → not infrastructure.
- **AD-3:** `no-restricted-imports` bans direct `*.adapter.ts` imports from features/domain.
- **AD-6:** `no-restricted-globals` bans browser-persistence APIs outside the 2 whitelisted files.
- **AD-8:** `no-restricted-syntax` bans re-declaring `ASK_BOTH_SYSTEM_NOTE_TEMPLATE` etc. outside canonical file.
- **AD-9:** `no-restricted-syntax` bans re-declaring all 8 context-config constants outside `context-config.ts`.
- **AD-17:** Stylelint `custom-property-pattern` restricts to the 5 THEME_VARS.
- **AD-20:** `assertContrast` unit test lands here + runs in CI.
- **AD-22:** `no-restricted-syntax` catches Hinglish signature phrases in feature/shared code.

## Library / Framework Requirements

New devDependencies:

```
eslint@8.x                          # Angular 21 uses ESLint 8; ESLint 9 flat-config is possible but not first-class in ng-cli
@angular-eslint/eslint-plugin@21.x
@angular-eslint/eslint-plugin-template@21.x
@angular-eslint/template-parser@21.x
@typescript-eslint/eslint-plugin@8.x
@typescript-eslint/parser@8.x
eslint-plugin-boundaries@4.x
stylelint@16.x
stylelint-config-standard@36.x
stylelint-config-standard-scss@13.x
```

If Vitest is chosen (optional per AC):

```
vitest@1.x
@analogjs/vitest-angular@1.x        # or equivalent Angular 21 integration
```

## File Structure Requirements

```
gen-ai-persona-ai/
  .eslintrc.json         # boundaries + no-restricted-globals + no-restricted-imports + no-restricted-syntax (2 rules)
  .stylelintrc.json      # theme-vars restriction
  package.json           # scripts updated
  src/config/
    persona-theme-check.spec.ts   # assertContrast test (executes in ng test)
  docs/
    testing.md           # Karma-vs-Vitest decision + rationale
```

## Testing Requirements

- Manual smoke test per AC: create each of the 5 temporary leak files, run `npm run lint`, confirm each fails with the expected rule name in the error message, delete the file. Then run `npm run lint` on the real codebase — must pass (no violations).
- `npm run stylelint` on a temporary `.scss` with `--persona-madeup-var: red;` fails; with `--persona-accent: red;` passes.
- `npm test` runs `persona-theme-check.spec.ts` and all E0-S2 + E0-S3 specs; all pass.

## Latest Tech Information

- ESLint 9 uses flat config (`eslint.config.js`) — Angular ESLint 21.x supports both but the classic `.eslintrc.json` is still the shortest path in Angular 21.2.x. If flat config is preferred, the migration is well-documented.
- `eslint-plugin-boundaries` v4 supports the modern element-type pattern; v3 is legacy.
- Stylelint 16 dropped some legacy rules; verify `declaration-property-value-allowed-list` still accepts regex patterns (it does per Stylelint 16 docs).
- Angular 21 CLI has `ng lint` built-in via `@angular-eslint/schematics` — install via `ng add @angular-eslint/schematics@21` for the wiring.

## Previous Story Intelligence

**E0-S3 (Config + registries):**
- All 11 config files exist. `THEME_VARS = [...5 vars...] as const` is in `theme-vars.ts`.
- `assertContrast` is in `persona-theme-check.ts` — this story writes the SPEC that exercises it.
- `PERSONA_REGISTRY`, `PROVIDER_DEFAULT_ROUTING`, `ASK_BOTH_SYSTEM_NOTE_TEMPLATE`, all AD-9 constants exist in their canonical files.
- Persona skeletons `hitesh.prompt.ts` + `piyush.prompt.ts` have `identityBlock` + `voiceRules` populated verbatim with Hinglish strings — the ESLint override for `src/personas/**` MUST include these files, else the entire persona voice fails lint.

**E0-S2:**
- All ports + domain types exist; `import { PersonaId } from '@domain/types/message'` (or equivalent path) resolves.

**E0-S1:**
- Angular 21 workspace + `strict: true` + Karma+Jasmine default.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-2` (Hexagonal, lines 72–76), `AD-3` (ProviderPort SSOT, lines 78–89), `AD-6` (StoragePort discipline, lines 106–114), `AD-9` (context-config shadowing ban, lines 141–155), `AD-11` (KEY_PATTERN compile-time enforcement, lines 167–175), `AD-17` (THEME_VARS closed set, lines 252–263), `AD-22` (product-copy separation + ESLint restriction, lines 300–309).
- Consistency Conventions table `Imports (boundary enforcement)` row (line 334) — `eslint-plugin-boundaries` OR `dependency-cruiser`.
- Deferred item: "Testing framework pick (Karma+Jasmine vs Jest vs Vitest) — deferred to Epic 0 kickoff. Angular 21 LTS scaffolds Karma+Jasmine by default. If replaced with Vitest at Epic 0, the choice is documented..." — this story is that documentation event.
- Sprint status: key `e0-s4-eslint-stylelint-and-tests`, blocks `[e2-s1-provider-adapters-and-registry, e2-s2-prompt-assembler-solo, e4-s2-persona-theming-transition]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-2] Boundary rule (`eslint-plugin-boundaries` on `src/domain/` and `src/features/`).
- [Source: ARCHITECTURE-SPINE.md#AD-3] `no-restricted-imports` on `*.adapter.ts` direct-import.
- [Source: ARCHITECTURE-SPINE.md#AD-6] `no-restricted-globals` on `localStorage`/`sessionStorage`/`caches`/`indexedDB`/`document.cookie`.
- [Source: ARCHITECTURE-SPINE.md#AD-9] `no-restricted-syntax` bans re-declaring 8 context-config constants + `THEME_VARS` + `PROVIDER_REGISTRY` outside canonical files.
- [Source: ARCHITECTURE-SPINE.md#AD-17] Stylelint `declaration-property-value-allowed-list` restricting `--persona-*`.
- [Source: ARCHITECTURE-SPINE.md#AD-20] `assertContrast` Vitest/Karma test in `src/config/persona-theme-check.ts`.
- [Source: ARCHITECTURE-SPINE.md#AD-22] ESLint `no-restricted-syntax` on Hinglish signature phrases in `src/features/**` and `src/shared/**` excluding `product-copy.ts`.
- [Source: ARCHITECTURE-SPINE.md#Deferred] Karma-vs-Vitest deferred to Epic 0 kickoff — half-hour timebox.

## Story Completion Status

- [ ] `.eslintrc.json` at repo root with all 5 rule groups (boundaries, no-restricted-globals, no-restricted-imports, no-restricted-syntax × 2).
- [ ] `.stylelintrc.json` at repo root with `custom-property-pattern` restricting `--persona-*` to the 5 THEME_VARS.
- [ ] `package.json` scripts: `lint`, `stylelint`, `test`, `test:ci`, `test:watch` wired.
- [ ] `src/config/persona-theme-check.spec.ts` executes 3 assertions on `assertContrast`; passes in `ng test`.
- [ ] Manual smoke tests: each of the 5 leak files triggers the expected lint failure; deleted post-verification.
- [ ] `npm run lint` on the real E0-S3 codebase passes (zero violations).
- [ ] `docs/testing.md` (or `.memlog.md` entry) documents the Karma-vs-Vitest pick + 30-min timebox rationale.
- [ ] devDependencies pinned in `package.json` per the version list above.
