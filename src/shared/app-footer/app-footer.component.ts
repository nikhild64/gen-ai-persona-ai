import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PRODUCT_COPY } from '../../config/product-copy';
import { disclaimerLinkLabel } from '../../config/aria-labels';

/**
 * FR-2 persistent parody footer + takedown affordance. Lives in the app
 * shell so it renders on every route without lazy-load hit (AD-21).
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="app-footer">
      <span class="disclaimer">{{ disclaimer }}</span>
      <a
        class="takedown-link"
        [attr.aria-label]="ariaLabel"
        [href]="takedownLink"
      >
        {{ takedownContact }}
      </a>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .app-footer {
        min-height: 48px;
        background: rgba(250, 250, 249, 0.6);
        backdrop-filter: blur(6px);
        border-top: 1px solid rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1.25rem;
        color: #57534e;
        font-size: 12px;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .disclaimer {
        line-height: 1.4;
      }
      .takedown-link {
        color: #292524;
        text-decoration: underline;
        white-space: nowrap;
      }
      .takedown-link:hover {
        color: #78350f;
      }
    `,
  ],
})
export class AppFooterComponent {
  readonly disclaimer = PRODUCT_COPY.footerDisclaimer;
  readonly takedownContact = PRODUCT_COPY.takedownContact;
  readonly ariaLabel = disclaimerLinkLabel;

  readonly takedownLink =
    `mailto:${PRODUCT_COPY.takedownEmail}?subject=` +
    encodeURIComponent(PRODUCT_COPY.takedownSubject);
}
