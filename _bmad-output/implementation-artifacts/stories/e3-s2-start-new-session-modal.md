# Story E3-S2: Start-new-session control + confirm-modal

Status: ready-for-dev

- **Epic:** 3 — Chat History (Session-Persistent)
- **Critical-path position:** 11 of 37 (Day 3 morning)
- **Blocks:** none directly
- **Depends on:** E3-S1

## Story

As a **cohort grader**,
I want **a "Start new session" control that (after confirmation) wipes all three chat threads and returns me to the landing page**,
So that **I can start fresh evaluation runs without opening a private browser window**.

## Acceptance Criteria

**Given** a chat surface is loaded (any of `/chat/hitesh`, `/chat/piyush`, `/chat/ask-both`),
**When** the user opens the settings modal (Epic 6 wires the actual modal shell — this story adds the start-new-session menu entry inside) OR clicks a discoverable "Start new session" affordance in a header overflow menu OR footer link (final placement per DESIGN.md.Components — settings modal in the "Save/Clear" section OR a distinct row in the modal),
**Then** the start-new-session control is reachable per FR-15's discoverability consequence.

**Given** the user clicks "Start new session",
**When** the click handler fires,
**Then** the `<confirm-modal>` component (`src/features/settings/confirm-modal.component.ts`) opens per DESIGN.md.Components.confirm-modal — `400px` width, `rounded-xl` (16px), `role="alertdialog"` per AD-20, with `h2` title `product-copy.ts.startNewSessionTitle` (`"Start a new session?"`), `body` copy `product-copy.ts.startNewSessionBody` (`"This will delete both chat histories."`), and a right-aligned button row: "Cancel" secondary + "Yes, clear everything" destructive-primary (`error` red fill, white `label` text — contrast 4.75:1 passes AA per DESIGN.md.Do's).

**Given** the confirm modal is open,
**When** the user presses Esc OR clicks "Cancel",
**Then** the modal closes without side effects, focus returns to the trigger element (via PrimeNG `<p-dialog>` focus trap per AD-20).

**Given** the user clicks "Yes, clear everything",
**When** the confirm handler fires,
**Then** `StoragePort.delete('chat:hitesh:v1')`, `StoragePort.delete('chat:piyush:v1')`, and `StoragePort.delete('chat:ask-both:v1')` are all called (Ask-Both key wiring finalized in Epic 9; this story deletes all three keys defensively since they're already in the `StorageKey` union from Epic 0); a 2-second success toast fires (`"Session cleared."` from `product-copy.ts.sessionClearedToast`); the app navigates back to `/` (landing).

**Given** the app has navigated back to landing,
**When** the user selects a persona and enters chat,
**Then** the chat thread is empty (no prior messages) and the hardcoded persona greeting from Addendum §D re-appears as the first assistant message per E2-S4 (FR-15 consequence: greetings re-appear on next persona selection).

**Given** the confirm-modal is focus-trapped,
**When** the user Tabs inside the modal,
**Then** focus cycles between "Cancel" and "Yes, clear everything" per AD-20; safe-default focus is on "Cancel" on open per DESIGN.md.Components.confirm-modal + `EXPERIENCE.md.Component Patterns`.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Modal focus-trap + Esc closes; focus returns to trigger element.
- **AC-A20.2** — Modal dismiss uses `modalDismissLabel`; "Yes, clear everything" button uses `clearSessionButtonLabel` from `aria-labels.ts`.
- **AC-A20.3** — Modal buttons have visible `:focus-visible` ring.
- **AC-A20.4** — Destructive button contrast (white on error red-600) = 4.75:1 passes AA per DESIGN.md.
- **AC-A22.1** — Modal title + body + button labels + toast copy all from `product-copy.ts`. No inline strings.

**verifies:** FR-15, AD-6 (StoragePort.delete via all three keys), AD-20 (cross-cutting — alertdialog role, focus-trap, safe-default focus), AD-22 (cross-cutting)

**touches:** `src/features/settings/confirm-modal.component.ts`, `src/features/settings/confirm-modal.component.scss`, `src/features/settings/confirm-modal.component.html`, `src/features/settings/settings-menu-entry.component.ts` (or wherever the "Start new session" entry lives per DESIGN.md placement), `src/config/product-copy.ts` (new keys: `startNewSessionTitle`, `startNewSessionBody`, `startNewSessionConfirmLabel`, `startNewSessionCancelLabel`, `sessionClearedToast`, `startNewSessionMenuLabel`), `src/config/aria-labels.ts` (uses existing `clearSessionButtonLabel` + `modalDismissLabel`)

**test target:** component test (confirm-modal renders with `role="alertdialog"`; safe-default focus on Cancel; Esc closes without side effects; confirm calls `StoragePort.delete` on all 3 keys; toast fires; navigation to `/` succeeds) + axe-core (modal accessibility)

## Developer Context

Destructive-action safety net. Wipes IndexedDB threads with confirmation. PrimeNG `<p-dialog>` handles most of the modal chrome; this story adds a role="alertdialog" wrapper + safe-default focus + AD-6 delete calls.

**Menu-entry placement per DESIGN.md:** the "Start new session" entry lives inside the settings modal (E6-S2 wires the modal shell). Since E6 lands AFTER E3 in the critical path, this story creates a temporary standalone `<settings-menu-entry>` component that renders a button in the chat header overflow menu (or footer) — E6-S2 later moves the entry into the settings modal cleanly. Alternative: the entry ONLY lands in the settings modal (E6-S2), and E3-S2 defers the entry-placement UI, only landing the confirm-modal component + wire-in. This story leans toward option A (temp entry in overflow menu) so grader can find it.

**Ask-Both key deleted defensively:** `chat:ask-both:v1` is already in the `StorageKey` union from E0-S3. Delete all 3 keys unconditionally in the confirm handler; if `chat:ask-both:v1` doesn't exist yet (Epic 9 hasn't landed), the delete is a no-op (returns `undefined`).

## Technical Requirements

### `src/features/settings/confirm-modal.component.ts`

Uses PrimeNG `<p-dialog>` with `role="alertdialog"`. Focus-trap is native. Safe-default focus lands on Cancel via `@ViewChild` focus after modal open.

```ts
import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import * as copy from '@config/product-copy';
import * as aria from '@config/aria-labels';

@Component({
  standalone: true,
  imports: [DialogModule, ButtonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.scss'],
})
export class ConfirmModalComponent {
  @Input() open = false;
  @Input() title = copy.startNewSessionTitle;
  @Input() body = copy.startNewSessionBody;
  @Input() confirmLabel = copy.startNewSessionConfirmLabel;
  @Input() cancelLabel = copy.startNewSessionCancelLabel;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly modalDismissLabel = aria.modalDismissLabel;
  readonly clearSessionAria = aria.clearSessionButtonLabel;

  onCancel(): void { this.cancelled.emit(); this.open = false; }
  onConfirm(): void { this.confirmed.emit(); this.open = false; }
}
```

Template:
```html
<p-dialog [(visible)]="open" [modal]="true" [closable]="true" [style]="{width:'400px'}"
          role="alertdialog" [dismissableMask]="false" (onHide)="onCancel()"
          [ariaLabel]="title">
  <ng-template pTemplate="header"><h2>{{title}}</h2></ng-template>
  <p class="body-copy">{{body}}</p>
  <ng-template pTemplate="footer">
    <p-button [label]="cancelLabel" (onClick)="onCancel()" #cancelBtn autofocus severity="secondary"></p-button>
    <p-button [label]="confirmLabel" (onClick)="onConfirm()" severity="danger" [attr.aria-label]="clearSessionAria"></p-button>
  </ng-template>
</p-dialog>
```

### `src/features/settings/settings-menu-entry.component.ts` — temporary entry

Renders "Start new session" as a header overflow menu item (or link in the app-shell). Injects `ConfirmModalComponent` state + calls `StoragePort.delete` on confirm.

```ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { STORAGE_PORT } from '@domain/chat/di-tokens';
import { MessageService } from 'primeng/api'; // PrimeNG Toast service
import * as copy from '@config/product-copy';

@Component({
  standalone: true,
  imports: [ConfirmModalComponent, /* Toast if using PrimeNG */],
  template: `
    <button (click)="modalOpen = true">{{menuLabel}}</button>
    <app-confirm-modal [open]="modalOpen" (confirmed)="onClear()" (cancelled)="modalOpen = false"></app-confirm-modal>
  `,
})
export class SettingsMenuEntryComponent {
  modalOpen = false;
  menuLabel = copy.startNewSessionMenuLabel;
  private storage = inject(STORAGE_PORT);
  private router = inject(Router);
  private toast = inject(MessageService);

  async onClear(): Promise<void> {
    await this.storage.delete('chat:hitesh:v1');
    await this.storage.delete('chat:piyush:v1');
    await this.storage.delete('chat:ask-both:v1'); // defensive — Epic 9 populates this key
    this.toast.add({ severity: 'success', detail: copy.sessionClearedToast, life: 2000 });
    this.modalOpen = false;
    await this.router.navigate(['/']);
  }
}
```

### Product-copy additions (`src/config/product-copy.ts`)

```ts
export const startNewSessionTitle = 'Start a new session?';
export const startNewSessionBody = 'This will delete both chat histories.';
export const startNewSessionConfirmLabel = 'Yes, clear everything';
export const startNewSessionCancelLabel = 'Cancel';
export const startNewSessionMenuLabel = 'Start new session';
export const sessionClearedToast = 'Session cleared.';
```

## Architecture Compliance

- **AD-6:** `StoragePort.delete` for each of 3 chat StorageKeys. Handler is one of the sole consumers that touches multiple keys at once.
- **AD-20 cross-cutting:** `role="alertdialog"`, focus-trap (PrimeNG native), safe-default focus on Cancel, `:focus-visible` rings, `aria-labels.ts` sourcing.
- **AD-22 cross-cutting:** all copy from `product-copy.ts`.
- **FR-15:** discoverability + confirm modal + clears + navigates to landing.

## Library / Framework Requirements

No new packages (PrimeNG 21.1.9 from E0-S1 covers `<p-dialog>`, `<p-button>`, `MessageService`/Toast).

## File Structure Requirements

```
src/features/settings/
  confirm-modal.component.ts / .html / .scss
  settings-menu-entry.component.ts        # temporary — E6-S2 folds into settings-modal
src/config/product-copy.ts                 # EXTEND
```

## Testing Requirements

- `confirm-modal.component.spec.ts`: renders with `role="alertdialog"`; Cancel button gets focus on open; Esc calls `cancelled`; "Yes, clear everything" calls `confirmed`; axe-core zero violations.
- `settings-menu-entry.component.spec.ts`: click menu → modal open; click Cancel → modal closes, no storage delete; click Confirm → 3 `storage.delete` calls (assert via mock StoragePort), toast fires, router navigates to `/`.

## Latest Tech Information

- PrimeNG `<p-dialog>` 21.1.9 supports `role="alertdialog"` via passthrough `role` attribute + focus-trap by default. Verify with axe-core.
- PrimeNG Toast (`MessageService.add`) is the standard notification pattern; import `ToastModule` in the app-shell.

## Previous Story Intelligence

**E3-S1 (IdbKeyvalStorageAdapter):**
- `StoragePort.delete(key)` clears the value. `IdbKeyvalStorageAdapter` wraps `idb-keyval`'s `del`.
- All three `chat:*:v1` keys land in one IndexedDB store.

**E2-S4 (ChatComponent):**
- Persona greeting re-renders on empty thread mount — so post-clear, navigating to `/chat/hitesh` shows the greeting fresh.

**E0-S3 (Config):**
- `StorageKey` union has all 4 keys; `product-copy.ts` accepts the new keys added in this story.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-6` (StoragePort discipline, lines 106–114), `AD-20` (accessibility invariants, lines 277–286), `AD-22` (product-copy separation, lines 300–309).
- DESIGN.md `Components.confirm-modal` (lines 392–396).
- EXPERIENCE.md `Component Patterns.confirm-modal` (line 90).
- cross-cutting-AC-checklist.md — E3 covered because it touches UI (modal).
- Sprint status: key `e3-s2-start-new-session-modal`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-6] StoragePort.delete for all 3 chat keys.
- [Source: DESIGN.md#Components.confirm-modal] Visual spec.
- [Source: EXPERIENCE.md#Component Patterns.confirm-modal] Safe-default focus on Cancel; role="alertdialog".
- [Source: cross-cutting-AC-checklist.md] AD-20 focus-trap + AD-22 copy sourcing apply to this story per §Format flexibility.

## Story Completion Status

- [ ] `src/features/settings/confirm-modal.component.ts` — standalone Angular component using `<p-dialog>` with `role="alertdialog"`, safe-default focus on Cancel, Emits confirmed / cancelled.
- [ ] `src/features/settings/settings-menu-entry.component.ts` — temporary entry rendering "Start new session" button + wiring 3 `StoragePort.delete` calls + toast + `router.navigate('/')`.
- [ ] `product-copy.ts` extended with 6 new keys.
- [ ] `<app-footer>` or chat-header overflow menu includes the entry (defer final placement to E6-S2 which will fold this into the settings modal).
- [ ] Spec tests + axe-core on the modal.
- [ ] Manual smoke: chat → menu → confirm → threads cleared → landing.
