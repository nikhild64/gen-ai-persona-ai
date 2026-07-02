import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import { personaDisplayName } from '../../personas/persona.registry';
import { personaSwitcherLabel } from '../../config/aria-labels';
import { PRODUCT_COPY } from '../../config/product-copy';
import { ANALYTICS_PORT } from '../../domain/chat/di-tokens';

/**
 * DESIGN.md.Components.persona-switcher — segmented toggle. Roles per
 * AD-20: `tablist` container, `tab` per segment, `aria-selected` on active.
 * ArrowLeft/ArrowRight cycle selection (WAI-ARIA authoring practice for
 * segmented toggles).
 */
@Component({
  selector: 'app-persona-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-switcher.component.html',
  styleUrls: ['./persona-switcher.component.scss'],
})
export class PersonaSwitcherComponent {
  readonly activePersona = input.required<PersonaId>();
  readonly disabled = input<boolean>(false);
  readonly switched = output<PersonaId>();

  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS_PORT);
  readonly personas: PersonaId[] = ['hitesh', 'piyush'];

  readonly disabledTooltip = computed(() =>
    PRODUCT_COPY.switcherDisabledDuringStream(
      personaDisplayName(this.activePersona()),
    ),
  );

  display(p: PersonaId): string {
    return personaDisplayName(p);
  }

  ariaLabel(): string {
    return personaSwitcherLabel(this.activePersona());
  }

  onSelect(target: PersonaId): void {
    if (this.disabled()) return;
    if (target === this.activePersona()) return;
    this.analytics.emit({
      name: 'persona_switched',
      payload: { from: this.activePersona(), to: target },
    });
    this.switched.emit(target);
    void this.router.navigate(['/chat', target]);
  }

  @HostListener('keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next: PersonaId =
      this.activePersona() === 'hitesh' ? 'piyush' : 'hitesh';
    this.onSelect(next);
    event.preventDefault();
  }
}
