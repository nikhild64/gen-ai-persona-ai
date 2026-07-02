# Story E9-S2: AskBothSequencer with Sequential flow + single AbortController + Persona-A failure semantics

Status: ready-for-dev

- **Epic:** 9 — Ask-Both Mode
- **Critical-path position:** 28 of 37 (Day 6)
- **Blocks:** E9-S3, E10-S1
- **Depends on:** E9-S1, E2-S1, E2-S2, E2-S3, E5-S2, E8-S2

## Story

As a **cohort grader**,
I want **Hitesh to always answer first, then Piyush to receive Hitesh's response as a system-note and respond with awareness of it — sequentially, not in parallel — and if I cancel mid-Hitesh, Piyush is never invoked**,
So that **the Ask-Both interaction feels like a real conversation, not two independent answers, and my cancellation is respected atomically**.

## Acceptance Criteria

**Given** the ChatOrchestrator + PromptAssembler + provider adapters from Epic 2,
**When** the developer authors `src/features/ask-both/ask-both-sequencer.service.ts`,
**Then** it exposes `sendAskBoth(userText: string): Observable<never>` — the sole entry point for Ask-Both message dispatch.

**Given** `sendAskBoth` is called,
**When** the sequencer runs the Sequential-mode flow (default when `ASK_BOTH_MODE === 'sequential'` from `src/config/feature-flags.ts`),
**Then** step-by-step per AD-13:
  1. Input moderation check on `userText` via `ModerationPort.check(userText, 'input')` per AD-12 (mode counts as `'ask-both-a'` for the check — Epic 8 wired this).
  2. Append user Message to `chat:ask-both:v1` thread via `StoragePort`.
  3. Create ONE `AbortController` per user message; the signal covers BOTH Persona A AND Persona B turns per AD-14.
  4. Compose Hitesh prompt: `PromptAssembler.compose('hitesh', thread, 'ask-both-a', { systemNote: null })`.
  5. Get Hitesh's key: `KeyVaultService.getKeyForProvider('gemini')` (or wherever Spike-0 routed).
  6. Stream Hitesh response via `PROVIDER_REGISTRY.get('gemini').streamChat(hiteshPrompt, key, sharedSignal)`; accumulate delta into `hiteshResponseSignal: WritableSignal<string>`.
  7. On Hitesh's `{type: 'done'}`:
     - Output moderation check on Hitesh's accumulated text per AD-12 (retry-once-then-refuse per E8-S2 applies).
     - Persist Hitesh assistant Message with `role: 'assistant'`, `persona: 'hitesh'`, `status: 'complete'` per AD-10.
     - Compose Piyush prompt: `PromptAssembler.compose('piyush', thread, 'ask-both-b', { systemNote: ASK_BOTH_SYSTEM_NOTE_TEMPLATE('Hitesh', hiteshText) })`.
     - Get Piyush's key: `KeyVaultService.getKeyForProvider('groq')`.
     - Stream Piyush response via `PROVIDER_REGISTRY.get('groq').streamChat(...)`; accumulate into `piyushResponseSignal`.
     - On Piyush's `{type: 'done'}`: output moderation check + persist Piyush Message.

**Given** Hitesh returns a provider error (5xx / timeout / quota-exhausted → `ChatChunk.error`),
**When** the sequencer handles the error branch per FR-27 + AD-13,
**Then** the sequencer does NOT invoke Piyush; an in-character error bubble is rendered in Hitesh's palette per Addendum §E (Epic 7 story E7-S2 supplies the quota-exhausted template + retry affordance); the user sees a "Retry" button below the Hitesh bubble.

**Given** Hitesh returns an in-character refusal (moderation block on input or output, or a persona-level refusal in the response text — the AD-12 output moderation flow just substituted a canned refusal),
**When** the sequencer handles the refusal branch per FR-27,
**Then** the sequencer STILL invokes Piyush with `systemNote: ASK_BOTH_SYSTEM_NOTE_TEMPLATE('Hitesh', hiteshRefusalText)` so Piyush can independently respond to the user's original question — this allows Piyush to still give a useful technical answer even if Hitesh refused (e.g., off-domain refusal).

**Given** the user aborts (persona switch, mode switch, tab close, explicit cancel button),
**When** the AbortController's `abort()` fires at ANY point during the Ask-Both sequence,
**Then** per AD-14: the whole sequence terminates; if Hitesh was streaming, Hitesh's Message is marked `status: 'cancelled'` with partial content per AD-10; Piyush is NEVER invoked; the mode-switcher and persona-switcher re-enable.

**Given** the Rolling Summary trigger fires on the Ask-Both thread (per AD-9),
**When** the summary is generated,
**Then** the sequencer (or ContextManager) uses `ASK_BOTH_SUMMARY_PROVIDER_ID = 'gemini'` from `src/config/provider-registry.ts` (Persona-A default provider matching turn order per AD-13) — verified by inspecting the outbound request in DevTools Network tab during a summary run.

**Given** the sequencer emits analytics,
**When** an Ask-Both user message is dispatched,
**Then** `ask_both_message_sent` analytics event fires with `{charCount}` per AD-15. Individual message_sent events for Hitesh + Piyush are NOT emitted separately (they'd double-count).

**verifies:** FR-27 (Sequential-With-Awareness turn order + Persona-A failure semantics), AD-8 (PromptAssembler modes `'ask-both-a'` + `'ask-both-b'` + `'ask-both-keep-going'` — extend from Epic 2's `'solo'`-only handling), AD-9 (ASK_BOTH_SUMMARY_PROVIDER_ID for Ask-Both threads), AD-10 (Message.persona field on both bubbles), AD-13 (Ask-Both sequencer semantics + system-note format + one AbortController), AD-14 (shared signal per user message), AD-15 (ask_both_message_sent typed event)

**touches:** `src/features/ask-both/ask-both-sequencer.service.ts`, `src/domain/prompts/prompt-assembler.service.ts` (extend `case 'ask-both-a'` + `case 'ask-both-b'` + `case 'ask-both-keep-going'` — the system-note is inserted between blocks 7 and 8 per AD-8; Piyush's few-shots also get the collaboration exemplars per AD-13 loaded via `personas/piyush.prompt.askBothCollabExamples` from E8-S1), `src/domain/chat/chat-orchestrator.service.ts` (delegate Ask-Both mode dispatches to AskBothSequencer OR the sequencer reuses orchestrator primitives directly)

**test target:** unit test (mock GeminiAdapter + GroqAdapter; verify Hitesh streams first + then Piyush with systemNote; verify Hitesh error blocks Piyush; verify Hitesh in-character refusal STILL invokes Piyush; verify abort cancels both turns atomically) + e2e test (real Sequential-mode flow with mock adapters via TEST_PROVIDER_REGISTRY yields expected bubbles in order)

## Developer Context

The Ask-Both engine. Own service, not part of ChatOrchestrator (which is Solo-only). Reuses PromptAssembler + adapters + KeyVault + ModerationPort — same DI primitives.

**Readiness-gap #2 addressed inline here:** `PromptAssembler` `case 'ask-both-a'/'ask-both-b'/'ask-both-keep-going'` extends E2-S2's Solo-only assembler. Assembler shape:
- `ask-both-a`: same as Solo but with `mode: 'ask-both-a'` in OutboundPrompt.meta.
- `ask-both-b`: adds a `[System note: ${personaName} just said the following...]` block between blocks 7 and 8, wrapping in the `ASK_BOTH_SYSTEM_NOTE_TEMPLATE` format from `prompt-format.ts`.
- `ask-both-keep-going`: uses `ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(userMsg, hiteshText, piyushText)`.

## Technical Requirements

### `ask-both-sequencer.service.ts`

```ts
@Injectable({ providedIn: 'root' })
export class AskBothSequencer {
  readonly hiteshResponseSignal: WritableSignal<string> = signal('');
  readonly piyushResponseSignal: WritableSignal<string> = signal('');
  readonly askBothTurnComplete$: Subject<void> = new Subject();

  private currentAbort: AbortController | null = null;

  constructor(
    @Inject(STORAGE_PORT) private storage: StoragePort,
    @Inject(MODERATION_PORT) private moderation: ModerationPort,
    @Inject(ANALYTICS_PORT) private analytics: AnalyticsPort,
    private assembler: PromptAssembler,
    private keyVault: KeyVaultService,
  ) {}

  sendAskBoth(userText: string): Observable<never> {
    return new Observable((sub) => {
      this.dispatch(userText, sub).catch((e) => sub.error(e));
      return () => this.currentAbort?.abort();
    });
  }

  cancelInFlight(): void { this.currentAbort?.abort(); }

  private async dispatch(userText: string, sub): Promise<void> {
    // Read ASK_BOTH_MODE flag — E9-S4 handles parallel branch
    if (ASK_BOTH_MODE === 'parallel') return this.dispatchParallel(userText, sub);

    // 1. Input moderation
    const inputVerdict = await this.moderation.check(userText, 'input');
    if (!inputVerdict.allowed) {
      // Render deflection in Hitesh's palette (Persona A default)
      // ...emit moderation_blocked
      sub.complete();
      return;
    }

    // 2. Append user message
    const thread = await this.getOrCreateAskBothThread();
    const userMsg: Message = {
      id: crypto.randomUUID(), role: 'user', content: userText, timestamp: Date.now(),
    };
    thread.messages.push(userMsg);
    await this.storage.set('chat:ask-both:v1', thread);

    // 3. Single AbortController for both turns
    this.currentAbort = new AbortController();
    const signal = this.currentAbort.signal;

    // Analytics — fire once for the whole turn
    this.analytics.emit({ name: 'ask_both_message_sent', payload: { charCount: userText.length } });

    // 4-6. Hitesh (Persona A)
    this.hiteshResponseSignal.set('');
    const hiteshPrompt = this.assembler.compose('hitesh', thread, 'ask-both-a');
    const hiteshKey = this.keyVault.getKeyForProvider('gemini');
    if (!hiteshKey) { /* auto-open settings similar to Solo */ sub.complete(); return; }
    const HiteshAdapter = PROVIDER_REGISTRY.get('gemini')!;
    const hiteshAdapter = new HiteshAdapter();

    let hiteshText = '';
    let hiteshErrored = false;
    let hiteshRefused = false;
    try {
      for await (const chunk of hiteshAdapter.streamChat(hiteshPrompt, hiteshKey, signal)) {
        if (chunk.type === 'delta' && chunk.text) {
          hiteshText += chunk.text;
          this.hiteshResponseSignal.set(hiteshText);
        } else if (chunk.type === 'error') {
          hiteshErrored = true;
          // E7-S2 in-character error bubble; render + Retry affordance
          this.renderAskBothError('hitesh', chunk, thread);
          break;
        } else if (chunk.type === 'done') break;
      }
    } catch { hiteshErrored = true; }

    if (hiteshErrored) { sub.complete(); return; } // Piyush NOT invoked per FR-27

    // Output moderation on Hitesh (retry-once via ModerationAdapter behavior — sequencer version)
    const hiteshFinal = await this.checkOutputWithRetryAskBoth('hitesh', hiteshText, hiteshPrompt, hiteshKey, hiteshAdapter);
    hiteshRefused = hiteshFinal !== hiteshText; // canned refusal was substituted

    // Persist Hitesh message
    const hiteshMsg: Message = {
      id: crypto.randomUUID(), role: 'assistant', persona: 'hitesh',
      content: hiteshFinal, timestamp: Date.now(), status: 'complete',
    };
    thread.messages.push(hiteshMsg);
    await this.storage.set('chat:ask-both:v1', thread);

    // 7. Piyush (Persona B) — invoked even if Hitesh refused (per FR-27 refusal semantics)
    this.piyushResponseSignal.set('');
    const piyushPrompt = this.assembler.compose('piyush', thread, 'ask-both-b', {
      systemNote: ASK_BOTH_SYSTEM_NOTE_TEMPLATE('Hitesh', hiteshFinal),
    });
    const piyushKey = this.keyVault.getKeyForProvider('groq');
    if (!piyushKey) { sub.complete(); return; }
    const PiyushAdapter = PROVIDER_REGISTRY.get('groq')!;
    const piyushAdapter = new PiyushAdapter();

    let piyushText = '';
    try {
      for await (const chunk of piyushAdapter.streamChat(piyushPrompt, piyushKey, signal)) {
        if (chunk.type === 'delta' && chunk.text) {
          piyushText += chunk.text;
          this.piyushResponseSignal.set(piyushText);
        } else if (chunk.type === 'error') {
          // ...same in-character error handling for Piyush
          break;
        } else if (chunk.type === 'done') break;
      }
    } catch { /* handle */ }

    const piyushFinal = await this.checkOutputWithRetryAskBoth('piyush', piyushText, piyushPrompt, piyushKey, piyushAdapter);
    const piyushMsg: Message = {
      id: crypto.randomUUID(), role: 'assistant', persona: 'piyush',
      content: piyushFinal, timestamp: Date.now(), status: 'complete',
    };
    thread.messages.push(piyushMsg);
    await this.storage.set('chat:ask-both:v1', thread);

    this.askBothTurnComplete$.next();
    sub.complete();
  }

  private dispatchParallel(...) { /* E9-S4 */ }
  private renderAskBothError(...) { /* ... */ }
  private checkOutputWithRetryAskBoth(...) { /* similar to orchestrator's version */ }
  private async getOrCreateAskBothThread(): Promise<Thread> { /* ... */ }
}
```

### `prompt-assembler.service.ts` — extend Ask-Both cases

Add case handlers for `'ask-both-a'`, `'ask-both-b'`, `'ask-both-keep-going'`:

```ts
case 'ask-both-a': {
  // Same as 'solo' but mode metadata
  const outbound = /* build 9-block for Hitesh */;
  outbound.meta.mode = 'ask-both-a';
  return outbound;
}
case 'ask-both-b': {
  // 9-block + system-note between blocks 7 and 8
  const systemNote = options?.systemNote ?? '';
  const outbound = /* build 9-block with systemNote inserted */;
  outbound.meta.mode = 'ask-both-b';
  return outbound;
}
case 'ask-both-keep-going': {
  const systemNote = options?.systemNote ?? ''; // ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE
  // ...
  outbound.meta.mode = 'ask-both-keep-going';
  return outbound;
}
```

Load `askBothCollabExamples` (from E8-S1) into `fewShots` for Ask-Both modes to calibrate Persona-B acknowledgment.

## Architecture Compliance

- **AD-8:** system-note inserted between blocks 7 and 8; template constant from `prompt-format.ts`.
- **AD-9:** Ask-Both thread rolling summary uses `ASK_BOTH_SUMMARY_PROVIDER_ID`.
- **AD-10:** persona field required on both Hitesh + Piyush assistant messages.
- **AD-12:** input moderation on Ask-Both send; output retry-once-then-refuse per stream.
- **AD-13:** Sequential-With-Awareness; FR-27 failure semantics (error blocks Piyush, refusal doesn't).
- **AD-14:** single AbortController covers both turns; abort mid-sequence stops A + prevents B.
- **AD-15:** `ask_both_message_sent` once per user turn (not double-emit).

## Library / Framework Requirements

No new packages.

## File Structure Requirements

```
src/features/ask-both/ask-both-sequencer.service.ts   # NEW
src/domain/prompts/prompt-assembler.service.ts        # UPDATE — 3 new cases
src/domain/chat/chat-orchestrator.service.ts          # UPDATE — delegate ask-both dispatches OR left as-is (sequencer stands alone)
```

## Testing Requirements

- Mock adapters: verify Hitesh streams first + then Piyush; verify Piyush's prompt contains the system-note with Hitesh's verbatim text.
- Hitesh error mid-stream → Piyush NOT invoked.
- Hitesh in-character refusal → Piyush INVOKED with refusal text as system-note.
- Abort mid-Hitesh → both turns terminate atomically; final `chunk.type === 'error', error: 'aborted'`.
- Analytics: `ask_both_message_sent` emitted ONCE per user message (not per persona).

## Latest Tech Information

- Single AbortController for both turns — key design decision per AD-14.

## Previous Story Intelligence

**E9-S1:** Ask-Both shell + routing + joint greeting + `chat:ask-both:v1` key.
**E8-S2:** Full HeuristicModerationAdapter + orchestrator retry-once path.
**E8-S1:** `askBothCollabExamples` populated for Persona-B calibration.
**E5-S2:** ContextManager summary generation with `ASK_BOTH_SUMMARY_PROVIDER_ID`.
**E2-S2:** PromptAssembler solo-only; extend with 3 cases here.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-13` (Ask-Both semantics, lines 189–208), `AD-14` (single AbortController, lines 210–219).
- Sequence diagram "Ask-Both Mode message" (lines 554–616).
- Sprint status: key `e9-s2-ask-both-sequencer-sequential`, blocks `[e9-s3, e10-s1]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-13] Full Ask-Both sequencer contract.
- [Source: ARCHITECTURE-SPINE.md sequence "Ask-Both Mode message"] Full diagram.
- [Source: cross-cutting-AC-checklist.md] AD-20/22 items also apply here (E9-S3 completes UI).

## Story Completion Status

- [ ] `AskBothSequencer` service with `sendAskBoth(userText)` + `cancelInFlight()` + reactive signals.
- [ ] Sequential flow: A first, then B with systemNote.
- [ ] Persona-A error → Piyush NOT invoked; error + Retry.
- [ ] Persona-A refusal → Piyush INVOKED with refusal as systemNote.
- [ ] Single AbortController covers both turns.
- [ ] `ask_both_message_sent` emitted once per turn.
- [ ] PromptAssembler extended with 3 Ask-Both cases.
- [ ] Full unit test coverage.
