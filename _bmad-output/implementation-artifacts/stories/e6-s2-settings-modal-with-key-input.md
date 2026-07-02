# Story E6-S2: SettingsModal component (provider select + key input + save/clear)

Status: ready-for-dev

- **Epic:** 6 — BYO-Key Mode
- **Critical-path position:** 21 of 37 (Day 5 morning)
- **Blocks:** E6-S3, E10-S1
- **Depends on:** E6-S1, E0-S3

## Story

As a **cohort grader**,
I want **to open a settings modal, pick Gemini or Groq, paste my key (with the input masked but a reveal eye-toggle), save, and see a small "Using your key" badge in the chat header**,
So that **the setup flow is dead-simple — under 30 seconds if I have a key on hand**.

## Acceptance Criteria

**Given** the KeyVaultService from E6-S1,
**When** the developer authors `src/features/settings/settings-modal.component.ts`,
**Then** it renders per DESIGN.md.Components.settings-modal — a PrimeNG `<p-dialog>` at `480px` width (desktop) / full-width (mobile), `rounded-xl` (16px), `surface-canvas` background, `24px` internal padding, elevation shadow.

**Given** the modal is rendered,
**When** the user inspects it,
**Then** the header row has `h1` title `product-copy.ts.settingsTitle` (`"Settings"`) left + close X icon button (24px, `ink-secondary`, keyboard Esc closes) right. Body sections are stacked with `32px` vertical spacing: (a) provider select — `label` "Provider" above a PrimeNG `<p-select>` with two options: "Gemini" and "Groq" (no third — AD-5); (b) API key input — `label` "API Key" above `<p-inputtext>` `type="password"` with an eye-toggle icon on the right side of the field to reveal plaintext on click. `caption` helper below the input shows expected format per provider (`"Format: AIza..."` for Gemini or `"Format: gsk_..."` for Groq — reactive to provider select change); (c) Save / Clear buttons right-aligned — Save primary (persona-accent fill if a persona is active, `focus-ring` sky fill if on landing route) with white `label` text; Clear secondary (transparent, `ink-secondary` text), disabled when no key is saved; (d) current-key status below the button row: `body-sm` `ink-secondary` with either `"Using your Gemini key."` (with success green dot) or `"No key saved."` (with ink-disabled grey dot).

**Given** the user selects Groq from the provider dropdown and types `gsk_...` in the key input,
**When** the input value changes,
**Then** the format helper text updates reactively; a light regex validation (the KEY_PATTERN from `GroqAdapter.KEY_PATTERN`) fires on blur — if the format doesn't match, the input shows a subtle `caption` `warning` line: `"That doesn't look like a Groq key (starts with gsk_)"` from `product-copy.ts.keyFormatWarning(provider)`. This is illustrative only — a well-formed but wrong key is caught by the actual provider call, not by regex.

**Given** the user clicks Save,
**When** the save handler fires,
**Then** `KeyVaultService.setKey(provider, key)` writes to sessionStorage; a 2-second `success` toast fires (`"Saved. You can chat now."` from `product-copy.ts.keySavedToast`); the modal closes; the `byo_key_saved` analytics event emits per AD-15 with payload `{provider}` — the raw key is NOT in the payload (scrubbed by the redaction registry from E6-S1, but the payload never contained the key in the first place; the redaction is a defense-in-depth).

**Given** the user clicks Clear,
**When** the clear handler fires,
**Then** `KeyVaultService.clearKey(provider)` wipes the sessionStorage entry; the current-key status updates to `"No key saved."` reactively; no toast (Clear is a passive operation).

**Given** the modal is open,
**When** the user presses Esc OR clicks the close X,
**Then** the modal closes without side effects (the current key state, if any, is unchanged); focus returns to the trigger element (settings gear icon) via PrimeNG `<p-dialog>` focus-trap per AD-20.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Modal Tab traversal: provider select → key input → eye-toggle → Save button → Clear button → close X. Focus trapped within modal until closed.
- **AC-A20.2** — Every control uses `aria-labels.ts` (`settingsGearLabel`, `modalDismissLabel`, plus new keys for provider select and key input labels).
- **AC-A20.3** — All controls have `:focus-visible` ring.
- **AC-A20.4** — Save button contrast passes AA on both persona accents.
- **AC-A20.6** — Modal open transition (12px slide + fade, 200ms) respects `prefers-reduced-motion` (instant appear).
- **AC-A21.1** — Settings feature module lazy-loaded via `loadChildren`.
- **AC-A22.1** — All modal chrome copy from `product-copy.ts` (title, section labels, format helpers, save/clear labels, current-key-status templates, toast).

**verifies:** FR-16 (BYO-Key paste + selection UX), AD-5 (provider set restricted to Gemini + Groq), AD-11 (KeyVaultService is the write-side of the sessionStorage discipline), AD-15 (byo_key_saved analytics event), AD-20 (cross-cutting), AD-21 (cross-cutting), AD-22 (cross-cutting)

**touches:** `src/features/settings/settings-modal.component.ts`, `src/features/settings/settings-modal.component.scss`, `src/features/settings/settings-modal.component.html`, `src/features/settings/settings-gear.component.ts` (small icon button that opens the modal — lives in the chat header), `src/config/product-copy.ts` (new keys: `settingsTitle`, `providerSelectLabel`, `apiKeyInputLabel`, `keyFormatHelper(provider)`, `keyFormatWarning(provider)`, `saveButtonLabel`, `clearButtonLabel`, `keyStatusUsingLabel(provider)`, `keyStatusNoKeyLabel`, `keySavedToast`, `settingsGearAriaLabel`), `src/config/aria-labels.ts` (uses existing `settingsGearLabel` + `modalDismissLabel`)

**test target:** component test (modal renders provider select with only Gemini + Groq; eye-toggle reveals key; format helper text updates on provider change; Save writes to KeyVaultService + fires byo_key_saved event + toast; Clear wipes; Esc closes; focus-trap keeps Tab inside) + axe-core on modal

## Developer Context

Settings UX for the BYO-Key flow. Uses PrimeNG primitives (`p-dialog`, `p-select`, `p-inputtext`, `p-button`, Toast via `MessageService`). Standalone Angular components — no NgModule.

**Lazy-load the settings feature:** `settings.routes.ts` with `loadChildren` per AD-21. Since settings modal is opened via a click (not a URL nav), the lazy chunk loads on first open. Alternative: eager-import via app-shell if bundle-budget is OK.

**Provider validation:** the KEY_PATTERN regex on adapter classes provides format check. Read from `PROVIDER_REGISTRY.get(provider)!.KEY_PATTERN`.

## Technical Requirements

### `settings-modal.component.ts`

```ts
@Component({
  standalone: true,
  imports: [DialogModule, SelectModule, InputTextModule, ButtonModule, ToastModule, ...],
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss'],
})
export class SettingsModalComponent {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  provider = signal<ProviderId>('gemini');
  keyInput = signal('');
  revealed = signal(false);
  keyFormatWarning = computed(() => {
    const val = this.keyInput();
    if (!val) return '';
    const pattern = PROVIDER_REGISTRY.get(this.provider())!.KEY_PATTERN;
    return pattern.test(val) ? '' : copy.keyFormatWarning(this.provider());
  });
  currentStatus = computed(() => {
    const s = this.keyVault.currentKey$();
    if (s.provider) return copy.keyStatusUsingLabel(s.provider);
    return copy.keyStatusNoKeyLabel;
  });

  constructor(private keyVault: KeyVaultService, @Inject(ANALYTICS_PORT) private analytics: AnalyticsPort, private toast: MessageService) {}

  onSave(): void {
    this.keyVault.setKey(this.provider(), this.keyInput());
    this.analytics.emit({ name: 'byo_key_saved', payload: { provider: this.provider() } });
    this.toast.add({ severity: 'success', detail: copy.keySavedToast, life: 2000 });
    this.keyInput.set('');
    this.closed.emit();
    this.open = false;
  }

  onClear(): void {
    this.keyVault.clearKey(this.provider());
  }

  onEyeToggle(): void { this.revealed.update((v) => !v); }
}
```

### `settings-gear.component.ts` — chat header icon

```ts
@Component({
  standalone: true,
  imports: [ButtonModule, SettingsModalComponent],
  selector: 'app-settings-gear',
  template: `
    <p-button icon="pi pi-cog" [attr.aria-label]="gearLabel" (onClick)="modalOpen = true" severity="secondary"></p-button>
    <app-settings-modal [open]="modalOpen" (closed)="modalOpen = false"></app-settings-modal>
  `,
})
export class SettingsGearComponent {
  modalOpen = false;
  readonly gearLabel = aria.settingsGearLabel;
}
```

Wire into `chat.component.html`:
```html
<div class="chat-header">
  <app-persona-switcher ...></app-persona-switcher>
  <!-- Ask-Both mode-switcher slot for Epic 9 -->
  <app-key-status-badge></app-key-status-badge>  <!-- E6-S3 -->
  <app-settings-gear></app-settings-gear>
</div>
```

### `settings.routes.ts` (optional — for lazy-load)

If not lazy-loading, `SettingsGearComponent` is imported directly into the chat-header. Bundle-budget check per AD-21.

### `product-copy.ts` additions

Per the AC touches list, ~11 new keys/functions.

## Architecture Compliance

- **AD-5:** provider select has ONLY Gemini + Groq.
- **AD-11:** `KeyVaultService.setKey` is the sole write path; sessionStorage lives here + IdbKeyvalStorageAdapter only.
- **AD-15:** `byo_key_saved` typed event — payload has `{provider}` only, NEVER the key.
- **AD-20/21/22 cross-cutting:** modal accessibility, lazy-load feasibility, product-copy sourcing.

## Library / Framework Requirements

PrimeNG (already installed): `DialogModule`, `SelectModule` (or `DropdownModule` in older PrimeNG), `InputTextModule`, `ButtonModule`, `ToastModule`, `MessageService`.

## File Structure Requirements

```
src/features/settings/
  settings-modal.component.ts / .html / .scss
  settings-gear.component.ts
src/config/product-copy.ts       # EXTEND — ~11 new keys
src/features/chat/chat.component.html  # WIRE <app-settings-gear>
```

## Testing Requirements

- `settings-modal.component.spec.ts`: renders 2 provider options; eye-toggle reveals; KEY_PATTERN warning shows on invalid; Save writes to KeyVaultService + emits `byo_key_saved` + toast fires; Esc closes.
- axe-core zero violations.
- Manual smoke: paste Gemini key, save, badge updates (E6-S3 verifies).

## Latest Tech Information

- PrimeNG 21.1.9 `<p-select>` replaces older `<p-dropdown>` — verify API in your version.
- PrimeNG `<p-dialog>` `focusOnShow` + built-in focus-trap satisfies AD-20.

## Previous Story Intelligence

**E6-S1 (KeyVaultService):**
- `setKey`/`clearKey`/`currentKey$` reactive signal. Modal reads `currentKey$` for status.

**E2-S1 (Provider adapters):**
- `PROVIDER_REGISTRY.get(provider)!.KEY_PATTERN` for validation.

**E0-S3 (Config):**
- `product-copy.ts` accepts new keys.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-5` (provider set, lines 100–104), `AD-11` (KeyVault + redaction, lines 167–175), `AD-15` (byo_key_saved event, lines 221–244).
- DESIGN.md `Components.settings-modal` (lines 381–390).
- EXPERIENCE.md `Component Patterns.settings-modal` (line 89).
- Sprint status: key `e6-s2-settings-modal-with-key-input`, blocks `[e6-s3, e10-s1]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-5] Only Gemini + Groq in provider select.
- [Source: DESIGN.md#Components.settings-modal] Visual spec.
- [Source: EXPERIENCE.md#Component Patterns.settings-modal] Auto-open behavior wired in E6-S3.

## Story Completion Status

- [ ] `settings-modal.component.ts` — PrimeNG p-dialog with provider select + key input + reveal + save/clear + status.
- [ ] `settings-gear.component.ts` — chat header icon opens modal.
- [ ] `KeyVaultService.setKey` writes on Save; toast fires; `byo_key_saved` emitted; modal closes.
- [ ] `KeyVaultService.clearKey` on Clear; status updates reactively.
- [ ] Cross-cutting AC + component test + axe-core.
- [ ] product-copy.ts extended with ~11 keys.
