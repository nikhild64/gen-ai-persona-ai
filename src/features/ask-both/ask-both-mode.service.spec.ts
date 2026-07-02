import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AskBothModeService } from './ask-both-mode.service';
import { ASK_BOTH_MODE } from '../../config/feature-flags';

const STORAGE_KEY = 'settings:ask-both-mode:v1';

describe('AskBothModeService (post-sprint Blended Ask-Both variant)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('AC-2: fresh session with no sessionStorage entry defaults to build-time ASK_BOTH_MODE', () => {
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe(ASK_BOTH_MODE);
    expect(svc.mode()).toBe(ASK_BOTH_MODE);
  });

  it('AC-7: persists user selection to sessionStorage under the closed StorageKey', () => {
    const svc = TestBed.inject(AskBothModeService);
    svc.set('blended');
    expect(svc.get()).toBe('blended');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('blended');
  });

  it('AC-7: primes state from sessionStorage on construction (survives reload)', () => {
    sessionStorage.setItem(STORAGE_KEY, 'blended');
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
  });

  it('ignores invalid sessionStorage payload and falls back to default', () => {
    sessionStorage.setItem(STORAGE_KEY, 'gibberish');
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe(ASK_BOTH_MODE);
  });

  it('accepts all three valid variants (Sequential | Parallel | Blended)', () => {
    const svc = TestBed.inject(AskBothModeService);
    // Order deliberately non-monotonic vs the initial default so every
    // set() is a real state change (avoids the set()==current no-op path
    // hiding the write).
    svc.set('blended');
    expect(svc.get()).toBe('blended');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('blended');

    svc.set('parallel');
    expect(svc.get()).toBe('parallel');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('parallel');

    svc.set('sequential');
    expect(svc.get()).toBe('sequential');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('sequential');
  });

  it('no-ops when setting the currently active mode (avoids redundant writes)', () => {
    const svc = TestBed.inject(AskBothModeService);
    svc.set('blended');
    sessionStorage.removeItem(STORAGE_KEY); // simulate external clear
    svc.set('blended');
    // No re-write happens because the value didn't change.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(null);
  });
});
