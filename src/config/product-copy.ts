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
  landingHeroTitle: 'Chat with Hitesh and Piyush.',
  landingHeroSubheader:
    'Two personas from the ChaiCode GenAI cohort — pick one, or ask both.',
  landingHiteshTagline:
    'Chai aur Code. Story sunata hun — phir tech samajhte hain saath mein.',
  landingPiyushTagline:
    'I build devs, not just apps. Dekho — chalo build karte hain.',
  landingCtaLabel: 'Start chatting',
  landingDisclaimerBand:
    'Parody personas — not affiliated with or endorsed by the real creators. This is a ChaiCode GenAI cohort project.',
  continueHint: 'Bring your own key to continue.',

  // ─── FOOTER (AD-22 disclaimer + takedown affordance, every route) ────────
  footerDisclaimer:
    'AI parody personas of Hitesh Choudhary and Piyush Garg. Built for the ChaiCode GenAI cohort. Not affiliated with the creators.',
  takedownContact: 'Contact for takedown / concerns',
  takedownEmail: 'contact@example.com',
  takedownSubject: 'Chai Code Personas — takedown / feedback',

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
  keySavedToast: 'API key saved for this browser session.',
  settingsAutoOpenHeader:
    'Chai chalega? Paste an API key to start chatting.',
  keyPrivacyDisclaimer:
    'Your key stays in this browser session only. Never sent to our servers, never persisted to disk, cleared when you close the tab.',
  clearSessionMenuLabel: 'Clear chat history',

  // ─── STREAMING / STALL ───────────────────────────────────────────────────
  streamingIndicatorSolo: (personaName: string): string =>
    `${personaName} is typing…`,
  streamingIndicatorAskBothA: 'Hitesh is typing…',
  streamingIndicatorAskBothB: 'Piyush is responding to Hitesh…',
  streamingIndicatorAskBothParallel: 'Hitesh and Piyush are both typing…',
  streamStallPromptBody:
    'Nothing has streamed for 30 seconds. This might be a slow provider — wait a bit more, or cancel and retry.',
  streamStallCancelLabel: 'Cancel',
  cancelledMessageBadge: 'Cancelled',
  switcherDisabledDuringStream: (personaName: string): string =>
    `${personaName} is still streaming — wait or cancel first.`,

  // ─── START-NEW-SESSION MODAL ─────────────────────────────────────────────
  startNewSessionTitle: 'Start a new session?',
  startNewSessionBody:
    'This clears the current thread. Your API key stays in this browser session.',
  startNewSessionConfirmLabel: 'Start new',
  startNewSessionCancelLabel: 'Keep going',
  sessionClearedToast: 'Chat cleared. New session started.',
  startNewSessionMenuLabel: 'Start new session',

  // ─── MODE SWITCHER (Solo ↔ Ask-Both) ─────────────────────────────────────
  modeSwitcherSoloLabel: 'Solo',
  modeSwitcherAskBothLabel: 'Ask both',

  // ─── ASK-BOTH ROOM ───────────────────────────────────────────────────────
  askBothBannerLabel: 'You are in Ask-Both mode — Hitesh answers first, then Piyush.',
  /**
   * AD-22 DOCUMENTED EXCEPTION: this joint greeting is persona-voiced despite
   * living in product-copy. Kept here because it is the ONLY message with no
   * single-persona `persona` attribution (it comes from "the room"). Source:
   * Addendum §D.3, byte-identical.
   */
  askBothGreeting:
    'Haanji! Welcome back. Aap Ask-Both mode mein ho — same sawaal poocho, dono jawab denge. Hitesh pehle bolega, phir Piyush uska take dekh ke apna angle add karega. Chai le lo, aur try karo — ek deep question daalo, dekhte hain kya nikalta hai.',
  askBothGreetingHint: 'Dono se poocho — kya doubt hai?',
  askBothBridgeAnnouncement:
    "Piyush is now responding to Hitesh's take.",
  askBothInputPlaceholder: 'Dono se poocho — kya doubt hai?',

  // ─── KEEP-GOING / CAP / RATE LIMIT ───────────────────────────────────────
  keepGoingButtonLabel: 'Keep going',
  capReachedInputHint:
    'You have hit the 40-message cap for this thread. Start a new session to continue.',
  retryAfterHint: (seconds: number): string =>
    `Rate limited by the provider. Try again in about ${seconds}s, or paste a fresh API key in Settings.`,
} as const;

export type ProductCopyKey = keyof typeof PRODUCT_COPY;
