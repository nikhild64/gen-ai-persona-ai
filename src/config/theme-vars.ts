/**
 * AD-17 — closed 5-element set of CSS custom properties that carry persona
 * theming. Stylelint (E0-S4) restricts persona SCSS to reading only these
 * variables; adding a new persona theme dimension is an AD update.
 */
export const THEME_VARS = [
  '--persona-accent',
  '--persona-bubble-bg',
  '--persona-avatar-url',
  '--persona-code-block-emphasis',
  '--persona-input-placeholder-style',
] as const;

export type ThemeVar = (typeof THEME_VARS)[number];
