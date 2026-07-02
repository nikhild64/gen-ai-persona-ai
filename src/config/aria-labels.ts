import type { PersonaId } from '../domain/types/persona';
import type { ProviderId } from './provider-registry';
import type { AskBothMode } from './feature-flags';

import { personaDisplayName } from '../personas/persona.registry';

const modeDisplayName = (m: 'solo' | 'ask-both'): string =>
  m === 'solo' ? 'Solo' : 'Blend';

const askBothVariantDisplayName = (v: AskBothMode): string => {
  switch (v) {
    case 'sequential':
      return 'Sequential';
    case 'parallel':
      return 'Parallel';
    case 'blended':
      return 'Blended';
  }
};

const providerDisplayName = (p: ProviderId): string =>
  p === 'gemini' ? 'Gemini' : 'Groq';

export const personaSwitcherLabel = (p: PersonaId): string =>
  `Switch persona — currently ${personaDisplayName(p)}`;

export const modeSwitcherLabel = (m: 'solo' | 'ask-both'): string =>
  `Switch mode — currently ${modeDisplayName(m)}`;

export const askBothVariantToggleLabel = (v: AskBothMode): string =>
  `Switch blend variant — currently ${askBothVariantDisplayName(v)}`;

export const chatInputLabel = (p: PersonaId | null): string =>
  p ? `Message ${personaDisplayName(p)}` : 'Message blended pair';

export const sendButtonLabel = 'Send message';
export const keepGoingButtonLabel = 'Keep going — one more round';
export const settingsGearLabel = 'Open settings';
export const clearSessionButtonLabel = 'Clear all chat history';
export const modalDismissLabel = 'Close';
export const disclaimerLinkLabel =
  'Read parody disclaimer and contact for takedown';

export const personaCardLabel = (p: PersonaId): string =>
  `Chat with ${personaDisplayName(p)}`;

export const keyStatusBadgeLabel = (
  state: 'saved' | 'none',
  provider?: ProviderId,
): string => {
  if (state === 'saved' && provider) {
    return `Using your ${providerDisplayName(provider)} key`;
  }
  return 'No key saved — paste one in Settings';
};
