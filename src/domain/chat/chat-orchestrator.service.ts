import {
  Injectable,
  InjectionToken,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';

import type { PersonaId } from '../types/persona';
import type {
  ChatChunk,
  ChatChunkError,
  Message,
  Thread,
} from '../types/message';
import type { StorageKey } from '../../config/storage-keys';
import { PERSONA_REGISTRY } from '../../personas/persona.registry';
import {
  HITESH_REGEX,
  PIYUSH_REGEX,
} from '../../config/regex-patterns';
import {
  STREAM_STALL_TIMEOUT_MS,
  MAX_TURNS_PER_THREAD,
} from '../../config/context-config';
import {
  assistantMessageCount,
  expectedAssistantMessagesForMode,
} from '../context/turn-counting';
import { PromptAssembler } from '../prompts/prompt-assembler.service';
import { KeyVaultService } from '../key-vault/key-vault.service';
import { ContextManager } from '../context/context-manager.service';
import type { ProviderId } from '../../config/provider-registry';
import type {
  ProviderPort,
  ProviderPortAdapterClass,
} from '../ports/provider.port';
import { getProviderAdapter } from '../../infrastructure/providers/provider.registry';
import {
  STORAGE_PORT,
  MODERATION_PORT,
  ANALYTICS_PORT,
} from './di-tokens';

/**
 * Injection token letting tests swap the provider-registry lookup for a mock.
 * Default provider is `getProviderAdapter` from `provider.registry.ts`.
 */
export const ADAPTER_FACTORY = new InjectionToken<
  (providerId: ProviderId) => ProviderPortAdapterClass
>('AdapterFactory', {
  providedIn: 'root',
  factory: () => getProviderAdapter,
});

/**
 * AD-3/AD-4/AD-7/AD-8/AD-10/AD-12/AD-14/AD-15/AD-19 hub. The only class that
 * calls `PROVIDER_REGISTRY.get(...).streamChat(...)`. Feature components inject
 * this service and call `sendMessage(persona, text)`; everything else — input
 * moderation, prompt composition, key lookup, streaming, stall detection,
 * output moderation with retry-once, message persistence, regex smoke-test,
 * analytics emission — happens here.
 */
@Injectable({ providedIn: 'root' })
export class ChatOrchestrator {
  // Reactive state consumed by UI (E2-S4 chat component)
  readonly accumulatedText: WritableSignal<string> = signal('');
  readonly inFlightStream: WritableSignal<boolean> = signal(false);
  readonly streamStalled: WritableSignal<boolean> = signal(false);
  readonly activeAssistantMessageId: WritableSignal<string | null> = signal(
    null,
  );
  /** E7-S1: true once max-turn cap fires; input disables until thread is cleared. */
  readonly capReached: WritableSignal<boolean> = signal(false);
  /** E7-S2: seconds carried in a provider 429 Retry-After header, if any. */
  readonly retryAfterSec: WritableSignal<number | null> = signal(null);

  /** E6-S3 subscribes to auto-open the settings modal when a key is missing. */
  readonly keyMissing$: Subject<PersonaId> = new Subject<PersonaId>();

  private readonly storage = inject(STORAGE_PORT);
  private readonly moderation = inject(MODERATION_PORT);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly assembler = inject(PromptAssembler);
  private readonly keyVault = inject(KeyVaultService);
  private readonly contextManager = inject(ContextManager);
  private readonly adapterFactory = inject(ADAPTER_FACTORY);

  private currentAbort: AbortController | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Read-only view of the reactive signals. Kept as `Signal<T>` (not
   * `WritableSignal<T>`) so consumers can't mutate.
   */
  readonly views: {
    accumulatedText: Signal<string>;
    inFlightStream: Signal<boolean>;
    streamStalled: Signal<boolean>;
    activeAssistantMessageId: Signal<string | null>;
  } = {
    accumulatedText: this.accumulatedText.asReadonly(),
    inFlightStream: this.inFlightStream.asReadonly(),
    streamStalled: this.streamStalled.asReadonly(),
    activeAssistantMessageId: this.activeAssistantMessageId.asReadonly(),
  };

  sendMessage(persona: PersonaId, text: string): Observable<never> {
    return new Observable<never>((sub) => {
      this.dispatch(persona, text).then(
        () => sub.complete(),
        (err) => sub.error(err),
      );
      return () => this.cancelInFlight();
    });
  }

  cancelInFlight(): void {
    this.currentAbort?.abort();
    this.currentAbort = null;
    this.clearStallTimer();
  }

  private async dispatch(persona: PersonaId, text: string): Promise<void> {
    // Step 1 — input moderation
    const inputVerdict = await this.moderation.check(text, 'input');
    if (!inputVerdict.allowed) {
      await this.renderRefusal(
        persona,
        this.pickRefusalTemplate(
          persona,
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

    // Step 2 — append user message
    const thread = await this.getOrCreateThread(persona);

    // E7-S1: max-turn cap check before touching the provider.
    if (
      assistantMessageCount(thread) + expectedAssistantMessagesForMode('solo') >
      MAX_TURNS_PER_THREAD
    ) {
      const capContent = PERSONA_REGISTRY[persona].prompt.capRefusalTemplate;
      const capMsg: Message = {
        id: this.uuid(),
        role: 'assistant',
        persona,
        content: capContent,
        timestamp: Date.now(),
        status: 'complete',
      };
      thread.messages.push(capMsg);
      thread.updatedAt = capMsg.timestamp;
      await this.storage.set(this.threadKeyFor(persona), thread);
      this.capReached.set(true);
      this.accumulatedText.set(capContent);
      return;
    }

    const userMsg: Message = {
      id: this.uuid(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    thread.messages.push(userMsg);
    thread.updatedAt = userMsg.timestamp;
    await this.storage.set(this.threadKeyFor(persona), thread);

    // Step 3 — compose prompt
    const prompt = this.assembler.compose(persona, thread, 'solo');

    // Step 4 — key lookup
    const providerId = PERSONA_REGISTRY[persona].providerId;
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      this.keyMissing$.next(persona);
      return;
    }

    // Step 5-7 — abort controller + stream
    const AdapterClass = this.adapterFactory(providerId);
    const adapter: ProviderPort = new (
      AdapterClass as unknown as new () => ProviderPort
    )();

    this.currentAbort = new AbortController();
    const controller = this.currentAbort;
    const assistantMsgId = this.uuid();
    this.activeAssistantMessageId.set(assistantMsgId);
    this.accumulatedText.set('');
    this.inFlightStream.set(true);
    this.streamStalled.set(false);
    this.armStallTimer(persona);

    let accumulated = '';
    let doneChunk: ChatChunk | null = null;
    let errorChunk: ChatChunk | null = null;

    try {
      for await (const chunk of adapter.streamChat(
        prompt,
        key,
        controller.signal,
      )) {
        this.resetStallTimer(persona);
        if (chunk.type === 'delta' && chunk.text) {
          accumulated += chunk.text;
          this.accumulatedText.set(accumulated);
        } else if (chunk.type === 'done') {
          doneChunk = chunk;
          break;
        } else if (chunk.type === 'error') {
          errorChunk = chunk;
          break;
        }
      }
    } finally {
      this.clearStallTimer();
      this.inFlightStream.set(false);
    }

    if (errorChunk) {
      await this.handleAdapterError(
        persona,
        errorChunk,
        assistantMsgId,
        accumulated,
        thread,
      );
      return;
    }

    if (doneChunk) {
      // Step 8 — output moderation with retry-once
      const finalText = await this.checkOutputWithRetry(
        persona,
        accumulated,
        assistantMsgId,
      );
      // Step 9 — persist assistant message
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        persona,
        content: finalText,
        timestamp: Date.now(),
        status: 'complete',
      };
      thread.messages.push(assistantMsg);
      thread.updatedAt = assistantMsg.timestamp;
      await this.storage.set(this.threadKeyFor(persona), thread);

      // Step 10 — regex smoke-test (AD-19 observation-only)
      const regex = persona === 'hitesh' ? HITESH_REGEX : PIYUSH_REGEX;
      if (!regex.test(finalText)) {
        this.analytics.emit({
          name: 'persona_regex_miss',
          payload: { persona },
        });
      }

      this.analytics.emit({
        name: 'message_sent',
        payload: { persona, mode: 'solo', charCount: text.length },
      });

      // Fire-and-forget rolling-summary trigger per AD-9. Main chat is not
      // blocked; any failure surfaces only as a `summary_failed` analytics
      // event.
      void this.contextManager.onTurnComplete(this.threadKeyFor(persona));
    }
  }

  private async checkOutputWithRetry(
    persona: PersonaId,
    accumulated: string,
    _assistantMsgId: string,
  ): Promise<string> {
    const first = await this.moderation.check(accumulated, 'output');
    if (first.allowed) return accumulated;
    // Retry-once: E8-S2 will re-invoke the adapter; for the orchestrator
    // shape (this story) we treat a still-blocked verdict as final refusal.
    const second = await this.moderation.check(accumulated, 'output');
    if (second.allowed) return accumulated;

    const template =
      this.pickRefusalTemplate(persona, first.category, first.suggested_refusal) ||
      PERSONA_REGISTRY[persona].prompt.selfIdentificationResponse;
    this.analytics.emit({
      name: 'moderation_blocked',
      payload: { direction: 'output', category: first.category },
    });
    this.accumulatedText.set(template);
    return template;
  }

  private armStallTimer(persona: PersonaId): void {
    this.clearStallTimer();
    this.stallTimer = setTimeout(() => {
      this.streamStalled.set(true);
      this.analytics.emit({
        name: 'stream_stall_detected',
        payload: { persona, elapsedMs: STREAM_STALL_TIMEOUT_MS },
      });
    }, STREAM_STALL_TIMEOUT_MS);
  }

  private resetStallTimer(persona: PersonaId): void {
    if (this.streamStalled()) this.streamStalled.set(false);
    this.armStallTimer(persona);
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  private async handleAdapterError(
    persona: PersonaId,
    chunk: ChatChunk,
    msgId: string,
    partial: string,
    thread: Thread,
  ): Promise<void> {
    const kind: ChatChunkError = chunk.meta?.error ?? 'unknown';
    if (kind === 'aborted') {
      // AD-14 — mark message cancelled with partial content preserved
      const msg: Message = {
        id: msgId,
        role: 'assistant',
        persona,
        content: partial,
        timestamp: Date.now(),
        status: 'cancelled',
      };
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.storage.set(this.threadKeyFor(persona), thread);
      return;
    }

    if (kind === 'quota_exhausted') {
      // E7-S2 — In-Character 429 surfacing.
      const template = PERSONA_REGISTRY[persona].prompt.quotaExhaustedTemplate;
      const msg: Message = {
        id: msgId,
        role: 'assistant',
        persona,
        content: template || partial,
        timestamp: Date.now(),
        status: 'complete',
      };
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.storage.set(this.threadKeyFor(persona), thread);
      this.accumulatedText.set(msg.content);
      this.retryAfterSec.set(chunk.meta?.retryAfterSec ?? null);
      this.analytics.emit({
        name: 'provider_429_surfaced',
        payload: {
          provider: PERSONA_REGISTRY[persona].providerId,
          retryAfterSec: chunk.meta?.retryAfterSec,
        },
      });
      return;
    }

    // Other error kinds — persist an error-status message so the UI can render a red bubble.
    const msg: Message = {
      id: msgId,
      role: 'assistant',
      persona,
      content: partial,
      timestamp: Date.now(),
      status: 'error',
      error: {
        kind,
        message: `Provider error: ${kind}`,
        retryable: chunk.meta?.retryable ?? false,
        retryAfterSec: chunk.meta?.retryAfterSec,
      },
    };
    thread.messages.push(msg);
    thread.updatedAt = msg.timestamp;
    await this.storage.set(this.threadKeyFor(persona), thread);
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

  private async renderRefusal(
    persona: PersonaId,
    template: string,
  ): Promise<void> {
    const thread = await this.getOrCreateThread(persona);
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      persona,
      content: template,
      timestamp: Date.now(),
      status: 'complete',
    };
    thread.messages.push(msg);
    thread.updatedAt = msg.timestamp;
    await this.storage.set(this.threadKeyFor(persona), thread);
    this.accumulatedText.set(template);
  }

  private threadKeyFor(persona: PersonaId): StorageKey {
    return persona === 'hitesh' ? 'chat:hitesh:v1' : 'chat:piyush:v1';
  }

  private async getOrCreateThread(persona: PersonaId): Promise<Thread> {
    const existing = await this.storage.get<Thread>(this.threadKeyFor(persona));
    if (existing) return existing;
    return {
      id: this.uuid(),
      scope: persona,
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}
