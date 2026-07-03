import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { PRODUCT_COPY } from '../../config/product-copy';
import { clearSessionButtonLabel } from '../../config/aria-labels';
import { StartNewSessionService } from './start-new-session.service';
import { ConfirmModalComponent } from './confirm-modal.component';

/**
 * FR-15 discoverable "Start new session" entry — rendered as a text-button
 * in the chat header until E6-S2 folds it into the full settings modal.
 * Triggers the shared confirm-modal, then calls StartNewSessionService.
 */
@Component({
  selector: 'app-settings-menu-entry',
  standalone: true,
  imports: [ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-menu-entry.component.html',
  styleUrls: ['./settings-menu-entry.component.scss'],
})
export class SettingsMenuEntryComponent {
  private readonly startNewSession = inject(StartNewSessionService);

  readonly modalOpen = signal(false);
  readonly justCleared = signal(false);

  readonly menuLabel = PRODUCT_COPY.startNewSessionMenuLabel;
  readonly clearedToast = PRODUCT_COPY.sessionClearedToast;
  readonly clearAriaLabel = clearSessionButtonLabel;

  async onConfirmClear(): Promise<void> {
    await this.startNewSession.clearInPlace();
    this.justCleared.set(true);
    setTimeout(() => this.justCleared.set(false), 2000);
  }
}
