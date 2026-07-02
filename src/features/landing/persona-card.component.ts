import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import { personaDisplayName } from '../../personas/persona.registry';
import { PRODUCT_COPY } from '../../config/product-copy';
import { personaCardLabel } from '../../config/aria-labels';

/**
 * FR-1 persona card — one of two equal-weight tiles on the landing page.
 * `[attr.data-persona]` scopes the CTA button colour to that persona per
 * AD-17. Full card is a single click target per UX-DR1 (RouterLink on <a>).
 */
@Component({
  selector: 'app-persona-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="persona-card"
      [attr.data-persona]="persona()"
      [routerLink]="['/chat', persona()]"
      [attr.aria-label]="ariaLabel()"
    >
      <img
        class="avatar"
        [src]="'/images/' + persona() + '.png'"
        alt=""
        width="96"
        height="96"
      />
      <div class="body">
        <h2>{{ displayName() }}</h2>
        <p class="tagline">{{ tagline() }}</p>
      </div>
      <span class="cta">{{ ctaLabel }}</span>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .persona-card {
        display: grid;
        grid-template-columns: 96px 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1.1rem 1.3rem;
        border-radius: 14px;
        border: 1px solid #e7e5e4;
        background: white;
        text-decoration: none;
        color: #1c1917;
        transition: transform 0.12s ease, box-shadow 0.12s ease,
          border-color 0.12s ease;
        min-height: 160px;
      }
      .persona-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
        border-color: var(--persona-accent, #d6d3d1);
      }
      .persona-card:focus-visible {
        outline: 2px solid var(--persona-accent, #0ea5e9);
        outline-offset: 2px;
      }
      .avatar {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--persona-accent, #d6d3d1);
        background: #f5f5f4;
      }
      .body h2 {
        margin: 0 0 0.35rem;
        font-size: 22px;
      }
      .tagline {
        margin: 0;
        color: #44403c;
        line-height: 1.45;
      }
      .cta {
        justify-self: end;
        padding: 0.55rem 1.1rem;
        border-radius: 999px;
        background: var(--persona-accent, #292524);
        color: white;
        font-weight: 600;
      }
      @media (max-width: 720px) {
        .persona-card {
          grid-template-columns: 72px 1fr;
        }
        .cta {
          grid-column: 1 / -1;
          justify-self: stretch;
          text-align: center;
        }
        .avatar {
          width: 72px;
          height: 72px;
        }
      }
    `,
  ],
})
export class PersonaCardComponent {
  readonly persona = input.required<PersonaId>();
  readonly ctaLabel = PRODUCT_COPY.landingCtaLabel;

  readonly displayName = computed(() => personaDisplayName(this.persona()));
  readonly tagline = computed(() =>
    this.persona() === 'hitesh'
      ? PRODUCT_COPY.landingHiteshTagline
      : PRODUCT_COPY.landingPiyushTagline,
  );
  readonly ariaLabel = computed(() => personaCardLabel(this.persona()));
}
