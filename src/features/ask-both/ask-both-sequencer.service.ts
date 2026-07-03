import { Injectable, InjectionToken, inject, signal, computed, type Signal, type WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';

import type { PersonaId } from '../../domain/types/persona';
import type { ChatChunk, Message, Thread } from '../../domain/types/message';
import type { ProviderPort, ProviderPortAdapterClass } from '../../domain/ports/provider.port';
import type { ProviderId } from '../../config/provider-registry';
import { KEEP_GOING_ROUNDS } from '../../config/context-config';
import type { AskBothMode } from '../../config/feature-flags';
import {
  ASK_BOTH_SYSTEM_NOTE_TEMPLATE,
  ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE,
} from '../../config/prompt-format';
import { PERSONA_REGISTRY, personaDisplayName } from '../../personas/persona.registry';
import blendedComposition from '../../personas/blended.prompt';
import { PromptAssembler } from '../../domain/prompts/prompt-assembler.service';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';
import { PersonaRoutingService } from '../../domain/key-vault/persona-routing.service';
import { ModelSelectionService } from '../../domain/key-vault/model-selection.service';
import { getProviderAdapter } from '../../infrastructure/providers/provider.registry';
import {
  STORAGE_PORT,
  MODERATION_PORT,
  ANALYTICS_PORT,
} from '../../domain/chat/di-tokens';
import { PRODUCT_COPY } from '../../config/product-copy';
import { hasBlendedSignature } from '../../config/regex-patterns';
import { AskBothModeService } from './ask-both-mode.service';

/**
 * Sequencer-local injection token letting tests swap the provider-registry
 * lookup for a mock, mirroring the `ADAPTER_FACTORY` pattern in
 * `chat-orchestrator.service.ts`. Defaults to `getProviderAdapter` from
 * `provider.registry.ts` so production wiring is unchanged. Added
 * post-sprint to enable the Blended-mode sequencer spec â€” vi.mock is not
 * supported for relative imports under the Angular unit-test system.
 */
export const ASK_BOTH_ADAPTER_FACTORY = new InjectionToken<
  (providerId: ProviderId) => ProviderPortAdapterClass
>('AskBothAdapterFactory', {
  providedIn: 'root',
  factory: () => getProviderAdapter,
});

/**
 * AD-13 Ask-Both sequencer. Owns the Sequential-With-Awareness flow
 * (Hitesh â†’ Piyush-with-system-note), the shared AbortController per
 * user turn (AD-14), and â€” via `keepGoing()` â€” the one-round follow-up
 * per AD-9 `KEEP_GOING_ROUNDS`. Parallel mode is the FR-31 fallback.
 */
@Injectable({ providedIn: 'root' })
export class AskBothSequencerService {
  readonly inFlight: WritableSignal<boolean> = signal(false);
  readonly currentPersona: WritableSignal<PersonaId | null> = signal(null);
  readonly currentText: WritableSignal<string> = signal('');
  readonly bridgeAnnouncement: WritableSignal<string | null> = signal(null);
  readonly keepGoingUsed: WritableSignal<number> = signal(0);

  /** Fires after every write to the ask-both thread in IDB so the component
   *  can incrementally refresh its `messages()` signal instead of waiting
   *  for the full `askBoth()` promise to resolve. */
  readonly threadUpdated$: Subject<void> = new Subject<void>();
  readonly keyMissing$ = new Subject<void>();

  readonly canKeepGoing: Signal<boolean> = computed(
    () =>
      !this.inFlight() &&
      this.keepGoingUsed() < KEEP_GOING_ROUNDS &&
      this.lastTurnHadAssistant(),
  );

  readonly activePersona: Signal<PersonaId | null> = this.currentPersona.asReadonly();

  readonly currentStreaming: Signal<Message | null> = computed(() => {
    if (!this.inFlight() && !this.currentText()) return null;
    const persona = this.currentPersona();
    if (!persona) return null;
    const text = this.currentText();
    if (!text) return null;
    return {
      id: 'streaming',
      role: 'assistant',
      persona,
      content: text,
      timestamp: Date.now(),
      status: 'streaming',
    };
  });

  private readonly storage = inject(STORAGE_PORT);
  private readonly moderation = inject(MODERATION_PORT);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly assembler = inject(PromptAssembler);
  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly modeService = inject(AskBothModeService);
  private readonly adapterFactory = inject(ASK_BOTH_ADAPTER_FACTORY);
  private controller: AbortController | null = null;
  private lastUserMessage: string | null = null;
  private lastTurnHadAssistant = signal(false);
  private threadWriteChain: Promise<void> = Promise.resolve();

  /**
   * Per-instance analytics session identifier. The Ask-Both sequencer is
   * `providedIn: 'root'`, so this UUID lasts for the SPA lifetime = the
   * browser tab session. Emitted with `ask_both_blended_message_sent` per
   * AC-6 to give observability into blended-usage per session vs per thread.
   */
  private readonly sessionId: string = this.uuid();

  async askBoth(userText: string): Promise<void> {
    if (this.inFlight()) return;

    const inputVerdict = await this.moderation.check(userText, 'input');
    if (!inputVerdict.allowed) {
      const thread = await this.getOrCreateThread();
      await this.renderAskBothRefusal(
        thread,
        this.pickRefusalTemplate(
          'hitesh',
          inputVerdict.category,
          inputVerdict.suggested_refusal,
        ),
      );
      this.analytics.emit({
        name: 'moderation_blocked',
        payload: { direction: 'input', category: inputVerdict.category },
      });
      return;
    }

    const activeMode = this.modeService.get();
    if (this.missingProvidersForMode(activeMode).length > 0) {
      this.keyMissing$.next();
      return;
    }

    this.analytics.emit({
      name: 'ask_both_message_sent',
      payload: { charCount: userText.length },
    });

    const thread = await this.getOrCreateThread();
    const userMsg: Message = {
      id: this.uuid(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };
    thread.messages.push(userMsg);
    thread.updatedAt = userMsg.timestamp;
    await this.storage.set('chat:ask-both:v1', thread);
    this.threadUpdated$.next();
    this.lastUserMessage = userText;
    this.keepGoingUsed.set(0);
    this.lastTurnHadAssistant.set(false);
    this.bridgeAnnouncement.set(null);

    this.inFlight.set(true);
    this.controller = new AbortController();

    if (activeMode === 'parallel') {
      await this.dispatchParallel();
    } else if (activeMode === 'blended') {
      await this.dispatchBlended();
    } else {
      await this.dispatchSequential();
    }

    const refreshed = await this.storage.get<Thread>('chat:ask-both:v1');
    const hadAssistant =
      refreshed?.messages.some(
        (m) =>
          m.role === 'assistant' &&
          m.status === 'complete' &&
          m.timestamp >= userMsg.timestamp,
      ) ?? false;
    this.lastTurnHadAssistant.set(hadAssistant);

    this.inFlight.set(false);
    this.currentPersona.set(null);
    this.currentText.set('');
    this.controller = null;
  }

  async keepGoing(): Promise<void> {
    if (this.inFlight()) return;
    if (this.keepGoingUsed() >= KEEP_GOING_ROUNDS) return;
    if (!this.lastTurnHadAssistant()) return;

    let thread = await this.storage.get<Thread>('chat:ask-both:v1');
    if (!thread) return;

    this.analytics.emit({
      name: 'keep_going_clicked',
      payload: {},
    });
    this.inFlight.set(true);
    this.bridgeAnnouncement.set(null);
    this.controller = new AbortController();

    const activeMode = this.modeService.get();
    const startedAt = Date.now();
    let producedAssistant = false;

    if (activeMode === 'blended') {
      await this.dispatchBlended();
    } else {
      const buildNote = (currentThread: Thread): string => {
        const [hiteshLast, piyushLast] = this.lastTwoAssistantTexts(
          currentThread,
        );
        return ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(
          this.lastUserMessage ?? '',
          hiteshLast,
          piyushLast,
        );
      };

      const hiteshResult = await this.streamPersona(
        'hitesh',
        'ask-both-keep-going',
        buildNote(thread),
      );

      if (!hiteshResult.errored && !this.controller?.signal.aborted) {
        const refreshed = await this.storage.get<Thread>('chat:ask-both:v1');
        if (refreshed) {
          thread = refreshed;
          this.bridgeAnnouncement.set(PRODUCT_COPY.askBothBridgeAnnouncement);
          await this.pause(700);
          this.bridgeAnnouncement.set(null);
          await this.streamPersona(
            'piyush',
            'ask-both-keep-going',
            buildNote(thread),
          );
        }
      }
    }

    const refreshed = await this.storage.get<Thread>('chat:ask-both:v1');
    producedAssistant =
      refreshed?.messages.some(
        (m) =>
          m.role === 'assistant' &&
          m.status === 'complete' &&
          m.timestamp >= startedAt,
      ) ?? false;

    if (producedAssistant) {
      this.keepGoingUsed.update((n) => n + 1);
      this.lastTurnHadAssistant.set(true);
    }

    this.inFlight.set(false);
    this.currentPersona.set(null);
    this.currentText.set('');
    this.controller = null;
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.inFlight.set(false);
  }

  resetSessionState(): void {
    this.cancel();
    this.keepGoingUsed.set(0);
    this.lastUserMessage = null;
    this.lastTurnHadAssistant.set(false);
    this.bridgeAnnouncement.set(null);
    this.currentPersona.set(null);
    this.currentText.set('');
  }

  private async dispatchSequential(): Promise<void> {
    const hiteshResult = await this.streamPersona(
      'hitesh',
      'ask-both-a',
      undefined,
    );
    if (hiteshResult.errored) return;

    this.bridgeAnnouncement.set(PRODUCT_COPY.askBothBridgeAnnouncement);
    await this.pause(700);

    const refreshed = await this.storage.get<Thread>('chat:ask-both:v1');
    if (!refreshed) return;

    const systemNote = ASK_BOTH_SYSTEM_NOTE_TEMPLATE(
      personaDisplayName('hitesh'),
      hiteshResult.text,
    );
    this.bridgeAnnouncement.set(null);
    await this.streamPersona('piyush', 'ask-both-b', systemNote);
  }

  private async dispatchParallel(): Promise<void> {
    this.analytics.emit({
      name: 'parallel_fallback_triggered',
      payload: {},
    });
    await Promise.all([
      this.streamPersona('hitesh', 'ask-both-a', undefined),
      this.streamPersona('piyush', 'ask-both-a', undefined),
    ]);
  }

  private async dispatchBlended(): Promise<void> {
    this.currentPersona.set(null);
    this.currentText.set('');

    const thread = await this.storage.get<Thread>('chat:ask-both:v1');
    if (!thread) return;

    const providerId = this.personaRouting.getProviderFor('hitesh');
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      this.keyMissing$.next();
      return;
    }

    const AdapterClass = this.adapterFactory(providerId);
    const adapter: ProviderPort = new (
      AdapterClass as unknown as new () => ProviderPort
    )();

    const composed = this.assembler.compose(
      'hitesh',
      thread,
      'ask-both-blended',
    );
    const prompt = {
      ...composed,
      model: this.modelSelection.getModelFor(providerId),
    };

    let accumulated = '';
    let errored = false;
    let doneChunk: ChatChunk | null = null;

    try {
      for await (const chunk of adapter.streamChat(
        prompt,
        key,
        this.controller!.signal,
      )) {
        if (chunk.type === 'delta' && chunk.text) {
          accumulated += chunk.text;
          this.currentText.set(accumulated);
        } else if (chunk.type === 'done') {
          doneChunk = chunk;
          break;
        } else if (chunk.type === 'error') {
          errored = true;
          break;
        }
      }
    } catch {
      errored = true;
    }

    if (!errored && doneChunk && accumulated.trim()) {
      const outputVerdict = await this.moderation.check(accumulated, 'output');
      let finalText = accumulated;
      if (!outputVerdict.allowed) {
        finalText =
          outputVerdict.suggested_refusal ||
          blendedComposition.moderationFallbackTemplate;
        this.analytics.emit({
          name: 'moderation_blocked',
          payload: { direction: 'output', category: outputVerdict.category },
        });
      }
      const msg: Message = {
        id: this.uuid(),
        role: 'assistant',
        content: finalText,
        timestamp: Date.now(),
        status: 'complete',
        attributionLabel: blendedComposition.attributionLabel,
      };
      await this.appendAssistantMessage(msg);
      this.currentText.set('');

      // AC-6 analytics â€” one event per blended send.
      this.analytics.emit({
        name: 'ask_both_blended_message_sent',
        payload: {
          sessionId: this.sessionId,
          threadId: thread.id,
          tokenEstimate: composed.meta.estimatedTokens,
        },
      });

      // AC-10 regex smoke-test â€” miss fires `persona_regex_miss{persona:'blended'}`.
      if (!hasBlendedSignature(finalText)) {
        this.analytics.emit({
          name: 'persona_regex_miss',
          payload: { persona: 'blended' },
        });
      }
    } else if (errored) {
      await this.appendAssistantMessage({
        id: this.uuid(),
        role: 'assistant',
        content: accumulated,
        timestamp: Date.now(),
        status: 'error',
        attributionLabel: blendedComposition.attributionLabel,
        error: {
          kind: 'unknown',
          message: 'Blended stream failed',
          retryable: true,
        },
      });
    }
  }

  private async streamPersona(
    persona: PersonaId,
    mode: 'ask-both-a' | 'ask-both-b' | 'ask-both-keep-going',
    systemNote: string | undefined,
  ): Promise<{ text: string; errored: boolean }> {
    this.currentPersona.set(persona);
    this.currentText.set('');

    const thread = await this.storage.get<Thread>('chat:ask-both:v1');
    if (!thread) return { text: '', errored: true };

    const providerId = this.personaRouting.getProviderFor(persona);
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      await this.persistKeyMissingNotice(persona);
      return { text: '', errored: true };
    }

    const AdapterClass = this.adapterFactory(providerId);
    const adapter: ProviderPort = new (
      AdapterClass as unknown as new () => ProviderPort
    )();

    const composed = this.assembler.compose(persona, thread, mode, {
      systemNote,
    });
    // See ChatOrchestrator: pick the user-selected model for this provider
    // (falls back to PROVIDER_DEFAULT_MODELS when the user hasn't chosen).
    const prompt = {
      ...composed,
      model: this.modelSelection.getModelFor(providerId),
    };
    let accumulated = '';
    let errored = false;
    let doneChunk: ChatChunk | null = null;

    try {
      for await (const chunk of adapter.streamChat(
        prompt,
        key,
        this.controller!.signal,
      )) {
        if (chunk.type === 'delta' && chunk.text) {
          accumulated += chunk.text;
          this.currentText.set(accumulated);
        } else if (chunk.type === 'done') {
          doneChunk = chunk;
          break;
        } else if (chunk.type === 'error') {
          errored = true;
          break;
        }
      }
    } catch {
      errored = true;
    }

    if (!errored && doneChunk && accumulated.trim()) {
      const outputVerdict = await this.moderation.check(accumulated, 'output');
      let finalText = accumulated;
      if (!outputVerdict.allowed) {
        finalText = this.pickRefusalTemplate(
          persona,
          outputVerdict.category,
          outputVerdict.suggested_refusal,
        );
        this.analytics.emit({
          name: 'moderation_blocked',
          payload: { direction: 'output', category: outputVerdict.category },
        });
      }
      const msg: Message = {
        id: this.uuid(),
        role: 'assistant',
        persona,
        content: finalText,
        timestamp: Date.now(),
        status: 'complete',
      };
      await this.appendAssistantMessage(msg);
      this.currentText.set('');
      return { text: finalText, errored: false };
    }

    if (errored || accumulated.trim()) {
      await this.persistStreamError(persona, accumulated);
    }

    return { text: accumulated, errored: true };
  }

  /** Small pacing delay + bridge visible so the eye can rest between voices. */
  private async pause(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private pickRefusalTemplate(
    persona: PersonaId,
    category?: string,
    suggested?: string,
  ): string {
    const p = PERSONA_REGISTRY[persona].prompt;
    switch (category) {
      case 'jailbreak':
        return p.promptInjectionTemplate || suggested || '';
      case 'off_domain':
        return p.offDomainTemplate || suggested || '';
      case 'adult':
        return p.adultTemplate || suggested || '';
      case 'political':
        return p.politicalTemplate || suggested || '';
      case 'hate':
      case 'self_harm':
        return p.hostileUserTemplate || suggested || '';
      default:
        return suggested || p.offDomainTemplate || '';
    }
  }

  private hasCompletedTurn(): boolean {
    return this.lastTurnHadAssistant();
  }

  private missingProvidersForMode(mode: AskBothMode): ProviderId[] {
    const personas: PersonaId[] =
      mode === 'blended' ? ['hitesh'] : ['hitesh', 'piyush'];
    const providers = [
      ...new Set(personas.map((p) => this.personaRouting.getProviderFor(p))),
    ];
    return providers.filter((p) => this.keyVault.getKeyForProvider(p) === null);
  }

  private async renderAskBothRefusal(
    thread: Thread,
    template: string,
  ): Promise<void> {
    const content =
      template.trim() ||
      PERSONA_REGISTRY['hitesh'].prompt.offDomainTemplate ||
      PRODUCT_COPY.keyStatusNoKeyLabel;
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      status: 'complete',
      attributionLabel: blendedComposition.attributionLabel,
    };
    thread.messages.push(msg);
    thread.updatedAt = msg.timestamp;
    await this.storage.set('chat:ask-both:v1', thread);
    this.threadUpdated$.next();
  }

  private async persistKeyMissingNotice(persona: PersonaId): Promise<void> {
    await this.appendAssistantMessage({
      id: this.uuid(),
      role: 'assistant',
      persona,
      content: PRODUCT_COPY.keyStatusNoKeyLabel,
      timestamp: Date.now(),
      status: 'error',
      error: {
        kind: 'auth_failed',
        message: 'Provider key missing',
        retryable: false,
      },
    });
    this.keyMissing$.next();
  }

  private async persistStreamError(
    persona: PersonaId,
    partial: string,
  ): Promise<void> {
    await this.appendAssistantMessage({
      id: this.uuid(),
      role: 'assistant',
      persona,
      content: partial,
      timestamp: Date.now(),
      status: 'error',
      error: {
        kind: 'unknown',
        message: 'Provider stream failed',
        retryable: true,
      },
    });
  }

  private async appendAssistantMessage(msg: Message): Promise<void> {
    const prev = this.threadWriteChain;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.threadWriteChain = prev.then(() => gate);
    await prev;
    try {
      const thread = await this.storage.get<Thread>('chat:ask-both:v1');
      if (!thread) return;
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.storage.set('chat:ask-both:v1', thread);
      this.threadUpdated$.next();
    } finally {
      release();
    }
  }

  private async getOrCreateThread(): Promise<Thread> {
    const existing = await this.storage.get<Thread>('chat:ask-both:v1');
    if (existing) return existing;
    return {
      id: this.uuid(),
      scope: 'ask-both',
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private lastTwoAssistantTexts(thread: Thread): [string, string] {
    const assistants = thread.messages.filter((m) => m.role === 'assistant');
    const piyush =
      [...assistants].reverse().find((m) => m.persona === 'piyush')?.content ??
      '';
    const hitesh =
      [...assistants].reverse().find((m) => m.persona === 'hitesh')?.content ??
      '';
    return [hitesh, piyush];
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}

