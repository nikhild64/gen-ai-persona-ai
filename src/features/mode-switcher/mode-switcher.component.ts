import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';

import { modeSwitcherLabel } from '../../config/aria-labels';
import { PRODUCT_COPY } from '../../config/product-copy';
import { ANALYTICS_PORT } from '../../domain/chat/di-tokens';

export type ChatMode = 'solo' | 'ask-both';

/**
 * FR-26 Solo ↔ Ask-Both toggle. Deliberately distinct visual treatment from
 * the persona-switcher (ink-primary active fill instead of persona-accent) —
 * mode is a product-level choice per DESIGN.md.Components.mode-switcher.
 */
@Component({
  selector: 'app-mode-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="track"
      role="tablist"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-disabled]="disabled() || null"
    >
      @for (m of modes; track m) {
      <button
        type="button"
        role="tab"
        class="segment"
        [attr.aria-selected]="m === activeMode()"
        [attr.tabindex]="m === activeMode() ? 0 : -1"
        [attr.title]="disabled() ? disabledTooltip() : null"
        [class.active]="m === activeMode()"
        [class.disabled]="disabled()"
        [disabled]="disabled()"
        (click)="onSelect(m)"
      >
        {{ label(m) }}
      </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .track {
        display: inline-flex;
        background: #f5f5f4;
        border: 1px solid #d6d3d1;
        border-radius: 999px;
        padding: 4px;
        gap: 2px;
        min-height: 36px;
      }
      .segment {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        background: transparent;
        border: none;
        color: #57534e;
        font-weight: 500;
        cursor: pointer;
        min-width: 44px;
      }
      .segment.active {
        background: #1c1917;
        color: white;
      }
      .segment:hover:not(.active):not(.disabled) {
        background: #e7e5e4;
      }
      .segment.disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ModeSwitcherComponent {
  readonly activeMode = input.required<ChatMode>();
  readonly disabled = input<boolean>(false);
  readonly switched = output<ChatMode>();

  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS_PORT);

  readonly modes: ChatMode[] = ['solo', 'ask-both'];

  readonly disabledTooltip = computed(() =>
    PRODUCT_COPY.switcherDisabledDuringStream(
      this.activeMode() === 'solo' ? 'Assistant' : 'Ask-Both',
    ),
  );

  label(m: ChatMode): string {
    return m === 'solo'
      ? PRODUCT_COPY.modeSwitcherSoloLabel
      : PRODUCT_COPY.modeSwitcherAskBothLabel;
  }

  ariaLabel(): string {
    return modeSwitcherLabel(this.activeMode());
  }

  onSelect(mode: ChatMode): void {
    if (this.disabled() || mode === this.activeMode()) return;

    this.analytics.emit({
      name: 'mode_switched',
      payload: { from: this.activeMode(), to: mode },
    });
    this.switched.emit(mode);

    if (mode === 'ask-both') {
      void this.router.navigateByUrl('/chat/ask-both');
    } else {
      const last =
        typeof sessionStorage !== 'undefined'
          ? sessionStorage.getItem('last-active-solo')
          : null;
      void this.router.navigateByUrl(`/chat/${last ?? 'hitesh'}`);
    }
  }
}
