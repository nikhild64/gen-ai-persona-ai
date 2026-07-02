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
    @if (state() === 'saved') {
    <span class="badge saved" [attr.aria-label]="ariaLabel()">
      <span class="dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </span>
    } @else {
    <button
      type="button"
      class="badge none"
      [attr.aria-label]="ariaLabel()"
      (click)="clicked.emit()"
    >
      <span class="dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </button>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 24px;
        padding: 0 0.6rem;
        border-radius: 999px;
        font-size: 12px;
        border: 1px solid #d6d3d1;
        background: white;
        color: #292524;
      }
      .badge.none {
        cursor: pointer;
        color: #b45309;
        border-color: #fed7aa;
        background: #fff7ed;
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
