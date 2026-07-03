import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { CustomPersonaStore } from './custom-persona.store';
import { localStoreRemove } from '../key-vault/browser-local-storage';
import type { CustomPersonaRecord } from '../types/custom-persona';

const SAMPLE: CustomPersonaRecord = {
  id: 'custom:test-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  fullDisplayName: 'Ada Lovelace',
  tagline: 'First programmer',
  era: '17th century',
  disclaimerTier: 'historical',
  greeting: 'Hello.',
  inputPlaceholder: 'Ask Ada…',
  starterQuestions: ['Q1', 'Q2', 'Q3'],
  providerId: 'gemini',
  prompt: {
    identityBlock: 'You are Ada.',
    voiceRules: 'Formal.',
    refusalRules: 'No advice.',
    voiceReminder: 'Stay formal.',
    fewShots: [{ user: 'Hi', assistant: 'Hello.' }],
    driftRefresh: 'Reminder.',
    selfVerificationChecklist: 'Check.',
  },
  sourceInput: { name: 'Ada Lovelace' },
};

describe('CustomPersonaStore', () => {
  beforeEach(() => {
    localStoreRemove('custom-personas:v1');
    TestBed.resetTestingModule();
  });

  it('persists and lists personas', () => {
    const store = TestBed.inject(CustomPersonaStore);
    store.save(SAMPLE);
    expect(store.list()).toHaveLength(1);
    expect(store.get('custom:test-1')?.fullDisplayName).toBe('Ada Lovelace');
  });

  it('deletes a persona', () => {
    const store = TestBed.inject(CustomPersonaStore);
    store.save(SAMPLE);
    store.delete('custom:test-1');
    expect(store.get('custom:test-1')).toBeUndefined();
  });

  it('maps to registry entry with shared moderation templates', () => {
    const store = TestBed.inject(CustomPersonaStore);
    const entry = store.toRegistryEntry(SAMPLE);
    expect(entry.voiceReminder).toBe('Stay formal.');
    expect(entry.prompt.capRefusalTemplate.length).toBeGreaterThan(0);
    expect(entry.prompt.offDomainTemplate.length).toBeGreaterThan(0);
  });
});
