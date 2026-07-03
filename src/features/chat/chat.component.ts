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
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

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
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { StartNewSessionService } from '../settings/start-new-session.service';
import { AppSettingsService } from '../../shared/app-settings/app-settings.service';
import {
  createStreamingTypewriterController,
  type StreamingTypewriterController,
} from '../../shared/streaming-typewriter/streaming-typewriter';

const LAST_ACTIVE_SOLO_KEY: StorageKey = 'settings:last-active-solo:v1';

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
    ModeSwitcherComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
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
  private readonly startNewSession = inject(StartNewSessionService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly streamDisplay: StreamingTypewriterController =
    createStreamingTypewriterController(this.destroyRef);

  readonly settingsOpen = this.appSettings.open;
  readonly settingsAutoOpen = this.appSettings.autoOpenMode;
  private queuedText: string | null = null;
  /** Bumped on persona switch so stale send callbacks cannot reload the wrong thread. */
  private sendGeneration = 0;
  /** Guards async loadThread/reloadThread against out-of-order persona switches. */
  private threadLoadGeneration = 0;

  readonly sendAriaLabel = sendButtonLabel;
  readonly capReachedHint = PRODUCT_COPY.capReachedInputHint;
  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);

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

  readonly starterQuestions = computed(
    () => PERSONA_REGISTRY[this.activePersona()].starterQuestions,
  );

  readonly streamingBubble = computed<Message | null>(() => {
    if (this.orchestrator.activeStreamPersona() !== this.activePersona()) {
      return null;
    }
    const text = this.streamDisplay.displayed();
    const target = this.orchestrator.accumulatedText();
    const streaming =
      this.orchestrator.inFlightStream() || this.orchestrator.streamStalled();
    const catchingUp =
      target.length > 0 && text.length > 0 && text.length < target.length;

    if (!streaming && !catchingUp) return null;
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
        !this.streamDisplay.displayed()) ||
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
          this.sendGeneration += 1;
          this.threadLoadGeneration += 1;
          this.orchestrator.cancelInFlight();
          this.streamDisplay.reset();
          this.messages.set([]);
          this.draft.set('');
        }
        this.activePersona.set(persona);
        const loadGen = this.threadLoadGeneration;
        void this.loadThread(persona, loadGen);
      });

    this.startNewSession.sessionCleared$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sendGeneration += 1;
        this.threadLoadGeneration += 1;
        this.streamDisplay.reset();
        this.messages.set([]);
        this.draft.set('');
        const persona = this.activePersona();
        const loadGen = this.threadLoadGeneration;
        void this.seedGreeting(persona, loadGen);
      });

    this.streamDisplay.bind({
      target: () => this.orchestrator.accumulatedText(),
      streaming: () =>
        this.orchestrator.inFlightStream() || this.orchestrator.streamStalled(),
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
      this.streamDisplay.displayed();
      this.orchestrator.inFlightStream();
      requestAnimationFrame(() => {
        const el = this.messageListEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    // E6-S3 auto-open — the orchestrator fires this Subject whenever the
    // active provider has no saved key. Open the modal in auto-open mode and
    // queue the pending user message for re-dispatch on save.
    this.orchestrator.keyMissing$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.appSettings.openSettings({ auto: true });
      });

    this.appSettings.saved$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onSettingsSaved());

    this.appSettings.dismissed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((wasAuto) => this.onSettingsDismissed(wasAuto));

    // Track last-active-solo persona so the mode-switcher can restore it
    // when the user comes back from Ask-Both.
    effect(() => {
      const persona = this.activePersona();
      try {
        sessionStorage.setItem(LAST_ACTIVE_SOLO_KEY, persona);
      } catch {
        /* ignore */
      }
    });
  }


  onSettingsSaved(): void {
    const wasAuto = this.settingsAutoOpen();
    this.settingsAutoOpen.set(false);
    if (wasAuto && this.queuedText) {
      const text = this.queuedText;
      this.queuedText = null;
      const generation = ++this.sendGeneration;
      this.orchestrator
        .sendMessage(this.activePersona(), text)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          complete: () => {
            if (generation !== this.sendGeneration) return;
            void this.streamDisplay.drain().then(() => {
              if (generation !== this.sendGeneration) return;
              void this.reloadThread();
            });
          },
          error: () => {
            if (generation !== this.sendGeneration) return;
            void this.reloadThread();
          },
        });
    }
  }

  onSettingsDismissed(wasAuto = this.settingsAutoOpen()): void {
    this.settingsAutoOpen.set(false);
    if (wasAuto) {
      this.queuedText = null;
      void this.router.navigateByUrl('/');
    }
  }

  onStarterChip(question: string): void {
    if (this.inputDisabled()) return;
    this.draft.set(question);
    this.onSend();
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

    const generation = ++this.sendGeneration;
    this.orchestrator
      .sendMessage(this.activePersona(), text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          if (generation !== this.sendGeneration) return;
          void this.streamDisplay.drain().then(() => {
            if (generation !== this.sendGeneration) return;
            if (!this.orchestrator.pendingKeyMissing()) {
              this.queuedText = null;
            }
            void this.reloadThread();
          });
        },
        error: () => {
          if (generation !== this.sendGeneration) return;
          void this.reloadThread();
        },
      });
  }

  onCancel(): void {
    this.orchestrator.cancelInFlight();
    this.streamDisplay.reset();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  private async loadThread(
    forPersona: PersonaId,
    loadGen: number,
  ): Promise<void> {
    const key = this.threadKeyFor(forPersona);
    const thread = await this.storage.get<Thread>(key);
    if (!this.isLoadCurrent(forPersona, loadGen)) return;
    if (thread && thread.messages.length > 0) {
      this.messages.set([...thread.messages]);
    } else {
      await this.seedGreeting(forPersona, loadGen);
    }
  }

  private async reloadThread(): Promise<void> {
    const persona = this.activePersona();
    const loadGen = this.threadLoadGeneration;
    const thread = await this.storage.get<Thread>(this.threadKey());
    if (!this.isLoadCurrent(persona, loadGen)) return;
    if (thread) this.messages.set([...thread.messages]);
  }

  private isLoadCurrent(forPersona: PersonaId, loadGen: number): boolean {
    return (
      loadGen === this.threadLoadGeneration &&
      forPersona === this.activePersona()
    );
  }

  private async seedGreeting(
    forPersona: PersonaId,
    loadGen: number,
  ): Promise<void> {
    const greeting = PERSONA_REGISTRY[forPersona].greeting;
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      persona: forPersona,
      content: greeting,
      timestamp: Date.now(),
      status: 'complete',
    };
    const thread: Thread = {
      id: this.uuid(),
      scope: forPersona,
      messages: [msg],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: msg.timestamp,
      updatedAt: msg.timestamp,
    };
    await this.storage.set(this.threadKeyFor(forPersona), thread);
    if (!this.isLoadCurrent(forPersona, loadGen)) return;
    this.messages.set([msg]);
  }

  private threadKeyFor(persona: PersonaId): StorageKey {
    return persona === 'hitesh' ? 'chat:hitesh:v1' : 'chat:piyush:v1';
  }

  private threadKey(): StorageKey {
    return this.threadKeyFor(this.activePersona());
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}
