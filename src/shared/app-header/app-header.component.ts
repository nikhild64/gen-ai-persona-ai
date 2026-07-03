import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import type { PersonaId } from '../../domain/types/persona';
import { PRODUCT_COPY } from '../../config/product-copy';
import { brandHomeLabel } from '../../config/aria-labels';
import { KeyStatusBadgeComponent } from '../../features/settings/key-status-badge.component';
import { SettingsModalComponent } from '../../features/settings/settings-modal.component';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, KeyStatusBadgeComponent, SettingsModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
})
export class AppHeaderComponent {
  private readonly router = inject(Router);
  readonly settings = inject(AppSettingsService);

  readonly brandName = PRODUCT_COPY.brandName;
  readonly brandAriaLabel = brandHomeLabel;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly badgeAskBoth = computed(() => this.url().includes('/ask-both'));

  readonly badgePersona = computed((): PersonaId | null => {
    if (this.badgeAskBoth()) return null;
    const path = this.url();
    if (path.includes('/piyush')) return 'piyush';
    if (path.includes('/chat')) return 'hitesh';
    return null;
  });
}
