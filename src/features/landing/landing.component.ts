import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { FEATURE_ASK_BOTH_MODE } from '../../config/feature-flags';
import { PRODUCT_COPY } from '../../config/product-copy';
import type { PersonaId } from '../../domain/types/persona';
import { PERSONA_IDS } from '../../domain/types/persona';
import { BlendedPairService } from '../ask-both/blended-pair.service';
import { PersonaPickerDialogComponent } from '../persona-picker/persona-picker-dialog.component';
import { PersonaCardComponent } from './persona-card.component';
import { AskBothCardComponent } from './ask-both-card.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    PersonaCardComponent,
    AskBothCardComponent,
    PersonaPickerDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private readonly router = inject(Router);
  readonly blendedPair = inject(BlendedPairService);

  readonly personas = PERSONA_IDS;
  readonly askBothEnabled = FEATURE_ASK_BOTH_MODE;
  readonly heroTitle = PRODUCT_COPY.landingHeroTitle;
  readonly heroSubheader = PRODUCT_COPY.landingHeroSubheader;
  readonly disclaimerBand = PRODUCT_COPY.landingDisclaimerBand;

  readonly pickerOpen = signal(false);

  openPicker(): void {
    this.pickerOpen.set(true);
  }

  onPersonaPicked(persona: PersonaId): void {
    void this.router.navigate(['/chat', persona]);
  }

  onBlendPairConfirmed(pair: { a: PersonaId; b: PersonaId }): void {
    this.blendedPair.setPair(pair.a, pair.b);
    void this.router.navigate(['/chat', 'ask-both']);
  }
}
