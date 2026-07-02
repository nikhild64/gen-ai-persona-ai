---
title: 'Ask-Both Blended Mode — single fused-voice response'
type: 'feature'
created: '2026-07-02'
status: 'in-review'
baseline_commit: 'fc32da6642b0158b4b7471475798e6047c30d9b1'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/dev-decisions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ask-Both ships two variants (Sequential/Parallel), both producing two bubbles/turn. Some learners want ONE unified voice that fuses Hitesh's warmth + Piyush's reductive style — half the read cost.

**Approach:** Add third variant "Blended" — single LLM call whose system prompt fuses both personas' identity/voice/few-shots/refusals. Three-option toggle inside the Ask-Both surface, persist selection to sessionStorage per AD-11, default stays Sequential.

## Boundaries & Constraints

**Always:**
- Latin transliteration only in blended output; fusion identityBlock includes the explicit SCRIPT rule from Piyush's mid-sprint fix.
- Exactly ONE LLM call, ONE bubble per turn; attribution surfaces both mentors (label chosen by dev).
- Assembler's exhaustive switch stays exhaustive (adding the arm updates every switch site via `assertNever`).
- AD-8 9-block prompt order preserved in blended composition.
- Copy → `product-copy.ts`, ARIA → `aria-labels.ts`, new `StorageKey` entry, new typed analytics arm.

**Ask First:** _(none — dev has autonomy for identityBlock wording, few-shot picks within the AC-3 subset, UX shape, tooltip copy, attribution label.)_

**Never:**
- Modify `KEEP_GOING_ROUNDS` or any other context-config constant.
- Modify `hitesh.prompt.ts` / `piyush.prompt.ts` — fusion lives in NEW `blended.prompt.ts`.
- Retroactively transform prior messages when the user switches modes.
- Change AD-13 turn-order semantics for Sequential mode.
- Emit Devanagari script anywhere in blended output.
- Skip the new analytics event or the LATIN regex smoke-test.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|---------------|-------------------|----------------|
| Blended send | mode=blended, user text | `compose(...,'ask-both-blended')` → 1 system + 1 user; sequencer streams once; persists 1 bubble with `attributionLabel`, `persona:undefined`; emits `ask_both_blended_message_sent{sessionId,threadId,tokenEstimate}` | Provider error → no bubble, in-flight cleared |
| Fresh session / invalid stored value | no valid sessionStorage entry | `AskBothModeService.get()` returns build-time `ASK_BOTH_MODE` default | Fall back to default silently |
| Reload after selection | user picked Blended | Toggle shows Blended active; next `askBoth()` runs blended flow | — |
| Keep-going in blended | prior blended bubble exists | 1 more blended composition + call + bubble; `keepGoingUsed` increments | Same as blended send |
| Mode switch mid-thread | user toggles Sequential→Blended | Only future messages change; existing bubbles untouched; toggle disabled while in-flight | Click during in-flight ignored |
| Regex miss on blended | reply matches neither persona regex | `persona_regex_miss{persona:'blended'}` | Observation only |

</frozen-after-approval>

## Code Map

- `src/domain/prompts/types.ts` — extend `PromptMode` with `'ask-both-blended'`
- `src/domain/prompts/prompt-assembler.service.ts` — new case + `composeAskBothBlended` + `buildBlendedSystemBlock` (AD-8 order, sourced from blended composition)
- `src/personas/blended.prompt.ts` — NEW: `{identityBlock, voiceRules, refusalRules, fewShots, selfVerificationChecklist, voiceReminder, attributionLabel}`
- `src/features/ask-both/ask-both-mode.service.ts` — NEW: signal + sessionStorage-persisted; seeded from `ASK_BOTH_MODE` when absent
- `src/features/ask-both/ask-both-mode-toggle.component.ts` — NEW: three-segment tablist mirroring `ModeSwitcherComponent` (ARIA + keyboard nav + tooltip)
- `src/features/ask-both/ask-both-sequencer.service.ts` — inject mode service; branch on `.get()`; add `dispatchBlended`; extend `keepGoing()`; per-instance `sessionId`; emit new event + regex-miss variant
- `src/features/ask-both/ask-both.component.ts` — mount toggle in `banner-slots`; wire `sequencer.inFlight()` disable
- `src/shared/message-bubble/message-bubble.component.ts` — `personaLabel` prefers `attributionLabel` when set
- `src/domain/types/message.ts` — add optional `attributionLabel?: string`
- `src/domain/ports/analytics.port.ts` — add `ask_both_blended_message_sent`; broaden `persona_regex_miss` payload to `PersonaId | 'blended'`
- `src/config/storage-keys.ts` — add `'settings:ask-both-mode:v1'`
- `src/config/feature-flags.ts` — widen `ASK_BOTH_MODE` union to include `'blended'`; parse `blended` env value
- `src/config/regex-patterns.ts` — `hasBlendedSignature(text) = HITESH_REGEX.test(t) || PIYUSH_REGEX.test(t)`
- `src/config/product-copy.ts` — `askBothVariantLabels`, `askBothVariantTooltip`, `askBothBlendedAttribution`
- `src/config/aria-labels.ts` — `askBothVariantToggleLabel(variant)`
- Specs updated: `prompt-assembler.service.spec.ts`, `types.spec.ts`, `regex-patterns.spec.ts`, `storage-keys.spec.ts`, `analytics.port.spec.ts`, `product-copy.spec.ts`, `aria-labels.spec.ts`
- New specs: `blended.prompt.spec.ts`, `ask-both-mode.service.spec.ts`, `ask-both-mode-toggle.component.spec.ts`, `ask-both-sequencer.service.spec.ts`

## Tasks & Acceptance

**Execution (dep-ordered):**
- [x] Extend types: `PromptMode`, `AnalyticsEvent`, `StorageKey`, `Message.attributionLabel`, feature-flag widen.
- [x] Author `blended.prompt.ts` — fusion identity + voice + refusals-union + few-shots (Hitesh Q1+Q3 = fewShots[0,1] + Piyush Q2+Q4 = fewShots[0,1]) + blended checklist + attributionLabel.
- [x] Extend `PromptAssembler` — new arm + `buildBlendedSystemBlock`.
- [x] Add `AskBothModeService`.
- [x] Add `AskBothModeToggleComponent`.
- [x] Extend `AskBothSequencerService` — mode branch; `dispatchBlended`; blended keep-going; new analytics + regex-miss. Added `ASK_BOTH_ADAPTER_FACTORY` DI token so the sequencer spec can inject a `MockAdapter`.
- [x] Extend `MessageBubbleComponent` — `attributionLabel` preference in `personaLabel`.
- [x] Mount toggle in `AskBothComponent` (and made `streamingLabel()` blended-aware).
- [x] Add copy + ARIA label + regex helper + StorageKey entry.
- [x] Add/extend specs listed in Code Map.
- [x] Append `## Post-sprint task — Blended Ask-Both mode` to `dev-decisions.md` (identityBlock wording, few-shot picks, attribution, UX shape).
- [ ] Single commit: `feat(ask-both): add Blended mode as third Ask-Both variant (single fused-voice response)` — pending step-04.

**Acceptance Criteria (user-intent AC-1..AC-11 in full — key details from that block):**
- AC-1 three-option toggle visible + highlighted + click switches for future only.
- AC-2 fresh-session default = Sequential.
- AC-3 blended composition = 1 `system` message (9-block order, fusion identity + both voiceRules + curated few-shots + unified refusals + blended checklist) + 1 `user` message wrapped in `<user_message>`.
- AC-4 exactly one LLM call, one bubble, no per-persona split.
- AC-5 Keep going reuses blended composition; `KEEP_GOING_ROUNDS` untouched.
- AC-6 `ask_both_blended_message_sent{sessionId,threadId,tokenEstimate}` fires; no `console.log` outside `LoggerService`.
- AC-7 sessionStorage persists selection across reload; StorageKey union entry added.
- AC-8 Latin only; identity block includes SCRIPT rule literally.
- AC-9 tooltip explains "1 LLM call vs 2".
- AC-10 regex smoke-test with `persona:'blended'` on miss.
- AC-11 AD-20 ARIA + keyboard nav; AD-21 no new sync work on hot path; AD-22 all copy in `product-copy.ts`.

## Design Notes

- **Attribution field:** `Message.attributionLabel?: string` is additive/back-compat. Blended bubbles skip `persona` → neutral Ask-Both container theme per AD-17. Avoids extending `PersonaId` (huge blast radius through registry/routing/model-params).
- **Mode seeding:** `ASK_BOTH_MODE` build-time flag stays the DEFAULT seed; user selection in sessionStorage wins. Preserves flag semantics constraint.

## Verification

**Commands:**
- `npm run test -- --run` — expected: all specs pass except the pre-existing `KEEP_GOING_ROUNDS` context-config one (out of scope).
- `npm run typecheck` — expected: clean.
- `npm run lint` — expected: clean.

**Manual:**
- Ask-Both surface renders 3-option toggle, Sequential default.
- Toggle Blended, send message: single bubble labelled "Hitesh + Piyush" (or chosen label); no Devanagari; token cost ≈ half a Sequential turn.
- Reload tab: Blended stays.
- Keep going: another blended bubble.
- Hover toggle: tooltip "One blended answer — 1 LLM call (Sequential is 2, Parallel is 2)."
