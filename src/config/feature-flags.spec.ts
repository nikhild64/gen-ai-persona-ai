import { describe, it, expect } from 'vitest';

import {
  FEATURE_ASK_BOTH_MODE,
  FEATURE_ROLLING_SUMMARY,
  FEATURE_MODERATION,
  FEATURE_BYO_KEY,
  FEATURE_CUSTOM_PERSONA,
  ASK_BOTH_MODE,
} from './feature-flags';

describe('feature-flags (AD-1 build-time, AD-13 mode selector)', () => {
  it('defaults kill-switches ON', () => {
    expect(FEATURE_ASK_BOTH_MODE).toBe(true);
    expect(FEATURE_ROLLING_SUMMARY).toBe(true);
    expect(FEATURE_MODERATION).toBe(true);
    expect(FEATURE_CUSTOM_PERSONA).toBe(true);
  });

  it('keeps FEATURE_BYO_KEY unconditionally true (vestigial per PRD §11.3)', () => {
    expect(FEATURE_BYO_KEY).toBe(true);
  });

  it('defaults ASK_BOTH_MODE to blended (blended-only Ask-Both)', () => {
    expect(ASK_BOTH_MODE).toBe('blended');
  });
});
