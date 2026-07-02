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
import { KeyStatusBadgeComponent } from '../settings/key-status-badge.component';
import { SettingsModalComponent } from '../settings/settings-modal.component';
import { SettingsMenuEntryComponent } from '../settings/settings-menu-entry.component';
import { PersonaPickerDialogComponent } from '../persona-picker/persona-picker-dialog.component';
import { AskBothSequencerService } from './ask-both-sequencer.service';
import { AskBothModeService } from './ask-both-mode.service';
import { BlendedPairService } from './blended-pair.service';

@Component({
  selector: 'app-ask-both',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    StreamingIndicatorComponent,
    ModeSwitcherComponent,
    KeyStatusBadgeComponent,
    SettingsModalComponent,
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
  private readonly storage = inject(STORAGE_PORT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);
  readonly settingsOpen = signal(false);
  readonly pickerOpen = signal(false);
  readonly bridgeMessage = this.sequencer.bridgeAnnouncement;
  readonly canKeepGoing = this.sequencer.canKeepGoing;

  @ViewChild('messageList') messageListEl?: ElementRef<HTMLDivElement>;

  readonly bannerLabel = PRODUCT_COPY.askBothBannerLabel;
  readonly askBothGreeting = PRODUCT_COPY.askBothGreeting;
  readonly askBothGreetingHint = PRODUCT_COPY.askBothGreetingHint;
  readonly inputPlaceholder = PRODUCT_COPY.askBothInputPlaceholder;
  readonly keepGoingLabel = PRODUCT_COPY.keepGoingButtonLabel;
  readonly sendLabel = PRODUCT_COPY.askBothSendButtonLabel;

  readonly pairAttribution = computed(() =>
    buildBlendedComposition(
      this.blendedPair.personaA(),
      this.blendedPair.personaB(),
    ).attributionLabel,
  );

  constructor() {
    this.renderer.setAttribute(this.document.body, 'data-mode', 'ask-both');
    void this.loadThread();

    this.sequencer.threadUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.reloadThread());

    effect(() => {
      this.messages();
      this.sequencer.currentStreaming();
      this.sequencer.inFlight();
      requestAnimationFrame(() => {
        const el = this.messageListEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnDestroy(): void {
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

  openSettings(): void {
    this.settingsOpen.set(true);
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
