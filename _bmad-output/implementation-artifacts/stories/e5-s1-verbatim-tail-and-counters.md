# Story E5-S1: Verbatim Tail + turn-counting + token-estimator wiring

Status: ready-for-dev

- **Epic:** 5 — Long-Conversation Memory
- **Critical-path position:** 17 of 37 (Day 4 afternoon)
- **Blocks:** E5-S2, E5-S3, E7-S1
- **Depends on:** E0-S3, E2-S3

## Story

As a **solo developer**,
I want **the token estimator (`estimateTokens`) and turn-counting helpers (`assistantMessageCount`, `expectedAssistantMessagesForMode`) as single-source pure functions in `src/domain/context/`, imported by ContextManager, ChatOrchestrator, and future Ask-Both sequencer**,
So that **there's no per-feature drift on how a token is counted or how many assistant messages an Ask-Both turn produces**.

## Acceptance Criteria

**Given** Epic 0 landed the context-config constants,
**When** the developer authors `src/domain/context/token-estimator.ts`,
**Then** it exports a single `estimateTokens(text: string): number` function using `Math.ceil(text.length / 4)` per AD-9. Every safety-net trigger (E5-S2), every eval (Epic 11), every diagnostic (later) imports from here. Swapping the algorithm (e.g., to real tiktoken) is an AD-9 update.

**Given** the token estimator exists,
**When** the developer authors `src/domain/context/turn-counting.ts`,
**Then** it exports two pure functions on `Thread`:
- `assistantMessageCount(thread: Thread): number` — counts messages with `role: 'assistant'`;
- `expectedAssistantMessagesForMode(mode: PromptMode): number` — returns 1 for `'solo'`, 2 for `'ask-both-a'` (the sequencer treats both A + B as a unit — Epic 9 details), 3 for `'ask-both-keep-going'` (A + B + one extra round), 0 for `'summarize'` and `'ask-both-b'` (B is invoked as part of an A+B unit already counted).

**Given** the turn-counting helpers exist,
**When** the developer wires Verbatim Tail into `PromptAssembler.compose` (extending E2-S2's assembler),
**Then** the assembler reads `VERBATIM_TAIL_LENGTH = 8` from `context-config.ts` and includes the LAST 8 messages in the outbound prompt's block-7 slot, regardless of mode. In Ask-Both this yields ~4 user exchanges by design (bounded token cost per AD-9). No mode-specific tail override — if deeper Ask-Both tails become an eval need, a separate `ASK_BOTH_VERBATIM_TAIL_LENGTH` const is added per AD-9's guidance (deferred).

**Given** the ChatOrchestrator's max-turn cap enforcement (Epic 7 will wire the user-visible surface),
**When** the orchestrator checks `assistantMessageCount(thread) + expectedAssistantMessagesForMode(mode) > MAX_TURNS_PER_THREAD`,
**Then** it uses the shared helpers from `src/domain/context/turn-counting.ts` — no re-implementation in the orchestrator. Ask-Both sequencer (Epic 9 story E9-S2) similarly uses these helpers.

**Given** any developer creates a duplicate `estimateTokens` or a duplicate turn-counting function elsewhere,
**When** they run `npm run lint`,
**Then** the ESLint `no-restricted-syntax` rule from E0-S4 (banning re-declaration of AD-9 helper names outside canonical files) catches it. (If the E0-S4 rule doesn't already cover `estimateTokens` / `assistantMessageCount` / `expectedAssistantMessagesForMode`, extend the rule here.)

**verifies:** FR-11 (Verbatim Tail preservation), AD-9 (single-source token-estimator + turn-counting helpers), AD-8 (Verbatim Tail block-7 slot filled by assembler)

**touches:** `src/domain/context/token-estimator.ts`, `src/domain/context/turn-counting.ts`, `src/domain/prompts/prompt-assembler.service.ts` (extend to populate block-7 slot from `thread.messages.slice(-VERBATIM_TAIL_LENGTH)`), `.eslintrc.json` (extend `no-restricted-syntax` rule from E0-S4 if not already covered)

**test target:** unit test (estimateTokens returns expected count for a known text; assistantMessageCount ignores 'user' messages + counts 'assistant' ones; expectedAssistantMessagesForMode returns correct value for each PromptMode; PromptAssembler.compose with a 12-message thread includes exactly the last 8 messages in block-7)

## Developer Context

Canonical helpers land. E2-S2 stubbed `estimateTokens` inline; this story REPLACES with the AD-9 canonical single-source impl. All future consumers (E5-S2 ContextManager, E7-S1 cap check, E9-S2 sequencer, Epic 11 evals) import from `src/domain/context/`.

**No behavior change from E2-S2 stub** — `Math.ceil(text.length / 4)` is the same formula. This story just moves it to the canonical location AND lands the turn-counting pair.

## Technical Requirements

### `src/domain/context/token-estimator.ts`

```ts
// AD-9: single-source token estimator. Every safety-net trigger, every eval,
// every diagnostic imports from here. Swapping to real tiktoken is an AD-9 update.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

### `src/domain/context/turn-counting.ts`

```ts
import type { Thread } from '@domain/types/message';
import type { PromptMode } from '@domain/prompts/types';
import { assertNever } from '@domain/types/persona';

export function assistantMessageCount(thread: Thread): number {
  return thread.messages.filter((m) => m.role === 'assistant').length;
}

export function expectedAssistantMessagesForMode(mode: PromptMode): number {
  switch (mode) {
    case 'solo': return 1;
    case 'ask-both-a': return 2; // A + B counted as unit
    case 'ask-both-b': return 0; // subsumed by ask-both-a
    case 'ask-both-keep-going': return 1; // one extra on top of already-counted A+B
    case 'summarize': return 0; // background op, doesn't count against user cap
    default: return assertNever(mode);
  }
}
```

### `prompt-assembler.service.ts` — extend Verbatim Tail wiring

E2-S2 already implemented block-7 with `thread.messages.slice(-VERBATIM_TAIL_LENGTH - 1, -1)` (exclude the current user message which is Block 9). This story CONFIRMS the implementation uses the canonical `VERBATIM_TAIL_LENGTH` import from `@config/context-config` and swaps the stub `estimateTokens` import from local to `@domain/context/token-estimator`.

### `.eslintrc.json` — extend no-restricted-syntax

Add to the constant-re-declaration ban list:
- `estimateTokens` — canonical file `src/domain/context/token-estimator.ts`.
- `assistantMessageCount` — canonical file `src/domain/context/turn-counting.ts`.
- `expectedAssistantMessagesForMode` — canonical file `src/domain/context/turn-counting.ts`.

Selector pattern: `FunctionDeclaration[id.name=/^(estimateTokens|assistantMessageCount|expectedAssistantMessagesForMode)$/]` with per-file overrides.

## Architecture Compliance

- **AD-8:** Verbatim Tail is block 7 of the 9-block prompt; assembler slice logic per AD-8.
- **AD-9:** single-source helpers; `VERBATIM_TAIL_LENGTH = 8` from `context-config.ts`; ESLint bans duplicates.

## Library / Framework Requirements

No new packages.

## File Structure Requirements

```
src/domain/context/
  token-estimator.ts        # NEW (canonical) — replaces E2-S2 stub location
  turn-counting.ts          # NEW
src/domain/prompts/prompt-assembler.service.ts  # UPDATE — import from @domain/context/*
.eslintrc.json              # UPDATE — extend no-restricted-syntax
```

If E2-S2 landed the stub at `src/domain/context/token-estimator.ts` (per that story's recommendation), just extend that file. If it landed elsewhere, MOVE it here.

## Testing Requirements

- `token-estimator.spec.ts`: `estimateTokens('') === 0`; `estimateTokens('a') === 1`; `estimateTokens('abcd') === 1`; `estimateTokens('abcde') === 2`; well-known 4-char-per-token heuristic.
- `turn-counting.spec.ts`:
  - `assistantMessageCount(threadWith2UserAnd3Assistant) === 3`.
  - `expectedAssistantMessagesForMode('solo') === 1`.
  - `expectedAssistantMessagesForMode('ask-both-a') === 2`.
  - `expectedAssistantMessagesForMode('ask-both-b') === 0`.
  - `expectedAssistantMessagesForMode('ask-both-keep-going') === 1`.
  - `expectedAssistantMessagesForMode('summarize') === 0`.
  - Fake mode `'foo' as PromptMode` → runtime throw (assertNever).
- Extend `prompt-assembler.service.spec.ts` (E2-S2): compose with 12-message thread; verify block-7 slot contains last 8 messages verbatim (indexes 3-10 of the 12, with index 11 as the current user message going to block 9).
- Lint: attempt to declare `function estimateTokens(x: string) { return 0; }` inside `src/features/chat/leak.ts` → lint fail.

## Latest Tech Information

- `Math.ceil(text.length / 4)` is the well-known GPT-3-era heuristic; imperfect but consistent. Swapping to `tiktoken` (js-tiktoken npm) is an AD-9 update; adds ~500KB gzip (heavy) — deferred.

## Previous Story Intelligence

**E2-S2 (PromptAssembler):**
- Stub `estimateTokens` landed at `src/domain/context/token-estimator.ts` (per that story's guidance). This story confirms it's canonical or moves if it went elsewhere.
- `PromptAssembler.buildSystemBlock` already slices `thread.messages.slice(-VERBATIM_TAIL_LENGTH - 1, -1)` — verify the slice math against the "exclude current user message" rule.

**E2-S3 (ChatOrchestrator):**
- Orchestrator will use `assistantMessageCount + expectedAssistantMessagesForMode` for E7-S1 cap check. Not modified this story.

**E0-S3 (Config):**
- `VERBATIM_TAIL_LENGTH = 8` in `src/config/context-config.ts`.

**E0-S4 (Lint):**
- `no-restricted-syntax` ban list — extend here to cover `estimateTokens`/`assistantMessageCount`/`expectedAssistantMessagesForMode`.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-8` (block 7 Verbatim Tail, lines 122–139), `AD-9` (token estimation + turn counting single-source, lines 141–155).
- Sprint status: key `e5-s1-verbatim-tail-and-counters`, blocks `[e5-s2, e5-s3, e7-s1]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-9] `estimateTokens` single source; `assistantMessageCount + expectedAssistantMessagesForMode` in `src/domain/context/turn-counting.ts`.
- [Source: prd.md#FR-11] Verbatim Tail preservation, N = 8.

## Story Completion Status

- [ ] `src/domain/context/token-estimator.ts` canonical (or confirm E2-S2 stub is at this path).
- [ ] `src/domain/context/turn-counting.ts` with `assistantMessageCount` + `expectedAssistantMessagesForMode`.
- [ ] `prompt-assembler.service.ts` imports from `@domain/context/token-estimator` (swap the local stub).
- [ ] ESLint `no-restricted-syntax` extended to ban duplicate helper declarations.
- [ ] Spec tests: token estimator + turn counting + assembler block-7 slice.
- [ ] Lint verification: leak file fails.
