import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PRODUCT_COPY } from '../../config/product-copy';
import { brandHomeLabel, settingsGearLabel } from '../../config/aria-labels';
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
  readonly settings = inject(AppSettingsService);

  readonly brandName = PRODUCT_COPY.brandName;
  readonly brandAriaLabel = brandHomeLabel;
  readonly settingsAriaLabel = settingsGearLabel;
}
