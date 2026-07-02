import { describe, it, expect } from 'vitest';

import * as CFG from './context-config';

describe('context-config (AD-9 thresholds)', () => {
  it('exports the exact AD-9 named constants with correct values', () => {
    expect(CFG.VERBATIM_TAIL_LENGTH).toBe(8);
    expect(CFG.SUMMARY_REFRESH_CADENCE).toBe(10);
    expect(CFG.SUMMARY_TOKEN_BUDGET_PCT).toBe(70);
    expect(CFG.DRIFT_REFRESH_FIRST_TURN).toBe(15);
    expect(CFG.DRIFT_REFRESH_CADENCE).toBe(10);
    expect(CFG.MAX_TURNS_PER_THREAD).toBe(40);
    expect(CFG.KEEP_GOING_ROUNDS).toBe(1);
    expect(CFG.STREAM_STALL_TIMEOUT_MS).toBe(30000);
  });
});
