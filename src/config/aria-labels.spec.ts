import { describe, it, expect } from 'vitest';

import {
  personaSwitcherLabel,
  modeSwitcherLabel,
  chatInputLabel,
  sendButtonLabel,
  keepGoingButtonLabel,
  settingsGearLabel,
  clearSessionButtonLabel,
  modalDismissLabel,
  disclaimerLinkLabel,
  personaCardLabel,
  keyStatusBadgeLabel,
  askBothVariantToggleLabel,
} from './aria-labels';

describe('aria-labels (AD-20 per EXPERIENCE.md Accessibility Floor)', () => {
  it('produces informative persona switcher labels', () => {
    expect(personaSwitcherLabel('musk')).toContain('Musk');
    expect(personaSwitcherLabel('jobs')).toContain('Jobs');
  });

  it('produces informative mode switcher labels', () => {
    expect(modeSwitcherLabel('solo')).toContain('Solo');
    expect(modeSwitcherLabel('ask-both')).toContain('Blend');
  });

  it('adapts chat-input label to null (ask-both) vs a specific persona', () => {
    expect(chatInputLabel(null)).toContain('blended');
    expect(chatInputLabel('musk')).toContain('Musk');
  });

  it('exposes static labels for every named interactive control', () => {
    [
      sendButtonLabel,
      keepGoingButtonLabel,
      settingsGearLabel,
      clearSessionButtonLabel,
      modalDismissLabel,
      disclaimerLinkLabel,
      personaCardLabel('jobs'),
    ].forEach((s) => expect(s.length).toBeGreaterThan(0));
  });

  it('varies keyStatusBadgeLabel by state and provider', () => {
    expect(keyStatusBadgeLabel('saved', 'gemini')).toContain('Gemini');
    expect(keyStatusBadgeLabel('saved', 'groq')).toContain('Groq');
    expect(keyStatusBadgeLabel('none')).toContain('No key');
  });

  it('AC-11: produces distinct Ask-Both variant toggle labels for each variant', () => {
    expect(askBothVariantToggleLabel('sequential')).toContain('Sequential');
    expect(askBothVariantToggleLabel('parallel')).toContain('Parallel');
    expect(askBothVariantToggleLabel('blended')).toContain('Blended');
    // All three labels announce the "Switch blend variant" purpose.
    ['sequential', 'parallel', 'blended'].forEach((v) => {
      expect(
        askBothVariantToggleLabel(v as 'sequential' | 'parallel' | 'blended'),
      ).toContain('blend variant');
    });
  });
});
