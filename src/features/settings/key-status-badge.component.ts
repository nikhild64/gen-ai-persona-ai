import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';

import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { PRODUCT_COPY } from '../../config/product-copy';
import { keyStatusBadgeLabel } from '../../config/aria-labels';

/**
 * DESIGN.md.Components.key-status-badge — small chip reflecting current
 * KeyVaultService state; clickable in the no-key state to open Settings.
 */
@Component({
  selector: 'app-key-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="badge"
      [class.saved]="state() === 'saved'"
      [class.none]="state() === 'none'"
      [attr.aria-label]="ariaLabel()"
      (click)="clicked.emit()"
    >
      <span class="dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        height: 36px;
        padding: 0 0.75rem;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.7);
        color: #292524;
        cursor: pointer;
        font: inherit;
        transition:
          background 0.15s ease,
          border-color 0.15s ease;
      }
      .badge.saved:hover {
        background: white;
        border-color: var(--persona-accent, rgba(0, 0, 0, 0.2));
      }
      .badge.none {
        color: #b45309;
        border-color: rgba(254, 215, 170, 0.9);
        background: rgba(255, 247, 237, 0.85);
      }
      .badge.none:hover {
        background: #fff7ed;
        border-color: #fed7aa;
      }
      .badge:focus-visible {
        outline: 2px solid var(--persona-accent, #0ea5e9);
        outline-offset: 2px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #a1a1aa;
      }
      .badge.saved .dot {
        background: #16a34a;
      }
      .badge.none .dot {
        background: #f59e0b;
      }
      @media (max-width: 720px) {
        .badge {
          display: none;
        }
      }
    `,
  ],
})
export class KeyStatusBadgeComponent {
  private readonly keyVault = inject(KeyVaultService);
  readonly clicked = output<void>();

  readonly state = computed<'saved' | 'none'>(() =>
    this.keyVault.currentProvider() ? 'saved' : 'none',
  );

  readonly label = computed(() => {
    const p = this.keyVault.currentProvider();
    return p
      ? PRODUCT_COPY.keyStatusUsingLabel(p)
      : PRODUCT_COPY.keyStatusNoKeyLabel;
  });

  readonly ariaLabel = computed(() =>
    keyStatusBadgeLabel(
      this.state(),
      this.keyVault.currentProvider() ?? undefined,
    ),
  );
}
