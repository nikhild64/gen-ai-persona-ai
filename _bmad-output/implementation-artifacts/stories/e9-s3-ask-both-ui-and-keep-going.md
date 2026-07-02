# Story E9-S3: Ask-Both UI — per-bubble attribution + streaming-indicator variants + Keep-going button

Status: ready-for-dev

- **Epic:** 9 — Ask-Both Mode
- **Critical-path position:** 29 of 37 (Day 6)
- **Blocks:** E9-S4, E11-S2
- **Depends on:** E9-S2, E4-S2

## Story

As a **cohort grader running Priya's UJ-4 flow**,
I want **each response bubble to clearly show whose voice it is (Hitesh's amber vs Piyush's blue), the streaming indicator to say "Piyush is thinking (reading Hitesh's take)..." during Piyush's turn, and a "Keep going" button after both respond so I can trigger one more round**,
So that **the eavesdropping feel is preserved — I can tell who's talking + I can chain one extra round if I want more**.

## Acceptance Criteria

**Given** the AskBothSequencer from E9-S2,
**When** the `<ask-both>` component subscribes to `hiteshResponseSignal` and `piyushResponseSignal`,
**Then** it renders per-turn `<message-bubble [attr.data-persona]="message.persona">` — Hitesh's bubble carries `[data-persona="hitesh"]` locally scoping the amber palette (per UX-DR13 + AD-17), Piyush's bubble carries `[data-persona="piyush"]` locally scoping the blue palette. The container's neutral `[data-mode="ask-both"]` chrome is preserved around each bubble.

**Given** the streaming-indicator component from Epic 2,
**When** the sequencer is streaming Hitesh (Persona-A phase),
**Then** the indicator label reads `product-copy.ts.streamingIndicatorAskBothA` (`"Hitesh is thinking…"`).

**Given** Hitesh has completed AND the sequencer is now streaming Piyush (Persona-B phase),
**When** the indicator re-renders,
**Then** the label reads `product-copy.ts.streamingIndicatorAskBothB` (`"Piyush is thinking (reading Hitesh's take)…"`) — the parenthetical is a deliberate FR-29 nod at the Sequential-With-Awareness pattern being visible in chrome without breaking AD-22 (chrome copy stays neutral English + light Hinglish flavor).

**Given** both Hitesh's and Piyush's bubbles have completed,
**When** the sequencer emits an `askBothTurnComplete$` signal,
**Then** the `<ask-both>` component renders a "Keep going" button below Piyush's bubble — `{colors.neutral-accent}`-bordered, `body-sm` label from `product-copy.ts.keepGoingButtonLabel` (`"Keep going"`). The button is enabled ONCE per turn.

**Given** the user clicks Keep going,
**When** the click handler fires,
**Then** the sequencer runs the Keep-going round per AD-13:
  1. Compose Hitesh prompt: `PromptAssembler.compose('hitesh', thread, 'ask-both-keep-going', { systemNote: ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(userMessage, hiteshText, piyushText) })`.
  2. Stream Hitesh response via GeminiAdapter with the shared `AbortSignal` (still the same AbortController from the user message — extended to cover the Keep-going round per AD-14).
  3. On done, persist Hitesh Keep-going Message with `persona: 'hitesh'`, `status: 'complete'`.
  4. The Keep-going button becomes disabled per `KEEP_GOING_ROUNDS = 1` (from `src/config/context-config.ts`, Epic 0) — the user cannot trigger a second round for this turn.
  5. `keep_going_clicked` analytics event emits per AD-15.

**Given** the Ask-Both max-turn cap counting (from Epic 7 story E7-S1 + turn-counting helpers from Epic 5),
**When** the sequencer checks the cap at send-attempt,
**Then** it uses `expectedAssistantMessagesForMode('ask-both-a') = 2` for the initial dispatch (Hitesh + Piyush count as 2 assistant messages) and `expectedAssistantMessagesForMode('ask-both-keep-going') = 1` for the Keep-going round (one more on top of the A+B already counted).

**Given** the aria-announcer from Epic 2 + Epic 4,
**When** Hitesh's message completes,
**Then** the aria-announcer writes `"Hitesh says: {fullText}"` per AD-20. IMMEDIATELY AFTER (before Piyush starts streaming), the aria-announcer writes the bridge announcement `"Piyush is now responding to Hitesh's take."` from `product-copy.ts.askBothBridgeAnnouncement` per AD-20 + EXPERIENCE.md.Accessibility Floor.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Keep going button is reachable via Tab after both bubbles complete.
- **AC-A20.2** — `keepGoingButtonLabel` from `aria-labels.ts`.
- **AC-A20.4** — Per-persona bubble colors verified by `assertContrast` (from Epic 4 story E4-S2 tests — ensure Ask-Both mode is included).
- **AC-A20.5** — Aria-announcer emits full completed messages + bridge announcement between A and B (never chunk-by-chunk).
- **AC-A22.1** — Keep going button label, streaming-indicator variants, bridge announcement — all from `product-copy.ts`.

**verifies:** FR-27 (Persona A + B rendering + attribution), FR-28 (Keep-going one-more-round + 1-use cap), FR-29 (Ask-Both streaming presentation + per-persona attribution + streaming-indicator variants), AD-13 (KEEP_GOING_ROUNDS = 1 + system-note templates), AD-17 (per-bubble `[data-persona]` + container `[data-mode]`), AD-15 (keep_going_clicked event), AD-20 (cross-cutting — aria-announcer bridge), AD-22 (cross-cutting)

**touches:** `src/features/ask-both/ask-both.component.ts` (extend from E9-S1 to render sequencer output + Keep-going button + bubble variants), `src/features/ask-both/ask-both.component.scss`, `src/features/ask-both/ask-both.component.html`, `src/features/ask-both/keep-going-button.component.ts` (small standalone button component; alternatively inline in ask-both.component.ts), `src/features/ask-both/ask-both-sequencer.service.ts` (extend from E9-S2 with Keep-going round handling), `src/shared/aria-announcer/aria-announcer.component.ts` (extend from Epic 2 with bridge-announcement support), `src/config/product-copy.ts` (new keys: `keepGoingButtonLabel`, `askBothBridgeAnnouncement` — plus `streamingIndicatorAskBothA` + `streamingIndicatorAskBothB` from Epic 2), `src/config/aria-labels.ts` (uses existing `keepGoingButtonLabel`)

**test target:** component test (bubbles render with correct `[data-persona]` scope + colors; streaming-indicator variant switches from A to B; Keep going button appears after both complete + disables after one click; keep_going_clicked event emits) + e2e test (full UJ-4 flow — Priya's JS-vs-Python — with mock adapters + verify bubbles + Keep-going flow + aria-announcer bridge)

## Developer Context

Completes Ask-Both Sequential UI. E9-S1 landed the shell + greeting; E9-S2 landed the sequencer; this story renders live bubbles + Keep-going + aria-bridge.

**Per-bubble persona scope:** Ask-Both container has `[data-mode="ask-both"]` (neutral chrome). Each `<message-bubble>` inside carries `[attr.data-persona]="msg.persona"` (per E4-S2 HostBinding), locally re-scoping `--persona-accent` + `--persona-bubble-bg` to Hitesh's amber or Piyush's blue.

**Bridge announcement (AC-A20.5):** aria-announcer emits `"Hitesh says: {fullText}"` on Hitesh done. IMMEDIATELY after (before Piyush's first delta), emit `"Piyush is now responding to Hitesh's take."`. Then when Piyush done → `"Piyush says: {fullText}"`.

## Technical Requirements

### `ask-both.component.ts` — extend from E9-S1

```ts
export class AskBothComponent {
  private sequencer = inject(AskBothSequencer);
  thread = signal<Thread | null>(null);
  keepGoingUsed = signal(false);

  ngOnInit() { /* existing thread init */ }

  onSend(text: string) {
    this.keepGoingUsed.set(false);
    this.sequencer.sendAskBoth(text).subscribe();
  }

  onKeepGoing() {
    this.keepGoingUsed.set(true);
    this.analytics.emit({ name: 'keep_going_clicked', payload: {} });
    this.sequencer.runKeepGoing().subscribe();
  }

  // Signal-based streaming indicator label logic
  streamingIndicatorLabel = computed(() => {
    if (!this.sequencer.hiteshResponseSignal()) return copy.streamingIndicatorAskBothA;
    if (this.sequencer.hiteshCompletedButPiyushStreaming()) return copy.streamingIndicatorAskBothB;
    return '';
  });
}
```

### `ask-both.component.html`

```html
<div class="chat-container" data-mode="ask-both">
  <!-- Empty-state greeting from E9-S1 -->
  <!-- Streaming: Hitesh bubble growing via signal -->
  <ng-container *ngIf="sequencer.hiteshResponseSignal()">
    <app-message-bubble [message]="{
      role: 'assistant', persona: 'hitesh',
      content: sequencer.hiteshResponseSignal(),
      timestamp: 0, id: 'streaming-hitesh', status: 'streaming'
    }"></app-message-bubble>
  </ng-container>
  <!-- Then Piyush bubble growing via signal -->
  <ng-container *ngIf="sequencer.piyushResponseSignal()">
    <app-message-bubble [message]="{
      role: 'assistant', persona: 'piyush',
      content: sequencer.piyushResponseSignal(),
      timestamp: 0, id: 'streaming-piyush', status: 'streaming'
    }"></app-message-bubble>
  </ng-container>
  <!-- Streaming indicator with variant label -->
  <app-streaming-indicator *ngIf="streamingIndicatorLabel()" [label]="streamingIndicatorLabel()"></app-streaming-indicator>
  <!-- Keep-going button after both done -->
  <p-button *ngIf="sequencer.askBothTurnComplete$ | async" [disabled]="keepGoingUsed()"
            [label]="keepGoingButtonLabel" (onClick)="onKeepGoing()"></p-button>
</div>
```

### `ask-both-sequencer.service.ts` — extend with Keep-going

```ts
private lastUserMessage = '';
private lastHiteshText = '';
private lastPiyushText = '';

runKeepGoing(): Observable<never> {
  return new Observable((sub) => {
    this.dispatchKeepGoing(sub).catch((e) => sub.error(e));
    return () => this.currentAbort?.abort();
  });
}

private async dispatchKeepGoing(sub): Promise<void> {
  const thread = await this.getOrCreateAskBothThread();
  const systemNote = ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(
    this.lastUserMessage, this.lastHiteshText, this.lastPiyushText
  );
  const prompt = this.assembler.compose('hitesh', thread, 'ask-both-keep-going', { systemNote });
  const key = this.keyVault.getKeyForProvider('gemini');
  if (!key) { sub.complete(); return; }
  // Extend currentAbort — same signal covers keep-going
  // Stream Hitesh response into hiteshResponseSignal
  // On done, persist message with persona: 'hitesh'
  sub.complete();
}
```

Store `lastUserMessage`/`lastHiteshText`/`lastPiyushText` on each successful turn for use in Keep-going.

### `aria-announcer.component.ts` — extend with bridge

```ts
constructor() {
  // Subscribe to a shared AriaAnnouncerService signal fed by ChatOrchestrator + AskBothSequencer
  // On Hitesh done event in Ask-Both mode:
  //   1. announce("Hitesh says: {fullText}")
  //   2. setTimeout(() => announce("Piyush is now responding to Hitesh's take."), 100)
  // On Piyush done: announce("Piyush says: {fullText}")
}
```

Or use a dedicated `AriaAnnouncerService` that both orchestrator + sequencer can call.

### `product-copy.ts` additions

```ts
export const keepGoingButtonLabel = 'Keep going';
export const askBothBridgeAnnouncement = "Piyush is now responding to Hitesh's take.";
// streamingIndicatorAskBothA / B already from E2-S4:
// = 'Hitesh is thinking…' / 'Piyush is thinking (reading Hitesh\'s take)…'
```

## Architecture Compliance

- **AD-13:** KEEP_GOING_ROUNDS = 1; system-note templates via `ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE`.
- **AD-14:** shared AbortController extends across Keep-going round.
- **AD-15:** `keep_going_clicked` typed event.
- **AD-17:** per-bubble `[data-persona]` + container `[data-mode]`.
- **AD-20 cross-cutting:** aria-announcer with bridge; full messages only.
- **AD-22 cross-cutting:** all chrome from product-copy.

## File Structure Requirements

```
src/features/ask-both/
  ask-both.component.ts / .html / .scss    # EXTEND from E9-S1
  ask-both-sequencer.service.ts             # EXTEND with keep-going
src/shared/aria-announcer/                  # EXTEND with bridge
src/config/product-copy.ts                  # EXTEND
```

## Testing Requirements

- Bubble rendering test: Hitesh bubble `[data-persona="hitesh"]` scope; Piyush bubble `[data-persona="piyush"]` scope inside `[data-mode="ask-both"]` container.
- Streaming indicator variant switching (A → B).
- Keep-going flow: sequencer runs 3rd round; button disables after click.
- Aria-announcer bridge: verify announce called with bridge string between Hitesh done + Piyush start.
- e2e UJ-4 flow with mock adapters.

## Latest Tech Information

- `[attr.data-persona]="msg.persona"` per bubble — E4-S2 HostBinding already wires it.

## Previous Story Intelligence

**E9-S2 (Sequencer):** reactive signals `hiteshResponseSignal`, `piyushResponseSignal`, `askBothTurnComplete$`.
**E9-S1 (Shell):** greeting + banner + container.
**E4-S2 (Theming):** bubble-level HostBinding for `[data-persona]`.
**E2-S4 (Chat):** aria-announcer base component.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-13`, `AD-17` (Ask-Both bubble scope), `AD-20` (aria-announcer bridge).
- EXPERIENCE.md Key Flows Flow 4 (Priya's UJ-4, lines 274–287).
- Sprint status: key `e9-s3-ask-both-ui-and-keep-going`, blocks `[e9-s4, e11-s2]`.

## References

- [Source: EXPERIENCE.md#Key Flows Flow 4] Full Priya UJ-4 flow.
- [Source: cross-cutting-AC-checklist.md] AD-20 aria-bridge + AD-22 chrome copy.

## Story Completion Status

- [ ] Ask-Both component subscribes to sequencer signals + renders live-growing bubbles with correct persona scope.
- [ ] Streaming indicator variants: A phase + B phase labels.
- [ ] Keep-going button appears after both complete; single-use per turn; keep_going_clicked emits.
- [ ] Aria-announcer emits bridge announcement between A and B.
- [ ] Cross-cutting AC + component tests + e2e UJ-4.
