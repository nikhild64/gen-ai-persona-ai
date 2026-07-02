import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-ask-both-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ask-both-card.component.html',
  styleUrls: ['./ask-both-card.component.scss'],
})
export class AskBothCardComponent {
  readonly blendRequested = output<void>();
}
