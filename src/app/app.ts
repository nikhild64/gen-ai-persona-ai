import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AriaAnnouncerComponent } from '../shared/aria-announcer/aria-announcer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AriaAnnouncerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
