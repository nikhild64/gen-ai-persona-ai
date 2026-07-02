import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { Message, Thread } from '../../domain/types/message';
import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { StreamingIndicatorComponent } from '../../shared/streaming-indicator/streaming-indicator.component';
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { AskBothSequencerService } from './ask-both-sequencer.service';

/**
 * FR-26/FR-27/FR-30 Ask-Both surface. The container carries
 * `[data-mode="ask-both"]` per AD-17 to switch chrome to neutral. Message
 * bubbles carry `[data-persona]` individually (per E4-S2 HostBinding), so
 * Hitesh and Piyush retain their own theming inside a neutral room.
 *
 * E9-S1 lands the shell + joint greeting. E9-S2 wired the sequencer service.
 * E9-S3 adds keep-going + bridge announcement. E9-S4 layers parallel mode.
 */
@Component({
  selector: 'app-ask-both',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    StreamingIndicatorComponent,
    ModeSwitcherComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="room" data-mode="ask-both">
      <header class="banner">
        <h2>{{ bannerLabel }}</h2>
        <app-mode-switcher
          activeMode="ask-both"
          [disabled]="sequencer.inFlight()"
          (switched)="onModeSwitched()"
        />
      </header>

      <div class="message-list">
        @if (messages().length === 0) {
        <div class="joint-greeting" role="note">
          <p class="body">{{ askBothGreeting }}</p>
          <p class="hint">{{ askBothGreetingHint }}</p>
        </div>
        }
        @for (msg of messages(); track msg.id) {
        <app-message-bubble [message]="msg" />
        } @if (sequencer.currentStreaming(); as streaming) {
        <app-message-bubble [message]="streaming" />
        } @if (bridgeMessage(); as bridge) {
        <div class="bridge" role="note">{{ bridge }}</div>
        } @if (sequencer.inFlight() && !sequencer.currentStreaming()) {
        <app-streaming-indicator [label]="streamingLabel()" />
        } @if (canKeepGoing()) {
        <button
          type="button"
          class="keep-going-btn"
          (click)="onKeepGoing()"
          [disabled]="sequencer.inFlight()"
        >
          {{ keepGoingLabel }}
        </button>
        }
      </div>

      <form class="input-area" (ngSubmit)="onSend()">
        <textarea
          rows="2"
          [placeholder]="inputPlaceholder"
          [disabled]="sequencer.inFlight()"
          [(ngModel)]="draft"
          name="draft"
          (keydown)="onKeyDown($event)"
        ></textarea>
        <div class="input-controls">
          @if (sequencer.inFlight()) {
          <button
            type="button"
            class="cancel-btn"
            (click)="sequencer.cancel()"
          >
            Cancel
          </button>
          } @else {
          <button
            type="submit"
            class="send-btn"
            [disabled]="!draft().trim()"
          >
            Ask both
          </button>
          }
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .room {
        display: grid;
        grid-template-rows: auto 1fr auto;
        height: calc(100vh - 3rem);
        max-width: 960px;
        margin: 0 auto;
        padding: 0 1rem;
        gap: 1rem;
        background: #fafaf9;
      }
      .banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid #d6d3d1;
      }
      .banner h2 {
        margin: 0;
        font-size: 18px;
        color: #292524;
      }
      .message-list {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 0.5rem 0;
      }
      .joint-greeting {
        background: #f5f5f4;
        border: 1px solid #d6d3d1;
        border-radius: 12px;
        padding: 1rem 1.1rem;
      }
      .joint-greeting .body {
        margin: 0 0 0.5rem;
        line-height: 1.55;
        color: #1c1917;
      }
      .joint-greeting .hint {
        margin: 0;
        color: #57534e;
        font-size: 13px;
      }
      .bridge {
        text-align: center;
        color: #78716c;
        font-size: 13px;
        font-style: italic;
      }
      .keep-going-btn {
        align-self: center;
        background: transparent;
        border: 1px solid #292524;
        color: #292524;
        padding: 0.5rem 1rem;
        border-radius: 999px;
        cursor: pointer;
        font-weight: 600;
      }
      .keep-going-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .input-area {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem 0 1rem;
        border-top: 1px solid #d6d3d1;
      }
      .input-area textarea {
        width: 100%;
        padding: 0.6rem 0.75rem;
        border: 1px solid #d6d3d1;
        border-radius: 8px;
        font: inherit;
        resize: vertical;
        min-height: 60px;
      }
      .input-controls {
        display: flex;
        gap: 0.5rem;
      }
      .send-btn,
      .cancel-btn {
        padding: 0.55rem 1.1rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid #292524;
      }
      .send-btn {
        background: #292524;
        color: white;
      }
      .cancel-btn {
        background: transparent;
        color: #292524;
      }
    `,
  ],
})
export class AskBothComponent {
  readonly sequencer = inject(AskBothSequencerService);
  private readonly storage = inject(STORAGE_PORT);
  private readonly destroyRef = inject(DestroyRef);

  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);
  readonly bridgeMessage = this.sequencer.bridgeAnnouncement;
  readonly canKeepGoing = this.sequencer.canKeepGoing;

  readonly bannerLabel = PRODUCT_COPY.askBothBannerLabel;
  readonly askBothGreeting = PRODUCT_COPY.askBothGreeting;
  readonly askBothGreetingHint = PRODUCT_COPY.askBothGreetingHint;
  readonly inputPlaceholder = PRODUCT_COPY.askBothInputPlaceholder;
  readonly keepGoingLabel = PRODUCT_COPY.keepGoingButtonLabel;

  constructor() {
    void this.loadThread();
  }

  streamingLabel(): string {
    const persona = this.sequencer.activePersona();
    if (persona === 'hitesh') return PRODUCT_COPY.streamingIndicatorAskBothA;
    if (persona === 'piyush') return PRODUCT_COPY.streamingIndicatorAskBothB;
    return 'Preparing…';
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text || this.sequencer.inFlight()) return;
    this.draft.set('');
    this.sequencer
      .askBoth(text)
      .then(() => void this.reloadThread())
      .catch(() => void this.reloadThread());
  }

  onKeepGoing(): void {
    if (this.sequencer.inFlight()) return;
    this.sequencer
      .keepGoing()
      .then(() => void this.reloadThread())
      .catch(() => void this.reloadThread());
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  onModeSwitched(): void {
    /* mode-switcher performs the navigation itself. */
  }

  private async loadThread(): Promise<void> {
    const t = await this.storage.get<Thread>('chat:ask-both:v1');
    this.messages.set(t?.messages ?? []);
  }

  private async reloadThread(): Promise<void> {
    const t = await this.storage.get<Thread>('chat:ask-both:v1');
    if (t) this.messages.set([...t.messages]);
  }
}
