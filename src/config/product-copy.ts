import type { ProviderId } from './provider-registry';

/**
 * AD-22 — product chrome copy. Voice is neutral, warm, developer-friendly,
 * primarily English with occasional light Hinglish flavour (e.g. "Chai chalega?"
 * as a warm loading nod). Persona-voice strings (Hitesh/Piyush greetings,
 * refusal templates, input placeholders) live in `src/personas/*.prompt.ts` +
 * `src/personas/persona.registry.ts`, NEVER here — with the ONE documented
 * exception of `askBothGreeting` (see comment on that field).
 *
 * ESLint `no-restricted-syntax` (E0-S4) will police feature code against
 * inline signature-phrase literals to keep the boundary crisp.
 */

const providerName = (p: ProviderId): string =>
  p === 'gemini' ? 'Gemini' : 'Groq';

const providerKeyPrefixHint = (p: ProviderId): string =>
  p === 'gemini' ? 'AIza…' : 'gsk_…';

export const PRODUCT_COPY = {
  // ─── LANDING ─────────────────────────────────────────────────────────────
  landingHeroTitle: 'Council — advisors from across time.',
  brandName: 'Council',
  landingHeroSubheader:
    'Seven AI parody personas — pick one, or blend any two advisors.',
  landingCtaLabel: 'Start chatting',
  personaPickerSingleTitle: 'Choose an advisor',
  personaPickerSingleSubtitle: 'Tap a personality to start chatting.',
  personaPickerUnifiedTitle: 'Choose advisor(s)',
  personaPickerUnifiedSubtitle:
    'Pick one to chat solo, or two to blend their voices.',
  personaPickerSoloButtonLabel: 'Chat solo',
  personaPickerSoloButtonLabelFor: (name: string): string => `Chat with ${name}`,
  personaPickerBlendButtonLabel: 'Blend pair',
  personaPickerBlendButtonLabelFor: (a: string, b: string): string =>
    `Blend ${a} + ${b}`,
  personaPickerSelectionHintNone: 'Select 1 advisor for solo chat, or 2 to blend.',
  personaPickerSelectionHintOne: '1 selected — chat solo, or pick one more to blend.',
  personaPickerSelectionHintTwo: '2 selected — ready to blend or switch to solo.',
  landingDisclaimerBand:
    'AI parody personas — not affiliated with or endorsed by the real individuals or their estates. Educational research project exploring LLM-based persona modeling. All persona content is derived from publicly available materials and used under fair use for non-commercial educational purposes. Takedown requests honored immediately.',
  continueHint: 'Bring your own key to continue.',
  landingApiKeyHint:
    'Paste a Gemini or Groq API key to chat or create custom personas.',
  landingSettingsButtonLabel: 'API key & settings',

  // ─── CUSTOM PERSONA (EXPERIMENTAL) ───────────────────────────────────────
  customPersonaExperimentalChip: 'Experimental',
  customPersonaExperimentalDisclaimer:
    'This persona was generated on your device and may be less polished than curated advisors.',
  createPersonaCardTitle: 'Create persona',
  createPersonaCardTagline:
    'Describe a real person — Council builds a voice from your input.',
  createPersonaCardCta: 'Generate',
  createPersonaDialogTitle: 'Create persona (Experimental)',
  createPersonaDialogSubtitle:
    'Enter a name (required) and optional details. Your API key generates the persona locally — nothing is sent to our servers.',
  createPersonaNameLabel: 'Person name',
  createPersonaDetailsLabel: 'Extra details (optional)',
  createPersonaCreateLabel: 'Create persona',
  createPersonaCancelLabel: 'Cancel',
  createPersonaNoKeyMessage:
    'An API key is required to generate a persona. Add your Gemini or Groq key, then try again.',
  createPersonaAddKeyButtonLabel: 'Add API key',
  createPersonaErrorGeneric:
    'Could not generate — check your API key in Settings or add more details.',
  deleteCustomPersonaTitle: 'Delete this persona?',
  deleteCustomPersonaBody: (name: string): string =>
    `Remove ${name} and its chat history from this browser. This cannot be undone.`,
  deleteCustomPersonaConfirm: 'Delete',

  // ─── FOOTER (AD-22 disclaimer + takedown affordance, every route) ────────
  footerDisclaimer:
    'AI parody personas — not affiliated with or endorsed by the real individuals or their estates. Educational research project exploring LLM-based persona modeling. All persona content is derived from publicly available materials and used under fair use for non-commercial educational purposes. Takedown requests honored immediately.',
  takedownContact: 'Contact for takedown / concerns',
  takedownEmail: 'contact@example.com',
  takedownSubject: 'Council — takedown / feedback',

  // ─── SETTINGS ────────────────────────────────────────────────────────────
  settingsTitle: 'Settings',
  providerSelectLabel: 'Provider',
  apiKeyInputLabel: 'API key',
  keyFormatHelper: (p: ProviderId): string =>
    `${providerName(p)} keys start with "${providerKeyPrefixHint(p)}".`,
  keyFormatWarning: (p: ProviderId): string =>
    `That doesn't look like a ${providerName(p)} key — should start with "${providerKeyPrefixHint(p)}".`,
  saveButtonLabel: 'Save key',
  clearButtonLabel: 'Clear key',
  keyStatusUsingLabel: (p: ProviderId): string =>
    `Using your ${providerName(p)} key`,
  keyStatusNoKeyLabel: 'No key saved',
  keySavedToast: 'API key saved in this browser.',
  settingsAutoOpenHeader:
    'Paste an API key to start chatting with Council.',
  keyPrivacyDisclaimer:
    'Your key stays in this browser only. Never sent to our servers. Stored in local storage until you clear it or clear site data.',
  clearSessionMenuLabel: 'Clear chat history',

  // ─── STREAMING / STALL ───────────────────────────────────────────────────
  streamingIndicatorSolo: (personaName: string): string =>
    `${personaName} is typing…`,
  streamingIndicatorAskBothA: 'Hitesh is typing…',
  streamingIndicatorAskBothB: 'Piyush is responding to Hitesh…',
  streamingIndicatorAskBothParallel: 'Hitesh and Piyush are both typing…',
  streamingIndicatorAskBothBlended: (pairLabel: string): string =>
    `${pairLabel} are speaking as one…`,
  streamStallPromptBody:
    'Nothing has streamed for 30 seconds. This might be a slow provider — wait a bit more, or cancel and retry.',
  streamStallCancelLabel: 'Cancel',
  cancelledMessageBadge: 'Cancelled',
  switcherDisabledDuringStream: (personaName: string): string =>
    `${personaName} is still streaming — wait or cancel first.`,

  // ─── START-NEW-SESSION MODAL ─────────────────────────────────────────────
  startNewSessionTitle: 'Start a new session?',
  startNewSessionBody:
    'This clears the current thread. Your API key stays saved in this browser.',
  startNewSessionConfirmLabel: 'Start new',
  startNewSessionCancelLabel: 'Keep going',
  sessionClearedToast: 'Chat cleared. New session started.',
  startNewSessionMenuLabel: 'Start new session',

  // ─── MODE SWITCHER (Solo ↔ Blend) ────────────────────────────────────────
  modeSwitcherSoloLabel: 'Solo',
  modeSwitcherAskBothLabel: 'Blend',

  // ─── ASK-BOTH VARIANT TOGGLE (post-sprint Blended mode) ──────────────────
  askBothVariantLabels: {
    sequential: 'Sequential',
    parallel: 'Parallel',
    blended: 'Blended',
  },
  askBothVariantTooltip:
    'One blended answer — 1 LLM call (Sequential is 2, Parallel is 2).',
  askBothBlendedAttribution: (pairLabel: string): string => pairLabel,

  // ─── BLEND ROOM ──────────────────────────────────────────────────────────
  askBothBannerLabel:
    'Blend mode — tap the pair below to change advisors.',
  askBothGreeting:
    'Welcome to Blend — choose two advisors, then ask one question. You will get a single fused answer blending both voices.',
  askBothGreetingHint: 'Try different pairs — Hitesh + Piyush, Musk + Jobs, Gandhi + Einstein…',
  askBothBridgeAnnouncement:
    'The second persona is now responding.',
  askBothInputPlaceholder: 'Type your question for the blended pair…',
  askBothStarterQuestions: [
    'How should I approach a hard technical decision?',
    'What matters more — speed or craft?',
    'How do I stay focused when everything feels urgent?',
  ],
  askBothSendButtonLabel: 'Blend',
  askBothPairLabelA: 'Persona A',
  askBothPairLabelB: 'Persona B',

  // ─── KEEP-GOING / CAP / RATE LIMIT ───────────────────────────────────────
  keepGoingButtonLabel: 'Keep going',
  capReachedInputHint:
    'You have hit the 40-message cap for this thread. Start a new session to continue.',
  retryAfterHint: (seconds: number): string =>
    `Rate limited by the provider. Try again in about ${seconds}s, or paste a fresh API key in Settings.`,
} as const;

export type ProductCopyKey = keyof typeof PRODUCT_COPY;
