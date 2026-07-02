import { describe, it, expect } from 'vitest';

import { THEME_VARS } from './theme-vars';

describe('theme-vars (AD-17)', () => {
  it('exports exactly the 5 CSS custom properties', () => {
    expect(THEME_VARS).toEqual([
      '--persona-accent',
      '--persona-bubble-bg',
      '--persona-avatar-url',
      '--persona-code-block-emphasis',
      '--persona-input-placeholder-style',
    ]);
  });
});
