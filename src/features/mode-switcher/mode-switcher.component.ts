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
import { FEATURE_ASK_BOTH_MODE } from '../../config/feature-flags';
import { localStoreGet } from '../../domain/key-vault/browser-local-storage';
import { PERSONA_IDS } from '../../domain/types/persona';

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
  templateUrl: './mode-switcher.component.html',
  styleUrls: ['./mode-switcher.component.scss'],
})
export class ModeSwitcherComponent {
  readonly activeMode = input.required<ChatMode>();
  readonly disabled = input<boolean>(false);
  readonly switched = output<ChatMode>();

  /** FR-32 kill-switch — hide entirely when Ask-Both feature is disabled. */
  readonly visible = FEATURE_ASK_BOTH_MODE;

  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS_PORT);

  readonly modes: ChatMode[] = ['solo', 'ask-both'];

  readonly disabledTooltip = computed(() =>
    PRODUCT_COPY.switcherDisabledDuringStream(
      this.activeMode() === 'solo' ? 'Assistant' : 'Blend',
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
      const last = localStoreGet('last-active-solo');
      void this.router.navigateByUrl(`/chat/${last ?? PERSONA_IDS[0]}`);
    }
  }
}
