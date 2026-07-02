# Story E6-S3: Auto-open on first send with no key + key-status-badge

Status: ready-for-dev

- **Epic:** 6 — BYO-Key Mode
- **Critical-path position:** 22 of 37 (Day 5 morning)
- **Blocks:** none
- **Depends on:** E6-S2, E2-S3

## Story

As a **cohort grader (Rahul) who just clicked Piyush on landing**,
I want **the settings modal to auto-open the first time I try to send a message without a saved key, with a friendly "Chai chalega? Paste an API key to start chatting." hint**,
So that **I don't have to hunt for the settings gear on my first interaction — the app tells me exactly what to do**.

## Acceptance Criteria

**Given** the ChatOrchestrator's `sendMessage` flow (from Epic 2 story E2-S3),
**When** the orchestrator reads `KeyVaultService.getKeyForProvider(activePersonaProvider)` and it returns `null`,
**Then** the orchestrator dispatches an event to the chat component (via a shared signal or an `EventEmitter`) — the chat component reacts by opening the settings modal in "auto-open" mode. The queued user message is NOT dispatched to the provider; the send button is inert until a key is saved.

**Given** the modal opens in "auto-open" mode,
**When** the modal renders,
**Then** a contextual header line appears above the modal title: `"Chai chalega? Paste an API key to start chatting."` from `product-copy.ts.settingsAutoOpenHeader` — this is the ONE explicitly-greenlit "light Hinglish flavor" instance in product chrome per EXPERIENCE.md.Voice and Tone table and DESIGN.md.Components.settings-modal + AD-22 documented exception.

**Given** the modal is in "auto-open" mode,
**When** the user closes it via Esc or the close X WITHOUT saving a key,
**Then** the queued message is discarded (per EXPERIENCE.md.State Patterns — "if the modal was the auto-open path and no key is saved, back-button routes to `/` (landing) — the user opted out of the send"). The behavior for Esc/close-X-without-save: navigate to `/` (landing).

**Given** the modal is in "auto-open" mode,
**When** the user saves a key,
**Then** on the modal-close-after-save handler, the queued message is automatically dispatched via `chatOrchestrator.sendMessage(activePersona(), queuedText)` — the user's flow feels seamless: they hit Enter → modal opened → they pasted key → they hit Save → their message just sent as if they'd hit Enter again.

**Given** the `<key-status-badge>` component (`src/features/settings/key-status-badge.component.ts`),
**When** the badge renders per DESIGN.md.Components.key-status-badge,
**Then** it's a `rounded-full` chip, `20px` height, `12px` horizontal padding, `hairline` border. Contents: `4px` dot indicator (`success` green if key present, `ink-disabled` grey if not) + `caption` label (`"Using your Gemini key"` / `"Using your Groq key"` / `"No key — paste in Settings"`). Position: chat header, right of the mode-switcher, left of the settings gear.

**Given** the badge is on mobile (< 768px),
**When** it renders,
**Then** it collapses to a hidden state; the settings gear icon in the header shows a small `4px` dot indicator instead (green if key present, red if not) — per DESIGN.md.Components.key-status-badge.

**Given** the KeyVaultService state changes (key saved or cleared),
**When** the badge subscribes to a `keyVaultService.currentKey$: Signal<{provider: ProviderId | null}>` (reactive Angular signal),
**Then** the badge updates reactively without a page refresh.

**Given** the user clicks the "No key — paste in Settings" badge (when in `no-key` state),
**When** the click fires,
**Then** the badge acts as a shortcut to open the settings modal — same as clicking the settings gear.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.2** — Badge uses `keyStatusBadgeLabel(state, provider)` from `aria-labels.ts`; the dot is decorative (`aria-hidden="true"`).
- **AC-A20.3** — Clickable badge (in no-key state) has `:focus-visible` ring.
- **AC-A22.1** — Auto-open header copy, badge labels, all from `product-copy.ts`.

**verifies:** FR-16 (auto-open on first send + key-status-badge), AD-11 (KeyVaultService.getKeyForProvider is the sole reader), AD-22 (settingsAutoOpenHeader is the documented light-Hinglish-flavor exception)

**touches:** `src/features/settings/key-status-badge.component.ts` (+ scss + html), `src/features/settings/settings-modal.component.ts` (extend from E6-S2 with `autoOpenMode` prop + queued-message dispatch on save), `src/features/chat/chat.component.ts` (listen for the "no key" signal from ChatOrchestrator, open modal in auto-open mode), `src/domain/chat/chat-orchestrator.service.ts` (dispatch a `keyMissing$` signal when getKeyForProvider returns null), `src/config/product-copy.ts` (extend with `settingsAutoOpenHeader`, `keyStatusUsingLabel`, `keyStatusNoKeyLabel` — from E6-S2 already; verify presence), `src/config/aria-labels.ts` (`keyStatusBadgeLabel`)

**test target:** component test (badge state updates reactively on KeyVaultService change; auto-open header renders when modal is opened in auto-open mode; queued message dispatches after save) + e2e test (fresh session, click Piyush card, land on chat, type message, hit Enter, verify modal auto-opens with header line, paste key, click Save, verify message auto-sends)

## Developer Context

Closes the BYO-Key flow — the user experience Rahul (UJ-1) actually hits on first send. E2-S3 orchestrator already emits `keyMissing$: Subject<PersonaId>` when key is null. This story wires:
1. Chat component subscribes to `keyMissing$` → opens modal in auto-open mode + queues the user text.
2. Settings modal accepts `autoOpenMode` input → shows header line + on close-after-save dispatches queued message.
3. Key-status-badge subscribes to `KeyVaultService.currentKey$` → renders + reactive updates.

## Technical Requirements

### `key-status-badge.component.ts`

```ts
@Component({
  standalone: true,
  selector: 'app-key-status-badge',
  templateUrl: './key-status-badge.component.html',
  styleUrls: ['./key-status-badge.component.scss'],
})
export class KeyStatusBadgeComponent {
  @Output() clicked = new EventEmitter<void>();

  private keyVault = inject(KeyVaultService);
  readonly state = computed(() => this.keyVault.currentKey$().provider ? 'saved' : 'none');
  readonly provider = computed(() => this.keyVault.currentKey$().provider);
  readonly label = computed(() =>
    this.state() === 'saved'
      ? copy.keyStatusUsingLabel(this.provider()!)
      : copy.keyStatusNoKeyLabel
  );
  readonly ariaLabel = computed(() => aria.keyStatusBadgeLabel(this.state(), this.provider() ?? undefined));

  onClick(): void {
    if (this.state() === 'none') this.clicked.emit();
  }
}
```

### `chat.component.ts` extension — subscribe to keyMissing$

```ts
private orchestrator = inject(ChatOrchestrator);
private queuedText: string | null = null;
settingsModalAutoOpen = signal(false);

ngOnInit(): void {
  this.orchestrator.keyMissing$.subscribe(() => {
    this.settingsModalAutoOpen.set(true);
    // queuedText already captured at send-attempt in the input handler
  });
}

onSend(text: string): void {
  this.queuedText = text;
  this.orchestrator.sendMessage(this.activePersona(), text).subscribe();
}

onModalClose(saved: boolean): void {
  const wasAutoOpen = this.settingsModalAutoOpen();
  this.settingsModalAutoOpen.set(false);
  if (saved && wasAutoOpen && this.queuedText) {
    // Auto-dispatch queued message
    this.orchestrator.sendMessage(this.activePersona(), this.queuedText).subscribe();
    this.queuedText = null;
  } else if (!saved && wasAutoOpen) {
    // Cancel + navigate to landing per EXPERIENCE.md.State Patterns
    this.queuedText = null;
    this.router.navigate(['/']);
  }
}
```

### `settings-modal.component.ts` extension

```ts
@Input() autoOpenMode = false;
@Output() closedWithSave = new EventEmitter<void>();
@Output() closedWithoutSave = new EventEmitter<void>();

get contextualHeader(): string {
  return this.autoOpenMode ? copy.settingsAutoOpenHeader : '';
}

onSave(): void {
  // ...existing save logic
  this.closedWithSave.emit();
}
onDismiss(): void {
  this.closedWithoutSave.emit();
}
```

Template: conditionally render the header line above the title when `autoOpenMode` is true.

### Header wiring in `chat.component.html`

```html
<div class="chat-header">
  <app-persona-switcher ...></app-persona-switcher>
  <app-key-status-badge (clicked)="openSettings()"></app-key-status-badge>
  <app-settings-gear></app-settings-gear>
</div>
<app-settings-modal
  [open]="settingsModalAutoOpen() || manualSettingsOpen()"
  [autoOpenMode]="settingsModalAutoOpen()"
  (closedWithSave)="onModalClose(true)"
  (closedWithoutSave)="onModalClose(false)"
></app-settings-modal>
```

## Architecture Compliance

- **AD-11:** `KeyVaultService` sole read/write path. `keyMissing$` from orchestrator, `currentKey$` from KeyVault.
- **AD-22:** `settingsAutoOpenHeader` documented exception in product-copy.

## File Structure Requirements

```
src/features/settings/key-status-badge.component.ts / .html / .scss   # NEW
src/features/settings/settings-modal.component.ts                     # EXTEND — autoOpenMode
src/features/chat/chat.component.ts / .html                           # WIRE keyMissing$ + queue
src/config/product-copy.ts                                            # verify settingsAutoOpenHeader present
src/config/aria-labels.ts                                             # keyStatusBadgeLabel present
```

## Testing Requirements

- `key-status-badge.component.spec.ts`: renders "Using your Gemini key" when KeyVault has key; renders "No key" when empty; clickable in no-key state emits `clicked`.
- `settings-modal.component.spec.ts` (extend): autoOpenMode renders contextual header.
- Chat component e2e: fresh session → send message → modal auto-opens → paste key → Save → message auto-sends.
- Chat component e2e: fresh session → send message → modal auto-opens → Esc → navigate to `/`.

## Latest Tech Information

- Angular 21 `computed()` signals for derived state.
- RxJS `Subject` from orchestrator for cross-service event dispatch.

## Previous Story Intelligence

**E6-S2 (Settings modal):**
- Modal component exists; this story extends with `autoOpenMode` + queued-message dispatch.

**E6-S1 (KeyVaultService):**
- `currentKey$` reactive signal — badge subscribes.

**E2-S3 (ChatOrchestrator):**
- `keyMissing$: Subject<PersonaId>` fires when key null. This story's chat component subscribes.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-11` (KeyVault sole reader, lines 167–175), `AD-22` (settingsAutoOpenHeader exception, lines 300–309).
- DESIGN.md `Components.key-status-badge` (lines 398–403), `settings-modal` auto-open header (line 390).
- EXPERIENCE.md `State Patterns.BYO-Key not set on first send-attempt` (line 115), `Modal open + browser back-button` (line 116).
- Sprint status: key `e6-s3-auto-open-and-key-status-badge`, blocks `[]`.

## References

- [Source: EXPERIENCE.md#State Patterns] Auto-open UX + Esc-cancels-and-routes-to-landing behavior.
- [Source: DESIGN.md#Components.key-status-badge] Badge visual spec.
- [Source: cross-cutting-AC-checklist.md] AC-A22.1 for the auto-open header.

## Story Completion Status

- [ ] `key-status-badge.component.ts` reactive to `KeyVaultService.currentKey$`.
- [ ] Settings modal extended with `autoOpenMode` input + closedWithSave / closedWithoutSave events + contextual header.
- [ ] Chat component subscribes to `keyMissing$` + queues user text + opens modal + dispatches on save / navigates to landing on cancel.
- [ ] Cross-cutting AC + component tests + e2e flow test.
