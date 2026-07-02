import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  input,
  model,
  output,
} from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';

import { PRODUCT_COPY } from '../../config/product-copy';
import { modalDismissLabel } from '../../config/aria-labels';

/**
 * DESIGN.md.Components.confirm-modal — reusable alertdialog with safe-default
 * focus on the Cancel button per AD-20. PrimeNG's `<p-dialog>` supplies the
 * focus-trap; we lift the `role` up to `alertdialog` and land the initial
 * focus target ourselves.
 */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [Dialog, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="open"
      [modal]="true"
      [closable]="true"
      [dismissableMask]="false"
      [style]="{ width: '400px' }"
      role="alertdialog"
      (onHide)="cancelled.emit()"
    >
      <ng-template pTemplate="header">
        <h2 id="confirm-modal-title" style="margin: 0;">
          {{ title() }}
        </h2>
      </ng-template>
      <p class="body">{{ body() }}</p>
      <div class="action-row">
        <p-button
          #cancelBtn
          [label]="cancelLabel()"
          severity="secondary"
          (onClick)="onCancel()"
        ></p-button>
        <p-button
          [label]="confirmLabel()"
          severity="danger"
          (onClick)="onConfirm()"
        ></p-button>
      </div>
    </p-dialog>
  `,
  styles: [
    `
      .body {
        line-height: 1.5;
        color: #292524;
        margin: 0 0 1.25rem;
      }
      .action-row {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class ConfirmModalComponent {
  readonly open = model<boolean>(false);
  readonly title = input<string>(PRODUCT_COPY.startNewSessionTitle);
  readonly body = input<string>(PRODUCT_COPY.startNewSessionBody);
  readonly confirmLabel = input<string>(
    PRODUCT_COPY.startNewSessionConfirmLabel,
  );
  readonly cancelLabel = input<string>(PRODUCT_COPY.startNewSessionCancelLabel);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly modalDismissLabel = modalDismissLabel;

  @ViewChild('cancelBtn', { read: ElementRef })
  cancelButtonRef?: ElementRef<HTMLElement>;

  constructor() {
    // Safe-default focus on Cancel when modal opens.
    effect(() => {
      if (this.open()) {
        setTimeout(() => {
          const btn = this.cancelButtonRef?.nativeElement.querySelector(
            'button',
          ) as HTMLButtonElement | null;
          btn?.focus();
        }, 0);
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
    this.open.set(false);
  }

  onConfirm(): void {
    this.confirmed.emit();
    this.open.set(false);
  }
}
