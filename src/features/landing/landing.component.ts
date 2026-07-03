import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { Router } from '@angular/router';



import { FEATURE_ASK_BOTH_MODE, FEATURE_CUSTOM_PERSONA } from '../../config/feature-flags';

import { PRODUCT_COPY } from '../../config/product-copy';

import type { PersonaId } from '../../domain/types/persona';

import { PERSONA_IDS } from '../../domain/types/persona';

import type { CustomPersonaRecord } from '../../domain/types/custom-persona';
import { BlendedPairService } from '../ask-both/blended-pair.service';

import { CustomPersonaStore } from '../../domain/custom-persona/custom-persona.store';

import { CustomPersonaThreadService } from '../../domain/custom-persona/custom-persona-thread.service';

import { PersonaPickerDialogComponent } from '../persona-picker/persona-picker-dialog.component';

import { PersonaCardComponent } from './persona-card.component';

import { AskBothCardComponent } from './ask-both-card.component';

import { CreatePersonaCardComponent } from './create-persona-card.component';

import { CreatePersonaDialogComponent } from './create-persona-dialog.component';

import { CustomPersonaCardComponent } from './custom-persona-card.component';



@Component({

  selector: 'app-landing',

  standalone: true,

  imports: [

    PersonaCardComponent,

    CustomPersonaCardComponent,

    AskBothCardComponent,

    CreatePersonaCardComponent,

    CreatePersonaDialogComponent,

    PersonaPickerDialogComponent,

  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './landing.component.html',

  styleUrls: ['./landing.component.scss'],

})

export class LandingComponent {
  private readonly router = inject(Router);
  readonly blendedPair = inject(BlendedPairService);

  private readonly customStore = inject(CustomPersonaStore);

  private readonly customThreads = inject(CustomPersonaThreadService);



  readonly personas = PERSONA_IDS;

  readonly customPersonas = this.customStore.personas;

  readonly askBothEnabled = FEATURE_ASK_BOTH_MODE;

  readonly customPersonaEnabled = FEATURE_CUSTOM_PERSONA;

  readonly heroTitle = PRODUCT_COPY.landingHeroTitle;

  readonly heroSubheader = PRODUCT_COPY.landingHeroSubheader;

  readonly disclaimerBand = PRODUCT_COPY.landingDisclaimerBand;



  readonly pickerOpen = signal(false);

  readonly createDialogOpen = signal(false);



  openPicker(): void {

    this.pickerOpen.set(true);

  }



  openCreateDialog(): void {
    this.createDialogOpen.set(true);
  }

  onPersonaPicked(persona: PersonaId): void {

    void this.router.navigate(['/chat', persona]);

  }



  onBlendPairConfirmed(pair: { a: PersonaId; b: PersonaId }): void {

    this.blendedPair.setPair(pair.a, pair.b);

    void this.router.navigate(['/chat', 'ask-both']);

  }



  async onDeleteCustomPersona(record: CustomPersonaRecord): Promise<void> {

    this.customStore.delete(record.id);

    await this.customThreads.deleteThread(record.id);

  }

}


