import {
  Injectable,
  InjectionToken,
  inject,
  signal,
  computed,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { Subject } from 'rxjs';

import type { PersonaId } from '../../domain/types/persona';
import type {
  ChatChunk,
  Message,
  Thread,
} from '../../domain/types/message';
import type {
  ProviderPort,
  ProviderPortAdapterClass,
} from '../../domain/ports/provider.port';
import type { ProviderId } from '../../config/provider-registry';
import { KEEP_GOING_ROUNDS } from '../../config/context-config';
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

  readonly canKeepGoing: Signal<boolean> = computed(
    () =>
      !this.inFlight() &&
      this.keepGoingUsed() < KEEP_GOING_ROUNDS &&
      this.hasCompletedTurn(),
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

  /**
   * Per-instance analytics session identifier. The Ask-Both sequencer is
   * `providedIn: 'root'`, so this UUID lasts for the SPA lifetime = the
   * browser tab session. Emitted with `ask_both_blended_message_sent` per
   * AC-6 to give observability into blended-usage per session vs per thread.
   */
  private readonly sessionId: string = this.uuid();

  async askBoth(userText: string): Promise<void> {
    if (this.inFlight()) return;

    // AD-12 input moderation
    const inputVerdict = await this.moderation.check(userText, 'input');
    if (!inputVerdict.allowed) {
      this.analytics.emit({
        name: 'moderation_blocked',
        payload: { direction: 'input', category: inputVerdict.category },
      });
      return;
    }

    // AD-13 fire-once analytics per turn
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
    this.bridgeAnnouncement.set(null);

    this.inFlight.set(true);
    this.controller = new AbortController();

    const activeMode = this.modeService.get();
    if (activeMode === 'parallel') {
      await this.dispatchParallel(thread);
    } else if (activeMode === 'blended') {
      await this.dispatchBlended(thread);
    } else {
      await this.dispatchSequential(thread);
    }

    this.inFlight.set(false);
    this.currentPersona.set(null);
    this.currentText.set('');
    this.controller = null;
  }

  async keepGoing(): Promise<void> {
    if (this.inFlight()) return;
    if (this.keepGoingUsed() >= KEEP_GOING_ROUNDS) return;
    if (!this.hasCompletedTurn()) return;

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

    if (activeMode === 'blended') {
      // AC-5: Blended keep-going runs another blended composition. The
      // assembler's `composeAskBothBlended` detects last-msg role is
      // assistant and synthesises the "continue with a fresh angle"
      // user prompt automatically.
      await this.dispatchBlended(thread);
    } else {
      // Sequential and Parallel keep-going both use the existing pair-round
      // pattern so the conversation stays alternating and the parallel-mode
      // observer still sees two fresh takes per click.
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
        thread,
        'ask-both-keep-going',
        buildNote(thread),
      );

      if (!hiteshResult.errored && !this.controller?.signal.aborted) {
        // Re-read thread so Piyush's system note includes Hitesh's just-appended
        // message; storage is the source of truth per AD-6.
        const refreshed = await this.storage.get<Thread>('chat:ask-both:v1');
        if (refreshed) {
          thread = refreshed;
          this.bridgeAnnouncement.set(PRODUCT_COPY.askBothBridgeAnnouncement);
          await this.pause(700);
          this.bridgeAnnouncement.set(null);
          await this.streamPersona(
            'piyush',
            thread,
            'ask-both-keep-going',
            buildNote(thread),
          );
        }
      }
    }

    this.keepGoingUsed.update((n) => n + 1);
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

  private async dispatchSequential(thread: Thread): Promise<void> {
    // Persona A â€” Hitesh
    const hiteshResult = await this.streamPersona(
      'hitesh',
      thread,
      'ask-both-a',
      undefined,
    );
    if (hiteshResult.errored) return; // FR-27: Persona A error blocks Persona B

    // AD-20 bridge announcement + brief visual pause so the eye can settle
    // on Hitesh's completed message before Piyush's typing bubble appears.
    this.bridgeAnnouncement.set(PRODUCT_COPY.askBothBridgeAnnouncement);
    await this.pause(700);

    // Persona B â€” Piyush (invoked even on Hitesh in-character refusal).
    const systemNote = ASK_BOTH_SYSTEM_NOTE_TEMPLATE(
      personaDisplayName('hitesh'),
      hiteshResult.text,
    );
    this.bridgeAnnouncement.set(null);
    await this.streamPersona('piyush', thread, 'ask-both-b', systemNote);
  }

  private async dispatchParallel(thread: Thread): Promise<void> {
    // E9-S4 fallback â€” fire both providers concurrently, no system-note.
    this.analytics.emit({
      name: 'parallel_fallback_triggered',
      payload: {},
    });
    await Promise.all([
      this.streamPersona('hitesh', thread, 'ask-both-a', undefined),
      this.streamPersona('piyush', thread, 'ask-both-a', undefined),
    ]);
  }

  /**
   * Post-sprint Blended dispatch (AC-4). Single LLM call, single bubble
   * emission carrying `attributionLabel` (no per-persona attribution). Uses
   * Hitesh's provider slot as the canonical carrier â€” blended is
   * persona-agnostic at the prompt level but has to pick ONE provider
   * adapter to talk to. Model / temp / topP come from Hitesh's model params
   * (warmer generation profile matches the fusion voice-rule intent).
   *
   * `currentPersona` stays `null` so the UI streaming label falls through
   * to the "Preparingâ€¦" fallback rather than showing "Hitesh is typingâ€¦" â€”
   * `streamingLabel()` in `ask-both.component.ts` can layer the Blended
   * label on top when `modeService.get() === 'blended'`.
   */
  private async dispatchBlended(thread: Thread): Promise<void> {
    this.currentPersona.set(null);
    this.currentText.set('');

    const providerId = this.personaRouting.getProviderFor('hitesh');
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
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

    if (!errored && doneChunk) {
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
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.storage.set('chat:ask-both:v1', thread);
      this.threadUpdated$.next();
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
    }
  }

  private async streamPersona(
    persona: PersonaId,
    thread: Thread,
    mode: 'ask-both-a' | 'ask-both-b' | 'ask-both-keep-going',
    systemNote: string | undefined,
  ): Promise<{ text: string; errored: boolean }> {
    this.currentPersona.set(persona);
    this.currentText.set('');

    const providerId = this.personaRouting.getProviderFor(persona);
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
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

    if (!errored && doneChunk) {
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
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.storage.set('chat:ask-both:v1', thread);
      // Notify listeners so the UI can promote the persisted message into
      // its messages() list before the next persona's stream begins â€” avoids
      // the "message jumped in" feel where multiple bubbles appeared at end.
      this.threadUpdated$.next();
      // Blank the live streaming bubble so it doesn't briefly show the
      // just-finished text alongside its now-persisted twin.
      this.currentText.set('');
      return { text: finalText, errored: false };
    }

    return { text: accumulated, errored };
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
    return this.lastUserMessage !== null;
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

