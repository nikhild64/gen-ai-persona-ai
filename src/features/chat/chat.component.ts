import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { ChatOrchestrator } from '../../domain/chat/chat-orchestrator.service';
import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import type { PersonaId } from '../../domain/types/persona';
import type { Message, Thread } from '../../domain/types/message';
import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from '../../personas/persona.registry';
import type { StorageKey } from '../../config/storage-keys';
import { PRODUCT_COPY } from '../../config/product-copy';
import {
  chatInputLabel,
  sendButtonLabel,
} from '../../config/aria-labels';

import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { StreamingIndicatorComponent } from '../../shared/streaming-indicator/streaming-indicator.component';
import { AriaAnnouncerService } from '../../shared/aria-announcer/aria-announcer.component';
import { SettingsMenuEntryComponent } from '../settings/settings-menu-entry.component';

/**
 * Solo-mode chat surface. `activePersona` is currently hard-wired via route
 * data (E4-S1 will parameterise via `/chat/:persona`). Hardcoded greeting
 * lands as the first assistant Message on empty threads; subsequent messages
 * flow through `ChatOrchestrator.sendMessage`.
 */
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    StreamingIndicatorComponent,
    SettingsMenuEntryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="chat-shell"
      [attr.data-persona]="activePersona()"
    >
      <header class="chat-header">
        <div class="persona-id">
          <img
            class="avatar"
            [src]="'/images/' + activePersona() + '.png'"
            [alt]="personaName() + ' avatar'"
            width="40"
            height="40"
          />
          <div class="persona-meta">
            <h1>{{ personaName() }}</h1>
            <p class="tagline">{{ personaTagline() }}</p>
          </div>
        </div>
        <div class="header-slots">
          <!-- E4-S1 persona-switcher, E9-S1 mode-switcher,
               E6-S3 key-status-badge, E6-S3 settings-gear land here -->
        </div>
      </header>

      <div class="message-list" #messageList>
        @for (msg of messages(); track msg.id) {
        <app-message-bubble [message]="msg" />
        } @if (streamingBubble(); as streaming) {
        <app-message-bubble [message]="streaming" />
        } @if (showStreamingIndicator()) {
        <app-streaming-indicator [label]="streamingLabel()" />
        }
      </div>

      <form class="input-area" (ngSubmit)="onSend()">
        <textarea
          #inputEl
          rows="2"
          [attr.aria-label]="inputAriaLabel()"
          [placeholder]="inputPlaceholder()"
          [disabled]="orchestrator.inFlightStream()"
          [(ngModel)]="draft"
          name="draft"
          (keydown)="onKeyDown($event)"
        ></textarea>
        <div class="input-controls">
          @if (orchestrator.inFlightStream()) {
          <button type="button" class="cancel-btn" (click)="onCancel()">
            Cancel
          </button>
          } @else {
          <button
            type="submit"
            class="send-btn"
            [attr.aria-label]="sendAriaLabel"
            [disabled]="!draft().trim()"
          >
            Send
          </button>
          } @if (streamStalledMessage()) {
          <span class="stall-hint">{{ streamStalledMessage() }}</span>
          }
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .chat-shell {
        display: grid;
        grid-template-rows: auto 1fr auto;
        height: calc(100vh - 3rem);
        max-width: 960px;
        margin: 0 auto;
        padding: 0 1rem;
        gap: 1rem;
      }
      /* AD-17 persona-scoped theme vars */
      .chat-shell[data-persona='hitesh'] {
        --persona-accent: #d97706;
        --persona-bubble-bg: #fffbeb;
        --persona-code-block-emphasis: default;
      }
      .chat-shell[data-persona='piyush'] {
        --persona-accent: #2563eb;
        --persona-bubble-bg: #eff6ff;
        --persona-code-block-emphasis: foregrounded;
      }
      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid #e7e5e4;
      }
      .persona-id {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid var(--persona-accent, #94a3b8);
        object-fit: cover;
        background: #f5f5f4;
      }
      .persona-meta h1 {
        font-size: 18px;
        margin: 0;
      }
      .persona-meta .tagline {
        font-size: 12px;
        color: #57534e;
        margin: 0;
      }
      .message-list {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 0.5rem 0;
      }
      .input-area {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem 0 1rem;
        border-top: 1px solid #e7e5e4;
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
      .input-area textarea:disabled {
        background: #f5f5f4;
        color: #78716c;
      }
      .input-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .send-btn,
      .cancel-btn {
        padding: 0.55rem 1.1rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid var(--persona-accent, #292524);
        background: var(--persona-accent, #292524);
        color: white;
      }
      .send-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .cancel-btn {
        background: transparent;
        color: var(--persona-accent, #292524);
      }
      .stall-hint {
        color: #b45309;
        font-size: 13px;
      }
    `,
  ],
})
export class ChatComponent {
  readonly orchestrator = inject(ChatOrchestrator);
  private readonly announcer = inject(AriaAnnouncerService);
  private readonly storage = inject(STORAGE_PORT);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly sendAriaLabel = sendButtonLabel;
  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);

  @ViewChild('messageList') messageListEl?: ElementRef<HTMLDivElement>;

  readonly activePersona = signal<PersonaId>('hitesh');

  readonly personaName = computed(() => personaDisplayName(this.activePersona()));
  readonly personaTagline = computed(() => {
    const p = this.activePersona();
    return p === 'hitesh'
      ? PRODUCT_COPY.landingHiteshTagline
      : PRODUCT_COPY.landingPiyushTagline;
  });

  readonly inputPlaceholder = computed(
    () => PERSONA_REGISTRY[this.activePersona()].inputPlaceholder,
  );
  readonly inputAriaLabel = computed(() => chatInputLabel(this.activePersona()));

  readonly streamingBubble = computed<Message | null>(() => {
    if (!this.orchestrator.inFlightStream() && !this.orchestrator.streamStalled()) {
      return null;
    }
    const text = this.orchestrator.accumulatedText();
    if (!text) return null;
    const id = this.orchestrator.activeAssistantMessageId() ?? 'streaming';
    return {
      id,
      role: 'assistant',
      persona: this.activePersona(),
      content: text,
      timestamp: Date.now(),
      status: 'streaming',
    };
  });

  readonly showStreamingIndicator = computed(
    () => this.orchestrator.inFlightStream() && !this.orchestrator.accumulatedText(),
  );

  readonly streamingLabel = computed(
    () => PRODUCT_COPY.streamingIndicatorSolo(this.personaName()),
  );

  readonly streamStalledMessage = computed(() =>
    this.orchestrator.streamStalled()
      ? PRODUCT_COPY.streamStallPromptBody
      : '',
  );

  constructor() {
    const persona = (this.route.snapshot.data?.['persona'] as PersonaId | undefined) ??
      (this.route.snapshot.paramMap.get('persona') as PersonaId | null) ?? 'hitesh';
    this.activePersona.set(persona);

    // Load persisted thread + seed hardcoded greeting on empty thread.
    void this.loadThread();

    // Announce completed assistant messages to screen readers per AD-20.
    effect(() => {
      if (this.orchestrator.inFlightStream()) return;
      const text = this.orchestrator.accumulatedText();
      if (text) {
        this.announcer.announce(`${this.personaName()} says: ${text}`);
      }
    });
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text || this.orchestrator.inFlightStream()) return;

    this.messages.update((m) => [
      ...m,
      {
        id: this.uuid(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      },
    ]);
    this.draft.set('');

    this.orchestrator
      .sendMessage(this.activePersona(), text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => void this.reloadThread(),
        error: () => void this.reloadThread(),
      });
  }

  onCancel(): void {
    this.orchestrator.cancelInFlight();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  private async loadThread(): Promise<void> {
    const thread = await this.storage.get<Thread>(this.threadKey());
    if (thread && thread.messages.length > 0) {
      this.messages.set([...thread.messages]);
    } else {
      await this.seedGreeting();
    }
  }

  private async reloadThread(): Promise<void> {
    const thread = await this.storage.get<Thread>(this.threadKey());
    if (thread) this.messages.set([...thread.messages]);
  }

  private async seedGreeting(): Promise<void> {
    const persona = this.activePersona();
    const greeting = PERSONA_REGISTRY[persona].greeting;
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      persona,
      content: greeting,
      timestamp: Date.now(),
      status: 'complete',
    };
    const thread: Thread = {
      id: this.uuid(),
      scope: persona,
      messages: [msg],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: msg.timestamp,
      updatedAt: msg.timestamp,
    };
    await this.storage.set(this.threadKey(), thread);
    this.messages.set([msg]);
  }

  private threadKey(): StorageKey {
    return this.activePersona() === 'hitesh'
      ? 'chat:hitesh:v1'
      : 'chat:piyush:v1';
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}
