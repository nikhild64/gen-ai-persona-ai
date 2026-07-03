import { Injectable, inject } from '@angular/core';

import type { Thread } from '../types/message';
import type { PersonaId } from '../types/persona';
import type { StorageKey } from '../../config/storage-keys';
import type { ProviderId } from '../../config/provider-registry';
import { ASK_BOTH_SUMMARY_PROVIDER_ID } from '../../config/provider-registry';
import { PersonaRoutingService } from '../key-vault/persona-routing.service';
import { ModelSelectionService } from '../key-vault/model-selection.service';
import {
  VERBATIM_TAIL_LENGTH,
  SUMMARY_REFRESH_CADENCE,
  SUMMARY_TOKEN_BUDGET_PCT,
} from '../../config/context-config';
import { FEATURE_ROLLING_SUMMARY } from '../../config/feature-flags';
import { getProviderAdapter } from '../../infrastructure/providers/provider.registry';
import type { ProviderPort } from '../ports/provider.port';
import { STORAGE_PORT, ANALYTICS_PORT } from '../chat/di-tokens';
import { PromptAssembler } from '../prompts/prompt-assembler.service';
import { KeyVaultService } from '../key-vault/key-vault.service';
import { assistantMessageCount } from './turn-counting';
import { estimateTokens } from './token-estimator';
import type { CustomPersonaId } from '../types/custom-persona';
import { CustomPersonaThreadService } from '../custom-persona/custom-persona-thread.service';
import { isCustomPersonaId } from '../types/custom-persona';

/**
 * AD-9 rolling summary generator with the hybrid (turn-count + token-budget)
 * trigger. Runs BACKGROUND-only after each completed assistant message; a
 * failure here never blocks the main chat.
 */
const CONTEXT_WINDOW_TOKENS = 32_000;

@Injectable({ providedIn: 'root' })
export class ContextManager {
  private readonly storage = inject(STORAGE_PORT);
  private readonly analytics = inject(ANALYTICS_PORT);
  private readonly assembler = inject(PromptAssembler);
  private readonly keyVault = inject(KeyVaultService);
  private readonly personaRouting = inject(PersonaRoutingService);
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly customThreads = inject(CustomPersonaThreadService);

  async onTurnComplete(
    threadKey: StorageKey,
    customPersonaId?: CustomPersonaId,
  ): Promise<void> {
    if (!FEATURE_ROLLING_SUMMARY) return;

    const thread = customPersonaId
      ? await this.customThreads.getThread(customPersonaId)
      : await this.storage.get<Thread>(threadKey);
    if (!thread) return;

    const turnCount = assistantMessageCount(thread);
    const projected = this.projectPromptText(thread);
    const estimated = estimateTokens(projected);

    const primary =
      turnCount > VERBATIM_TAIL_LENGTH &&
      thread.turnsSinceLastSummary >= SUMMARY_REFRESH_CADENCE;
    const safetyNet =
      estimated > (SUMMARY_TOKEN_BUDGET_PCT / 100) * CONTEXT_WINDOW_TOKENS;

    if (!primary && !safetyNet) {
      thread.turnsSinceLastSummary += 1;
      thread.updatedAt = Date.now();
      await this.persistThread(threadKey, thread, customPersonaId);
      return;
    }

    const persona: PersonaId =
      thread.scope === 'ask-both'
        ? 'musk'
        : isCustomPersonaId(thread.scope)
          ? 'einstein'
          : thread.scope;
    const providerId: ProviderId =
      thread.scope === 'ask-both'
        ? ASK_BOTH_SUMMARY_PROVIDER_ID
        : isCustomPersonaId(thread.scope)
          ? this.personaRouting.getProviderForCustom('gemini')
          : this.personaRouting.getProviderFor(persona);
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) return;

    const composedSummary = this.assembler.compose(
      persona,
      thread,
      'summarize',
    );
    const summaryPrompt = {
      ...composedSummary,
      model: this.modelSelection.getModelFor(providerId),
    };
    const AdapterClass = getProviderAdapter(providerId);
    const adapter = new (AdapterClass as unknown as new () => ProviderPort)();
    const controller = new AbortController();

    let summaryText = '';
    try {
      for await (const chunk of adapter.streamChat(
        summaryPrompt,
        key,
        controller.signal,
      )) {
        if (chunk.type === 'delta' && chunk.text) {
          summaryText += chunk.text;
        } else if (chunk.type === 'error') {
          this.analytics.emit({
            name: 'summary_failed',
            payload: {
              provider: providerId,
              category: chunk.meta?.error ?? 'unknown',
            },
          });
          return;
        }
      }
    } catch {
      this.analytics.emit({
        name: 'summary_failed',
        payload: { provider: providerId, category: 'unknown' },
      });
      return;
    }

    if (summaryText.trim().length === 0) return;

    thread.rollingSummary = summaryText.trim();
    thread.turnsSinceLastSummary = 0;
    thread.updatedAt = Date.now();
    await this.persistThread(threadKey, thread, customPersonaId);
  }

  private async persistThread(
    threadKey: StorageKey,
    thread: Thread,
    customPersonaId?: CustomPersonaId,
  ): Promise<void> {
    if (customPersonaId) {
      await this.customThreads.saveThread(customPersonaId, thread);
      return;
    }
    await this.storage.set(threadKey, thread);
  }

  private projectPromptText(thread: Thread): string {
    const summary = thread.rollingSummary ?? '';
    const tail = thread.messages
      .slice(-VERBATIM_TAIL_LENGTH)
      .map((m) => m.content)
      .join('\n');
    return `${summary}\n${tail}`;
  }
}
