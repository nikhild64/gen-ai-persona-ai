import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AriaAnnouncerComponent } from '../shared/aria-announcer/aria-announcer.component';
import { AppFooterComponent } from '../shared/app-footer/app-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AriaAnnouncerComponent, AppFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
