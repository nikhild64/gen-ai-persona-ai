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

import type { PersonaId } from '../../domain/types/persona';
import { PERSONA_IDS } from '../../domain/types/persona';
import type { Message, Thread } from '../../domain/types/message';
import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { buildBlendedComposition } from '../../personas/blended.prompt';
import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from '../../personas/persona.registry';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { StreamingIndicatorComponent } from '../../shared/streaming-indicator/streaming-indicator.component';
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { KeyStatusBadgeComponent } from '../settings/key-status-badge.component';
import { SettingsModalComponent } from '../settings/settings-modal.component';
import { SettingsMenuEntryComponent } from '../settings/settings-menu-entry.component';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);
  readonly settingsOpen = signal(false);
  readonly bridgeMessage = this.sequencer.bridgeAnnouncement;
  readonly canKeepGoing = this.sequencer.canKeepGoing;

  readonly personaOptions = PERSONA_IDS;

  @ViewChild('messageList') messageListEl?: ElementRef<HTMLDivElement>;

  readonly bannerLabel = PRODUCT_COPY.askBothBannerLabel;
  readonly askBothGreeting = PRODUCT_COPY.askBothGreeting;
  readonly askBothGreetingHint = PRODUCT_COPY.askBothGreetingHint;
  readonly inputPlaceholder = PRODUCT_COPY.askBothInputPlaceholder;
  readonly keepGoingLabel = PRODUCT_COPY.keepGoingButtonLabel;
  readonly pairLabelA = PRODUCT_COPY.askBothPairLabelA;
  readonly pairLabelB = PRODUCT_COPY.askBothPairLabelB;

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

  personaLabel(p: PersonaId): string {
    return personaDisplayName(p);
  }

  personaFullName(p: PersonaId): string {
    return PERSONA_REGISTRY[p].fullDisplayName;
  }

  onPersonaAChange(value: string): void {
    if (this.isPersonaId(value)) {
      this.blendedPair.setPersonaA(value);
    }
  }

  onPersonaBChange(value: string): void {
    if (this.isPersonaId(value)) {
      this.blendedPair.setPersonaB(value);
    }
  }

  streamingLabel(): string {
    if (this.modeService.get() === 'blended') {
      return PRODUCT_COPY.streamingIndicatorAskBothBlended(this.pairAttribution());
    }
    const persona = this.sequencer.activePersona();
    if (persona === 'hitesh') return PRODUCT_COPY.streamingIndicatorAskBothA;
    if (persona === 'piyush') return PRODUCT_COPY.streamingIndicatorAskBothB;
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

  private isPersonaId(value: string): value is PersonaId {
    return (this.personaOptions as readonly string[]).includes(value);
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
