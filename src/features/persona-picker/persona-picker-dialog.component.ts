import {

  ChangeDetectionStrategy,

  Component,

  computed,

  effect,

  input,

  model,

  output,

  signal,

  untracked,

} from '@angular/core';

import { Dialog } from 'primeng/dialog';

import { Button } from 'primeng/button';



import type { PersonaId } from '../../domain/types/persona';

import { PERSONA_IDS } from '../../domain/types/persona';

import {

  PERSONA_REGISTRY,

  personaDisplayName,

} from '../../personas/persona.registry';

import { PRODUCT_COPY } from '../../config/product-copy';



/** `single` = tap to switch immediately. `unified` = pick 1 (solo) or 2 (blend). */

export type PersonaPickerMode = 'single' | 'unified';



@Component({

  selector: 'app-persona-picker-dialog',

  standalone: true,

  imports: [Dialog, Button],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './persona-picker-dialog.component.html',

  styleUrls: ['./persona-picker-dialog.component.scss'],

})

export class PersonaPickerDialogComponent {

  readonly open = model<boolean>(false);

  readonly mode = input<PersonaPickerMode>('single');

  readonly disabled = input(false);



  readonly activePersona = input<PersonaId | null>(null);

  readonly initialPair = input<{ a: PersonaId; b: PersonaId } | null>(null);



  readonly personaPicked = output<PersonaId>();

  readonly pairConfirmed = output<{ a: PersonaId; b: PersonaId }>();



  readonly personas = PERSONA_IDS;

  readonly registry = PERSONA_REGISTRY;



  readonly selection = signal<PersonaId[]>([]);



  readonly title = computed(() =>

    this.mode() === 'single'

      ? PRODUCT_COPY.personaPickerSingleTitle

      : PRODUCT_COPY.personaPickerUnifiedTitle,

  );



  readonly subtitle = computed(() =>

    this.mode() === 'single'

      ? PRODUCT_COPY.personaPickerSingleSubtitle

      : PRODUCT_COPY.personaPickerUnifiedSubtitle,

  );



  readonly canConfirmSolo = computed(

    () => this.mode() === 'unified' && this.selection().length === 1,

  );



  readonly canConfirmBlend = computed(

    () => this.mode() === 'unified' && this.selection().length === 2,

  );



  readonly soloButtonLabel = computed(() => {

    const sel = this.selection();

    if (sel.length !== 1) return PRODUCT_COPY.personaPickerSoloButtonLabel;

    return PRODUCT_COPY.personaPickerSoloButtonLabelFor(

      personaDisplayName(sel[0]),

    );

  });



  readonly blendButtonLabel = computed(() => {

    const sel = this.selection();

    if (sel.length !== 2) return PRODUCT_COPY.personaPickerBlendButtonLabel;

    return PRODUCT_COPY.personaPickerBlendButtonLabelFor(

      personaDisplayName(sel[0]),

      personaDisplayName(sel[1]),

    );

  });



  readonly selectionHint = computed(() => {
    const count = this.selection().length;
    if (count === 0) return PRODUCT_COPY.personaPickerSelectionHintNone;
    if (count === 1) return PRODUCT_COPY.personaPickerSelectionHintOne;
    return PRODUCT_COPY.personaPickerSelectionHintTwo;
  });



  constructor() {

    effect(() => {

      if (!this.open()) return;

      untracked(() => this.resetSelection());

    });

  }



  fullName(p: PersonaId): string {

    return PERSONA_REGISTRY[p].fullDisplayName;

  }



  tagline(p: PersonaId): string {

    return PERSONA_REGISTRY[p].tagline;

  }



  isSelected(p: PersonaId): boolean {

    return this.selection().includes(p);

  }



  selectionIndex(p: PersonaId): number {

    return this.selection().indexOf(p);

  }



  onTileClick(p: PersonaId): void {

    if (this.disabled()) return;



    if (this.mode() === 'single') {

      this.personaPicked.emit(p);

      this.open.set(false);

      return;

    }



    const current = this.selection();

    const idx = current.indexOf(p);

    if (idx >= 0) {

      this.selection.set(current.filter((id) => id !== p));

      return;

    }

    if (current.length < 2) {

      this.selection.set([...current, p]);

      return;

    }

    this.selection.set([current[0], p]);

  }



  onConfirmSolo(): void {

    const sel = this.selection();

    if (sel.length !== 1) return;

    this.personaPicked.emit(sel[0]);

    this.open.set(false);

  }



  onConfirmBlend(): void {

    const sel = this.selection();

    if (sel.length !== 2) return;

    this.pairConfirmed.emit({ a: sel[0], b: sel[1] });

    this.open.set(false);

  }



  onHide(): void {

    this.selection.set([]);

  }



  private resetSelection(): void {

    if (this.mode() === 'unified') {

      const pair = this.initialPair();

      this.selection.set(pair ? [pair.a, pair.b] : []);

    } else {

      this.selection.set([]);

    }

  }

}


