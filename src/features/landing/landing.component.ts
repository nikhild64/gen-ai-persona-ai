import { ChangeDetectionStrategy, Component } from '@angular/core';

import type { PersonaId } from '../../domain/types/persona';
import { PRODUCT_COPY } from '../../config/product-copy';
import { PersonaCardComponent } from './persona-card.component';

/**
 * FR-1 landing surface — hero band + two equal-weight persona cards +
 * expanded parody disclaimer band. The compact footer (E1-S2) lives in the
 * app shell and appears below this content on every route.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [PersonaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <h1>{{ heroTitle }}</h1>
      <p class="sub">{{ heroSubheader }}</p>
    </section>

    <section class="cards" aria-label="Available personas">
      @for (p of personas; track p) {
      <app-persona-card [persona]="p" />
      }
    </section>

    <section class="disclaimer-band" role="note">
      <p>{{ disclaimerBand }}</p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
      }
      .hero {
        text-align: center;
        margin-bottom: 1.75rem;
      }
      .hero h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(24px, 4vw, 34px);
      }
      .hero .sub {
        margin: 0;
        color: #57534e;
        font-size: 16px;
      }
      .cards {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr;
      }
      @media (min-width: 720px) {
        .cards {
          grid-template-columns: 1fr;
        }
      }
      .disclaimer-band {
        margin-top: 2rem;
        padding: 1rem 1.2rem;
        background: rgba(255, 255, 255, 0.55);
        backdrop-filter: blur(6px);
        border: 1px solid rgba(0, 0, 0, 0.05);
        border-radius: 10px;
        color: #57534e;
        font-size: 13px;
        text-align: center;
        line-height: 1.55;
      }
      .disclaimer-band p {
        margin: 0;
      }
    `,
  ],
})
export class LandingComponent {
  readonly personas: PersonaId[] = ['hitesh', 'piyush'];
  readonly heroTitle = PRODUCT_COPY.landingHeroTitle;
  readonly heroSubheader = PRODUCT_COPY.landingHeroSubheader;
  readonly disclaimerBand = PRODUCT_COPY.landingDisclaimerBand;
}
