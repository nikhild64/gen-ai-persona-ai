# Story E5-S2: ContextManager hybrid trigger + Rolling Summary generation

Status: ready-for-dev

- **Epic:** 5 — Long-Conversation Memory
- **Critical-path position:** 18 of 37 (Day 4 afternoon)
- **Blocks:** E9-S2, E10-S1, E11-S2
- **Depends on:** E5-S1, E3-S1

## Story

As a **cohort grader running Anjali's UJ-2 flow (turn 30 conversation about deploying MERN)**,
I want **the assistant to remember my stack + context at turn 30 without me re-explaining, without the prompt token cost blowing up**,
So that **the long conversation actually feels like a coherent thread with Hitesh, not a fresh prompt every 8 messages**.

## Acceptance Criteria

**Given** all context-config constants from Epic 0 are populated,
**When** the developer authors `src/domain/context/context-manager.service.ts`,
**Then** it exposes `onTurnComplete(threadId: string): Promise<void>` — called from ChatOrchestrator after each assistant message completes (`{type: 'done'}` fires).

**Given** `onTurnComplete` is called,
**When** the manager evaluates trigger conditions,
**Then** it computes `assistantMessageCount(thread)` (from `src/domain/context/turn-counting.ts` — E5-S1), estimates prompt tokens via `estimateTokens(text)` (from `src/domain/context/token-estimator.ts` — E5-S1 sole source), and fires the Rolling Summary IF the hybrid trigger fires per AD-9:
- **Primary trigger:** `assistantMessageCount > VERBATIM_TAIL_LENGTH` (first summary) AND `turnsSinceLastSummary >= SUMMARY_REFRESH_CADENCE`;
- **Safety-net trigger:** `estimatedTokens > SUMMARY_TOKEN_BUDGET_PCT * context_window_tokens` (70% headroom);
- If NEITHER fires, `turnsSinceLastSummary` is incremented on the thread and the flow returns without generating a summary.

**Given** either trigger fires,
**When** the manager generates the summary,
**Then** it calls `PromptAssembler.compose(persona, thread, 'summarize')` — a fresh PromptMode arm added to the enum in Epic 5 (compile-fails Epic 2's assembler until this story adds the case). The `'summarize'` prompt template (per AD-9 diagram sequence) is: `"Compress the conversation below into ~200 tokens preserving facts, user context (stack, project, error), and open threads. Do NOT preserve verbatim wording."` embedded in `PromptAssembler.compose`'s `'summarize'` branch.

**Given** the summary prompt is composed,
**When** the manager calls `ProviderPort.streamChat(summaryPrompt, key, signal)` — using SAME provider as the current chat for Solo threads OR `ASK_BOTH_SUMMARY_PROVIDER_ID = 'gemini'` for `scope: 'ask-both'` threads per AD-9 —
**Then** the accumulated summary text is written back to the thread: `thread.rollingSummary = summaryText; thread.turnsSinceLastSummary = 0;` and `StoragePort.set('chat:hitesh:v1', thread)` persists it. Rolling Summary lives INSIDE the Thread record per AD-10 — not a separate storage key.

**Given** the summary generation fails (timeout / provider 429 / network error),
**When** the provider adapter emits `{type: 'error'}`,
**Then** the manager emits `summary_failed` analytics event per AD-15 with `{provider, category}` payload; the fallback is sliding-window truncation (`PromptAssembler` on the next call sees an empty `rollingSummary` and its block-6 slot stays empty; the Verbatim Tail block-7 still holds the last 8 messages). **The main chat response is NOT blocked** per AD-9 — the failure is background-only.

**Given** the `'summarize'` mode is checked for input-moderation per AD-12,
**When** the moderation input check runs at the send-attempt path,
**Then** `'summarize'` and `drift-refresh` injection modes are EXEMPT (their input is already-moderated prior history) — verified by the ChatOrchestrator's moderation-check branch inspecting the PromptMode.

**verifies:** FR-12 (Rolling Summary generation + injection), AD-9 (hybrid trigger + token budget + summary provider selection), AD-8 (adds 'summarize' PromptMode arm), AD-10 (Thread.rollingSummary + turnsSinceLastSummary persisted), AD-12 (summarize mode exempt from input moderation), AD-15 (summary_failed analytics event)

**touches:** `src/domain/context/context-manager.service.ts`, `src/domain/prompts/prompt-assembler.service.ts` (add `case 'summarize'` branch that composes the summary prompt), `src/domain/prompts/types.ts` (verify `PromptMode` includes `'summarize'` from Epic 0), `src/domain/chat/chat-orchestrator.service.ts` (call `contextManager.onTurnComplete(threadId)` after each assistant message completes)

**test target:** unit test (mock a thread with 12 messages, verify primary trigger fires + summary is generated + rollingSummary is persisted; mock a thread with estimated tokens > 70% of a fake context window, verify safety-net trigger fires; mock a summary provider that errors, verify `summary_failed` event + main chat is not blocked)

## Developer Context

Long-conversation memory backbone. `ContextManager.onTurnComplete` is called at the END of every completed assistant message; it decides whether to fire a summary generation IN THE BACKGROUND. The main chat never blocks on summary.

**Readiness-gap #2 (PromptMode enum vs assembler case):** clarify the two boundaries:
- **Enum arm:** `'summarize'` is declared in `PromptMode` union at E0-S2 (already there per that story). No enum change here.
- **Assembler case:** E2-S2 stubbed `case 'summarize': throw new Error('not yet implemented')`. THIS STORY replaces the throw with the real summary-prompt composition.

**Provider choice for summary:**
- Solo thread scope `'hitesh'` → summary via Gemini (same as chat).
- Solo thread scope `'piyush'` → summary via Groq (same as chat).
- Ask-Both thread scope `'ask-both'` → summary via `ASK_BOTH_SUMMARY_PROVIDER_ID = 'gemini'` (Persona-A default provider per AD-9).

**Background failure = no user impact:** if the summary call fails, log analytics + continue. Next `PromptAssembler.compose` sees `thread.rollingSummary === null` and block-6 stays empty; block-7 verbatim tail still preserves recency. User perceives thread as slightly less "long-memory" but no error surfaces.

## Technical Requirements

### `src/domain/context/context-manager.service.ts`

```ts
import { Inject, Injectable } from '@angular/core';
import type { Thread, PersonaId } from '@domain/types/message';
import type { StoragePort } from '@domain/ports/storage.port';
import type { AnalyticsPort } from '@domain/ports/analytics.port';
import { STORAGE_PORT, ANALYTICS_PORT } from '@domain/chat/di-tokens';
import { PROVIDER_REGISTRY } from '@infrastructure/providers/provider.registry';
import { ASK_BOTH_SUMMARY_PROVIDER_ID } from '@config/provider-registry';
import { PERSONA_REGISTRY } from '@personas/persona.registry';
import { PromptAssembler } from '@domain/prompts/prompt-assembler.service';
import { KeyVaultService } from '@domain/key-vault/key-vault.service';
import { assistantMessageCount } from '@domain/context/turn-counting';
import { estimateTokens } from '@domain/context/token-estimator';
import { VERBATIM_TAIL_LENGTH, SUMMARY_REFRESH_CADENCE, SUMMARY_TOKEN_BUDGET_PCT } from '@config/context-config';
import { FEATURE_ROLLING_SUMMARY } from '@config/feature-flags';

const CONTEXT_WINDOW_TOKENS = 32000; // Gemini 2.5 Flash default; make configurable later

@Injectable({ providedIn: 'root' })
export class ContextManager {
  constructor(
    @Inject(STORAGE_PORT) private storage: StoragePort,
    @Inject(ANALYTICS_PORT) private analytics: AnalyticsPort,
    private assembler: PromptAssembler,
    private keyVault: KeyVaultService,
  ) {}

  async onTurnComplete(threadKey: 'chat:hitesh:v1' | 'chat:piyush:v1' | 'chat:ask-both:v1'): Promise<void> {
    if (!FEATURE_ROLLING_SUMMARY) return; // E10-S1 feature flag
    const thread = await this.storage.get<Thread>(threadKey);
    if (!thread) return;

    const turnCount = assistantMessageCount(thread);
    const projectedPrompt = this.projectPromptText(thread);
    const estimated = estimateTokens(projectedPrompt);

    const primaryFires = turnCount > VERBATIM_TAIL_LENGTH && thread.turnsSinceLastSummary >= SUMMARY_REFRESH_CADENCE;
    const safetyFires = estimated > (SUMMARY_TOKEN_BUDGET_PCT / 100) * CONTEXT_WINDOW_TOKENS;

    if (!primaryFires && !safetyFires) {
      thread.turnsSinceLastSummary += 1;
      await this.storage.set(threadKey, thread);
      return;
    }

    // Generate summary
    const persona = thread.scope === 'ask-both' ? 'hitesh' : thread.scope;
    const providerId = thread.scope === 'ask-both'
      ? ASK_BOTH_SUMMARY_PROVIDER_ID
      : PERSONA_REGISTRY[persona].providerId;
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) return; // no key → skip summary silently

    const summaryPrompt = this.assembler.compose(persona, thread, 'summarize');
    const AdapterClass = PROVIDER_REGISTRY.get(providerId)!;
    const adapter = new AdapterClass();
    const controller = new AbortController();

    let summaryText = '';
    try {
      for await (const chunk of adapter.streamChat(summaryPrompt, key, controller.signal)) {
        if (chunk.type === 'delta' && chunk.text) summaryText += chunk.text;
        else if (chunk.type === 'error') {
          this.analytics.emit({ name: 'summary_failed', payload: { provider: providerId, category: chunk.meta?.error ?? 'unknown' } });
          return; // main chat NOT blocked
        }
      }
    } catch {
      this.analytics.emit({ name: 'summary_failed', payload: { provider: providerId, category: 'unknown' } });
      return;
    }

    thread.rollingSummary = summaryText;
    thread.turnsSinceLastSummary = 0;
    await this.storage.set(threadKey, thread);
  }

  private projectPromptText(thread: Thread): string {
    // rough concatenation for token estimate; real assemble would be too expensive for a pre-check
    return [thread.rollingSummary ?? '', ...thread.messages.slice(-VERBATIM_TAIL_LENGTH).map((m) => m.content)].join('\n');
  }
}
```

### `prompt-assembler.service.ts` — replace throw with real 'summarize' case

```ts
case 'summarize': {
  const summarySystemPrompt = 'Compress the conversation below into ~200 tokens preserving facts, user context (stack, project, error), and open threads. Do NOT preserve verbatim wording.';
  const historyBlock = thread.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const messages: PromptMessage[] = [
    { role: 'system', content: summarySystemPrompt },
    { role: 'user', content: historyBlock },
  ];
  return {
    messages,
    model: params.modelName,
    temperature: 0.2, // lower temp for summary consistency
    topP: params.topP,
    maxOutputTokens: 300,
    meta: { mode: 'summarize', hasSummary: false, hasDriftRefresh: false, estimatedTokens: estimateTokens(historyBlock) },
  };
}
```

### `chat-orchestrator.service.ts` — hook onTurnComplete

After a completed assistant message persists, call:
```ts
await this.contextManager.onTurnComplete(this.threadKeyFor(persona));
```

Fire-and-forget style OK; don't await the return since main chat should not be blocked.

## Architecture Compliance

- **AD-8:** `'summarize'` PromptMode case; summary prompt lives inside the assembler's `case 'summarize'` branch (not in ContextManager) per "sole composer" discipline.
- **AD-9:** hybrid trigger, background-only, provider selection per Solo vs Ask-Both scope.
- **AD-10:** rollingSummary + turnsSinceLastSummary persisted in Thread.
- **AD-12:** summarize mode exempt from input moderation (orchestrator checks mode before calling `moderation.check(text, 'input')`).
- **AD-15:** `summary_failed` typed event.

## Library / Framework Requirements

No new packages.

## File Structure Requirements

```
src/domain/context/context-manager.service.ts   # NEW
src/domain/prompts/prompt-assembler.service.ts  # UPDATE — real 'summarize' case
src/domain/chat/chat-orchestrator.service.ts    # UPDATE — call onTurnComplete after done
```

## Testing Requirements

- `context-manager.service.spec.ts`:
  - 12-message thread + `turnsSinceLastSummary >= 10` → primary trigger fires; mocked adapter yields summary; verify `thread.rollingSummary` persisted + `turnsSinceLastSummary = 0`.
  - 4-message thread → neither trigger fires; `turnsSinceLastSummary` increments; NO summary generated.
  - Fake huge thread (~24000 tokens estimated) → safety-net fires even at low turn count.
  - Mock adapter errors → `summary_failed` emitted; main chat NOT blocked (return without persist).
  - `scope: 'ask-both'` → uses `ASK_BOTH_SUMMARY_PROVIDER_ID` (Gemini).
- `prompt-assembler.service.spec.ts` extend: `mode: 'summarize'` composes a `system: "Compress..."` + `user: <historyBlock>` message pair.

## Latest Tech Information

- Gemini 2.5 Flash context window: ~1M tokens per Google. `CONTEXT_WINDOW_TOKENS = 32000` is a conservative starting value; tune post-eval.
- Summary generation cost: 1 call per ~10 turns; ~300-token output. Bounded per FR-12 cost.

## Previous Story Intelligence

**E5-S1 (Verbatim Tail + counters):**
- `estimateTokens` + `assistantMessageCount` canonical.

**E3-S1 (IdbKeyvalStorageAdapter):**
- `StoragePort.get<Thread>(key)` / `.set(key, thread)` — full Thread persistence.

**E2-S3 (ChatOrchestrator):**
- Orchestrator's post-done step is where `contextManager.onTurnComplete` inserts.
- `AnalyticsPort` typed event union has `summary_failed`.

**E2-S2 (PromptAssembler):**
- `case 'summarize'` currently throws; this story implements it.

**E0-S3 (Config):**
- `SUMMARY_REFRESH_CADENCE = 10`, `SUMMARY_TOKEN_BUDGET_PCT = 70`, `ASK_BOTH_SUMMARY_PROVIDER_ID = 'gemini'`, `FEATURE_ROLLING_SUMMARY`.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-9` (hybrid trigger + provider selection + background failure, lines 141–155), `AD-8` (summarize PromptMode arm, lines 122–139), `AD-10` (Thread.rollingSummary persisted, lines 157–165), `AD-12` (summarize exempt from moderation input, lines 177–187), `AD-15` (summary_failed event, lines 221–244).
- Sequence diagram "Rolling Summary trigger" (lines 618–668).
- Sprint status: key `e5-s2-rolling-summary-hybrid-trigger`, blocks `[e9-s2, e10-s1, e11-s2]`.

## References

- [Source: ARCHITECTURE-SPINE.md sequence "Rolling Summary trigger"] Full flow diagram.
- [Source: ARCHITECTURE-SPINE.md#AD-9] Hybrid trigger + background failure.
- [Source: prd.md#FR-12] Rolling Summary generation + injection.
- [Source: sprint-status.yaml#deferred_readiness_gaps.gap_2] PromptMode arm declared in Epic 0 vs assembler case handled here.

## Story Completion Status

- [ ] `ContextManager.onTurnComplete(threadKey)` implements hybrid trigger + summary generation + background failure.
- [ ] `PromptAssembler` `case 'summarize'` replaces throw with real composition.
- [ ] `ChatOrchestrator` invokes `contextManager.onTurnComplete(threadKey)` after each done message.
- [ ] `FEATURE_ROLLING_SUMMARY = false` early-returns per E10-S1 wiring.
- [ ] Solo vs Ask-Both scope routes summary to correct provider.
- [ ] `summary_failed` analytics on error path; main chat NOT blocked.
- [ ] Spec tests cover primary trigger, safety-net trigger, no-trigger, error path, scope routing.
