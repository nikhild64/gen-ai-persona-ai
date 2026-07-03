import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FEATURE_ASK_BOTH_MODE } from '../../config/feature-flags';

import type { PersonaId } from '../../domain/types/persona';
import { PRODUCT_COPY } from '../../config/product-copy';
import { PersonaCardComponent } from './persona-card.component';
import { AskBothCardComponent } from './ask-both-card.component';

/**
 * FR-1 landing surface — hero band + two equal-weight persona cards + the
 * combined Ask-Both tile + expanded parody disclaimer band. The compact
 * footer (E1-S2) lives in the app shell and appears below this content on
 * every route.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [PersonaCardComponent, AskBothCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  readonly personas: PersonaId[] = ['hitesh', 'piyush'];
  readonly askBothEnabled = FEATURE_ASK_BOTH_MODE;
  readonly heroTitle = PRODUCT_COPY.landingHeroTitle;
  readonly heroSubheader = PRODUCT_COPY.landingHeroSubheader;
  readonly disclaimerBand = PRODUCT_COPY.landingDisclaimerBand;
}
