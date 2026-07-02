import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AskBothModeService } from './ask-both-mode.service';

const STORAGE_KEY = 'settings:ask-both-mode:v1';

describe('AskBothModeService (blended-only Ask-Both)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to blended for fresh sessions', () => {
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
    expect(svc.mode()).toBe('blended');
  });

  it('persists user selection to localStorage under the closed StorageKey', () => {
    const svc = TestBed.inject(AskBothModeService);
    svc.set('sequential');
    expect(svc.get()).toBe('sequential');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('sequential');
  });

  it('primes state from localStorage on construction (survives reload)', () => {
    localStorage.setItem(STORAGE_KEY, 'blended');
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
  });

  it('migrates legacy sessionStorage value on first read', () => {
    sessionStorage.setItem(STORAGE_KEY, 'parallel');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('parallel');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('parallel');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(null);
  });

  it('ignores invalid localStorage payload and falls back to blended default', () => {
    localStorage.setItem(STORAGE_KEY, 'gibberish');
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
  });

  it('no-ops when setting the currently active mode (avoids redundant writes)', () => {
    const svc = TestBed.inject(AskBothModeService);
    expect(svc.get()).toBe('blended');
    localStorage.removeItem(STORAGE_KEY);
    svc.set('blended');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
  });
});
