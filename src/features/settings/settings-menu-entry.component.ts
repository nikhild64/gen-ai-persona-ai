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
  template: `
    <button
      type="button"
      class="entry"
      [attr.aria-label]="clearAriaLabel"
      (click)="modalOpen.set(true)"
    >
      {{ menuLabel }}
    </button>
    <app-confirm-modal
      [(open)]="modalOpen"
      (confirmed)="onConfirmClear()"
      (cancelled)="modalOpen.set(false)"
    />
    @if (justCleared()) {
    <span class="toast" role="status">{{ clearedToast }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .entry {
        background: transparent;
        border: 1px solid #d6d3d1;
        color: #292524;
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
      }
      .entry:hover {
        background: #f5f5f4;
      }
      .toast {
        font-size: 13px;
        color: #166534;
        background: #dcfce7;
        padding: 0.3rem 0.5rem;
        border-radius: 4px;
      }
    `,
  ],
})
export class SettingsMenuEntryComponent {
  private readonly startNewSession = inject(StartNewSessionService);

  readonly modalOpen = signal(false);
  readonly justCleared = signal(false);

  readonly menuLabel = PRODUCT_COPY.startNewSessionMenuLabel;
  readonly clearedToast = PRODUCT_COPY.sessionClearedToast;
  readonly clearAriaLabel = clearSessionButtonLabel;

  async onConfirmClear(): Promise<void> {
    await this.startNewSession.clearAndReturnHome();
    this.justCleared.set(true);
    setTimeout(() => this.justCleared.set(false), 2000);
  }
}
