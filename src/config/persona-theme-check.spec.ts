import { describe, it, expect } from 'vitest';

import { assertContrast, __test__ } from './persona-theme-check';

describe('persona-theme-check (AD-20 WCAG)', () => {
  it('throws when contrast < 4.5:1 in normal-text mode', () => {
    expect(() => assertContrast('#FFFFFF', '#FEF3C7')).toThrowError(
      /fails WCAG AA/,
    );
  });

  it('passes for stone-900 on white (~17:1)', () => {
    expect(() => assertContrast('#FFFFFF', '#1C1917')).not.toThrow();
  });

  it('rejects invalid hex input clearly', () => {
    expect(() => assertContrast('not-a-hex', '#000000')).toThrowError(
      /Invalid hex/,
    );
  });

  it('computes a monotonically higher ratio for darker foregrounds on white', () => {
    const a = __test__.contrastRatio('#FFFFFF', '#666666');
    const b = __test__.contrastRatio('#FFFFFF', '#000000');
    expect(b).toBeGreaterThan(a);
  });
});
