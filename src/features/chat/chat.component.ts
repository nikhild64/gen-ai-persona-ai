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
import { PersonaRoutingService } from '../../domain/key-vault/persona-routing.service';
import { STORAGE_PORT, ANALYTICS_PORT } from '../../domain/chat/di-tokens';
import type { PersonaId } from '../../domain/types/persona';
import { isPersonaId } from '../../domain/types/persona';
import type { Message, Thread } from '../../domain/types/message';
import {
  PERSONA_REGISTRY,
  personaDisplayName,
} from '../../personas/persona.registry';
import { CHAT_STORAGE_KEYS } from '../../config/storage-keys';
import { PRODUCT_COPY } from '../../config/product-copy';
import {
  disclaimerTierCopy,
  personaChatDisclaimer,
} from '../../config/persona-disclaimers';
import {
  chatInputLabel,
  personaSwitcherLabel,
  sendButtonLabel,
} from '../../config/aria-labels';
import type { ChatPersonaRef, CustomPersonaId } from '../../domain/types/custom-persona';
import { builtinRef, customRef, isCustomPersonaId } from '../../domain/types/custom-persona';
import { PersonaResolverService } from '../../domain/personas/persona-resolver.service';
import { CustomPersonaThreadService } from '../../domain/custom-persona/custom-persona-thread.service';
import { AppSettingsService } from '../../shared/app-settings/app-settings.service';
import { FEATURE_CUSTOM_PERSONA } from '../../config/feature-flags';

import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { StreamingIndicatorComponent } from '../../shared/streaming-indicator/streaming-indicator.component';
import { AriaAnnouncerService } from '../../shared/aria-announcer/aria-announcer.component';
import { SettingsMenuEntryComponent } from '../settings/settings-menu-entry.component';
import { PersonaPickerDialogComponent } from '../persona-picker/persona-picker-dialog.component';
import { ModeSwitcherComponent } from '../mode-switcher/mode-switcher.component';
import { PersonaAvatarSvgComponent } from '../../shared/persona-avatar-svg/persona-avatar-svg.component';
import { localStoreSet } from '../../domain/key-vault/browser-local-storage';
import {
  createStreamingTypewriterController,
  type StreamingTypewriterController,
} from '../../shared/streaming-typewriter/streaming-typewriter';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    StreamingIndicatorComponent,
    SettingsMenuEntryComponent,
    PersonaPickerDialogComponent,
    ModeSwitcherComponent,
    PersonaAvatarSvgComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent {
  readonly orchestrator = inject(ChatOrchestrator);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly announcer = inject(AriaAnnouncerService);
  private readonly storage = inject(STORAGE_PORT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly resolver = inject(PersonaResolverService);
  private readonly customThreads = inject(CustomPersonaThreadService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly streamDisplay: StreamingTypewriterController =
    createStreamingTypewriterController(this.destroyRef);

  readonly personaPickerOpen = signal(false);
  private queuedText: string | null = null;
  private sendGeneration = 0;

  readonly sendAriaLabel = sendButtonLabel;
  readonly capReachedHint = PRODUCT_COPY.capReachedInputHint;
  readonly experimentalChip = PRODUCT_COPY.customPersonaExperimentalChip;
  readonly customPersonaEnabled = FEATURE_CUSTOM_PERSONA;
  readonly draft = signal('');
  readonly messages = signal<Message[]>([]);

  readonly activeRef = signal<ChatPersonaRef>(builtinRef('musk'));
  readonly isCustomMode = computed(() => this.activeRef().kind === 'custom');

  readonly inputDisabled = computed(
    () =>
      this.orchestrator.inFlightStream() || this.orchestrator.capReached(),
  );

  readonly retryHint = computed(() => {
    const seconds = this.orchestrator.retryAfterSec();
    return seconds === null ? null : PRODUCT_COPY.retryAfterHint(seconds);
  });

  @ViewChild('messageList') messageListEl?: ElementRef<HTMLDivElement>;

  readonly activePersona = computed((): PersonaId | null => {
    const ref = this.activeRef();
    return ref.kind === 'builtin' ? ref.id : null;
  });

  readonly activeCustomId = computed((): CustomPersonaId | null => {
    const ref = this.activeRef();
    return ref.kind === 'custom' ? ref.id : null;
  });

  readonly registryEntry = computed(() => this.resolver.resolve(this.activeRef()));

  readonly personaName = computed(() => {
    const entry = this.registryEntry();
    if (!entry) return 'Advisor';
    return this.isCustomMode()
      ? entry.fullDisplayName
      : personaDisplayName(this.activePersona()!);
  });

  readonly personaTagline = computed(
    () => this.registryEntry()?.tagline ?? '',
  );

  readonly personaSwitcherAriaLabel = computed(() => {
    const p = this.activePersona();
    return p ? personaSwitcherLabel(p) : this.personaName();
  });

  readonly switcherDisabledTooltip = computed(() =>
    PRODUCT_COPY.switcherDisabledDuringStream(this.personaName()),
  );

  readonly chatDisclaimer = computed(() => {
    const entry = this.registryEntry();
    if (!entry) return '';
    if (this.isCustomMode()) {
      return `${disclaimerTierCopy(entry.disclaimerTier, entry.fullDisplayName)} ${PRODUCT_COPY.customPersonaExperimentalDisclaimer}`;
    }
    return personaChatDisclaimer(this.activePersona()!);
  });

  readonly inputPlaceholder = computed(
    () => this.registryEntry()?.inputPlaceholder ?? 'Type a message…',
  );

  readonly starterQuestions = computed(
    () => this.registryEntry()?.starterQuestions ?? [],
  );

  readonly inputAriaLabel = computed(() => {
    const p = this.activePersona();
    return p ? chatInputLabel(p) : `Message for ${this.personaName()}`;
  });

  readonly avatarDisplayName = computed(
    () => this.registryEntry()?.fullDisplayName ?? '',
  );

  readonly streamingBubble = computed<Message | null>(() => {
    const text = this.streamDisplay.displayed();
    const target = this.orchestrator.accumulatedText();
    const streaming =
      this.orchestrator.inFlightStream() || this.orchestrator.streamStalled();
    const catchingUp =
      target.length > 0 && text.length > 0 && text.length < target.length;

    if (!streaming && !catchingUp) return null;
    if (!text) return null;
    const id = this.orchestrator.activeAssistantMessageId() ?? 'streaming';
    const entry = this.registryEntry();
    return {
      id,
      role: 'assistant',
      persona: this.activePersona() ?? undefined,
      attributionLabel: entry?.fullDisplayName,
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
    this.renderer.addClass(this.document.body, 'conversation-view');
    this.destroyRef.onDestroy(() => {
      this.renderer.removeClass(this.document.body, 'conversation-view');
      this.sendGeneration++;
      this.orchestrator.cancelInFlight();
      this.streamDisplay.reset();
    });

    this.streamDisplay.bind({
      target: () => this.orchestrator.accumulatedText(),
      streaming: () =>
        this.orchestrator.inFlightStream() || this.orchestrator.streamStalled(),
    });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const customSlug = params.get('customId');
        if (customSlug) {
          const id = (
            customSlug.startsWith('custom:') ? customSlug : `custom:${customSlug}`
          ) as CustomPersonaId;
          if (isCustomPersonaId(id)) {
            this.switchPersona(customRef(id));
            return;
          }
        }

        const slug = params.get('persona');
        const persona: PersonaId =
          slug && isPersonaId(slug) ? slug : 'musk';
        this.switchPersona(builtinRef(persona));
      });

    effect((onCleanup) => {
      const dataPersona = this.isCustomMode() ? 'custom' : this.activePersona();
      if (dataPersona) {
        this.renderer.setAttribute(this.document.body, 'data-persona', dataPersona);
      }
      onCleanup(() =>
        this.renderer.removeAttribute(this.document.body, 'data-persona'),
      );
    });

    effect(() => {
      if (this.orchestrator.inFlightStream()) return;
      const text = this.orchestrator.accumulatedText();
      if (text) {
        this.announcer.announce(`${this.personaName()} says: ${text}`);
      }
    });

    effect(() => {
      this.messages();
      this.streamDisplay.displayed();
      this.orchestrator.inFlightStream();
      requestAnimationFrame(() => {
        const el = this.messageListEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    this.orchestrator.keyMissing$
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
      const p = this.activePersona();
      if (p) localStoreSet('last-active-solo', p);
    });
  }

  openPersonaPicker(): void {
    if (this.orchestrator.inFlightStream()) return;
    this.personaPickerOpen.set(true);
  }

  onPersonaPicked(target: PersonaId): void {
    if (this.activePersona() === target) return;
    const from: PersonaId | CustomPersonaId = this.isCustomMode()
      ? this.activeCustomId()!
      : this.activePersona()!;
    this.analytics.emit({
      name: 'persona_switched',
      payload: { from, to: target },
    });
    void this.router.navigate(['/chat', target]);
  }

  onCustomPersonaPicked(id: CustomPersonaId): void {
    if (this.activeCustomId() === id) return;
    const from: PersonaId | CustomPersonaId = this.isCustomMode()
      ? this.activeCustomId()!
      : this.activePersona()!;
    this.analytics.emit({
      name: 'persona_switched',
      payload: { from, to: id },
    });
    const urlId = id.replace(/^custom:/, '');
    void this.router.navigate(['/chat', 'custom', urlId]);
  }

  onStarterChip(question: string): void {
    if (this.inputDisabled()) return;
    this.draft.set(question);
    this.onSend();
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text || this.orchestrator.inFlightStream()) return;

    if (!this.hasKeyForActive()) {
      this.queuedText = text;
      this.appSettings.openSettings({ auto: true });
      return;
    }

    this.dispatchSend(text);
  }

  private hasKeyForActive(): boolean {
    const ref = this.activeRef();
    const entry = this.registryEntry();
    if (!entry) return false;
    if (ref.kind === 'builtin') {
      return this.personaRouting.hasKeyForPersona(ref.id);
    }
    const provider = this.personaRouting.getProviderForCustom(entry.providerId);
    return this.personaRouting.hasKeyForProvider(provider);
  }

  private switchPersona(nextRef: ChatPersonaRef): void {
    if (JSON.stringify(nextRef) === JSON.stringify(this.activeRef())) return;
    this.sendGeneration++;
    this.orchestrator.cancelInFlight();
    this.streamDisplay.reset();
    this.activeRef.set(nextRef);
    void this.loadThread();
  }

  private dispatchSend(text: string): void {
    const generation = ++this.sendGeneration;
    this.queuedText = text;

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
      .sendMessageRef(this.activeRef(), text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          if (generation !== this.sendGeneration) return;
          void this.streamDisplay.drain().then(() => {
            if (generation !== this.sendGeneration) return;
            this.queuedText = null;
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
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  customChatUrlId(): string {
    const id = this.activeCustomId();
    if (!id) return '';
    return id.replace(/^custom:/, '');
  }

  private async loadThread(): Promise<void> {
    const thread = await this.readThread();
    if (thread && thread.messages.length > 0) {
      this.messages.set([...thread.messages]);
    } else {
      await this.seedGreeting();
    }
  }

  private async reloadThread(): Promise<void> {
    const thread = await this.readThread();
    if (thread) this.messages.set([...thread.messages]);
  }

  private async readThread(): Promise<Thread | undefined> {
    const ref = this.activeRef();
    if (ref.kind === 'builtin') {
      return this.storage.get<Thread>(CHAT_STORAGE_KEYS[ref.id]);
    }
    return this.customThreads.getThread(ref.id);
  }

  private async seedGreeting(): Promise<void> {
    const entry = this.registryEntry();
    if (!entry) return;
    const ref = this.activeRef();
    const greeting = entry.greeting;
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      content: greeting,
      attributionLabel: entry.fullDisplayName,
      timestamp: Date.now(),
      status: 'complete',
      ...(ref.kind === 'builtin' ? { persona: ref.id } : {}),
    };
    const thread: Thread = {
      id: this.uuid(),
      scope: ref.kind === 'builtin' ? ref.id : ref.id,
      messages: [msg],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: msg.timestamp,
      updatedAt: msg.timestamp,
    };
    await this.persistThread(thread);
    this.messages.set([msg]);
  }

  private async persistThread(thread: Thread): Promise<void> {
    const ref = this.activeRef();
    if (ref.kind === 'builtin') {
      await this.storage.set(CHAT_STORAGE_KEYS[ref.id], thread);
      return;
    }
    await this.customThreads.saveThread(ref.id, thread);
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}
