import {
  ChangeDetectionStrategy,
  Component,
  output,
} from '@angular/core';

import { PRODUCT_COPY } from '../../config/product-copy';

@Component({
  selector: 'app-create-persona-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-persona-card.component.html',
  styleUrls: ['./create-persona-card.component.scss'],
})
export class CreatePersonaCardComponent {
  readonly createRequested = output<void>();

  readonly title = PRODUCT_COPY.createPersonaCardTitle;
  readonly tagline = PRODUCT_COPY.createPersonaCardTagline;
  readonly ctaLabel = PRODUCT_COPY.createPersonaCardCta;
  readonly badge = PRODUCT_COPY.customPersonaExperimentalChip;
}
