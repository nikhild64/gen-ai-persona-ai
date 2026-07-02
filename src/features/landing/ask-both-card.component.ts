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
  template: `
    <a
      class="ask-both-card"
      data-mode="ask-both"
      [routerLink]="['/chat', 'ask-both']"
      aria-label="Ask both Hitesh and Piyush together"
    >
      <div class="avatar-stack">
        <img
          src="/images/hitesh.png"
          alt=""
          width="96"
          height="96"
          class="avatar avatar-hitesh"
        />
        <img
          src="/images/piyush.png"
          alt=""
          width="96"
          height="96"
          class="avatar avatar-piyush"
        />
      </div>
      <div class="body">
        <h2>Ask both</h2>
        <p class="tagline">
          Get Hitesh's story-first take and Piyush's structured breakdown —
          back-to-back on the same question.
        </p>
      </div>
      <span class="cta">Ask both together</span>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ask-both-card {
        display: grid;
        grid-template-columns: 128px 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1.1rem 1.3rem;
        border-radius: 14px;
        border: 1px solid rgba(0, 0, 0, 0.06);
        background:
          radial-gradient(
            ellipse 70% 60% at 12% 0%,
            rgba(253, 224, 138, 0.45) 0%,
            rgba(253, 224, 138, 0) 65%
          ),
          radial-gradient(
            ellipse 70% 60% at 88% 100%,
            rgba(191, 219, 254, 0.55) 0%,
            rgba(191, 219, 254, 0) 65%
          ),
          linear-gradient(135deg, #fffcf1 0%, #fdfaf3 45%, #f4f7fe 55%, #eff3ff 100%);
        backdrop-filter: blur(8px);
        text-decoration: none;
        color: #1c1917;
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease,
          border-color 0.15s ease;
        min-height: 160px;
      }
      .ask-both-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
        border-color: rgba(0, 0, 0, 0.12);
      }
      .ask-both-card:focus-visible {
        outline: 2px solid #292524;
        outline-offset: 2px;
      }
      .avatar-stack {
        position: relative;
        width: 128px;
        height: 96px;
      }
      .avatar {
        position: absolute;
        top: 0;
        width: 96px;
        height: 96px;
        border-radius: 50%;
        object-fit: cover;
        background: #f5f5f4;
        border: 3px solid #ffffff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
      }
      .avatar-hitesh {
        left: 0;
        border-color: #fef3c7;
        z-index: 1;
      }
      .avatar-piyush {
        left: 40px;
        border-color: #dbeafe;
        opacity: 0.55;
        z-index: 2;
        transition: opacity 0.2s ease;
      }
      .ask-both-card:hover .avatar-piyush {
        opacity: 0.85;
      }
      .body h2 {
        margin: 0 0 0.35rem;
        font-size: 22px;
      }
      .tagline {
        margin: 0;
        color: #44403c;
        line-height: 1.45;
      }
      .cta {
        justify-self: end;
        padding: 0.55rem 1.1rem;
        border-radius: 999px;
        background: #1c1917;
        color: white;
        font-weight: 600;
      }
      @media (max-width: 720px) {
        .ask-both-card {
          grid-template-columns: 104px 1fr;
        }
        .avatar-stack {
          width: 104px;
          height: 72px;
        }
        .avatar {
          width: 72px;
          height: 72px;
        }
        .avatar-piyush {
          left: 32px;
        }
        .cta {
          grid-column: 1 / -1;
          justify-self: stretch;
          text-align: center;
        }
      }
    `,
  ],
})
export class AskBothCardComponent {}
