# Story E4-S3: In-flight-stream disable + stall auto-cancel affordance

Status: ready-for-dev

- **Epic:** 4 — Persona Switcher
- **Critical-path position:** 14 of 37 (Day 3 afternoon)
- **Blocks:** none
- **Depends on:** E4-S1, E2-S3

## Story

As a **cohort grader**,
I want **the persona switcher (and mode switcher) disabled while an assistant response is streaming, and a "Slow connection. Cancel and try again?" prompt if the stream hangs for 30 seconds**,
So that **I don't accidentally trigger a persona-bleed at the storage layer by switching mid-stream, and I always have a way out of a stuck stream**.

## Acceptance Criteria

**Given** the ChatOrchestrator exposes an `inFlightStream$` signal (or `Observable<boolean>`) from Epic 2,
**When** an assistant message is streaming,
**Then** the persona-switcher (E4-S1) and the mode-switcher (Epic 9) segments become disabled — visually greyed out (`ink-disabled` text), `cursor: not-allowed`, tooltip on hover: `"[Persona] is finishing…"` from `product-copy.ts.switcherDisabledDuringStream(persona)` per UX-DR4 + AD-7.

**Given** the switcher is disabled,
**When** the user attempts to click or press Enter/Space on the inactive segment,
**Then** the click event is BLOCKED (per UX-DR4) — no navigation happens, the tooltip shows. Domain state is preserved: no partial persona-bleed at the storage layer per AD-7.

**Given** the stream completes (`{type: 'done'}` fires) OR errors (`{type: 'error'}` fires) OR is cancelled,
**When** `inFlightStream$` transitions to `false`,
**Then** the switcher re-enables — full color + `cursor: pointer` + tooltip removed.

**Given** the stream stalls (no delta arrives) for `STREAM_STALL_TIMEOUT_MS = 30000`,
**When** the ChatOrchestrator's stall-detection timer fires (from Epic 2 story E2-S3),
**Then** the streaming-indicator morphs into a `warning`-tinted card per UX-DR16 with copy `"Slow connection. Cancel and try again?"` from `product-copy.ts.streamStallPromptBody` + a "Cancel" button using `product-copy.ts.streamStallCancelLabel`. The card sits below the last message bubble.

**Given** the user clicks Cancel on the stall prompt,
**When** the click handler fires,
**Then** the ChatOrchestrator's `cancelInFlight()` runs: `AbortController.abort()` per AD-14, the current assistant message is marked `status: 'cancelled'` per AD-10 with partial content preserved + a `caption` badge below reading `"cancelled"`; the switcher re-enables; the stall-prompt disappears; `stream_stall_detected` analytics event has already been emitted per AD-15 (at stall-detection time in Epic 2), and NO additional event is emitted on cancel.

**Given** the persona switch happens successfully (not blocked),
**When** the switcher fires,
**Then** the `persona_switched` analytics event emits per AD-15 with payload `{from, to}` — verified in the analytics debug log.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.2** — Switcher disabled state includes `aria-disabled="true"` — screen reader announces the disabled state.
- **AC-A20.6** — Stall-prompt fade-in respects `prefers-reduced-motion`.
- **AC-A22.1** — Stall-prompt copy + tooltip copy + cancel button label from `product-copy.ts`.

**verifies:** FR-9 (30s stall auto-cancel), AD-7 (persona identity isolation via in-flight disable), AD-14 (cancellation contract), AD-15 (persona_switched + stream_stall_detected analytics events), AD-20 (cross-cutting — aria-disabled), AD-22 (cross-cutting)

**touches:** `src/features/persona-switcher/persona-switcher.component.ts` (bind `[disabled]="chatOrchestrator.inFlightStream$()"` + `[attr.aria-disabled]="chatOrchestrator.inFlightStream$()"`), `src/features/persona-switcher/persona-switcher.component.scss` (disabled visual state), `src/shared/streaming-indicator/streaming-indicator.component.ts` (extend to render the stall-prompt variant when `chatOrchestrator.streamStalled$()` fires), `src/shared/streaming-indicator/streaming-indicator.component.scss`, `src/config/product-copy.ts` (new keys: `switcherDisabledDuringStream`, `streamStallPromptBody`, `streamStallCancelLabel`, `cancelledMessageBadge`), `src/domain/chat/chat-orchestrator.service.ts` (extend from Epic 2 to expose `streamStalled$: Signal<boolean>` — reactive on the stall timer)

**test target:** component test (switcher renders disabled state when `inFlightStream$` is true; click on disabled switcher does not trigger navigation) + e2e test (mock adapter that never yields a delta; wait 30s; stall prompt appears; cancel restores UI state; `stream_stall_detected` event fires exactly once) + unit test (`persona_switched` analytics event payload matches AD-15 shape)

## Developer Context

Wires the reactive discipline that AD-7 requires. E2-S3 exposed `inFlightStream$` and `streamStalled$` signals; this story turns them into visible UI behavior.

**No new orchestrator logic** — this story only CONSUMES orchestrator signals. If E2-S3's `streamStalled$` wasn't fully wired (check the E2-S3 completion), extend it here.

**Analytics discipline:** `persona_switched` fires on successful switch (E4-S1 wire it) — this story adds it to the switcher's emit path if E4-S1 didn't already.

## Technical Requirements

### `persona-switcher.component.ts` — extend with disabled + analytics

```ts
readonly disabled = computed(() => this.orchestrator.inFlightStream$());
readonly disabledTooltip = computed(() => copy.switcherDisabledDuringStream(this.activePersona));

onSelect(p: PersonaId): void {
  if (this.disabled() || p === this.activePersona) return;
  this.analytics.emit({ name: 'persona_switched', payload: { from: this.activePersona, to: p } });
  this.switched.emit(p);
  this.router.navigate([`/chat/${p}`]);
}
```

Template:
```html
<div role="tablist" [attr.aria-label]="ariaLabel()">
  <button
    *ngFor="let p of personas"
    role="tab"
    [attr.aria-selected]="p === activePersona"
    [attr.aria-disabled]="disabled()"
    [disabled]="disabled()"
    [title]="disabled() ? disabledTooltip() : ''"
    ...>
    ...
  </button>
</div>
```

SCSS disabled state:
```scss
.persona-switcher button.disabled,
.persona-switcher button[disabled] {
  color: var(--ink-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}
```

### `streaming-indicator.component.ts` — extend with stall variant

```ts
@Input() stalled = false;
@Input() cancelLabel = copy.streamStallCancelLabel;
@Input() stallBody = copy.streamStallPromptBody;
@Output() cancelClicked = new EventEmitter<void>();
```

Template:
```html
<div class="streaming-indicator" [class.stalled]="stalled">
  <ng-container *ngIf="!stalled">
    <img [src]="avatarUrl" alt="" width="32" height="32">
    <span class="body-sm">{{label}}</span>
    <div class="dots"><span></span><span></span><span></span></div>
  </ng-container>
  <ng-container *ngIf="stalled">
    <div class="stall-card">
      <p>{{stallBody}}</p>
      <p-button [label]="cancelLabel" (onClick)="cancelClicked.emit()" severity="warning"></p-button>
    </div>
  </ng-container>
</div>
```

Wire in `chat.component.html`:
```html
<app-streaming-indicator
  *ngIf="orchestrator.inFlightStream$() && !orchestrator.accumulatedText$()"
  [stalled]="orchestrator.streamStalled$()"
  [label]="streamingLabel()"
  (cancelClicked)="orchestrator.cancelInFlight()">
</app-streaming-indicator>
```

### `product-copy.ts` additions

```ts
export const switcherDisabledDuringStream = (p: PersonaId) =>
  `${p === 'hitesh' ? 'Hitesh' : 'Piyush'} is finishing…`;
export const streamStallPromptBody = 'Slow connection. Cancel and try again?';
export const streamStallCancelLabel = 'Cancel';
export const cancelledMessageBadge = 'cancelled';
```

## Architecture Compliance

- **AD-7:** switcher disable during stream prevents persona-bleed at storage layer.
- **AD-14:** cancel via `orchestrator.cancelInFlight()` — AbortController abort + `status: 'cancelled'` + partial preserved.
- **AD-15:** `persona_switched` on successful switch; `stream_stall_detected` already emitted by E2-S3 orchestrator.
- **AD-22:** stall + tooltip copy from `product-copy.ts`.

## File Structure Requirements

```
src/features/persona-switcher/persona-switcher.component.ts / .scss  # EXTEND
src/shared/streaming-indicator/streaming-indicator.component.ts / .html / .scss  # EXTEND with stall variant
src/features/chat/chat.component.html  # WIRE — [stalled] + (cancelClicked)
src/config/product-copy.ts  # EXTEND
```

## Testing Requirements

- `persona-switcher.component.spec.ts`: `disabled` input true → button `[disabled]` + `aria-disabled="true"` + tooltip present; click does nothing.
- `streaming-indicator.component.spec.ts`: `stalled=false` renders dots; `stalled=true` renders stall card + Cancel button; Cancel button click emits `cancelClicked`.
- e2e (or extended unit): mock adapter yields 1 delta then hangs; wait `STREAM_STALL_TIMEOUT_MS` (mock the timer to fire immediately via Jasmine `clock`); assert stall card appears + click Cancel triggers orchestrator cancel + message status becomes `cancelled`.

## Latest Tech Information

- Angular 21 `computed()` for derived signals — `disabled = computed(() => orchestrator.inFlightStream$())`.
- Jasmine `jasmine.clock().install()` + `.tick(30000)` to fast-forward the stall timer in tests.

## Previous Story Intelligence

**E4-S1 (Persona switcher):**
- Component + tablist ARIA landed. This story adds `disabled` input + analytics emit.

**E2-S3 (ChatOrchestrator):**
- `inFlightStream$` + `streamStalled$` signals exposed.
- `cancelInFlight()` public method aborts + marks `cancelled`.
- `stream_stall_detected` analytics fires from orchestrator on stall timer.

**E2-S4 (Streaming indicator):**
- Base component renders dots + label. This story adds `stalled` input + stall variant.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-7` (persona isolation, lines 116–120), `AD-14` (cancellation contract, lines 210–219), `AD-15` (analytics events, lines 221–244).
- EXPERIENCE.md State Patterns "Auto-cancel prompt (30s stall)" (line 112).
- Sprint status: key `e4-s3-in-flight-disable-stall-cancel`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-7] In-flight disable prevents persona-bleed.
- [Source: ARCHITECTURE-SPINE.md#AD-14] `cancelInFlight()` → AbortController abort + status:'cancelled' + partial preserved.
- [Source: EXPERIENCE.md#State Patterns] Stall prompt UX + Cancel + `stream_stall_detected`.

## Story Completion Status

- [ ] Persona-switcher renders disabled state during in-flight stream + `aria-disabled` + tooltip.
- [ ] Successful switch emits `persona_switched` analytics with `{from, to}`.
- [ ] Streaming-indicator renders stall variant when `streamStalled$` is true; Cancel button wired to `orchestrator.cancelInFlight()`.
- [ ] `product-copy.ts` extended with 4 new keys.
- [ ] Cross-cutting AC + spec tests + timed e2e test.
