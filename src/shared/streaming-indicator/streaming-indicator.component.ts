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
  template: `
    @if (!stalled()) {
    <div class="indicator" role="status" aria-live="polite">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="label">{{ label() }}</span>
    </div>
    } @else {
    <div class="stall-card" role="status" aria-live="polite">
      <p class="stall-body">{{ stallBody }}</p>
      <button
        type="button"
        class="stall-cancel"
        (click)="cancelClicked.emit()"
      >
        {{ cancelLabel }}
      </button>
    </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .indicator {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        height: 32px;
        padding: 0 0.5rem;
        color: #57534e;
        font-size: 14px;
        font-style: italic;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--persona-accent, #a1a1aa);
        opacity: 0.35;
        animation: pulse 1s infinite ease-in-out;
      }
      .dot:nth-child(2) {
        animation-delay: 0.133s;
      }
      .dot:nth-child(3) {
        animation-delay: 0.266s;
      }
      .label {
        margin-left: 0.25rem;
      }
      @keyframes pulse {
        0%,
        80%,
        100% {
          opacity: 0.35;
          transform: scale(1);
        }
        40% {
          opacity: 1;
          transform: scale(1.25);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dot {
          animation: none;
          opacity: 0.7;
        }
      }
      .stall-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0.9rem;
        background: #fef9c3;
        border: 1px solid #fde68a;
        border-radius: 8px;
        color: #713f12;
      }
      .stall-body {
        margin: 0;
        flex: 1 1 auto;
        font-size: 14px;
      }
      .stall-cancel {
        background: #b45309;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 0.4rem 0.8rem;
        cursor: pointer;
        font-weight: 600;
      }
    `,
  ],
})
export class StreamingIndicatorComponent {
  readonly label = input<string>('Thinking…');
  readonly stalled = input<boolean>(false);
  readonly stallBody = PRODUCT_COPY.streamStallPromptBody;
  readonly cancelLabel = PRODUCT_COPY.streamStallCancelLabel;
  readonly cancelClicked = output<void>();
}
