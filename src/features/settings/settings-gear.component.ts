import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
} from '@angular/core';

import { settingsGearLabel } from '../../config/aria-labels';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { SettingsModalComponent } from './settings-modal.component';
import { KeyStatusBadgeComponent } from './key-status-badge.component';

/**
 * Chat-header trio: key-status badge + gear icon + settings modal. Consumers
 * can two-way-bind `open` to trigger the modal (E6-S3 auto-open flow uses
 * this from the chat component).
 */
@Component({
  selector: 'app-settings-gear',
  standalone: true,
  imports: [SettingsModalComponent, KeyStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gear-row">
      <app-key-status-badge (clicked)="open.set(true)" />
      <button
        type="button"
        class="gear-btn"
        [attr.aria-label]="gearLabel"
        (click)="open.set(true)"
      >
        <span class="pi pi-cog" aria-hidden="true"></span>
      </button>
    </div>
    <app-settings-modal
      [(open)]="open"
      [(autoOpenMode)]="autoOpenMode"
      (closedWithSave)="savedEmit()"
      (closedWithoutSave)="dismissedEmit()"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      .gear-row {
        display: inline-flex;
        gap: 0.4rem;
        align-items: center;
      }
      .gear-btn {
        background: transparent;
        border: 1px solid #d6d3d1;
        border-radius: 6px;
        padding: 0.4rem 0.55rem;
        cursor: pointer;
        font-size: 14px;
        color: #292524;
        position: relative;
      }
      .gear-btn::after {
        content: '';
        position: absolute;
        top: 4px;
        right: 4px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: v-bind(dotColor);
      }
    `,
  ],
})
export class SettingsGearComponent {
  readonly open = model<boolean>(false);
  readonly autoOpenMode = model<boolean>(false);

  private readonly keyVault = inject(KeyVaultService);
  readonly gearLabel = settingsGearLabel;

  readonly dotColor = computed(() =>
    this.keyVault.hasKey() ? '#16a34a' : '#f59e0b',
  );

  private savedListeners: Array<() => void> = [];
  private dismissedListeners: Array<() => void> = [];

  onSaved(cb: () => void): void {
    this.savedListeners.push(cb);
  }
  onDismissed(cb: () => void): void {
    this.dismissedListeners.push(cb);
  }
  savedEmit(): void {
    this.savedListeners.forEach((cb) => cb());
  }
  dismissedEmit(): void {
    this.dismissedListeners.forEach((cb) => cb());
  }
}
