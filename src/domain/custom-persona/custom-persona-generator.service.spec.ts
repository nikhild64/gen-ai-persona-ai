import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CustomPersonaGeneratorService,
  CustomPersonaGenerationError,
} from './custom-persona-generator.service';
import { ADAPTER_FACTORY } from '../chat/chat-orchestrator.service';
import { KeyVaultService } from '../key-vault/key-vault.service';
import { MockAdapter } from '../../infrastructure/providers/testing/mock.adapter';
import { localStoreRemove } from '../key-vault/browser-local-storage';

const VALID_JSON = JSON.stringify({
  fullDisplayName: 'Ada Lovelace',
  tagline: 'First programmer',
  era: '17th century',
  disclaimerTier: 'historical',
  greeting: 'Welcome.',
  inputPlaceholder: 'Ask Ada…',
  starterQuestions: ['Q1', 'Q2', 'Q3'],
  prompt: {
    identityBlock: 'You are Ada Lovelace.',
    voiceRules: 'Formal voice.',
    refusalRules: 'No financial advice.',
    voiceReminder: 'Stay in character.',
    fewShots: [{ user: 'Hi', assistant: 'Hello.' }],
    driftRefresh: 'Voice reminder.',
    selfVerificationChecklist: 'Check voice.',
  },
});

describe('CustomPersonaGeneratorService', () => {
  beforeEach(() => {
    localStoreRemove('custom-personas:v1');
    TestBed.resetTestingModule();
  });

  it('parses valid JSON and saves persona', async () => {
    const mockAdapter = new MockAdapter().configure([
      { type: 'delta', text: VALID_JSON },
      { type: 'done' },
    ]);
    const AdapterClass = class {
      constructor() {
        return mockAdapter;
      }
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ADAPTER_FACTORY,
          useValue: () => AdapterClass as unknown as new () => unknown,
        },
      ],
    });
    const keyVault = TestBed.inject(KeyVaultService);
    vi.spyOn(keyVault, 'getKeyForProvider').mockReturnValue('AIza-test');

    const record = await TestBed.inject(CustomPersonaGeneratorService).generate(
      'Ada Lovelace',
    );
    expect(record.fullDisplayName).toBe('Ada Lovelace');
    expect(record.id).toMatch(/^custom:/);
    expect(record.prompt.voiceReminder).toBe('Stay in character.');
  });

  it('throws on malformed JSON', async () => {
    const mockAdapter = new MockAdapter().configure([
      { type: 'delta', text: 'not json at all' },
      { type: 'done' },
    ]);
    const AdapterClass = class {
      constructor() {
        return mockAdapter;
      }
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ADAPTER_FACTORY,
          useValue: () => AdapterClass as unknown as new () => unknown,
        },
      ],
    });
    const keyVault = TestBed.inject(KeyVaultService);
    vi.spyOn(keyVault, 'getKeyForProvider').mockReturnValue('AIza-test');

    await expect(
      TestBed.inject(CustomPersonaGeneratorService).generate('Someone'),
    ).rejects.toBeInstanceOf(CustomPersonaGenerationError);
  });

  it('throws no_key when vault empty', async () => {
    TestBed.configureTestingModule({});
    const keyVault = TestBed.inject(KeyVaultService);
    vi.spyOn(keyVault, 'getKeyForProvider').mockReturnValue(null);

    await expect(
      TestBed.inject(CustomPersonaGeneratorService).generate('Someone'),
    ).rejects.toMatchObject({ code: 'no_key' });
  });
});
