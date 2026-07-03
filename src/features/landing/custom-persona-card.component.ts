import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CustomPersonaRecord } from '../../domain/types/custom-persona';
import { PRODUCT_COPY } from '../../config/product-copy';
import { customPersonaCardLabel } from '../../config/aria-labels';
import { PersonaAvatarSvgComponent } from '../../shared/persona-avatar-svg/persona-avatar-svg.component';
import { ConfirmModalComponent } from '../settings/confirm-modal.component';

@Component({
  selector: 'app-custom-persona-card',
  standalone: true,
  imports: [RouterLink, PersonaAvatarSvgComponent, ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-persona-card.component.html',
  styleUrls: ['./custom-persona-card.component.scss'],
})
export class CustomPersonaCardComponent {
  readonly persona = input.required<CustomPersonaRecord>();
  readonly deleteRequested = output<CustomPersonaRecord>();

  readonly ctaLabel = PRODUCT_COPY.landingCtaLabel;
  readonly deleteConfirmOpen = signal(false);

  readonly chatUrl = computed(() => {
    const id = this.persona().id.replace(/^custom:/, '');
    return ['/chat', 'custom', id];
  });

  readonly ariaLabel = computed(() =>
    customPersonaCardLabel(this.persona().fullDisplayName),
  );

  readonly deleteTitle = PRODUCT_COPY.deleteCustomPersonaTitle;
  readonly deleteBody = computed(() =>
    PRODUCT_COPY.deleteCustomPersonaBody(this.persona().fullDisplayName),
  );
  readonly deleteConfirmLabel = PRODUCT_COPY.deleteCustomPersonaConfirm;

  onDeleteClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteConfirmOpen.set(true);
  }

  onDeleteConfirmed(): void {
    this.deleteRequested.emit(this.persona());
  }
}
