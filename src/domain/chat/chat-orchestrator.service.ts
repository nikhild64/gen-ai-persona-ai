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
import { CHAT_STORAGE_KEYS } from '../../config/storage-keys';
import { PERSONA_REGISTRY } from '../../personas/persona.registry';
import type { PersonaRegistryEntry } from '../../personas/persona.registry';
import { MUSK_REGEX, JOBS_REGEX } from '../../config/regex-patterns';
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
import { PersonaRoutingService } from '../key-vault/persona-routing.service';
import { ModelSelectionService } from '../key-vault/model-selection.service';
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
import type { ChatPersonaRef } from '../types/custom-persona';
import { builtinRef } from '../types/custom-persona';
import { PersonaResolverService } from '../personas/persona-resolver.service';
import { CustomPersonaThreadService } from '../custom-persona/custom-persona-thread.service';
import {
  appendStreamToken,
  yieldToUi,
} from '../../shared/streaming-typewriter/stream-token';

export const ADAPTER_FACTORY = new InjectionToken<
  (providerId: ProviderId) => ProviderPortAdapterClass
>('AdapterFactory', {
  providedIn: 'root',
  factory: () => getProviderAdapter,
});

@Injectable({ providedIn: 'root' })
export class ChatOrchestrator {
  readonly accumulatedText: WritableSignal<string> = signal('');
  readonly inFlightStream: WritableSignal<boolean> = signal(false);
  readonly streamStalled: WritableSignal<boolean> = signal(false);
  readonly activeAssistantMessageId: WritableSignal<string | null> = signal(
    null,
  );
  readonly capReached: WritableSignal<boolean> = signal(false);
  readonly retryAfterSec: WritableSignal<number | null> = signal(null);

  readonly keyMissing$: Subject<ChatPersonaRef> = new Subject<ChatPersonaRef>();

  private readonly storage = inject(STORAGE_PORT);
  private readonly moderation = inject(MODERATION_PORT);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly assembler = inject(PromptAssembler);
  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly contextManager = inject(ContextManager);
  private readonly adapterFactory = inject(ADAPTER_FACTORY);
  private readonly resolver = inject(PersonaResolverService);
  private readonly customThreads = inject(CustomPersonaThreadService);

  private currentAbort: AbortController | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

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
    return this.sendMessageRef(builtinRef(persona), text);
  }

  sendMessageRef(ref: ChatPersonaRef, text: string): Observable<never> {
    return new Observable<never>((sub) => {
      this.dispatch(ref, text).then(
        () => sub.complete(),
        (err) => sub.error(err),
      );
      return () => this.abortStream();
    });
  }

  /** Abort the provider stream and clear in-flight UI state. */
  cancelInFlight(): void {
    this.abortStream();
    this.clearStreamPresentation();
  }

  private abortStream(): void {
    this.currentAbort?.abort();
    this.currentAbort = null;
    this.clearStallTimer();
  }

  private clearStreamPresentation(): void {
    this.inFlightStream.set(false);
    this.streamStalled.set(false);
    this.accumulatedText.set('');
    this.activeAssistantMessageId.set(null);
  }

  private async dispatch(ref: ChatPersonaRef, text: string): Promise<void> {
    const entry = this.resolver.resolve(ref);
    if (!entry) return;

    const inputVerdict = await this.moderation.check(text, 'input');
    if (!inputVerdict.allowed) {
      await this.renderRefusal(
        ref,
        entry,
        this.pickRefusalTemplate(
          entry,
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

    const thread = await this.getOrCreateThread(ref);

    if (
      assistantMessageCount(thread) + expectedAssistantMessagesForMode('solo') >
      MAX_TURNS_PER_THREAD
    ) {
      const capContent = entry.prompt.capRefusalTemplate;
      const capMsg: Message = {
        id: this.uuid(),
        role: 'assistant',
        content: capContent,
        attributionLabel: entry.fullDisplayName,
        timestamp: Date.now(),
        status: 'complete',
        ...(ref.kind === 'builtin' ? { persona: ref.id } : {}),
      };
      thread.messages.push(capMsg);
      thread.updatedAt = capMsg.timestamp;
      await this.persistThread(ref, thread);
      this.capReached.set(true);
      this.accumulatedText.set(capContent);
      return;
    }

    const providerId = this.providerFor(ref, entry);
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      this.keyMissing$.next(ref);
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
    await this.persistThread(ref, thread);

    const composed =
      ref.kind === 'builtin'
        ? this.assembler.compose(ref.id, thread, 'solo')
        : this.assembler.composeFromEntry(entry, thread);

    const prompt = {
      ...composed,
      model: this.modelSelection.getModelFor(providerId),
    };

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
    this.armStallTimer(ref);

    let accumulated = '';
    let doneChunk: ChatChunk | null = null;
    let errorChunk: ChatChunk | null = null;

    try {
      for await (const chunk of adapter.streamChat(
        prompt,
        key,
        controller.signal,
      )) {
        this.resetStallTimer(ref);
        if (chunk.type === 'delta' && chunk.text) {
          if (!controller.signal.aborted) {
            accumulated = appendStreamToken(accumulated, chunk.text);
            this.accumulatedText.set(accumulated);
          }
          await yieldToUi();
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
      if (controller.signal.aborted) {
        this.clearStreamPresentation();
      }
    }

    if (
      !errorChunk &&
      !doneChunk &&
      controller.signal.aborted
    ) {
      errorChunk = {
        type: 'error',
        meta: { error: 'aborted', retryable: false },
      };
    }

    if (errorChunk) {
      await this.handleAdapterError(
        ref,
        entry,
        errorChunk,
        assistantMsgId,
        accumulated,
        thread,
      );
      return;
    }

    if (doneChunk) {
      const finalText = await this.checkOutputWithRetry(
        ref,
        entry,
        accumulated,
      );
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: finalText,
        attributionLabel: entry.fullDisplayName,
        timestamp: Date.now(),
        status: 'complete',
        ...(ref.kind === 'builtin' ? { persona: ref.id } : {}),
      };
      thread.messages.push(assistantMsg);
      thread.updatedAt = assistantMsg.timestamp;
      await this.persistThread(ref, thread);

      if (ref.kind === 'builtin') {
        const regex = ref.id === 'musk' ? MUSK_REGEX : JOBS_REGEX;
        if (!regex.test(finalText)) {
          this.analytics.emit({
            name: 'persona_regex_miss',
            payload: { persona: ref.id },
          });
        }
      }

      this.analytics.emit({
        name: 'message_sent',
        payload: {
          persona: ref.kind === 'builtin' ? ref.id : 'custom',
          mode: 'solo',
          charCount: text.length,
        },
      });

      void this.contextManager.onTurnComplete(
        this.summaryStorageKey(ref),
        ref.kind === 'custom' ? ref.id : undefined,
      );
    }
  }

  private async checkOutputWithRetry(
    ref: ChatPersonaRef,
    entry: PersonaRegistryEntry,
    accumulated: string,
  ): Promise<string> {
    const first = await this.moderation.check(accumulated, 'output');
    if (first.allowed) return accumulated;
    const second = await this.moderation.check(accumulated, 'output');
    if (second.allowed) return accumulated;

    const template =
      this.pickRefusalTemplate(entry, first.category, first.suggested_refusal) ||
      entry.prompt.selfIdentificationResponse;
    this.analytics.emit({
      name: 'moderation_blocked',
      payload: { direction: 'output', category: first.category },
    });
    this.accumulatedText.set(template);
    return template;
  }

  private armStallTimer(_ref: ChatPersonaRef): void {
    this.clearStallTimer();
    this.stallTimer = setTimeout(() => {
      this.streamStalled.set(true);
      this.analytics.emit({
        name: 'stream_stall_detected',
        payload: { persona: 'custom', elapsedMs: STREAM_STALL_TIMEOUT_MS },
      });
    }, STREAM_STALL_TIMEOUT_MS);
  }

  private resetStallTimer(ref: ChatPersonaRef): void {
    if (this.streamStalled()) this.streamStalled.set(false);
    this.armStallTimer(ref);
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  private async handleAdapterError(
    ref: ChatPersonaRef,
    entry: PersonaRegistryEntry,
    chunk: ChatChunk,
    msgId: string,
    partial: string,
    thread: Thread,
  ): Promise<void> {
    const kind: ChatChunkError = chunk.meta?.error ?? 'unknown';
    const msgBase = {
      id: msgId,
      role: 'assistant' as const,
      attributionLabel: entry.fullDisplayName,
      timestamp: Date.now(),
      ...(ref.kind === 'builtin' ? { persona: ref.id } : {}),
    };

    if (kind === 'aborted') {
      const msg: Message = {
        ...msgBase,
        content: partial,
        status: 'cancelled',
      };
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.persistThread(ref, thread);
      return;
    }

    if (kind === 'quota_exhausted') {
      const template = entry.prompt.quotaExhaustedTemplate;
      const msg: Message = {
        ...msgBase,
        content: template || partial,
        status: 'complete',
      };
      thread.messages.push(msg);
      thread.updatedAt = msg.timestamp;
      await this.persistThread(ref, thread);
      this.accumulatedText.set(msg.content);
      this.retryAfterSec.set(chunk.meta?.retryAfterSec ?? 30);
      this.analytics.emit({
        name: 'provider_429_surfaced',
        payload: {
          provider: this.providerFor(ref, entry),
          retryAfterSec: chunk.meta?.retryAfterSec,
        },
      });
      return;
    }

    const msg: Message = {
      ...msgBase,
      content: partial,
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
    await this.persistThread(ref, thread);
  }

  private pickRefusalTemplate(
    entry: PersonaRegistryEntry,
    category?: string,
    suggested?: string,
  ): string {
    const p = entry.prompt;
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
    ref: ChatPersonaRef,
    entry: PersonaRegistryEntry,
    template: string,
  ): Promise<void> {
    const thread = await this.getOrCreateThread(ref);
    const msg: Message = {
      id: this.uuid(),
      role: 'assistant',
      content: template,
      attributionLabel: entry.fullDisplayName,
      timestamp: Date.now(),
      status: 'complete',
      ...(ref.kind === 'builtin' ? { persona: ref.id } : {}),
    };
    thread.messages.push(msg);
    thread.updatedAt = msg.timestamp;
    await this.persistThread(ref, thread);
    this.accumulatedText.set(template);
  }

  private providerFor(
    ref: ChatPersonaRef,
    entry: PersonaRegistryEntry,
  ): ProviderId {
    if (ref.kind === 'builtin') {
      return this.personaRouting.getProviderFor(ref.id);
    }
    return this.personaRouting.getProviderForCustom(entry.providerId);
  }

  private summaryStorageKey(ref: ChatPersonaRef): StorageKey {
    if (ref.kind === 'builtin') {
      return CHAT_STORAGE_KEYS[ref.id];
    }
    return 'chat:custom-personas:v1';
  }

  private async persistThread(ref: ChatPersonaRef, thread: Thread): Promise<void> {
    if (ref.kind === 'builtin') {
      await this.storage.set(CHAT_STORAGE_KEYS[ref.id], thread);
      return;
    }
    await this.customThreads.saveThread(ref.id, thread);
  }

  async getOrCreateThread(ref: ChatPersonaRef): Promise<Thread> {
    if (ref.kind === 'builtin') {
      const existing = await this.storage.get<Thread>(CHAT_STORAGE_KEYS[ref.id]);
      if (existing) return existing;
      return {
        id: this.uuid(),
        scope: ref.id,
        messages: [],
        rollingSummary: null,
        turnsSinceLastSummary: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const existing = await this.customThreads.getThread(ref.id);
    if (existing) return existing;
    return {
      id: this.uuid(),
      scope: ref.id,
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
