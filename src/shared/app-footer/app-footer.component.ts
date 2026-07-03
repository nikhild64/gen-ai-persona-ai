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
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.scss'],
})
export class AppFooterComponent {
  readonly disclaimer = PRODUCT_COPY.footerDisclaimer;
  readonly takedownContact = PRODUCT_COPY.takedownContact;
  readonly ariaLabel = disclaimerLinkLabel;

  readonly takedownLink =
    `mailto:${PRODUCT_COPY.takedownEmail}?subject=` +
    encodeURIComponent(PRODUCT_COPY.takedownSubject);
}
