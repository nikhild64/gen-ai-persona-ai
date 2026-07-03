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
import {
  appendStreamToken,
  yieldToUi,
} from '../../shared/streaming-typewriter/stream-token';
import { PromptAssembler } from '../prompts/prompt-assembler.service';
import { KeyVaultService } from '../key-vault/key-vault.service';
import { PersonaRoutingService } from '../key-vault/persona-routing.service';
import { ContextManager } from '../context/context-manager.service';
import { ProviderStreamRunnerService } from './provider-stream-runner.service';
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
  /** Persona owning the current/last in-flight stream — guards cross-persona UI bleed. */
  readonly activeStreamPersona: WritableSignal<PersonaId | null> = signal(null);
  /** E7-S1: true once max-turn cap fires; input disables until thread is cleared. */
  readonly capReached: WritableSignal<boolean> = signal(false);
  /** E7-S2: seconds carried in a provider 429 Retry-After header, if any. */
  readonly retryAfterSec: WritableSignal<number | null> = signal(null);
  /** True when the last dispatch stopped because a provider key was missing. */
  readonly pendingKeyMissing: WritableSignal<boolean> = signal(false);

  /** E6-S3 subscribes to auto-open the settings modal when a key is missing. */
  readonly keyMissing$: Subject<PersonaId> = new Subject<PersonaId>();

  private readonly storage = inject(STORAGE_PORT);
  private readonly moderation = inject(MODERATION_PORT);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly assembler = inject(PromptAssembler);
  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly contextManager = inject(ContextManager);
  private readonly streamRunner = inject(ProviderStreamRunnerService);
  private readonly adapterFactory = inject(ADAPTER_FACTORY);

  private currentAbort: AbortController | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on cancel — in-flight dispatch() exits before touching stream UI. */
  private dispatchEpoch = 0;

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
    if (this.inFlightStream()) {
      return new Observable<never>((sub) => {
        sub.complete();
      });
    }
    return new Observable<never>((sub) => {
      this.dispatch(persona, text).then(
        () => sub.complete(),
        (err) => sub.error(err),
      );
    });
  }

  /** FR-15 — reset transient UI state when threads are cleared. */
  resetSessionState(): void {
    this.cancelInFlight();
    this.capReached.set(false);
    this.retryAfterSec.set(null);
    this.pendingKeyMissing.set(false);
    this.accumulatedText.set('');
    this.activeAssistantMessageId.set(null);
    this.activeStreamPersona.set(null);
    this.streamStalled.set(false);
  }

  cancelInFlight(): void {
    this.dispatchEpoch += 1;
    this.currentAbort?.abort();
    this.currentAbort = null;
    this.clearStallTimer();
    // Drop any partial stream so persona/mode switches cannot replay the
    // previous advisor's text through the typewriter.
    this.accumulatedText.set('');
    this.activeAssistantMessageId.set(null);
    this.activeStreamPersona.set(null);
    this.inFlightStream.set(false);
    this.streamStalled.set(false);
  }

  private async dispatch(persona: PersonaId, text: string): Promise<void> {
    const epoch = this.dispatchEpoch;

    // Step 1 — input moderation
    const inputVerdict = await this.moderation.check(text, 'input');
    if (this.isDispatchStale(epoch)) return;
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
    if (this.isDispatchStale(epoch)) return;

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

    const providerId = this.personaRouting.getProviderFor(persona);
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      this.pendingKeyMissing.set(true);
      this.keyMissing$.next(persona);
      return;
    }
    this.pendingKeyMissing.set(false);

    thread.messages.push(userMsg);
    thread.updatedAt = userMsg.timestamp;
    await this.storage.set(this.threadKeyFor(persona), thread);
    if (this.isDispatchStale(epoch)) return;

    // Step 3 — compose prompt
    const composed = this.assembler.compose(persona, thread, 'solo');

    if (this.isDispatchStale(epoch)) return;

    this.currentAbort = new AbortController();
    const controller = this.currentAbort;
    const assistantMsgId = this.uuid();
    this.activeAssistantMessageId.set(assistantMsgId);
    this.activeStreamPersona.set(persona);
    this.accumulatedText.set('');
    this.inFlightStream.set(true);
    this.streamStalled.set(false);
    this.armStallTimer(persona);

    const streamResult = await this.streamRunner.streamWithRateLimitFallback({
      persona,
      composed,
      initialProvider: providerId,
      signal: controller.signal,
      adapterFactory: this.adapterFactory,
      onDelta: (text) => {
        this.resetStallTimer(persona);
        if (!controller.signal.aborted) {
          this.accumulatedText.set(text);
        }
      },
      onRetryAttempt: () => {
        this.resetStallTimer(persona);
      },
    });

    this.clearStallTimer();
    this.inFlightStream.set(false);

    if (this.isDispatchStale(epoch) || controller.signal.aborted) {
      return;
    }

    const {
      accumulated,
      doneChunk,
      errorChunk,
      adapter,
      prompt,
      key: streamKey,
      usedFallback,
    } = streamResult;

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

    if (!doneChunk) {
      await this.handleAdapterError(
        persona,
        { type: 'error', meta: { error: 'network_error', retryable: true } },
        assistantMsgId,
        accumulated,
        thread,
      );
      return;
    }

    if (!accumulated.trim()) {
      await this.handleAdapterError(
        persona,
        { type: 'error', meta: { error: 'invalid_request', retryable: false } },
        assistantMsgId,
        accumulated,
        thread,
      );
      return;
    }

    if (usedFallback) {
      this.retryAfterSec.set(null);
    }

    // Step 8 — output moderation with retry-once (re-invokes provider once)
    const finalText = await this.checkOutputWithRetry(
      persona,
      accumulated,
      assistantMsgId,
      adapter,
      prompt,
      streamKey,
      controller,
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
    this.retryAfterSec.set(null);

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

    void this.contextManager.onTurnComplete(this.threadKeyFor(persona));
  }

  private isDispatchStale(epoch: number): boolean {
    return epoch !== this.dispatchEpoch;
  }

  private async checkOutputWithRetry(
    persona: PersonaId,
    accumulated: string,
    _assistantMsgId: string,
    adapter: ProviderPort,
    prompt: Parameters<ProviderPort['streamChat']>[0],
    key: string,
    controller: AbortController,
  ): Promise<string> {
    const first = await this.moderation.check(accumulated, 'output');
    if (first.allowed) return accumulated;

    let retryAccumulated = '';
    try {
      for await (const chunk of adapter.streamChat(
        prompt,
        key,
        controller.signal,
      )) {
        if (chunk.type === 'delta' && chunk.text) {
          retryAccumulated = appendStreamToken(retryAccumulated, chunk.text);
          this.accumulatedText.set(retryAccumulated);
          await yieldToUi();
        } else if (chunk.type === 'done' || chunk.type === 'error') {
          break;
        }
      }
    } catch {
      /* fall through to refusal */
    }

    if (retryAccumulated.trim()) {
      const second = await this.moderation.check(retryAccumulated, 'output');
      if (second.allowed) return retryAccumulated;
    }

    const template =
      this.pickRefusalTemplate(persona, first.category, first.suggested_refusal) ||
      PERSONA_REGISTRY[persona].prompt.selfIdentificationResponse ||
      PERSONA_REGISTRY[persona].prompt.offDomainTemplate;
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
      this.accumulatedText.set('');
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
      // Always publish a retry-after so the UI banner is visible; providers
      // often omit the Retry-After header on 429 for free tiers. 30s is a
      // reasonable default hold.
      this.retryAfterSec.set(chunk.meta?.retryAfterSec ?? 30);
      this.analytics.emit({
        name: 'provider_429_surfaced',
        payload: {
          provider: this.personaRouting.getProviderFor(persona),
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
    this.accumulatedText.set('');
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
    const content =
      template.trim() ||
      PERSONA_REGISTRY[persona].prompt.offDomainTemplate ||
      PERSONA_REGISTRY[persona].prompt.selfIdentificationResponse;
    const thread = await this.getOrCreateThread(persona);
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      persona,
      content: content,
      timestamp: Date.now(),
      status: 'complete',
    };
    thread.messages.push(msg);
    thread.updatedAt = msg.timestamp;
    await this.storage.set(this.threadKeyFor(persona), thread);
    this.accumulatedText.set(content);
  }

  private threadKeyFor(persona: PersonaId): StorageKey {
    return persona === 'hitesh' ? 'chat:hitesh:v1' : 'chat:piyush:v1';
  }

  private async getOrCreateThread(persona: PersonaId): Promise<Thread> {
    const existing = await this.storage.get<Thread>(this.threadKeyFor(persona));
    if (existing && Array.isArray(existing.messages)) return existing;
    if (existing) {
      return {
        ...existing,
        messages: [],
      };
    }
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
