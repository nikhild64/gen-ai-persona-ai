import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';

import { AskBothModeService } from './ask-both-mode.service';
import type { AskBothMode } from '../../config/feature-flags';
import { PRODUCT_COPY } from '../../config/product-copy';
import { askBothVariantToggleLabel } from '../../config/aria-labels';

/**
 * Post-sprint Ask-Both variant toggle. Three-segment tablist
 * (Sequential | Parallel | Blended) — same visual language as
 * `ModeSwitcherComponent`, but scoped to the Ask-Both surface only
 * (not a top-level mode switcher). Reads/writes the active variant via
 * `AskBothModeService`, so the sequencer sees the change on the next send.
 *
 * Accessibility (AD-20):
 *  - `role="tablist"` with `role="tab"` segments and `aria-selected`.
 *  - Keyboard nav via ArrowLeft / ArrowRight / Home / End (WAI-ARIA
 *    tablist pattern).
 *  - Tooltip via native `title` attribute (announced by screen readers
 *    that support it, and rendered on hover / focus by every browser).
 *  - `aria-label` sourced from `askBothVariantToggleLabel(active)` in
 *    `aria-labels.ts` — AD-20 registry lookup, not an inline string.
 *
 * Disabled state (AD-21 hot-path): mirrors `ModeSwitcherComponent` —
 * disables all segments during in-flight to avoid mid-stream switches.
 */
@Component({
  selector: 'app-ask-both-mode-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ask-both-mode-toggle.component.html',
  styleUrls: ['./ask-both-mode-toggle.component.scss'],
})
export class AskBothModeToggleComponent {
  readonly disabled = input<boolean>(false);

  readonly variants: readonly AskBothMode[] = [
    'sequential',
    'parallel',
    'blended',
  ] as const;

  private readonly modeService = inject(AskBothModeService);

  readonly active = computed(() => this.modeService.mode());

  readonly tooltip = PRODUCT_COPY.askBothVariantTooltip;

  ariaLabel(): string {
    return askBothVariantToggleLabel(this.active());
  }

  label(variant: AskBothMode): string {
    return PRODUCT_COPY.askBothVariantLabels[variant];
  }

  onSelect(variant: AskBothMode): void {
    if (this.disabled() || variant === this.active()) return;
    this.modeService.set(variant);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    const currentIdx = this.variants.indexOf(this.active());
    const nextIdx = this.computeNextIndex(event.key, currentIdx);
    if (nextIdx === null) return;

    event.preventDefault();
    const next = this.variants[nextIdx];
    if (next && next !== this.active()) {
      this.modeService.set(next);
    }
  }

  private computeNextIndex(key: string, currentIdx: number): number | null {
    switch (key) {
      case 'ArrowRight':
        return (currentIdx + 1) % this.variants.length;
      case 'ArrowLeft':
        return (currentIdx - 1 + this.variants.length) % this.variants.length;
      case 'Home':
        return 0;
      case 'End':
        return this.variants.length - 1;
      default:
        return null;
    }
  }
}
