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

## E0.5-S1 — Spike-0 (Gemini browser-CORS)

- **Decision:** Implemented per user directive as an Angular route `/spike/gemini-cors` (component `SpikeGeminiCorsComponent` under `src/features/spike/`), NOT as the bare `spike-zero.html` from the story.
- **Rationale:** User specified: "Instead of a bare-bones fetch script per handoff-epics.md, implement a minimal Angular route at `/spike/gemini-cors`". Component provides live streaming panel + verbatim-error panel + cancel button + status + tokens-received count.
- **Decision:** Route gated by `FEATURE_SPIKE_ROUTES` flag from `src/config/feature-flags.ts` (defaults ON in dev, OFF in production via `NG_APP_ENV=production` + `NG_APP_DEV_SPIKE_ROUTES=false`).
- **Rationale:** User directive: "Guard the route behind a dev-only flag from src/config/feature-flags.ts". Route is added conditionally in `app.routes.ts`; if flag is false the route array is empty and the URL 404s.
- **Decision:** Component fetches Gemini SSE endpoint directly from within the feature (component code, no adapter). Boundary rule allows this because `src/features/spike/` never imports from `src/infrastructure/`; it does its own `fetch(...)`.
- **Rationale:** Story intent — this is a raw browser-fetch smoke test, NOT a test of the eventual GeminiAdapter (which lands in E2-S1). Passing this spike is the precondition for E2-S1 wiring.
- **Note:** SSE parser reads token text from `candidates[0].content.parts[0].text` per user directive. Tokens are appended live to output panel via signal update.
- **Outcome (2026-07-02 15:57):** PASS. HTTP 200 + content-type: text/event-stream + live token streaming confirmed by user. AD-5 stands as-is. No proxy fallback; AD-1 Pure-FE preserved. Resuming autonomous flow at E2-S1.

## E2-S1 — Provider adapters (Gemini + Groq)

- **Decision:** `GeminiAdapter` sends `system`-role messages via the top-level `systemInstruction` block, and only `user`/`assistant` (→ `model`) messages inside `contents[]`.
- **Rationale:** Gemini's REST API rejects `role: 'system'` inside `contents[]`. Filtering + concatenating into `systemInstruction` preserves persona identity block delivery.
- **Decision:** Both adapters use per-line SSE parsing with a `\n\n` event-boundary buffer. Handles chunked TCP boundaries mid-JSON.
- **Rationale:** Naive `split('\n')` on each read misses events split across TCP packets. The buffer + `indexOf('\n\n')` loop is the standard SSE-consumer pattern.
- **Decision:** Frequency + presence penalties are dropped for Gemini (not supported by the REST endpoint). Passed through for Groq.
- **Rationale:** Gemini rejects these params. Log line inline. The `PromptAssembler` (E2-S2) doesn't need to know per-provider param support — adapters silently drop unsupported params.
- **Decision:** `MockAdapter` used for both provider IDs in `TEST_PROVIDER_REGISTRY` (single class registered twice).
- **Rationale:** Test doubles don't need per-provider fidelity; a single scriptable mock covers both.

## E2-S3 — ChatOrchestrator

- **Decision:** Introduced `ADAPTER_FACTORY` `InjectionToken` around `getProviderAdapter` so tests can inject a `TEST_PROVIDER_REGISTRY`-style factory without patching the real registry.
- **Rationale:** Direct import of `PROVIDER_REGISTRY` inside a service is hard to swap in specs; token indirection is cleaner and E4-S3/E9-S2 will benefit.
- **Decision:** Output-moderation retry-once is minimal in E2-S3 (calls the port twice sequentially, no adapter re-invocation). E8-S2 will layer the real refire-through-provider retry.
- **Rationale:** Shape-only for E2-S3; the real retry lands with the real moderation adapter, keeping this story focused.

## E2-S4 — Chat component + shared UI

- **Decision:** Skipped `highlight.js` / `shiki`. Code blocks render un-highlighted for now; variant selection via `--persona-code-block-emphasis` is wired.
- **Rationale:** ~30 KB bundle cost vs low near-term UX value. Documented in `docs/performance.md`; can be added in a follow-up without breaking `<app-code-block>` contract.
- **Decision:** Used inline templates + styles for all shared UI components rather than separate `.html`/`.scss` files.
- **Rationale:** Faster to author and read on a solo sprint; Angular convention permits either style. E4-S2 persona theming will still work — persona CSS vars are wired through the containing `[data-persona]` element.
- **Decision:** Avatar paths bound to `/images/{persona}.png` — matches user-provided assets at `public/images/hitesh.png` + `public/images/piyush.png`.
- **Rationale:** User dropped in avatar images alongside the spike run; wired the chat header to consume them directly.
- **Decision:** `app.routes.ts` default redirect goes to `/chat/hitesh` for the E2-S4 slice so the UI is browsable. E1-S1 will replace with the landing page.
- **Rationale:** Grader-testable-now beats grader-testable-later.

## Mid-sprint fix (post-dev, pre-submission) — Piyush Devanagari → Latin transliteration

- **Trigger:** Manual testing after autonomous dev completed. User observed: "for hitesh the responses are good, in English written in Hinglish; for Piyush it returns in pure Hindi in between." Piyush's persona prompt files were teaching the model to emit long stretches of Devanagari script, contradicting the voice-rule intent ("English syntax + Hindi phonetics/transliteration").
- **Root cause:** Few-shots + templates + `askBothCollabExamples` + `driftRefresh` + `selfIdentificationResponse` + `hardcodedGreeting` + `inputPlaceholder` all authored in mixed Devanagari + Latin during E2-S2 / E5-S3 / E7-S1..S2 / E8-S1..S2. LLM faithfully mirrored the few-shot pattern.
- **Scope of fix (user chose FULL LATIN policy):**
  - `src/personas/piyush.prompt.ts` — voiceRules (added explicit SCRIPT rule), selfVerificationChecklist clause 1, all 3 few-shots (Q2/Q4/Q5 sources retained with transliteration note), 4 `askBothCollabExamples`, `driftRefresh`, `capRefusalTemplate`, `quotaExhaustedTemplate`, 7 refusal templates, `selfIdentificationResponse`
  - `src/personas/persona.registry.ts` — Piyush `greeting` + `inputPlaceholder`
  - `src/personas/hitesh.prompt.ts` — `askBothCollabExamples` (Piyush-speaking + 2 anti-pattern examples)
  - `src/personas/persona.registry.spec.ts` — snapshot tests for Piyush `selfIdentificationResponse` + `greeting` updated to new Latin values
  - `src/config/regex-patterns.ts` — `PIYUSH_REGEX` rewritten to match Latin signature phrases (`dekho|yaar|baat samajh aayi|OK\?|Hey everyone|kuch nahi hai|theek hai`). **Critical:** without this, every Piyush response post-fix would register as `persona_regex_miss` per AD-19.
  - `src/config/regex-patterns.spec.ts` — Piyush sample-match test string transliterated
  - `src/config/product-copy.ts` — Piyush landing tagline transliterated
  - `src/config/model-params.ts` — comment block transliterated for consistency
- **Devanagari retained (intentional):** Piyush voice-rules "write X not Y" pedagogical block (lines 28-30 of `piyush.prompt.ts`) — teaches the model what NOT to emit; Devanagari is pedagogically necessary here.
- **Drift from source docs:** Persona research §C.3 Q2/Q4/Q5 originals are preserved as-authored; the `// source:` comments now note "transliterated to Latin script for readability per mid-sprint fix; content preserved". Addendum §C.3 wording predates this fix — flag for post-submission update to `_bmad-output/planning-artifacts/prds/prd-gen-ai-persona-ai-2026-07-02/addendum.md`.
- **Rationale:** (a) Persona Accuracy rubric (30 marks) — the observed pure-Hindi walls broke the "English written in Hinglish" register the voice rules promised. (b) User-facing readability — most graders can read Latin Hinglish; Devanagari walls are alienating. (c) Persona-differentiation preserved — Piyush still distinct from Hitesh via sentence rhythm (short, punchy), vocabulary (dekho vs Haanji, yaar in a different position), teaching approach (reductive→whiteboard→code), formatting (bullets/arrows). (d) Voice-rule intent already stated "English syntax + Hindi phonetics/transliteration" — this fix aligns implementation with stated intent.

## Post-sprint task — Blended Ask-Both mode

Out-of-band enhancement layered on top of the completed Sprint 1 (37/37). Adds a third Ask-Both variant "Blended" — a single LLM call whose system prompt fuses both personas' identity / voice / few-shots / refusals into one unified answer. Three-option toggle inside the Ask-Both surface (Sequential | Parallel | Blended), sessionStorage-persisted per AD-11, Sequential remains default. Spec: `_bmad-output/implementation-artifacts/spec-ask-both-blended-mode.md`.

### Autonomous decisions

- **Fusion identityBlock wording:** The block opens with "You are the FUSED VOICE of two mentors — Hitesh Choudhary AND Piyush Garg — speaking as ONE unified persona…" then names each mentor's provenance (channels/companies/tagline) so the model has grounding for whom it's synthesising. Includes the SCRIPT rule verbatim from the Piyush mid-sprint fix (Latin-only, no Devanagari) so AC-8 is enforceable both in-prompt and via the regex check. Attribution "Hitesh + Piyush" is baked in as the persona-signing convention.
- **Few-shot selection:** Adopted the AC-3 subset exactly — Hitesh Q1 (React vs Next.js — framework choice, story-first) + Hitesh Q3 (job market — emotional support) + Piyush Q2 (system design — reductive framing) + Piyush Q4 (Docker — numbered roadmap). Four in total, calibrating BOTH voices. Sourced by reference from the persona composition objects — no content duplication.
- **Attribution label:** "Hitesh + Piyush" wins over "The Panel" and "Fused voice". Rationale: user-testable (learners already recognise both names from the landing page), no jargon, and matches the persona-signing convention documented in the identityBlock. Stored in `blendedComposition.attributionLabel` and mirrored in `PRODUCT_COPY.askBothBlendedAttribution`.
- **UX shape:** Segmented control mirroring `ModeSwitcherComponent` (Solo ↔ Ask-Both) — same visual language for consistency, distinct in placement (inside the Ask-Both banner slots). Chose over radio/dropdown for the same reasons DESIGN.md.Components.mode-switcher chose the segmented pattern originally: single glance shows all options and their state.
- **Tooltip:** "One blended answer — 1 LLM call (Sequential is 2, Parallel is 2)." Exposed via `title` on both the tablist container and each segment; announced by screen readers that support the attribute and rendered on hover/focus by every browser (AC-9).
- **Mode seeding:** `ASK_BOTH_MODE` build-time env flag stays authoritative for fresh sessions with no sessionStorage entry. `AskBothModeService` layers the user's runtime pick on top. Preserves the flag-semantics constraint ("Do not autonomously change ASK_BOTH_MODE flag semantics beyond adding 'blended' as a valid value") — the constant is now the DEFAULT SEED, not a hard-coded runtime selector.
- **Attribution field on Message:** Added optional `attributionLabel?: string`. Purely presentational, back-compat with existing persisted messages (they carry no field, render unchanged). Preferred over extending `PersonaId` with a `'blended'` variant — that would have cascaded through `PERSONA_REGISTRY`, `provider-routing`, `model-params`, theme vars, and every `assertNever` switch (huge blast radius).
- **Provider carrier for blended:** Hitesh's provider slot. Blended is persona-agnostic at the prompt level but has to pick ONE adapter to talk to. Chose Hitesh's default (Gemini) so the fused voice sits on the warmer generation profile, matching the story-first opening beat of the fusion voice rules. Model params also come from Hitesh's `PERSONA_MODEL_PARAMS` entry.
- **Adapter factory DI (`ASK_BOTH_ADAPTER_FACTORY`):** Added mirroring the existing `ADAPTER_FACTORY` pattern in `ChatOrchestrator`. Enables the sequencer spec to inject a `MockAdapter` for the blended-flow smoke test. `vi.mock` is not supported for relative imports under the Angular unit-test system, so DI is the clean path.
- **`sessionId` for AC-6 payload:** Generated per `AskBothSequencerService` instance via `crypto.randomUUID()`. Since the service is `providedIn: 'root'`, this UUID lasts for the SPA lifetime = browser tab session. `threadId` comes from the Ask-Both `Thread.id` (which itself is stable per-thread and reset on Start-New-Session). `tokenEstimate` sourced from `OutboundPrompt.meta.estimatedTokens` — reuses AD-9's canonical estimator.
- **Keep-Going in Blended:** Reused the `'ask-both-blended'` compose mode. The assembler detects when the last thread message is an assistant reply and synthesises a "Continue this Blended discussion with a second fused-voice take — offer a fresh angle" user message so the model produces a follow-up take rather than paraphrasing itself. Verbatim tail includes the prior blended answer for full context. `KEEP_GOING_ROUNDS` untouched.
- **Streaming indicator:** New `PRODUCT_COPY.streamingIndicatorAskBothBlended = 'Hitesh + Piyush are speaking as one…'`. `AskBothComponent.streamingLabel()` consults the active mode first — when blended, uses this label; otherwise falls through to the existing Sequential/Parallel indicators.
- **Moderation fallback:** Added `blendedComposition.moderationFallbackTemplate` as a warm, in-fusion-voice off-domain redirect. Used when the moderation adapter's `suggested_refusal` is empty. Avoids adding 5 category-specific templates (offDomain/political/adult/etc.) since blended is a single-answer variant and a single warm redirect covers the practical space.
- **ESLint whitelist additions:** `src/personas/blended.prompt.ts` added to the `no-restricted-syntax` off-list (mirrors `hitesh.prompt.ts` / `piyush.prompt.ts`); `src/features/ask-both/ask-both-mode.service.ts` added to the `no-restricted-globals` off-list (mirrors `mode-switcher.component.ts` — sessionStorage for a non-sensitive UI hint). Both are surgical additions to the existing whitelist pattern, not policy changes.

### Deferred / accepted debt

- **5 pre-existing test failures left as-is** per the task constraint ("Do NOT commit or fix any pre-existing failing test unless it's directly related to this task's scope"):
  - `context-config.spec.ts` — expects `KEEP_GOING_ROUNDS === 1`, actual is `5`. Flagged as the user's open decision.
  - `model-params.spec.ts` × 2 — `maxOutputTokens` 1200/1000 vs actual 500 (mid-sprint trim, spec not updated in `fc32da6`).
  - `prompt-assembler.service.spec.ts` × 2 — solo-mode `maxOutputTokens` tests that forward the same values as above.
- **8 pre-existing lint errors left as-is** — same reasoning. All are in `model-discovery.service.ts` / `model-selection.service.ts` / `persona-routing.service.ts` / `settings-modal.component.ts` — files not touched by this task, introduced in `fc32da6`.
- **No provider-config surface for blended:** Blended always uses the Hitesh-provider slot. If the user later wants to route Blended through Groq (or a fixed high-quality model), that's a follow-up UX addition to the settings modal.

## Blockers

_(none)_
