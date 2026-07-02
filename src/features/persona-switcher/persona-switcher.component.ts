import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import { personaDisplayName } from '../../personas/persona.registry';
import { personaSwitcherLabel } from '../../config/aria-labels';

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
  template: `
    <div
      class="track"
      role="tablist"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-disabled]="disabled() || null"
    >
      @for (p of personas; track p) {
      <button
        type="button"
        role="tab"
        class="segment"
        [attr.aria-selected]="p === activePersona()"
        [attr.data-persona]="p"
        [attr.tabindex]="p === activePersona() ? 0 : -1"
        [class.active]="p === activePersona()"
        [class.disabled]="disabled()"
        [disabled]="disabled()"
        (click)="onSelect(p)"
      >
        <img
          [src]="'/images/' + p + '.png'"
          alt=""
          width="18"
          height="18"
          class="avatar"
        />
        <span>{{ display(p) }}</span>
      </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .track {
        display: inline-flex;
        background: #f5f5f4;
        border: 1px solid #d6d3d1;
        border-radius: 999px;
        padding: 4px;
        gap: 2px;
        min-height: 36px;
      }
      .segment {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: transparent;
        border: none;
        color: #57534e;
        font-weight: 500;
        cursor: pointer;
        min-width: 44px;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .segment:hover:not(.active):not(.disabled) {
        background: #e7e5e4;
      }
      .segment.active {
        background: var(--switcher-accent, #292524);
        color: white;
      }
      .segment.active[data-persona='hitesh'] {
        --switcher-accent: #d97706;
      }
      .segment.active[data-persona='piyush'] {
        --switcher-accent: #2563eb;
      }
      .segment.disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .avatar {
        border-radius: 50%;
        object-fit: cover;
        background: #d6d3d1;
      }
    `,
  ],
})
export class PersonaSwitcherComponent {
  readonly activePersona = input.required<PersonaId>();
  readonly disabled = input<boolean>(false);
  readonly switched = output<PersonaId>();

  private readonly router = inject(Router);
  readonly personas: PersonaId[] = ['hitesh', 'piyush'];

  display(p: PersonaId): string {
    return personaDisplayName(p);
  }

  ariaLabel(): string {
    return personaSwitcherLabel(this.activePersona());
  }

  onSelect(target: PersonaId): void {
    if (this.disabled()) return;
    if (target === this.activePersona()) return;
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
