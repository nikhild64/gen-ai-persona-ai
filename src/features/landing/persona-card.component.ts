import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import { personaDisplayName } from '../../personas/persona.registry';
import { PRODUCT_COPY } from '../../config/product-copy';
import { personaCardLabel } from '../../config/aria-labels';

/**
 * FR-1 persona card — one of two equal-weight tiles on the landing page.
 * `[attr.data-persona]` scopes the CTA button colour to that persona per
 * AD-17. Full card is a single click target per UX-DR1 (RouterLink on <a>).
 */
@Component({
  selector: 'app-persona-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-card.component.html',
  styleUrls: ['./persona-card.component.scss'],
})
export class PersonaCardComponent {
  readonly persona = input.required<PersonaId>();
  readonly ctaLabel = PRODUCT_COPY.landingCtaLabel;

  readonly displayName = computed(() => personaDisplayName(this.persona()));
  readonly tagline = computed(() =>
    this.persona() === 'hitesh'
      ? PRODUCT_COPY.landingHiteshTagline
      : PRODUCT_COPY.landingPiyushTagline,
  );
  readonly ariaLabel = computed(() => personaCardLabel(this.persona()));
}
