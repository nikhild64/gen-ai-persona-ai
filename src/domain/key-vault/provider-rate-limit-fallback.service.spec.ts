import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { ProviderRateLimitFallbackService } from './provider-rate-limit-fallback.service';
import { KeyVaultService } from './key-vault.service';
import { ModelSelectionService } from './model-selection.service';
import { PersonaRoutingService } from './persona-routing.service';
import { AVAILABLE_MODELS } from '../../config/available-models';
import { PROVIDER_DEFAULT_MODELS } from '../../config/provider-registry';

describe('ProviderRateLimitFallbackService', () => {
  let service: ProviderRateLimitFallbackService;
  let keyVault: KeyVaultService;
  let modelSelection: ModelSelectionService;
  let personaRouting: PersonaRoutingService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProviderRateLimitFallbackService);
    keyVault = TestBed.inject(KeyVaultService);
    modelSelection = TestBed.inject(ModelSelectionService);
    personaRouting = TestBed.inject(PersonaRoutingService);
    keyVault.setKey('gemini', 'gemini-key');
    keyVault.setKey('groq', 'groq-key');
  });

  afterEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('orders same-provider models before alternate provider', () => {
    const startModel = AVAILABLE_MODELS.gemini[0]!.id;
    const chain = service.buildAttemptChain('gemini', startModel);

    expect(chain[0]).toEqual({
      providerId: 'gemini',
      modelId: startModel,
      key: 'gemini-key',
    });

    const sameProviderRest = chain
      .slice(1)
      .filter((a) => a.providerId === 'gemini')
      .map((a) => a.modelId);
    expect(sameProviderRest.length).toBeGreaterThan(0);
    expect(sameProviderRest).not.toContain(startModel);

    const altAttempts = chain.filter((a) => a.providerId === 'groq');
    expect(altAttempts.length).toBeGreaterThan(0);
    expect(altAttempts[0]!.modelId).toBe(PROVIDER_DEFAULT_MODELS.groq);
  });

  it('skips alternate provider when that key is missing', () => {
    keyVault.clearKey('groq');
    const startModel = modelSelection.getModelFor('gemini');
    const chain = service.buildAttemptChain('gemini', startModel);

    expect(chain.every((a) => a.providerId === 'gemini')).toBe(true);
  });

  it('commits provider + model overrides after a successful fallback', () => {
    const altModel = AVAILABLE_MODELS.groq[1]!.id;
    service.commitSuccessfulFallback('hitesh', 'gemini', {
      providerId: 'groq',
      modelId: altModel,
      key: 'groq-key',
    });

    expect(personaRouting.getProviderFor('hitesh')).toBe('groq');
    expect(modelSelection.getModelFor('groq')).toBe(altModel);

    const raw = sessionStorage.getItem('settings:persona-routing:v1');
    expect(raw).toContain('groq');
    const modelsRaw = sessionStorage.getItem('settings:model-selection:v1');
    expect(modelsRaw).toContain(altModel);
  });
});
