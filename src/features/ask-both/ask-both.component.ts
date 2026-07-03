import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
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
import { Router } from '@angular/router';

import type { PersonaId } from '../../domain/types/persona';
import type { Message, Thread } from '../../domain/types/message';
import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { buildBlendedComposition } from '../../personas/blended.prompt';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { StreamingIndicatorComponent } from '../../shared/streaming-indicator/streaming-indicator.component';
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { SettingsMenuEntryComponent } from '../settings/settings-menu-entry.component';
import { PersonaPickerDialogComponent } from '../persona-picker/persona-picker-dialog.component';
import { AskBothSequencerService } from './ask-both-sequencer.service';
import { AskBothModeService } from './ask-both-mode.service';
import { PersonaRoutingService } from '../../domain/key-vault/persona-routing.service';
import { AppSettingsService } from '../../shared/app-settings/app-settings.service';
import { BlendedPairService } from './blended-pair.service';
import {
  createStreamingTypewriterController,
  type StreamingTypewriterController,
} from '../../shared/streaming-typewriter/streaming-typewriter';

@Component({
  selector: 'app-ask-both',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    StreamingIndicatorComponent,
    ModeSwitcherComponent,
    SettingsMenuEntryComponent,
    PersonaPickerDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ask-both.component.html',
  styleUrls: ['./ask-both.component.scss'],
})
export class AskBothComponent implements OnDestroy {
  readonly sequencer = inject(AskBothSequencerService);
  readonly modeService = inject(AskBothModeService);
  readonly blendedPair = inject(BlendedPairService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly storage = inject(STORAGE_PORT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly streamDisplay: StreamingTypewriterController =
    createStreamingTypewriterController(this.destroyRef);

  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);
  readonly pickerOpen = signal(false);
  private queuedText: string | null = null;
  readonly bridgeMessage = this.sequencer.bridgeAnnouncement;
  readonly canKeepGoing = this.sequencer.canKeepGoing;

  @ViewChild('messageList') messageListEl?: ElementRef<HTMLDivElement>;

  readonly bannerLabel = PRODUCT_COPY.askBothBannerLabel;
  readonly askBothGreeting = PRODUCT_COPY.askBothGreeting;
  readonly askBothGreetingHint = PRODUCT_COPY.askBothGreetingHint;
  readonly inputPlaceholder = PRODUCT_COPY.askBothInputPlaceholder;
  readonly starterQuestions = PRODUCT_COPY.askBothStarterQuestions;
  readonly keepGoingLabel = PRODUCT_COPY.keepGoingButtonLabel;
  readonly sendLabel = PRODUCT_COPY.askBothSendButtonLabel;

  readonly pairAttribution = computed(() =>
    buildBlendedComposition(
      this.blendedPair.personaA(),
      this.blendedPair.personaB(),
    ).attributionLabel,
  );

  readonly streamingBubble = computed<Message | null>(() => {
    const text = this.streamDisplay.displayed();
    const target = this.sequencer.currentText();
    const streaming = this.sequencer.inFlight();
    const catchingUp =
      target.length > 0 && text.length > 0 && text.length < target.length;

    if (!streaming && !catchingUp) return null;
    if (!text) return null;

    const persona = this.sequencer.activePersona();
    if (persona) {
      return {
        id: 'streaming',
        role: 'assistant',
        persona,
        content: text,
        timestamp: Date.now(),
        status: 'streaming',
      };
    }

    return {
      id: 'streaming',
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
      status: 'streaming',
      attributionLabel: this.pairAttribution(),
    };
  });

  readonly showStreamingIndicator = computed(
    () => this.sequencer.inFlight() && !this.streamDisplay.displayed(),
  );

  constructor() {
    this.renderer.addClass(this.document.body, 'conversation-view');
    this.renderer.setAttribute(this.document.body, 'data-mode', 'ask-both');
    void this.loadThread();

    this.streamDisplay.bind({
      target: () => this.sequencer.currentText(),
      streaming: () => this.sequencer.inFlight(),
    });

    this.sequencer.threadUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.sequencer.inFlight()) return;
        void this.reloadThread();
      });

    this.sequencer.keyMissing$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.appSettings.openSettings({ auto: true });
      });

    this.appSettings.saved$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ wasAuto }) => {
        if (wasAuto && this.queuedText) {
          const text = this.queuedText;
          this.queuedText = null;
          this.dispatchSend(text);
        }
      });

    this.appSettings.dismissed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.queuedText = null;
      });

    effect(() => {
      this.messages();
      this.streamDisplay.displayed();
      this.sequencer.inFlight();
      requestAnimationFrame(() => {
        const el = this.messageListEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'conversation-view');
    this.renderer.removeAttribute(this.document.body, 'data-mode');
  }

  openBlendPicker(): void {
    if (this.sequencer.inFlight()) return;
    this.pickerOpen.set(true);
  }

  onPersonaPicked(persona: PersonaId): void {
    void this.router.navigate(['/chat', persona]);
  }

  onBlendPairConfirmed(pair: { a: PersonaId; b: PersonaId }): void {
    this.blendedPair.setPair(pair.a, pair.b);
  }

  streamingLabel(): string {
    if (this.modeService.get() === 'blended') {
      return PRODUCT_COPY.streamingIndicatorAskBothBlended(this.pairAttribution());
    }
    const persona = this.sequencer.activePersona();
    if (persona === 'musk') return PRODUCT_COPY.streamingIndicatorAskBothA;
    if (persona === 'jobs') return PRODUCT_COPY.streamingIndicatorAskBothB;
    return 'Preparing…';
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text || this.sequencer.inFlight()) return;

    if (!this.personaRouting.hasAnyProviderKey()) {
      this.queuedText = text;
      this.appSettings.openSettings({ auto: true });
      return;
    }

    this.dispatchSend(text);
  }

  onStarterChip(question: string): void {
    if (this.sequencer.inFlight()) return;
    this.draft.set(question);
    this.onSend();
  }

  private dispatchSend(text: string): void {
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
    void this.sequencer
      .askBoth(text)
      .then(() => this.streamDisplay.drain())
      .then(() => void this.reloadThread())
      .catch(() => void this.reloadThread());
  }

  onKeepGoing(): void {
    if (this.sequencer.inFlight()) return;
    void this.sequencer
      .keepGoing()
      .then(() => this.streamDisplay.drain())
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

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}
