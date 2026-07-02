# Story E9-S4: Parallel-mode flag branch + FR-31 fallback

Status: ready-for-dev

- **Epic:** 9 — Ask-Both Mode
- **Critical-path position:** 30 of 37 (Day 6)
- **Blocks:** E10-S1
- **Depends on:** E9-S3
- **SCOPE-CUT PRIORITY #1** — first-cut candidate per sprint-status.yaml if Day 6 slips.

## Story

As a **solo developer at demo-day midnight**,
I want **an escape hatch — flip `ASK_BOTH_MODE = 'parallel'` in feature-flags.ts and rebuild — that ships Ask-Both without the Sequential-With-Awareness system-note (both personas respond independently, in parallel), so if Sequential feels sycophantic in eval I have Plan B**,
So that **FR-31 fallback works as intended and the mode-switcher doesn't have to hide entirely when Sequential mode misbehaves**.

## Acceptance Criteria

**Given** the AskBothSequencer from E9-S2 + the `ASK_BOTH_MODE` const from `src/config/feature-flags.ts` (Epic 0),
**When** the sequencer's `sendAskBoth` handler reads the flag,
**Then** IF `ASK_BOTH_MODE === 'parallel'`, the flow branches per AD-13:
  1. Input moderation check on `userText` (same as Sequential).
  2. Append user Message.
  3. Create ONE AbortController covering both concurrent requests (still one signal per user message per AD-14, but both provider.streamChat calls receive it).
  4. Compose Hitesh prompt: `PromptAssembler.compose('hitesh', thread, 'ask-both-a', { systemNote: null })` — same as Sequential.
  5. Compose Piyush prompt: `PromptAssembler.compose('piyush', thread, 'ask-both-b', { systemNote: null })` — **CRITICAL: systemNote is null, no reference to Hitesh's response** per AD-13.
  6. Get both keys.
  7. Invoke `GeminiAdapter.streamChat` AND `GroqAdapter.streamChat` CONCURRENTLY (both AsyncIterables consumed in parallel — Promise.all or two independent RxJS subscriptions).
  8. UI streams both bubbles simultaneously (both `hiteshResponseSignal` and `piyushResponseSignal` grow in parallel).
  9. On BOTH done: output moderation checks + persist both Messages.
  10. Emit `parallel_fallback_triggered` analytics event per AD-15.

**Given** Parallel mode is active,
**When** the streaming-indicator renders,
**Then** it shows a combined label from `product-copy.ts.streamingIndicatorAskBothParallel` (`"Hitesh and Piyush are answering…"`) instead of the sequential A/B variants — no collaboration cues (Piyush is not "reading Hitesh's take" in Parallel).

**Given** Parallel mode is active,
**When** the SM-2 + SM-7 evaluation runs (Epic 11),
**Then** the Persona-B acknowledgment expectations are relaxed to N/A per AD-13 — Ask-Both is evaluated on independent Persona Fidelity per Persona only (the SM-7 rubric.md notes the relaxation when Parallel mode is active).

**Given** the Keep-going button in Parallel mode,
**When** the user views the completed Ask-Both bubbles,
**Then** the Keep-going button is HIDDEN entirely — Keep-going doesn't make sense without the awareness chain (Hitesh has no Piyush-take to respond to that he'd know about). This is per AD-13's implicit rule that Keep-going is a Sequential-only affordance.

**Given** the FEATURE_ASK_BOTH_MODE kill-switch is separately `false`,
**When** the app boots,
**Then** the mode-switcher control is HIDDEN entirely per FR-32 + AD-13 (separate from ASK_BOTH_MODE selector); any deep link to `/chat/ask-both` redirects to `/` per EXPERIENCE.md.State Patterns. This is verified in Epic 10's feature-flag consumption story.

**Given** the aria-announcer,
**When** running in Parallel mode,
**Then** the bridge announcement `"Piyush is now responding to Hitesh's take."` is NOT emitted (there's no sequential dependency); each bubble's completion emits its own persona-prefixed announcement independently. First-completed-first-announced order (whichever finishes first).

**verifies:** FR-31 (Ask-Both Parallel-mode fallback), AD-13 (ASK_BOTH_MODE selector distinct from FEATURE_ASK_BOTH_MODE kill-switch + Parallel-mode contract), AD-14 (single AbortController still covers both concurrent turns), AD-15 (parallel_fallback_triggered event), AD-20 (cross-cutting — aria-announcer behavior adapts)

**touches:** `src/features/ask-both/ask-both-sequencer.service.ts` (extend with parallel branch), `src/features/ask-both/ask-both.component.ts` (hide Keep-going button in Parallel mode; use `streamingIndicatorAskBothParallel` label; concurrent stream binding), `src/shared/aria-announcer/aria-announcer.component.ts` (skip bridge announcement in Parallel mode), `src/config/product-copy.ts` (new key: `streamingIndicatorAskBothParallel`), `evals/rubric.md` (Epic 11 — noted at Ask-Both rubric section that Parallel mode relaxes acknowledgment/sycophancy metrics to N/A)

**test target:** unit test (flip ASK_BOTH_MODE to 'parallel'; verify sequencer invokes both adapters concurrently + no systemNote on Piyush prompt + parallel_fallback_triggered event; verify Keep-going button hidden in Parallel mode) + manual smoke test (build with ASK_BOTH_MODE=parallel; run a full Ask-Both request; verify both bubbles stream in parallel via DevTools Network waterfall)

## Developer Context

Plan-B if Sequential-With-Awareness produces sycophantic Piyush responses in eval. Flip one const → rebuild → deploy → both personas respond independently.

**SCOPE-CUT PRIORITY #1** (per sprint-status.yaml): if Day 6 runs long, cut this whole story. Sequential mode works standalone. FR-31 gets "not-tested-fallback" note in EVALUATION.md.

## Technical Requirements

### `ask-both-sequencer.service.ts` — extend

```ts
private async dispatch(userText: string, sub): Promise<void> {
  if (ASK_BOTH_MODE === 'parallel') return this.dispatchParallel(userText, sub);
  // ...sequential flow (E9-S2)
}

private async dispatchParallel(userText: string, sub): Promise<void> {
  // 1. Input moderation
  const inputVerdict = await this.moderation.check(userText, 'input');
  if (!inputVerdict.allowed) { /* render deflection */ sub.complete(); return; }

  // 2. Append user message
  const thread = await this.getOrCreateAskBothThread();
  thread.messages.push({ id: crypto.randomUUID(), role: 'user', content: userText, timestamp: Date.now() });
  await this.storage.set('chat:ask-both:v1', thread);

  // 3. Single AbortController for both
  this.currentAbort = new AbortController();
  const signal = this.currentAbort.signal;

  // 4-5. Compose both prompts with NO systemNote
  const hiteshPrompt = this.assembler.compose('hitesh', thread, 'ask-both-a', { systemNote: null });
  const piyushPrompt = this.assembler.compose('piyush', thread, 'ask-both-b', { systemNote: null });

  // 6. Get keys
  const hiteshKey = this.keyVault.getKeyForProvider('gemini');
  const piyushKey = this.keyVault.getKeyForProvider('groq');
  if (!hiteshKey || !piyushKey) { sub.complete(); return; }

  // 7. Concurrent invocation
  const HiteshAdapter = PROVIDER_REGISTRY.get('gemini')!;
  const PiyushAdapter = PROVIDER_REGISTRY.get('groq')!;
  const hitesh = new HiteshAdapter();
  const piyush = new PiyushAdapter();

  const consumeHitesh = async () => {
    let text = '';
    for await (const c of hitesh.streamChat(hiteshPrompt, hiteshKey, signal)) {
      if (c.type === 'delta' && c.text) { text += c.text; this.hiteshResponseSignal.set(text); }
      else if (c.type === 'done' || c.type === 'error') break;
    }
    return text;
  };
  const consumePiyush = async () => {
    let text = '';
    for await (const c of piyush.streamChat(piyushPrompt, piyushKey, signal)) {
      if (c.type === 'delta' && c.text) { text += c.text; this.piyushResponseSignal.set(text); }
      else if (c.type === 'done' || c.type === 'error') break;
    }
    return text;
  };

  const [hiteshFinal, piyushFinal] = await Promise.all([consumeHitesh(), consumePiyush()]);

  // 9. Output moderation + persist both
  const hf = await this.checkOutputWithRetryAskBoth('hitesh', hiteshFinal, hiteshPrompt, hiteshKey, hitesh);
  const pf = await this.checkOutputWithRetryAskBoth('piyush', piyushFinal, piyushPrompt, piyushKey, piyush);
  thread.messages.push({ id: crypto.randomUUID(), role: 'assistant', persona: 'hitesh', content: hf, timestamp: Date.now(), status: 'complete' });
  thread.messages.push({ id: crypto.randomUUID(), role: 'assistant', persona: 'piyush', content: pf, timestamp: Date.now(), status: 'complete' });
  await this.storage.set('chat:ask-both:v1', thread);

  // 10. Emit event
  this.analytics.emit({ name: 'parallel_fallback_triggered', payload: {} });
  this.analytics.emit({ name: 'ask_both_message_sent', payload: { charCount: userText.length } });
  this.askBothTurnComplete$.next();
  sub.complete();
}
```

### `ask-both.component.ts` — Parallel-mode UI

```ts
readonly isParallel = ASK_BOTH_MODE === 'parallel';

streamingIndicatorLabel = computed(() => {
  if (this.isParallel && (this.sequencer.hiteshResponseSignal() === '' && this.sequencer.piyushResponseSignal() === '')) {
    return copy.streamingIndicatorAskBothParallel;
  }
  // ...else Sequential logic from E9-S3
});
```

Template: hide Keep-going button when `isParallel` is true.

### `aria-announcer` — skip bridge in Parallel

```ts
if (ASK_BOTH_MODE !== 'parallel') {
  // Emit bridge between A and B
}
```

### `product-copy.ts`:

```ts
export const streamingIndicatorAskBothParallel = 'Hitesh and Piyush are answering…';
```

### `evals/rubric.md` — Epic 11 note

Placeholder for E11: when `ASK_BOTH_MODE === 'parallel'`, SM-7 acknowledgment-rate + sycophancy-rate targets are N/A; report as "n/a in Parallel mode".

## Architecture Compliance

- **AD-13:** ASK_BOTH_MODE selector separate from FEATURE_ASK_BOTH_MODE kill-switch; Parallel skips systemNote + concurrent invocation.
- **AD-14:** single AbortController covers both concurrent turns.
- **AD-15:** `parallel_fallback_triggered` typed event.

## File Structure Requirements

```
src/features/ask-both/ask-both-sequencer.service.ts   # EXTEND with dispatchParallel
src/features/ask-both/ask-both.component.ts / .html   # UPDATE — parallel-mode UI adjustments
src/shared/aria-announcer/aria-announcer.component.ts # UPDATE — skip bridge in parallel
src/config/product-copy.ts                             # EXTEND streamingIndicatorAskBothParallel
evals/rubric.md                                        # NOTE about Parallel-mode SM-7 relaxation (E11)
```

## Testing Requirements

- Sequencer spec: `ASK_BOTH_MODE = 'parallel'` → both adapters called concurrently (verify no systemNote in Piyush prompt); parallel_fallback_triggered emitted.
- Component spec: Keep-going button hidden in Parallel mode.
- Manual smoke: build with `VITE_ASK_BOTH_MODE=parallel`, run Ask-Both request, verify DevTools Network waterfall shows both requests firing simultaneously (not sequentially).

## Latest Tech Information

- `Promise.all([async iter 1, async iter 2])` — both AsyncIterables consumed in parallel; both writes to signals are independent.

## Previous Story Intelligence

**E9-S2 (Sequencer):** stub `dispatchParallel(...)` placeholder — this story fills it.
**E9-S3 (UI):** Keep-going button UI + bridge announcement — this story hides them in Parallel.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-13` Parallel-mode contract (lines 205–208).
- Sprint status: key `e9-s4-parallel-mode-and-aria-bridge`, blocks `[e10-s1]`, scope_cut_priority: 1.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-13] Parallel mode contract; systemNote null; SM-7 relaxation.
- [Source: prd.md#FR-31] Ask-Both Parallel-mode fallback rationale.
- [Source: sprint-status.yaml#scope_cut_priority.1] First-cut candidate if Day 6 slips.

## Story Completion Status

- [ ] Sequencer `dispatchParallel` implemented per AD-13.
- [ ] Streaming indicator uses combined label in Parallel.
- [ ] Keep-going button hidden in Parallel.
- [ ] Aria-announcer bridge skipped in Parallel.
- [ ] `parallel_fallback_triggered` emitted.
- [ ] Manual smoke: parallel network waterfall verified.
- [ ] evals/rubric.md notes Parallel-mode SM-7 relaxation (E11 will fully populate).
