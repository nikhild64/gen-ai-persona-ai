import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { customPersonaRouteGuard } from './custom-persona-route.guard';
import { CustomPersonaStore } from '../../domain/custom-persona/custom-persona.store';
import type { CustomPersonaRecord } from '../../domain/types/custom-persona';

const SAMPLE: CustomPersonaRecord = {
  id: 'custom:guard-test',
  createdAt: '2026-01-01T00:00:00.000Z',
  fullDisplayName: 'Guard Test',
  tagline: 'T',
  era: 'Living',
  disclaimerTier: 'contemporary',
  greeting: 'Hi',
  inputPlaceholder: 'Ask',
  starterQuestions: [],
  providerId: 'gemini',
  prompt: {
    identityBlock: 'I',
    voiceRules: 'V',
    refusalRules: 'R',
    voiceReminder: 'VR',
    fewShots: [],
    driftRefresh: 'D',
    selfVerificationChecklist: 'C',
  },
  sourceInput: { name: 'Guard' },
};

describe('customPersonaRouteGuard', () => {
  it('allows when persona exists', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [CustomPersonaStore],
    });
    TestBed.inject(CustomPersonaStore).save(SAMPLE);
    const result = TestBed.runInInjectionContext(() =>
      customPersonaRouteGuard(
        { paramMap: { get: (k: string) => (k === 'customId' ? 'guard-test' : null) } } as never,
        {} as never,
      ),
    );
    expect(result).toBe(true);
  });

  it('redirects when persona missing', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
    });
    const result = TestBed.runInInjectionContext(() =>
      customPersonaRouteGuard(
        { paramMap: { get: () => 'missing-id' } } as never,
        {} as never,
      ),
    );
    expect(result).not.toBe(true);
    expect(result).toEqual(TestBed.inject(Router).parseUrl('/'));
  });
});
