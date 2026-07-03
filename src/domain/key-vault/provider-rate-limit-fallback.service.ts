import { Injectable, inject } from '@angular/core';

import type { PersonaId } from '../types/persona';
import type { ProviderId } from '../../config/provider-registry';
import { PROVIDER_DEFAULT_MODELS } from '../../config/provider-registry';
import { KeyVaultService } from './key-vault.service';
import { ModelSelectionService } from './model-selection.service';
import { ModelDiscoveryService } from './model-discovery.service';
import { PersonaRoutingService } from './persona-routing.service';

export type ProviderStreamAttempt = {
  providerId: ProviderId;
  modelId: string;
  key: string;
};

function alternateProvider(provider: ProviderId): ProviderId {
  return provider === 'gemini' ? 'groq' : 'gemini';
}

/**
 * On HTTP 429, walk an ordered fallback chain: other models on the same
 * provider, then the alternate provider's curated models (default first).
 * Successful fallbacks update session-persisted model + persona routing.
 */
@Injectable({ providedIn: 'root' })
export class ProviderRateLimitFallbackService {
  private readonly keyVault = inject(KeyVaultService);
  private readonly modelSelection = inject(ModelSelectionService);
  private readonly modelDiscovery = inject(ModelDiscoveryService);
  private readonly personaRouting = inject(PersonaRoutingService);

  buildAttemptChain(
    providerId: ProviderId,
    modelId: string,
  ): ProviderStreamAttempt[] {
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) return [];

    const chain: ProviderStreamAttempt[] = [
      { providerId, modelId, key },
      ...this.fallbackTargets(providerId, modelId),
    ];
    return chain;
  }

  commitSuccessfulFallback(
    persona: PersonaId,
    initialProvider: ProviderId,
    attempt: ProviderStreamAttempt,
  ): void {
    if (attempt.providerId !== initialProvider) {
      this.personaRouting.setProviderFor(persona, attempt.providerId);
    }
    if (this.modelSelection.getModelFor(attempt.providerId) !== attempt.modelId) {
      this.modelSelection.setModelFor(attempt.providerId, attempt.modelId);
    }
  }

  private fallbackTargets(
    failedProvider: ProviderId,
    failedModel: string,
  ): ProviderStreamAttempt[] {
    const targets: ProviderStreamAttempt[] = [];
    const triedModels = new Set<string>([failedModel]);

    const sameKey = this.keyVault.getKeyForProvider(failedProvider);
    if (sameKey) {
      for (const modelId of this.modelIdsFor(failedProvider)) {
        if (triedModels.has(modelId)) continue;
        triedModels.add(modelId);
        targets.push({
          providerId: failedProvider,
          modelId,
          key: sameKey,
        });
      }
    }

    const alt = alternateProvider(failedProvider);
    const altKey = this.keyVault.getKeyForProvider(alt);
    if (!altKey) return targets;

    const altModels = this.modelIdsFor(alt);
    const defaultModel = PROVIDER_DEFAULT_MODELS[alt];
    const orderedAlt = [
      defaultModel,
      ...altModels.filter((id) => id !== defaultModel),
    ];
    for (const modelId of orderedAlt) {
      if (triedModels.has(modelId)) continue;
      triedModels.add(modelId);
      targets.push({ providerId: alt, modelId, key: altKey });
    }

    return targets;
  }

  private modelIdsFor(provider: ProviderId): string[] {
    return this.modelDiscovery
      .getModelsFor(provider)
      .map((m) => m.id);
  }
}
