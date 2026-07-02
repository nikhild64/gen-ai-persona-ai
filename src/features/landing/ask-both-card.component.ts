import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * FR-1 companion tile — Ask-Both entry alongside the two persona cards.
 * Carries `data-mode="ask-both"` so the shared card chrome picks up the
 * mixed-gradient chip treatment defined in this component.
 */
@Component({
  selector: 'app-ask-both-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ask-both-card.component.html',
  styleUrls: ['./ask-both-card.component.scss'],
})
export class AskBothCardComponent {}
