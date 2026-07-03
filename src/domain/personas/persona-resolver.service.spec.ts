import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { PersonaResolverService } from './persona-resolver.service';
import { CustomPersonaStore } from '../custom-persona/custom-persona.store';
import { builtinRef, customRef } from '../types/custom-persona';
import type { CustomPersonaRecord } from '../types/custom-persona';

const SAMPLE: CustomPersonaRecord = {
  id: 'custom:abc',
  createdAt: '2026-01-01T00:00:00.000Z',
  fullDisplayName: 'Test Person',
  tagline: 'Tag',
  era: 'Living',
  disclaimerTier: 'contemporary',
  greeting: 'Hi',
  inputPlaceholder: 'Ask…',
  starterQuestions: [],
  providerId: 'gemini',
  prompt: {
    identityBlock: 'Id',
    voiceRules: 'Voice',
    refusalRules: 'Refuse',
    voiceReminder: 'Reminder',
    fewShots: [],
    driftRefresh: 'Drift',
    selfVerificationChecklist: 'Check',
  },
  sourceInput: { name: 'Test' },
};

describe('PersonaResolverService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('resolves builtin personas from registry', () => {
    const resolver = TestBed.inject(PersonaResolverService);
    const entry = resolver.resolve(builtinRef('musk'));
    expect(entry?.fullDisplayName).toContain('Musk');
  });

  it('resolves custom personas from store', () => {
    TestBed.inject(CustomPersonaStore).save(SAMPLE);
    const resolver = TestBed.inject(PersonaResolverService);
    const entry = resolver.resolve(customRef('custom:abc'));
    expect(entry?.fullDisplayName).toBe('Test Person');
  });

  it('returns null for missing custom persona', () => {
    const resolver = TestBed.inject(PersonaResolverService);
    expect(resolver.resolve(customRef('custom:missing'))).toBeNull();
  });
});
