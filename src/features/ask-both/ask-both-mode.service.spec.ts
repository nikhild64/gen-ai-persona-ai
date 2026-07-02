import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AskBothModeService } from './ask-both-mode.service';

const STORAGE_KEY = 'settings:ask-both-mode:v1';

describe('AskBothModeService (blended-only Ask-Both)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('defaults to blended for fresh sessions', () => {
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
    expect(svc.mode()).toBe('blended');
  });

  it('persists user selection to sessionStorage under the closed StorageKey', () => {
    const svc = TestBed.inject(AskBothModeService);
    // Default is already blended — pick a different stored value to exercise persist().
    svc.set('sequential');
    expect(svc.get()).toBe('sequential');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('sequential');
  });

  it('primes state from sessionStorage on construction (survives reload)', () => {
    sessionStorage.setItem(STORAGE_KEY, 'blended');
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
  });

  it('ignores invalid sessionStorage payload and falls back to blended default', () => {
    sessionStorage.setItem(STORAGE_KEY, 'gibberish');
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
  });

  it('no-ops when setting the currently active mode (avoids redundant writes)', () => {
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
    sessionStorage.removeItem(STORAGE_KEY);
    svc.set('blended');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(null);
  });
});
