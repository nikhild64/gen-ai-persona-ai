import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FEATURE_ASK_BOTH_MODE } from '../../config/feature-flags';

import { PRODUCT_COPY } from '../../config/product-copy';
import { PERSONA_LANDING_GROUPS } from '../../personas/persona.registry';
import { PersonaCardComponent } from './persona-card.component';
import { AskBothCardComponent } from './ask-both-card.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [PersonaCardComponent, AskBothCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  readonly groups = PERSONA_LANDING_GROUPS;
  readonly askBothEnabled = FEATURE_ASK_BOTH_MODE;
  readonly heroTitle = PRODUCT_COPY.landingHeroTitle;
  readonly heroSubheader = PRODUCT_COPY.landingHeroSubheader;
  readonly disclaimerBand = PRODUCT_COPY.landingDisclaimerBand;
}
