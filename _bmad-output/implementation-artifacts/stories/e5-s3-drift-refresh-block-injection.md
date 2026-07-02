# Story E5-S3: Drift Refresh block injection at turn 15 + every 10 thereafter

Status: ready-for-dev

- **Epic:** 5 — Long-Conversation Memory
- **Critical-path position:** 19 of 37 (Day 4 afternoon)
- **Blocks:** E11-S2, E12-S2
- **Depends on:** E5-S1, E2-S2

## Story

As a **cohort grader running Anjali's UJ-2 flow (turn 30 conversation)**,
I want **Hitesh's voice at turn 30 to feel like his voice at turn 3 — not to have degraded into generic-ChatGPT tone**,
So that **the drift-refresh mitigation from FR-13 actually works and the eval SM-2 drift curve at turn 35 stays within 15pp of turn 5**.

## Acceptance Criteria

**Given** the PromptAssembler from E2-S2 + E5-S1 (Verbatim Tail wiring),
**When** the developer extends `PromptAssembler.compose` with drift-refresh logic,
**Then** the assembler reads the current turn count (`assistantMessageCount(thread) + 1` — the imminent assistant message), compares against `DRIFT_REFRESH_FIRST_TURN = 15` and `DRIFT_REFRESH_CADENCE = 10`, and IF the current turn is >= 15 AND `(turn - DRIFT_REFRESH_FIRST_TURN) % DRIFT_REFRESH_CADENCE === 0` (i.e., turns 15, 25, 35, ...), the drift-refresh block is inserted immediately before block 9 (user message) per AD-8.

**Given** the drift-refresh block is injected,
**When** the developer inspects the outbound prompt for turn 15 (Hitesh),
**Then** the block-8-slot content (between self-verification checklist block 8 and user message block 9) contains the Hitesh drift-refresh template from Addendum §C.4:
```
[Voice reminder — Hitesh]
Remember: Hindi-base grammar + English tech nouns. Warm elder-brother pacing.
Use 1–3 of: Haanji / chai ke saath / yaar / samjha kya / 😁. Analogy or short
story FIRST, then the tech. Never trash a framework or fabricate a price.
Mirror the user's Hinglish register — never respond in pure English if they
were in Hinglish.
```
And the analogous Piyush block from Addendum §C.4 when persona is Piyush.

**Given** the drift-refresh block is read from a persona.registry.ts field,
**When** the developer confirms placement,
**Then** the drift-refresh string lives in `PERSONA_REGISTRY[persona].prompt.driftRefresh` (a persona-prompt-file export) — NOT hard-coded in the assembler per AD-8 + AD-22.

**Given** the drift-refresh block is injected,
**When** the outbound prompt's `meta.hasDriftRefresh` is set,
**Then** the OutboundPrompt's meta accurately reports `hasDriftRefresh: true` at turns 15, 25, 35, ... and `false` otherwise.

**Given** the Rolling Summary generation from E5-S2 fires on the same turn as a drift-refresh (e.g., turn 15 could coincide if the primary trigger has been firing),
**When** the ordering is inspected,
**Then** Rolling Summary generation happens FIRST (so the drift-refresh sees the compressed history), per AD-9's rule: "If Rolling Summary generation and Drift Refresh would both fire on the same turn, they run in that order."

**Given** the ChatOrchestrator invokes the PromptAssembler at turn 15,
**When** the outbound prompt is inspected,
**Then** the block-8 slot has the drift-refresh block; the block-9 slot has the user message wrapped in `<user_message>...</user_message>`; the block-6 slot has the Rolling Summary if one exists; the block-7 slot has the last 8 messages verbatim — full AD-8 block-order integrity confirmed by a snapshot test.

**verifies:** FR-13 (Persona Drift refresh), AD-8 (block-8 slot placement between self-verification and user message), AD-9 (DRIFT_REFRESH_FIRST_TURN + DRIFT_REFRESH_CADENCE + ordering rule with Rolling Summary), AD-22 (drift-refresh block lives in persona prompt file, not assembler)

**touches:** `src/domain/prompts/prompt-assembler.service.ts` (extend with drift-refresh injection logic), `src/personas/hitesh.prompt.ts` (add `driftRefresh: string` export from Addendum §C.4), `src/personas/piyush.prompt.ts` (add `driftRefresh: string` export from Addendum §C.4), `src/personas/persona.registry.ts` (extend PromptComposition shape to include `driftRefresh` field)

**test target:** unit test (call PromptAssembler.compose at turns 5, 15, 25, 35, 45; verify block-8 slot has drift-refresh only at 15, 25, 35, 45 and empty at 5; snapshot test on the FULL outbound prompt structure at turn 25 with populated rollingSummary to confirm all 9 blocks in exact AD-8 order)

## Developer Context

Anti-drift mitigation. Every ~10 turns after turn 15, re-inject a compressed voice reminder into the prompt at position 8 (immediately before the user's current message at position 9). Bounded to 60-100 tokens per injection per Addendum §C.4.

**PromptComposition field:** E0-S3 (readiness-gap #4 consolidation) declared `driftRefresh: string` upfront with `''` placeholder. THIS STORY populates the value in `hitesh.prompt.ts` + `piyush.prompt.ts` verbatim from Addendum §C.4.

**Turn-count arithmetic:** `currentTurn = assistantMessageCount(thread) + 1` (the assistant message about to be generated). Firing at 15, 25, 35 corresponds to `(currentTurn - DRIFT_REFRESH_FIRST_TURN) % DRIFT_REFRESH_CADENCE === 0` AND `currentTurn >= DRIFT_REFRESH_FIRST_TURN`.

**Ordering rule:** E5-S2 ContextManager fires summary generation. E5-S3 assembler injects drift-refresh. Both COULD fire on turn 15. The ordering is enforced by the call sequence in `ChatOrchestrator.dispatch`:
1. Orchestrator calls `contextManager.onTurnComplete(threadKey)` AFTER the previous assistant message completed.
2. IF summary fires, it persists `rollingSummary` before the NEXT user message.
3. On the next user message, `PromptAssembler.compose` reads `thread.rollingSummary` (now updated) + injects drift-refresh block.

So the order is: previous turn done → summary generation (if triggered) → user sends new message → assembler composes with both fresh summary AND drift-refresh block. ✓

## Technical Requirements

### `prompt-assembler.service.ts` extension

```ts
case 'solo': {
  // ... existing code
  const currentTurn = assistantMessageCount(thread) + 1;
  const shouldInjectDrift = currentTurn >= DRIFT_REFRESH_FIRST_TURN
    && (currentTurn - DRIFT_REFRESH_FIRST_TURN) % DRIFT_REFRESH_CADENCE === 0;
  const driftBlock = shouldInjectDrift ? PERSONA_REGISTRY[persona].prompt.driftRefresh : null;
  const systemContent = this.buildSystemBlock(persona, thread, driftBlock);
  // ... rest
  outbound.meta.hasDriftRefresh = shouldInjectDrift;
  return outbound;
}
```

`buildSystemBlock` already accepts the `driftRefresh: string | null` parameter (per E2-S2 shape) — this story wires the real value.

### `src/personas/hitesh.prompt.ts` — populate driftRefresh (Addendum §C.4)

```ts
export default {
  identityBlock: /* verbatim from Addendum §C.2 — E0-S3 */,
  voiceRules: /* verbatim from Addendum §C.2 — E0-S3 */,
  refusalRules: /* E8-S1 */,
  fewShots: /* E2-S2 3 verbatim entries */,
  askBothCollabExamples: /* E8-S1 */,
  driftRefresh: `[Voice reminder — Hitesh]
Remember: Hindi-base grammar + English tech nouns. Warm elder-brother pacing.
Use 1–3 of: Haanji / chai ke saath / yaar / samjha kya / 😁. Analogy or short
story FIRST, then the tech. Never trash a framework or fabricate a price.
Mirror the user's Hinglish register — never respond in pure English if they
were in Hinglish.`,
  selfVerificationChecklist: /* Addendum §C.5 — E0-S3 */,
  // ...rest placeholders per PromptComposition shape
};
```

### `src/personas/piyush.prompt.ts` — populate driftRefresh (Addendum §C.4)

```ts
driftRefresh: `[Voice reminder — Piyush]
Remember: English-syntax + Hindi phonetics. Pure Hindi ONLY for everyday
analogies. Fast, direct, whiteboard-driven. Use 2–3 of: देखो / यार / बात
समझ आई / OK? / कुछ नहीं है यार. Reductive framing FIRST, then whiteboard
decomposition, then code. Comprehension check every 2–3 sentences. End with
homework or "build करो, तोड़ो, आगे बढ़ो" push. Mirror user's Hinglish register.`,
```

## Architecture Compliance

- **AD-8:** block 8 slot placement, immediately before block 9 (user message).
- **AD-9:** DRIFT_REFRESH_FIRST_TURN = 15, DRIFT_REFRESH_CADENCE = 10, ordering rule with summary.
- **AD-22:** drift-refresh strings live in `src/personas/*.prompt.ts` (ESLint E0-S4 exempts).

## File Structure Requirements

```
src/domain/prompts/prompt-assembler.service.ts  # UPDATE — drift-refresh injection
src/personas/hitesh.prompt.ts                    # POPULATE driftRefresh
src/personas/piyush.prompt.ts                    # POPULATE driftRefresh
```

## Testing Requirements

- `prompt-assembler.service.spec.ts` extend:
  - Compose at turn 5 (4 assistant messages, current is 5th) → `meta.hasDriftRefresh === false`; system block has NO drift block.
  - Compose at turn 15 → `hasDriftRefresh === true`; block-8 slot contains Hitesh drift-refresh text (byte-match against Addendum §C.4).
  - Compose at turn 20 → false (only 25 fires next).
  - Compose at turn 25 → true.
  - Snapshot test on FULL outbound prompt structure at turn 25 with populated `rollingSummary`: verify 9-block order integrity.
- `hitesh.prompt.spec.ts` + `piyush.prompt.spec.ts`: `driftRefresh` byte-matches Addendum §C.4 verbatim.

## Latest Tech Information

- Drift-refresh at position 8 counteracts the "lost in the middle" attention degradation (documented behavior across LLM families). Placing at position 8 keeps the reminder in the LAST-N-tokens attention window on every subsequent generation.

## Previous Story Intelligence

**E5-S1 (Turn counting):**
- `assistantMessageCount(thread)` returns current count. `currentTurn = count + 1` = imminent assistant message.

**E5-S2 (ContextManager):**
- Summary generation runs BEFORE next PromptAssembler call, so `thread.rollingSummary` is fresh when drift-refresh assembles.

**E2-S2 (PromptAssembler):**
- `buildSystemBlock(persona, thread, driftRefresh)` already accepts nullable drift; empty case wired.

**E0-S3 (Config):**
- `DRIFT_REFRESH_FIRST_TURN = 15`, `DRIFT_REFRESH_CADENCE = 10`.
- `PromptComposition.driftRefresh: string` declared upfront (readiness-gap #4).

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-8` (block 8 placement, lines 122–139), `AD-9` (turn thresholds + ordering with summary, lines 141–155), `AD-22` (persona-voice in personas/, lines 300–309).
- Addendum §C.4 (drift-refresh templates verbatim, lines 322–345).
- Sprint status: key `e5-s3-drift-refresh-block-injection`, blocks `[e11-s2, e12-s2]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-8] Drift-Refresh block immediately before block 9.
- [Source: ARCHITECTURE-SPINE.md#AD-9] DRIFT_REFRESH_FIRST_TURN + CADENCE + ordering rule.
- [Source: addendum.md#C.4] Verbatim drift-refresh templates.
- [Source: prd.md#FR-13] Persona Drift refresh at turn 15 + every 10.

## Story Completion Status

- [ ] `prompt-assembler.service.ts` extended with turn-count arithmetic + drift-refresh injection.
- [ ] `hitesh.prompt.ts` `driftRefresh` populated verbatim from Addendum §C.4.
- [ ] `piyush.prompt.ts` `driftRefresh` populated verbatim from Addendum §C.4.
- [ ] `OutboundPrompt.meta.hasDriftRefresh` reports true at turns 15/25/35/…; false otherwise.
- [ ] Spec tests: turn 5/15/20/25/35 injection behavior + full 9-block snapshot at turn 25.
- [ ] Ordering rule verified: summary runs → new user msg → assembler sees fresh summary + injects drift.
