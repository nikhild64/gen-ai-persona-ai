import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import { PERSONA_IDS } from '../../domain/types/persona';
import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from '../../personas/persona.registry';
import { personaSwitcherLabel } from '../../config/aria-labels';
import { PRODUCT_COPY } from '../../config/product-copy';
import { ANALYTICS_PORT } from '../../domain/chat/di-tokens';

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
  readonly personas = PERSONA_IDS;
  readonly registry = PERSONA_REGISTRY;

  readonly open = signal(false);
  readonly filter = signal('');
  readonly activeIndex = signal(0);

  readonly listboxId = 'persona-switcher-listbox';

  private readonly inputEl =
    viewChild<ElementRef<HTMLInputElement>>('filterInput');

  readonly disabledTooltip = computed(() =>
    PRODUCT_COPY.switcherDisabledDuringStream(
      personaDisplayName(this.activePersona()),
    ),
  );

  readonly filteredPersonas = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return [...this.personas];
    return this.personas.filter((p) => {
      const entry = PERSONA_REGISTRY[p];
      return (
        personaDisplayName(p).toLowerCase().includes(q) ||
        entry.fullDisplayName.toLowerCase().includes(q) ||
        entry.tagline.toLowerCase().includes(q)
      );
    });
  });

  display(p: PersonaId): string {
    return personaDisplayName(p);
  }

  fullName(p: PersonaId): string {
    return PERSONA_REGISTRY[p].fullDisplayName;
  }

  ariaLabel(): string {
    return personaSwitcherLabel(this.activePersona());
  }

  toggleOpen(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (this.open()) {
      this.filter.set('');
      this.activeIndex.set(
        this.filteredPersonas().indexOf(this.activePersona()),
      );
      queueMicrotask(() => this.inputEl()?.nativeElement.focus());
    }
  }

  close(): void {
    this.open.set(false);
    this.filter.set('');
  }

  onSelect(target: PersonaId): void {
    if (this.disabled()) return;
    if (target === this.activePersona()) {
      this.close();
      return;
    }
    this.analytics.emit({
      name: 'persona_switched',
      payload: { from: this.activePersona(), to: target },
    });
    this.switched.emit(target);
    this.close();
    void this.router.navigate(['/chat', target]);
  }

  onFilterInput(value: string): void {
    this.filter.set(value);
    this.activeIndex.set(0);
    if (!this.open()) this.open.set(true);
  }

  @HostListener('keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const list = this.filteredPersonas();
    if (list.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) {
        this.open.set(true);
        return;
      }
      this.activeIndex.update((i) => (i + 1) % list.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) {
        this.open.set(true);
        return;
      }
      this.activeIndex.update((i) => (i - 1 + list.length) % list.length);
    } else if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const pick = list[this.activeIndex()];
      if (pick) this.onSelect(pick);
    } else if (event.key === 'Escape') {
      this.close();
    }
  }
}
