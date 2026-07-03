import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import { PRODUCT_COPY } from '../../config/product-copy';

/**
 * DESIGN.md.Components.streaming-indicator — 3-dot pulse while waiting for
 * the first token; morphs into a warning-tinted "Slow connection" stall card
 * with a Cancel button when `stalled` is true (per UX-DR16 + FR-9). Pulse
 * disabled under `prefers-reduced-motion` via CSS media query.
 */
@Component({
  selector: 'app-streaming-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './streaming-indicator.component.html',
  styleUrls: ['./streaming-indicator.component.scss'],
})
export class StreamingIndicatorComponent {
  readonly label = input<string>('Thinking…');
  readonly stalled = input<boolean>(false);
  readonly stallBody = PRODUCT_COPY.streamStallPromptBody;
  readonly cancelLabel = PRODUCT_COPY.streamStallCancelLabel;
  readonly cancelClicked = output<void>();
}
