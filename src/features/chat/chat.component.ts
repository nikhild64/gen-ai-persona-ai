import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Renderer2,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
import { PersonaSwitcherComponent } from '../persona-switcher/persona-switcher.component';
import { SettingsModalComponent } from '../settings/settings-modal.component';
import { KeyStatusBadgeComponent } from '../settings/key-status-badge.component';
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { Router } from '@angular/router';

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
    PersonaSwitcherComponent,
    SettingsModalComponent,
    KeyStatusBadgeComponent,
    ModeSwitcherComponent,
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
          <app-persona-switcher
            [activePersona]="activePersona()"
            [disabled]="orchestrator.inFlightStream()"
          />
          <app-key-status-badge
            [persona]="activePersona()"
            (clicked)="openSettings()"
          />
          <app-mode-switcher
            activeMode="solo"
            [disabled]="orchestrator.inFlightStream()"
          />
        </div>
      </header>

      <app-settings-modal
        [(open)]="settingsOpen"
        [(autoOpenMode)]="settingsAutoOpen"
        (closedWithSave)="onSettingsSaved()"
        (closedWithoutSave)="onSettingsDismissed()"
      />

      <div class="message-list" #messageList>
        @for (msg of messages(); track msg.id) {
        <app-message-bubble [message]="msg" />
        } @if (streamingBubble(); as streaming) {
        <app-message-bubble [message]="streaming" />
        } @if (showStreamingIndicator()) {
        <app-streaming-indicator
          [label]="streamingLabel()"
          [stalled]="orchestrator.streamStalled()"
          (cancelClicked)="onCancel()"
        />
        }
      </div>

      <form class="input-area" (ngSubmit)="onSend()">
        <textarea
          #inputEl
          rows="2"
          [attr.aria-label]="inputAriaLabel()"
          [placeholder]="inputPlaceholder()"
          [disabled]="inputDisabled()"
          [(ngModel)]="draft"
          name="draft"
          (keydown)="onKeyDown($event)"
        ></textarea>
        @if (orchestrator.capReached()) {
        <p class="cap-hint">{{ capReachedHint }}</p>
        } @if (retryHint(); as hint) {
        <div class="retry-hint" role="alert">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          <span>{{ hint }}</span>
        </div>
        }
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
            [disabled]="!draft().trim() || inputDisabled()"
          >
            Send
          </button>
          } @if (streamStalledMessage()) {
          <span class="stall-hint">{{ streamStalledMessage() }}</span>
          }
          <app-settings-menu-entry class="menu-entry-slot" />
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
        max-width: 1024px;
        margin: 0 auto;
        padding: 0 1rem;
        gap: 1rem;
      }
      /* Persona theme vars come from src/shared/styles/_personas.scss via
         [data-persona] on this shell. The full-viewport background gradient
         is driven by body[data-persona] (set from the component constructor)
         so it fills the entire window, not just the max-width column. */
      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        gap: 0.75rem;
        flex-wrap: wrap;
        row-gap: 0.5rem;
        min-height: 60px;
      }
      .persona-id {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }
      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid var(--persona-accent, #94a3b8);
        object-fit: cover;
        background: #f5f5f4;
        flex-shrink: 0;
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
      .header-slots {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .gear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        min-width: 36px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.7);
        color: #292524;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        transition:
          background 0.15s ease,
          border-color 0.15s ease,
          transform 0.15s ease;
      }
      .gear:hover {
        background: white;
        border-color: var(--persona-accent, #d6d3d1);
        transform: rotate(30deg);
      }
      .gear:focus-visible {
        outline: 2px solid var(--persona-accent, #0ea5e9);
        outline-offset: 2px;
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
        border-top: 1px solid rgba(0, 0, 0, 0.08);
      }
      .input-area textarea {
        width: 100%;
        padding: 0.6rem 0.75rem;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        font: inherit;
        resize: vertical;
        min-height: 60px;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(4px);
      }
      .input-area textarea:disabled {
        background: rgba(245, 245, 244, 0.6);
        color: #78716c;
      }
      .input-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .menu-entry-slot {
        margin-left: auto;
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
      .cap-hint {
        margin: 0;
        color: #57534e;
        font-size: 12px;
      }
      .retry-hint {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        padding: 0.55rem 0.75rem;
        background: rgba(254, 243, 199, 0.85);
        border: 1px solid rgba(217, 119, 6, 0.5);
        border-radius: 8px;
        color: #92400e;
        font-size: 13px;
        font-weight: 500;
      }
      .retry-hint .pi {
        font-size: 15px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class ChatComponent {
  readonly orchestrator = inject(ChatOrchestrator);
  private readonly announcer = inject(AriaAnnouncerService);
  private readonly storage = inject(STORAGE_PORT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  readonly settingsOpen = signal(false);
  readonly settingsAutoOpen = signal(false);
  private queuedText: string | null = null;

  readonly sendAriaLabel = sendButtonLabel;
  readonly capReachedHint = PRODUCT_COPY.capReachedInputHint;
  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);
  /** Typewriter-revealed slice of `accumulatedText` — trails the raw stream
   * so long provider chunks don't dump on-screen all at once. */
  readonly displayedStreamingText = signal('');

  readonly inputDisabled = computed(
    () =>
      this.orchestrator.inFlightStream() || this.orchestrator.capReached(),
  );

  readonly retryHint = computed(() => {
    const seconds = this.orchestrator.retryAfterSec();
    return seconds === null ? null : PRODUCT_COPY.retryAfterHint(seconds);
  });

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
    const text = this.displayedStreamingText();
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
    () =>
      (this.orchestrator.inFlightStream() &&
        !this.orchestrator.accumulatedText()) ||
      this.orchestrator.streamStalled(),
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
    // Route reuse: `data` observable updates when navigation swaps persona on
    // the same ChatComponent instance (Angular re-uses components across
    // /chat/hitesh ↔ /chat/piyush by default).
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const persona = (data?.['persona'] as PersonaId | undefined) ?? 'hitesh';
        if (persona !== this.activePersona()) {
          this.orchestrator.cancelInFlight();
        }
        this.activePersona.set(persona);
        void this.loadThread();
      });

    // Sync body[data-persona] so the full-viewport gradient in styles.scss
    // tracks the active persona. Effect fires on activePersona() changes and
    // registers cleanup so navigating away restores the neutral surface.
    effect((onCleanup) => {
      const persona = this.activePersona();
      this.renderer.setAttribute(this.document.body, 'data-persona', persona);
      onCleanup(() =>
        this.renderer.removeAttribute(this.document.body, 'data-persona'),
      );
    });

    // Announce completed assistant messages to screen readers per AD-20.
    effect(() => {
      if (this.orchestrator.inFlightStream()) return;
      const text = this.orchestrator.accumulatedText();
      if (text) {
        this.announcer.announce(`${this.personaName()} says: ${text}`);
      }
    });

    // Auto-scroll message list to the bottom whenever a new message lands
    // OR the current streaming response gains tokens. rAF defers the scroll
    // until after Angular flushes the DOM update.
    effect(() => {
      this.messages();
      this.displayedStreamingText();
      this.orchestrator.inFlightStream();
      requestAnimationFrame(() => {
        const el = this.messageListEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    // Typewriter reveal — the raw `accumulatedText` signal can jump by 100+
    // chars per delta with providers like Gemini, so we trail it via an
    // interval that reveals a smoothly scaling chunk each tick. When the
    // stream ends we snap `displayedStreamingText` to the final value so it
    // matches the persisted message before `reloadThread` swaps it in.
    effect((onCleanup) => {
      const inFlight = this.orchestrator.inFlightStream();

      if (!inFlight) {
        this.displayedStreamingText.set(
          untracked(() => this.orchestrator.accumulatedText()),
        );
        return;
      }

      this.displayedStreamingText.set('');
      const intervalId = setInterval(() => {
        const target = this.orchestrator.accumulatedText();
        const current = this.displayedStreamingText();
        if (current.length >= target.length) return;
        const remaining = target.length - current.length;
        const perTick = Math.max(1, Math.ceil(remaining / 12));
        this.displayedStreamingText.set(
          target.slice(0, current.length + perTick),
        );
      }, 25);
      onCleanup(() => clearInterval(intervalId));
    });

    // E6-S3 auto-open — the orchestrator fires this Subject whenever the
    // active provider has no saved key. Open the modal in auto-open mode and
    // queue the pending user message for re-dispatch on save.
    this.orchestrator.keyMissing$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.settingsAutoOpen.set(true);
        this.settingsOpen.set(true);
      });

    // Track last-active-solo persona so the mode-switcher can restore it
    // when the user comes back from Ask-Both.
    effect(() => {
      const persona = this.activePersona();
      try {
        sessionStorage.setItem('last-active-solo', persona);
      } catch {
        /* ignore */
      }
    });
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  onSettingsSaved(): void {
    const wasAuto = this.settingsAutoOpen();
    this.settingsAutoOpen.set(false);
    if (wasAuto && this.queuedText) {
      const text = this.queuedText;
      this.queuedText = null;
      this.orchestrator
        .sendMessage(this.activePersona(), text)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          complete: () => void this.reloadThread(),
          error: () => void this.reloadThread(),
        });
    }
  }

  onSettingsDismissed(): void {
    const wasAuto = this.settingsAutoOpen();
    this.settingsAutoOpen.set(false);
    if (wasAuto) {
      this.queuedText = null;
      void this.router.navigateByUrl('/');
    }
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text || this.orchestrator.inFlightStream()) return;

    this.queuedText = text; // E6-S3 auto-open flow re-dispatches after save

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
        complete: () => {
          this.queuedText = null;
          void this.reloadThread();
        },
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
