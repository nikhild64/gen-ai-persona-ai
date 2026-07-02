import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * DESIGN.md.Components.streaming-indicator — full-width × 32px indicator that
 * renders while an in-flight stream has not yet produced its first token. The
 * 3-dot pulse is disabled under `prefers-reduced-motion` via CSS media query.
 */
@Component({
  selector: 'app-streaming-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="indicator" role="status" aria-live="polite">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="label">{{ label() }}</span>
    </div>
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
    `,
  ],
})
export class StreamingIndicatorComponent {
  readonly label = input<string>('Thinking…');
}
