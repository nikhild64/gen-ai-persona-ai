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
  templateUrl: './settings-gear.component.html',
  styleUrls: ['./settings-gear.component.scss'],
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
