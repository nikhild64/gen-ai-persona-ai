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
} from './aria-labels';

describe('aria-labels (AD-20 per EXPERIENCE.md Accessibility Floor)', () => {
  it('produces informative persona switcher labels', () => {
    expect(personaSwitcherLabel('hitesh')).toContain('Hitesh');
    expect(personaSwitcherLabel('piyush')).toContain('Piyush');
  });

  it('produces informative mode switcher labels', () => {
    expect(modeSwitcherLabel('solo')).toContain('Solo');
    expect(modeSwitcherLabel('ask-both')).toContain('Ask Both');
  });

  it('adapts chat-input label to null (ask-both) vs a specific persona', () => {
    expect(chatInputLabel(null)).toContain('both');
    expect(chatInputLabel('hitesh')).toContain('Hitesh');
  });

  it('exposes static labels for every named interactive control', () => {
    [
      sendButtonLabel,
      keepGoingButtonLabel,
      settingsGearLabel,
      clearSessionButtonLabel,
      modalDismissLabel,
      disclaimerLinkLabel,
      personaCardLabel('piyush'),
    ].forEach((s) => expect(s.length).toBeGreaterThan(0));
  });

  it('varies keyStatusBadgeLabel by state and provider', () => {
    expect(keyStatusBadgeLabel('saved', 'gemini')).toContain('Gemini');
    expect(keyStatusBadgeLabel('saved', 'groq')).toContain('Groq');
    expect(keyStatusBadgeLabel('none')).toContain('No key');
  });
});
