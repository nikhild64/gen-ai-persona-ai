# Story E9-S1: Mode-switcher + `/chat/ask-both` routing + joint greeting

Status: ready-for-dev

- **Epic:** 9 — Ask-Both Mode
- **Critical-path position:** 27 of 37 (Day 6)
- **Blocks:** E9-S2, E10-S1
- **Depends on:** E0-S3, E4-S1, E3-S1

## Story

As a **cohort grader running Priya's UJ-4 flow (JS-vs-Python decision)**,
I want **a mode-switcher in the chat header that toggles between Solo and Ask-Both, and when I switch to Ask-Both I see a neutral room banner and a joint greeting from "the room"**,
So that **it's immediately clear this is a distinct mode from Solo — different chrome, different attribution, same question can be asked**.

## Acceptance Criteria

**Given** the persona-switcher visual primitives from Epic 4,
**When** the developer authors `src/features/mode-switcher/mode-switcher.component.ts`,
**Then** it renders per DESIGN.md.Components.mode-switcher — same segmented-toggle track as persona-switcher, but with two segments: `"Solo"` and `"Ask Both"` (labels from `product-copy.ts.modeSwitcherSoloLabel` and `product-copy.ts.modeSwitcherAskBothLabel`). Active segment uses `ink-primary` (`#1C1917`) background fill with white text — NOT a persona accent — deliberately distinct from the persona-switcher to communicate mode is a product-level choice per FR-26.

**Given** the mode-switcher is placed in the chat header (right of the persona-switcher),
**When** the user clicks "Ask Both",
**Then** Angular Router navigates to `/chat/ask-both` (defined in `chat.routes.ts` with `loadChildren` per AD-21); the persona-switcher stays visible but its state is de-emphasized in Ask-Both mode (both personas participate — the persona-switcher's active-selection is not meaningful).

**Given** the `/chat/ask-both` route is loaded,
**When** the `<ask-both>` component mounts,
**Then** the chat container carries `[attr.data-mode]="'ask-both'"` per AD-17, applying the neutral chrome palette (`surface-chrome` background, `neutral-accent` `#78716C` for the header banner underline). Header banner reads `product-copy.ts.askBothBannerLabel` (`"Ask both — Hitesh + Piyush"`).

**Given** the Ask-Both thread is empty (fresh session or after Start-New-Session),
**When** the component reads `thread.messages.length === 0`,
**Then** the joint greeting from `product-copy.ts.askBothGreeting` (Addendum §D.3 — the ONE explicit AD-22 exception for fuller Hinglish in product chrome, justified because it's the joint-room greeting) renders as ONE `role: 'system'` bubble (no persona avatar, no persona-accent — uses neutral chrome palette). Below the greeting, a small `caption` `ink-secondary` note: `"Hitesh answers first, then Piyush. Try a deep question."` from `product-copy.ts.askBothGreetingHint`.

**Given** the Ask-Both mode manages its own storage key,
**When** the ChatOrchestrator (or a wrapping AskBothService) reads/writes the thread,
**Then** it uses `chat:ask-both:v1` (from `src/config/storage-keys.ts` — declared in Epic 0). Solo threads (`chat:hitesh:v1`, `chat:piyush:v1`) remain intact and separate; Ask-Both does NOT merge them per FR-30.

**Given** the mode-switcher's disabled-during-stream state (same behavior as persona-switcher from E4-S3),
**When** an in-flight stream is active in Ask-Both mode,
**Then** the mode-switcher is disabled with the "[Persona] is finishing…" tooltip; switching back to Solo is blocked until the current stream completes / errors / is cancelled.

**Given** the user switches from Ask-Both back to Solo,
**When** the click fires on the "Solo" segment,
**Then** the router navigates to `/chat/{last-active-solo-persona}` (or `/chat/hitesh` if never active) per EXPERIENCE.md.Component Patterns; the Ask-Both thread stays intact separately.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Mode-switcher position in Tab traversal per EXPERIENCE.md (after persona-switcher).
- **AC-A20.2** — `modeSwitcherLabel: (mode) => \`Switch mode — currently ${modeDisplayName(mode)}\`` from `aria-labels.ts`.
- **AC-A20.4** — Active segment contrast (white on `#1C1917` stone-900) = 17.4:1 (AAA).
- **AC-A21.1** — Ask-Both feature module lazy-loaded via `loadChildren`.
- **AC-A22.1** — All mode-switcher chrome copy from `product-copy.ts`; joint greeting from the documented AD-22 exception `askBothGreeting`.

**verifies:** FR-26 (mode switcher), FR-30 (Ask-Both thread persistence), AD-6 (chat:ask-both:v1 storage key), AD-17 (Ask-Both `[data-mode]` scope + neutral chrome + persona-switcher de-emphasis), AD-20 + AD-21 + AD-22 (cross-cutting)

**touches:** `src/features/mode-switcher/mode-switcher.component.ts` (+ scss + html), `src/features/ask-both/ask-both.component.ts` (+ scss + html — the Ask-Both feature shell — subsequent stories flesh out UI + sequencer), `src/features/ask-both/ask-both.routes.ts` (with `loadChildren` from `app.routes.ts`), `src/app/app.routes.ts` (add `/chat/ask-both` route), `src/config/product-copy.ts` (new keys: `modeSwitcherSoloLabel`, `modeSwitcherAskBothLabel`, `askBothBannerLabel`, `askBothGreetingHint`, plus `askBothGreeting` from Epic 0), `src/config/aria-labels.ts` (uses existing `modeSwitcherLabel`)

**test target:** component test (mode-switcher renders active/inactive segments; click on Ask Both routes to `/chat/ask-both`; empty Ask-Both thread renders joint greeting; `[data-mode="ask-both"]` scope applies neutral chrome) + axe-core on `/chat/ask-both`

## Developer Context

Frame + entry point for Ask-Both mode. Mode-switcher visually distinct from persona-switcher (ink-primary fill instead of persona-accent). `<ask-both>` component landed as a shell; E9-S2 lands the sequencer, E9-S3 lands the per-bubble UI, E9-S4 lands the Parallel branch.

**`last-active-solo-persona` tracking:** track via a simple app-shell service or `sessionStorage['last-active-solo']`. On "Solo" click, navigate to that persona's route.

## Technical Requirements

### `mode-switcher.component.ts`

Same segmented-toggle template as persona-switcher (E4-S1) but with ink-primary active fill. Reuse SCSS mixin if possible.

```ts
type Mode = 'solo' | 'ask-both';

@Component({ standalone: true, selector: 'app-mode-switcher', ... })
export class ModeSwitcherComponent {
  @Input({ required: true }) activeMode!: Mode;
  @Input() disabled = false;
  modes: Mode[] = ['solo', 'ask-both'];
  displayName(m: Mode): string { return m === 'solo' ? copy.modeSwitcherSoloLabel : copy.modeSwitcherAskBothLabel; }
  ariaLabel(): string { return aria.modeSwitcherLabel(this.activeMode); }

  onSelect(m: Mode): void {
    if (this.disabled || m === this.activeMode) return;
    if (m === 'ask-both') this.router.navigate(['/chat/ask-both']);
    else {
      const last = sessionStorage.getItem('last-active-solo') ?? 'hitesh';
      this.router.navigate([`/chat/${last}`]);
    }
    this.analytics.emit({ name: 'mode_switched', payload: { from: this.activeMode, to: m } });
  }
}
```

### `ask-both.component.ts` — shell for E9-S2/S3/S4

```ts
@Component({
  standalone: true,
  templateUrl: './ask-both.component.html',
  styleUrls: ['./ask-both.component.scss'],
})
export class AskBothComponent implements OnInit {
  private storage = inject(STORAGE_PORT);
  thread = signal<Thread | null>(null);
  readonly askBothGreeting = copy.askBothGreeting;
  readonly askBothGreetingHint = copy.askBothGreetingHint;
  readonly askBothBannerLabel = copy.askBothBannerLabel;

  async ngOnInit() {
    const existing = await this.storage.get<Thread>('chat:ask-both:v1');
    if (existing) this.thread.set(existing);
    else this.thread.set({
      id: crypto.randomUUID(), scope: 'ask-both', messages: [],
      rollingSummary: null, turnsSinceLastSummary: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  }
}
```

Template:
```html
<div class="chat-container" data-mode="ask-both">
  <div class="header-banner"><h2>{{askBothBannerLabel}}</h2></div>
  <div class="message-list">
    <ng-container *ngIf="thread()?.messages?.length === 0">
      <div class="system-bubble">{{askBothGreeting}}</div>
      <p class="caption ink-secondary">{{askBothGreetingHint}}</p>
    </ng-container>
    <!-- E9-S3 renders bubbles + Keep-going button -->
  </div>
  <!-- Input + send — E9-S2 wires the sequencer -->
</div>
```

### `ask-both.routes.ts` + `app.routes.ts`

```ts
// ask-both.routes.ts
export const ASK_BOTH_ROUTES: Routes = [{ path: '', component: AskBothComponent }];

// app.routes.ts — extend chat routes
export const CHAT_ROUTES: Routes = [
  { path: 'hitesh', component: ChatComponent, data: { persona: 'hitesh' } },
  { path: 'piyush', component: ChatComponent, data: { persona: 'piyush' } },
  { path: 'ask-both', loadChildren: () => import('../ask-both/ask-both.routes').then(m => m.ASK_BOTH_ROUTES) },
];
```

Feature-flag gating (E10-S1 lands the redirect): if `!FEATURE_ASK_BOTH_MODE`, redirect `/chat/ask-both` to `/` (per FR-32).

### `product-copy.ts` additions

```ts
export const modeSwitcherSoloLabel = 'Solo';
export const modeSwitcherAskBothLabel = 'Ask Both';
export const askBothBannerLabel = 'Ask both — Hitesh + Piyush';
export const askBothGreetingHint = 'Hitesh answers first, then Piyush. Try a deep question.';
// askBothGreeting from E0-S3 verbatim Addendum §D.3
```

## Architecture Compliance

- **AD-6:** `chat:ask-both:v1` storage key.
- **AD-13:** `FEATURE_ASK_BOTH_MODE` kill-switch separate from `ASK_BOTH_MODE` selector.
- **AD-17:** `[attr.data-mode]="'ask-both'"` scope + neutral chrome + persona-switcher de-emphasis.
- **AD-22 exception:** `askBothGreeting` is the ONE documented Hinglish product-chrome exception.

## File Structure Requirements

```
src/features/mode-switcher/mode-switcher.component.ts / .html / .scss  # NEW
src/features/ask-both/
  ask-both.component.ts / .html / .scss
  ask-both.routes.ts
src/app/app.routes.ts   # UPDATE — add ask-both child route
src/features/chat/chat.component.html  # WIRE <app-mode-switcher>
src/config/product-copy.ts  # EXTEND
```

## Testing Requirements

- `mode-switcher.component.spec.ts`: renders 2 segments; click "Ask Both" navigates; disabled state blocks click.
- `ask-both.component.spec.ts`: empty thread renders joint greeting + hint; existing thread renders messages (E9-S3 fills full bubble rendering).
- axe-core on `/chat/ask-both`.
- E2E: navigate Solo → Ask-Both → Solo; verify separate threads.

## Latest Tech Information

- Angular 21 nested lazy-load: parent `/chat` lazy-loads chat routes; child `/chat/ask-both` lazy-loads ask-both.routes.

## Previous Story Intelligence

**E4-S1 (Persona switcher):**
- Segmented toggle primitive; mode-switcher reuses SCSS pattern.

**E4-S2 (Theming):**
- `[data-mode="ask-both"]` scope for neutral chrome (verified in that story too).

**E3-S1 (Storage):**
- StoragePort supports `chat:ask-both:v1` key.

**E0-S3 (Config):**
- `askBothGreeting` verbatim from Addendum §D.3.
- All `StorageKey` union entries.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-13` (FEATURE_ASK_BOTH_MODE + ASK_BOTH_MODE separate, lines 189–208), `AD-17` (data-mode scope, lines 252–263).
- DESIGN.md Components.mode-switcher (lines 365–372).
- EXPERIENCE.md Component Patterns.mode-switcher (line 87).
- Addendum §D.3 (joint greeting verbatim, lines 367–375).
- Sprint status: key `e9-s1-mode-switcher-and-joint-greeting`, blocks `[e9-s2, e10-s1]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-17] `[data-mode]` container scope + per-bubble `[data-persona]` in Ask-Both.
- [Source: addendum.md#D.3] askBothGreeting verbatim + AD-22 exception rationale.
- [Source: cross-cutting-AC-checklist.md] AD-20/21/22 items.

## Story Completion Status

- [ ] `mode-switcher.component.ts` with ink-primary active fill.
- [ ] `ask-both.component.ts` shell renders empty-state joint greeting + hint.
- [ ] `ask-both.routes.ts` lazy-loaded under `/chat/ask-both`.
- [ ] Container scope `[attr.data-mode="ask-both"]` applied; neutral chrome.
- [ ] `last-active-solo-persona` tracking on mode switch back to Solo.
- [ ] mode_switched analytics event on successful switch.
- [ ] Cross-cutting AC.
