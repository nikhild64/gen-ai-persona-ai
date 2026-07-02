import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from '../../personas/persona.registry';
import { PRODUCT_COPY } from '../../config/product-copy';
import { personaCardLabel } from '../../config/aria-labels';

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
  readonly fullName = computed(
    () => PERSONA_REGISTRY[this.persona()].fullDisplayName,
  );
  readonly tagline = computed(() => PERSONA_REGISTRY[this.persona()].tagline);
  readonly era = computed(() => PERSONA_REGISTRY[this.persona()].era);
  readonly ariaLabel = computed(() => personaCardLabel(this.persona()));
}
