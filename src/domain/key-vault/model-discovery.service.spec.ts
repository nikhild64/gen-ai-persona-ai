import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { ModelDiscoveryService } from './model-discovery.service';
import { KeyVaultService } from './key-vault.service';

describe('ModelDiscoveryService', () => {
  let service: ModelDiscoveryService;
  let keyVault: KeyVaultService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModelDiscoveryService);
    keyVault = TestBed.inject(KeyVaultService);
    vi.restoreAllMocks();
  });

  it('skips refresh when no key is saved', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await service.refresh('gemini', true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches live models after a key is saved', async () => {
    keyVault.setKey('groq', 'gsk_test_key');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-oss-120b',
              active: true,
              input_modalities: ['text'],
              output_modalities: ['text'],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await service.refresh('groq', true);

    expect(service.state().groq.models?.map((m) => m.id)).toEqual([
      'openai/gpt-oss-120b',
    ]);
    expect(service.state().groq.error).toBeNull();
  });

  it('clears cached models when clear() is called', async () => {
    keyVault.setKey('groq', 'gsk_test_key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-oss-120b',
              active: true,
              input_modalities: ['text'],
              output_modalities: ['text'],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await service.refresh('groq', true);
    expect(service.state().groq.models?.length).toBe(1);

    service.clear('groq');

    expect(service.state().groq.models).toBeNull();
    expect(service.state().groq.error).toBeNull();
  });
});
