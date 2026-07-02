import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  Renderer2,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Message, Thread } from '../../domain/types/message';
import { STORAGE_PORT } from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { StreamingIndicatorComponent } from '../../shared/streaming-indicator/streaming-indicator.component';
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { KeyStatusBadgeComponent } from '../settings/key-status-badge.component';
import { SettingsModalComponent } from '../settings/settings-modal.component';
import { SettingsMenuEntryComponent } from '../settings/settings-menu-entry.component';
import { AskBothSequencerService } from './ask-both-sequencer.service';
import { AskBothModeService } from './ask-both-mode.service';
import { AskBothModeToggleComponent } from './ask-both-mode-toggle.component';

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
    AskBothModeToggleComponent,
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
  private readonly storage = inject(STORAGE_PORT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);
  readonly settingsOpen = signal(false);
  readonly bridgeMessage = this.sequencer.bridgeAnnouncement;
  readonly canKeepGoing = this.sequencer.canKeepGoing;

  @ViewChild('messageList') messageListEl?: ElementRef<HTMLDivElement>;

  readonly bannerLabel = PRODUCT_COPY.askBothBannerLabel;
  readonly askBothGreeting = PRODUCT_COPY.askBothGreeting;
  readonly askBothGreetingHint = PRODUCT_COPY.askBothGreetingHint;
  readonly inputPlaceholder = PRODUCT_COPY.askBothInputPlaceholder;
  readonly keepGoingLabel = PRODUCT_COPY.keepGoingButtonLabel;

  constructor() {
    // Drive the mixed persona gradient defined in styles.scss.
    this.renderer.setAttribute(this.document.body, 'data-mode', 'ask-both');
    void this.loadThread();

    // Incremental refresh: sequencer fires threadUpdated$ after every write
    // (user message, Hitesh's completion, Piyush's completion, keep-going
    // completions). Reload immediately so each persona's message settles
    // into the list as soon as it's persisted instead of all appearing at
    // the end.
    this.sequencer.threadUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.reloadThread());

    // Auto-scroll to bottom on new messages / streaming updates. rAF defers
    // the scroll until after Angular flushes the DOM update.
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

  streamingLabel(): string {
    // Blended dispatches keep `activePersona` null (there is no single
    // persona owner). Consult the active variant first so the label reads
    // "Hitesh + Piyush are speaking as one…" instead of the generic
    // "Preparing…" fallback.
    if (this.modeService.get() === 'blended') {
      return PRODUCT_COPY.streamingIndicatorAskBothBlended;
    }
    const persona = this.sequencer.activePersona();
    if (persona === 'hitesh') return PRODUCT_COPY.streamingIndicatorAskBothA;
    if (persona === 'piyush') return PRODUCT_COPY.streamingIndicatorAskBothB;
    return 'Preparing…';
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text || this.sequencer.inFlight()) return;
    // Optimistic local push so the user's own message lands immediately —
    // sequencer's own storage-write will fire threadUpdated$ shortly after
    // and reconcile with the authoritative persisted version (matching id
    // isn't required; reloadThread replaces the whole list).
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
