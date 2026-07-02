import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { ANALYTICS_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { modalDismissLabel } from '../../config/aria-labels';

type ProviderOption = { label: string; value: ProviderId };

/**
 * E6-S2 settings modal + E6-S3 auto-open extension. `autoOpenMode` shows the
 * "Chai chalega?" contextual header (AD-22 documented exception). Emits
 * `closedWithSave` / `closedWithoutSave` so the caller (chat component) can
 * re-dispatch a queued message or navigate away.
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
      [style]="{ width: '480px' }"
      (onHide)="onHide()"
    >
      <ng-template pTemplate="header">
        <div class="modal-header">
          @if (autoOpenMode()) {
          <p class="ctx">{{ autoOpenHeader }}</p>
          }
          <h2>{{ title }}</h2>
        </div>
      </ng-template>

      <section class="row">
        <label>
          <span class="lbl">{{ providerLabel }}</span>
          <p-select
            [options]="providerOptions"
            [ngModel]="provider()"
            (ngModelChange)="provider.set($event)"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
          ></p-select>
        </label>
      </section>

      <section class="row">
        <label>
          <span class="lbl">{{ keyLabel }}</span>
          <div class="key-input">
            <input
              pInputText
              spellcheck="false"
              autocomplete="off"
              [type]="revealed() ? 'text' : 'password'"
              [placeholder]="keyPlaceholder()"
              [ngModel]="keyInput()"
              (ngModelChange)="keyInput.set($event)"
            />
            <button
              type="button"
              class="eye"
              [attr.aria-label]="revealed() ? 'Hide key' : 'Show key'"
              (click)="revealed.set(!revealed())"
            >
              {{ revealed() ? '🙈' : '👁' }}
            </button>
          </div>
          <span class="hint">{{ keyHint() }}</span>
        </label>
      </section>

      <section class="status-row">
        <span class="dot" [class.on]="hasKey()"></span>
        <span class="status">{{ statusLabel() }}</span>
      </section>

      <ng-template pTemplate="footer">
        <p-button
          [label]="clearLabel"
          severity="secondary"
          [disabled]="!hasKey()"
          (onClick)="onClear()"
        ></p-button>
        <p-button
          [label]="saveLabel"
          [disabled]="!keyInput().trim()"
          (onClick)="onSave()"
        ></p-button>
      </ng-template>
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
      .row {
        margin-bottom: 1.25rem;
      }
      .row label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .lbl {
        font-weight: 600;
        font-size: 13px;
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
        background: transparent;
        border: 1px solid #d6d3d1;
        border-radius: 6px;
        padding: 0.35rem 0.5rem;
        cursor: pointer;
      }
      .hint {
        color: #78716c;
        font-size: 12px;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 13px;
        color: #57534e;
        margin-top: 0.75rem;
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
    `,
  ],
})
export class SettingsModalComponent {
  readonly open = model<boolean>(false);
  readonly autoOpenMode = model<boolean>(false);
  readonly closedWithSave = output<void>();
  readonly closedWithoutSave = output<void>();

  readonly provider = signal<ProviderId>('gemini');
  readonly keyInput = signal<string>('');
  readonly revealed = signal<boolean>(false);
  readonly justSaved = signal<boolean>(false);

  private readonly keyVault = inject(KeyVaultService);
  private readonly analytics = inject(ANALYTICS_PORT);

  readonly title = PRODUCT_COPY.settingsTitle;
  readonly providerLabel = PRODUCT_COPY.providerSelectLabel;
  readonly keyLabel = PRODUCT_COPY.apiKeyInputLabel;
  readonly saveLabel = PRODUCT_COPY.saveButtonLabel;
  readonly clearLabel = PRODUCT_COPY.clearButtonLabel;
  readonly savedToast = PRODUCT_COPY.keySavedToast;
  readonly autoOpenHeader = PRODUCT_COPY.settingsAutoOpenHeader;
  readonly modalDismissLabel = modalDismissLabel;

  readonly providerOptions: ProviderOption[] = [
    { label: 'Gemini', value: 'gemini' },
    { label: 'Groq', value: 'groq' },
  ];

  readonly hasKey = computed(() => this.keyVault.hasKey());

  readonly statusLabel = computed(() => {
    const p = this.keyVault.currentProvider();
    return p
      ? PRODUCT_COPY.keyStatusUsingLabel(p)
      : PRODUCT_COPY.keyStatusNoKeyLabel;
  });

  readonly keyHint = computed(() =>
    PRODUCT_COPY.keyFormatHelper(this.provider()),
  );

  readonly keyPlaceholder = computed(() =>
    this.provider() === 'gemini' ? 'AIzaSy…' : 'gsk_…',
  );

  onSave(): void {
    const key = this.keyInput().trim();
    if (!key) return;
    this.keyVault.setKey(this.provider(), key);
    this.analytics.emit({
      name: 'byo_key_saved',
      payload: { provider: this.provider() },
    });
    this.keyInput.set('');
    this.justSaved.set(true);
    setTimeout(() => this.justSaved.set(false), 2000);
    this.closedWithSave.emit();
    this.open.set(false);
    this.autoOpenMode.set(false);
  }

  onClear(): void {
    this.keyVault.clearKey(this.provider());
  }

  onHide(): void {
    // Fires on ANY close — X, Esc, mask-click. If we didn't just save, treat
    // as dismissed-without-save so the caller can react (auto-open flow
    // routes back to landing).
    if (!this.justSaved()) this.closedWithoutSave.emit();
    this.autoOpenMode.set(false);
  }
}
