import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';

import type { ProviderId } from '../../config/provider-registry';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { PersonaRoutingService } from '../../domain/key-vault/persona-routing.service';
import { ANALYTICS_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { modalDismissLabel } from '../../config/aria-labels';
import { personaDisplayName } from '../../personas/persona.registry';
import type { PersonaId } from '../../domain/types/persona';

type ProviderSlot = {
  id: ProviderId;
  label: string;
  placeholder: string;
  hint: string;
};

type ProviderOption = { label: string; value: ProviderId };

/**
 * E6-S2 settings modal + E6-S3 auto-open extension. Renders:
 *   1. Persona → provider routing (user can send both personas to the same
 *      provider, e.g. use one Gemini key for both).
 *   2. One key slot per provider so both keys can be configured in a single
 *      visit; keys persist independently, saving does not close the dialog.
 *
 * `closedWithSave` fires on each save so the caller (chat component) can
 * re-dispatch a queued message; the dialog itself stays open until the user
 * hits Done / X / Esc so they can continue editing routing or the other key.
 */
@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [Dialog, Select, InputText, Button, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="open"
      [modal]="true"
      [closable]="true"
      [dismissableMask]="false"
      [style]="{ width: '560px' }"
      (onHide)="onHide()"
    >
      <ng-template pTemplate="header">
        <div class="modal-header">
          @if (autoOpenMode()) {
          <p class="ctx">{{ autoOpenHeader }}</p>
          }
          <h2>{{ title }}</h2>
          <p class="lead">
            Route each persona to the provider whose key you want to use.
            You can point both personas at the same provider if you only
            have one key.
          </p>
        </div>
      </ng-template>

      <section class="routing">
        <h3 class="section-heading">Which provider answers as…</h3>
        <div class="routing-grid">
          @for (persona of personas; track persona) {
          <label class="route-row">
            <span class="lbl">{{ personaLabel(persona) }}</span>
            <p-select
              [options]="providerOptions"
              [ngModel]="routing()[persona]"
              (ngModelChange)="setRoute(persona, $event)"
              [ngModelOptions]="{ standalone: true }"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
            ></p-select>
            <span
              class="route-status"
              [class.ok]="isSaved(routing()[persona])"
            >
              @if (isSaved(routing()[persona])) { Key ready } @else { Key
              missing }
            </span>
          </label>
          }
        </div>
      </section>

      <h3 class="section-heading">Provider keys</h3>
      @for (slot of slots; track slot.id) {
      <section class="slot" [attr.data-provider]="slot.id">
        <header class="slot-header">
          <div class="slot-title">
            <span class="dot" [class.on]="isSaved(slot.id)"></span>
            <span class="name">{{ slot.label }}</span>
          </div>
          <span class="status">{{ slotStatus(slot.id) }}</span>
        </header>

        <div class="key-input">
          <input
            pInputText
            spellcheck="false"
            autocomplete="off"
            [type]="revealed()[slot.id] ? 'text' : 'password'"
            [placeholder]="slot.placeholder"
            [ngModel]="inputs()[slot.id]"
            [ngModelOptions]="{ standalone: true }"
            (ngModelChange)="setInput(slot.id, $event)"
            (keydown.enter)="onSave(slot.id)"
          />
          <button
            type="button"
            class="eye"
            [attr.aria-label]="
              revealed()[slot.id] ? 'Hide key' : 'Show key'
            "
            (click)="toggleReveal(slot.id)"
          >
            <i
              class="pi"
              [class.pi-eye]="!revealed()[slot.id]"
              [class.pi-eye-slash]="revealed()[slot.id]"
              aria-hidden="true"
            ></i>
          </button>
        </div>
        <span class="hint">{{ slot.hint }}</span>

        <div class="slot-actions">
          <p-button
            [label]="clearLabel"
            severity="secondary"
            [disabled]="!isSaved(slot.id)"
            (onClick)="onClear(slot.id)"
          ></p-button>
          <p-button
            [label]="saveLabel"
            [disabled]="!inputs()[slot.id]?.trim()"
            (onClick)="onSave(slot.id)"
          ></p-button>
        </div>
      </section>
      }

      <div class="footer-actions">
        <p-button label="Done" (onClick)="onDone()"></p-button>
      </div>
    </p-dialog>

    @if (justSaved()) {
    <div class="toast" role="status">{{ savedToast }}</div>
    }
  `,
  styles: [
    `
      .modal-header {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
      }
      .modal-header .ctx {
        margin: 0;
        color: #b45309;
        font-size: 14px;
      }
      .modal-header .lead {
        margin: 0;
        color: #57534e;
        font-size: 13px;
        line-height: 1.5;
      }
      .section-heading {
        margin: 0 0 0.5rem;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #78716c;
      }
      .routing {
        margin-bottom: 1.25rem;
      }
      .routing-grid {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .route-row {
        display: grid;
        grid-template-columns: 90px 1fr auto;
        align-items: center;
        gap: 0.6rem;
      }
      .route-status {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #b45309;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        background: rgba(254, 215, 170, 0.45);
        white-space: nowrap;
      }
      .route-status.ok {
        color: #15803d;
        background: rgba(187, 247, 208, 0.45);
      }
      .slot {
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 10px;
        padding: 0.85rem 1rem 0.95rem;
        margin-bottom: 0.75rem;
        background: rgba(255, 255, 255, 0.55);
      }
      .slot-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.6rem;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .slot-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .slot-title .name {
        font-weight: 600;
        font-size: 14px;
      }
      .status {
        font-size: 12px;
        color: #57534e;
      }
      .key-input {
        display: flex;
        gap: 0.35rem;
        align-items: center;
      }
      .key-input input {
        flex: 1 1 auto;
      }
      .eye {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 38px;
        min-height: 38px;
        background: transparent;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 6px;
        padding: 0 0.5rem;
        cursor: pointer;
        color: #57534e;
        transition:
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }
      .eye:hover {
        background: rgba(0, 0, 0, 0.04);
        border-color: rgba(0, 0, 0, 0.2);
        color: #292524;
      }
      .eye .pi {
        font-size: 16px;
        line-height: 1;
      }
      .hint {
        display: block;
        color: #78716c;
        font-size: 12px;
        margin-top: 0.35rem;
      }
      .slot-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .footer-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
        padding-top: 0.85rem;
        border-top: 1px solid rgba(0, 0, 0, 0.06);
      }
      .lbl {
        font-weight: 600;
        font-size: 13px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #a1a1aa;
      }
      .dot.on {
        background: #16a34a;
      }
      .toast {
        position: fixed;
        bottom: 1.5rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.55rem 1rem;
        background: #dcfce7;
        color: #166534;
        border-radius: 6px;
        font-weight: 600;
        z-index: 4000;
      }
      @media (max-width: 520px) {
        .route-row {
          grid-template-columns: 1fr;
          align-items: stretch;
        }
        .route-status {
          justify-self: start;
        }
      }
    `,
  ],
})
export class SettingsModalComponent {
  readonly open = model<boolean>(false);
  readonly autoOpenMode = model<boolean>(false);
  readonly closedWithSave = output<void>();
  readonly closedWithoutSave = output<void>();

  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly analytics = inject(ANALYTICS_PORT);

  readonly title = PRODUCT_COPY.settingsTitle;
  readonly saveLabel = PRODUCT_COPY.saveButtonLabel;
  readonly clearLabel = PRODUCT_COPY.clearButtonLabel;
  readonly savedToast = PRODUCT_COPY.keySavedToast;
  readonly autoOpenHeader = PRODUCT_COPY.settingsAutoOpenHeader;
  readonly modalDismissLabel = modalDismissLabel;

  readonly justSaved = signal(false);
  private savedDuringSession = false;

  readonly personas: PersonaId[] = ['hitesh', 'piyush'];
  readonly routing = this.personaRouting.routing;

  readonly inputs = signal<Record<ProviderId, string>>({
    gemini: '',
    groq: '',
  });
  readonly revealed = signal<Record<ProviderId, boolean>>({
    gemini: false,
    groq: false,
  });

  readonly providerOptions: ProviderOption[] = [
    { label: 'Gemini', value: 'gemini' },
    { label: 'Groq', value: 'groq' },
  ];

  readonly slots: ProviderSlot[] = (['gemini', 'groq'] as ProviderId[]).map(
    (id) => ({
      id,
      label: id === 'gemini' ? 'Gemini' : 'Groq',
      placeholder: id === 'gemini' ? 'AIzaSy…' : 'gsk_…',
      hint: PRODUCT_COPY.keyFormatHelper(id),
    }),
  );

  readonly hasAnyKey = computed(() => this.keyVault.hasKey());

  constructor() {
    // Reset input drafts + reveal flags (but keep saved keys) whenever the
    // modal opens so the field is fresh.
    effect(() => {
      if (this.open()) {
        this.inputs.set({ gemini: '', groq: '' });
        this.revealed.set({ gemini: false, groq: false });
        this.savedDuringSession = false;
      }
    });
  }

  personaLabel(p: PersonaId): string {
    return personaDisplayName(p);
  }

  isSaved(id: ProviderId): boolean {
    return this.keyVault.getKeyForProvider(id) !== null;
  }

  slotStatus(id: ProviderId): string {
    return this.isSaved(id) ? 'Saved' : 'Not saved';
  }

  setInput(id: ProviderId, value: string): void {
    this.inputs.update((prev) => ({ ...prev, [id]: value }));
  }

  toggleReveal(id: ProviderId): void {
    this.revealed.update((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  setRoute(persona: PersonaId, provider: ProviderId): void {
    this.personaRouting.setProviderFor(persona, provider);
  }

  onSave(id: ProviderId): void {
    const key = (this.inputs()[id] ?? '').trim();
    if (!key) return;
    this.keyVault.setKey(id, key);
    this.analytics.emit({
      name: 'byo_key_saved',
      payload: { provider: id },
    });
    this.setInput(id, '');
    this.justSaved.set(true);
    setTimeout(() => this.justSaved.set(false), 2000);
    this.savedDuringSession = true;
    // Notify the caller so a queued message can re-dispatch. We deliberately
    // do NOT close the dialog — user may want to configure the other key or
    // change routing.
    this.closedWithSave.emit();
    this.autoOpenMode.set(false);
  }

  onClear(id: ProviderId): void {
    this.keyVault.clearKey(id);
  }

  onDone(): void {
    this.open.set(false);
  }

  onHide(): void {
    // Fires on ANY close — X, Esc, mask-click, or Done button. Only treat as
    // dismissed-without-save when nothing was saved during this open session
    // (auto-open flow uses this to route back to landing).
    if (!this.savedDuringSession) this.closedWithoutSave.emit();
    this.autoOpenMode.set(false);
    this.savedDuringSession = false;
  }
}
