import { Injectable, inject } from '@angular/core';

import type { PersonaId } from '../types/persona';
import type { ChatChunk } from '../types/message';
import type { ProviderId } from '../../config/provider-registry';
import type {
  ProviderPort,
  ProviderPortAdapterClass,
} from '../ports/provider.port';
import type { OutboundPrompt } from '../prompts/types';
import { ModelSelectionService } from '../key-vault/model-selection.service';
import {
  ProviderRateLimitFallbackService,
  type ProviderStreamAttempt,
} from '../key-vault/provider-rate-limit-fallback.service';
import { ANALYTICS_PORT } from './di-tokens';
import {
  collectProviderStream,
  isQuotaExhausted,
} from './collect-provider-stream';

export type ProviderStreamRunResult = {
  accumulated: string;
  doneChunk: ChatChunk | null;
  errorChunk: ChatChunk | null;
  providerId: ProviderId;
  modelId: string;
  adapter: ProviderPort;
  prompt: OutboundPrompt;
  key: string;
  usedFallback: boolean;
};

/**
 * Streams from a provider with automatic 429 recovery: next model on the
 * same provider, then alternate provider models. Updates persisted routing
 * when a fallback succeeds.
 */
@Injectable({ providedIn: 'root' })
export class ProviderStreamRunnerService {
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly rateLimitFallback = inject(ProviderRateLimitFallbackService);
  private readonly analytics = inject(ANALYTICS_PORT);

  async streamWithRateLimitFallback(options: {
    persona: PersonaId;
    composed: OutboundPrompt;
    initialProvider: ProviderId;
    signal: AbortSignal;
    adapterFactory: (providerId: ProviderId) => ProviderPortAdapterClass;
    onDelta?: (accumulated: string) => void | Promise<void>;
    onRetryAttempt?: () => void;
  }): Promise<ProviderStreamRunResult> {
    const initialModel = this.modelSelection.getModelFor(options.initialProvider);
    const attempts = this.rateLimitFallback.buildAttemptChain(
      options.initialProvider,
      initialModel,
    );

    if (attempts.length === 0) {
      return this.emptyFailure(options.initialProvider, initialModel);
    }

    let lastResult: ProviderStreamRunResult | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i]!;
      if (i > 0) {
        options.onRetryAttempt?.();
        await options.onDelta?.('');
      }

      const result = await this.runAttempt(
        options.composed,
        attempt,
        options.adapterFactory,
        options.signal,
        options.onDelta,
      );
      lastResult = result;

      if (!result.errorChunk && result.doneChunk) {
        if (i > 0) {
          this.rateLimitFallback.commitSuccessfulFallback(
            options.persona,
            options.initialProvider,
            attempt,
          );
          this.analytics.emit({
            name: 'provider_rate_limit_fallback',
            payload: {
              persona: options.persona,
              fromProvider: options.initialProvider,
              fromModel: initialModel,
              toProvider: attempt.providerId,
              toModel: attempt.modelId,
            },
          });
        }
        return { ...result, usedFallback: i > 0 };
      }

      if (!isQuotaExhausted(result.errorChunk)) {
        return { ...result, usedFallback: false };
      }
    }

    return lastResult ?? this.emptyFailure(options.initialProvider, initialModel);
  }

  private async runAttempt(
    composed: OutboundPrompt,
    attempt: ProviderStreamAttempt,
    adapterFactory: (providerId: ProviderId) => ProviderPortAdapterClass,
    signal: AbortSignal,
    onDelta?: (accumulated: string) => void | Promise<void>,
  ): Promise<ProviderStreamRunResult> {
    const AdapterClass = adapterFactory(attempt.providerId);
    const adapter: ProviderPort = new (
      AdapterClass as unknown as new () => ProviderPort
    )();
    const prompt: OutboundPrompt = { ...composed, model: attempt.modelId };

    const collected = await collectProviderStream(
      adapter,
      prompt,
      attempt.key,
      signal,
      onDelta,
    );

    return {
      ...collected,
      providerId: attempt.providerId,
      modelId: attempt.modelId,
      adapter,
      prompt,
      key: attempt.key,
      usedFallback: false,
    };
  }

  private emptyFailure(
    providerId: ProviderId,
    modelId: string,
  ): ProviderStreamRunResult {
    return {
      accumulated: '',
      doneChunk: null,
      errorChunk: {
        type: 'error',
        meta: { error: 'auth_failed', retryable: false },
      },
      providerId,
      modelId,
      adapter: {} as ProviderPort,
      prompt: { messages: [], model: modelId, meta: {
        mode: 'solo',
        hasSummary: false,
        hasDriftRefresh: false,
        estimatedTokens: 0,
      } },
      key: '',
      usedFallback: false,
    };
  }
}
