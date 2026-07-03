# Story E0-S3: Config constants + PROVIDER_REGISTRY + PERSONA_REGISTRY

Status: ready-for-dev

- **Epic:** 0 — Foundation
- **Critical-path position:** 3 of 37 (Day 1)
- **Blocks:** E0-S4, E2-S1, E2-S2, E2-S4, E3-S1, E4-S1, E4-S2, E5-S1, E6-S1, E6-S2, E8-S1, E9-S1, E10-S1, E11-S1, E1-S1, E1-S2, E12-S2
- **Depends on:** E0-S2

## Story

As a **solo developer**,
I want **all 11 config files under `src/config/` populated with their canonical constants and the `PROVIDER_REGISTRY` + `PERSONA_REGISTRY` wired to persona prompt file skeletons**,
So that **every AD-9 threshold, AD-11 KEY_PATTERN, AD-15 AnalyticsEvent arm, AD-17 THEME_VAR, and AD-22 product-copy key lives in exactly one place from Day 1**.

## Acceptance Criteria

**Given** the workspace is scaffolded,
**When** the developer authors `src/config/context-config.ts`,
**Then** it exports `VERBATIM_TAIL_LENGTH = 8`, `SUMMARY_REFRESH_CADENCE = 10`, `SUMMARY_TOKEN_BUDGET_PCT = 70`, `DRIFT_REFRESH_FIRST_TURN = 15`, `DRIFT_REFRESH_CADENCE = 10`, `MAX_TURNS_PER_THREAD = 40`, `KEEP_GOING_ROUNDS = 1`, `STREAM_STALL_TIMEOUT_MS = 30000` — every constant AD-9 names.

**Given** `context-config.ts` exists,
**When** the developer authors `src/config/feature-flags.ts`,
**Then** it exports `FEATURE_ASK_BOTH_MODE: boolean = true`, `FEATURE_ROLLING_SUMMARY: boolean = true`, `FEATURE_MODERATION: boolean = true`, `FEATURE_BYO_KEY: boolean = true` (vestigial per §11.3), and the SEPARATE `ASK_BOTH_MODE: 'sequential' | 'parallel' = 'sequential'` const per AD-13 (not to be conflated with the kill-switch); values read from `import.meta.env` or equivalent build-time source.

**Given** the flag file exists,
**When** the developer authors `src/config/provider-registry.ts`,
**Then** it exports `type ProviderId = 'gemini' | 'groq'`, a `PROVIDER_DEFAULT_ROUTING: Record<PersonaId, ProviderId>` mapping (`hitesh → 'gemini'`, `piyush → 'groq'` per AD-5 — subject to Spike-0 outcome), and `ASK_BOTH_SUMMARY_PROVIDER_ID: ProviderId = 'gemini'` per AD-9. Adapter class registration happens in Epic 2 story E2-S1 but the file skeleton is here.

**Given** the provider registry is defined,
**When** the developer authors `src/config/model-params.ts`,
**Then** `PERSONA_MODEL_PARAMS: Record<PersonaId, ChatRequestParams>` is populated per Addendum §B.4 — Hitesh (Gemini) `{ max_tokens: 1200, temperature: 0.75, top_p: 0.95, frequency_penalty: 0.2, presence_penalty: 0.3 }`, Piyush (Groq) `{ max_tokens: 1000, temperature: 0.55, top_p: 0.9, frequency_penalty: 0.05, presence_penalty: 0.1 }` — with an inline comment noting Piyush's low freq/presence penalty is INTENTIONAL to preserve `देखो`/`यार`/`OK?` repetition.

**Given** the model-params file exists,
**When** the developer authors `src/config/prompt-format.ts`,
**Then** it exports `ASK_BOTH_SYSTEM_NOTE_TEMPLATE(personaName: string, priorText: string): string` returning `` `[System note: ${personaName} just said the following to the user:\n\n${priorText}]` `` per AD-13, and `ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(userMessage: string, personaAText: string, personaBText: string): string` returning the analogous three-part template.

**Given** prompt-format is drafted,
**When** the developer authors `src/config/theme-vars.ts`,
**Then** it exports `const THEME_VARS = ['--persona-accent', '--persona-bubble-bg', '--persona-avatar-url', '--persona-code-block-emphasis', '--persona-input-placeholder-style'] as const;` per AD-17 — the closed set of CSS custom properties that Stylelint will police in E0-S4.

**Given** theme-vars is drafted,
**When** the developer authors `src/config/persona-theme-check.ts`,
**Then** it exports `assertContrast(bg: string, fg: string): void` that computes WCAG relative-luminance-ratio and throws when < 4.5:1 (called from unit tests per AD-20).

**Given** persona-theme-check exists,
**When** the developer authors `src/config/storage-keys.ts`,
**Then** it exports `type StorageKey = 'chat:hitesh:v1' | 'chat:piyush:v1' | 'chat:ask-both:v1' | 'settings:v1';` per AD-6 — closed union, adding a key requires an AD update.

**Given** storage-keys exists,
**When** the developer authors `src/config/regex-patterns.ts`,
**Then** it exports `HITESH_REGEX = /Haanji|chai|samjha kya|yaar|😁|kro|msst|smjh/i;` and `PIYUSH_REGEX = /देखो|यार|बात समझ आई|OK\?|Hey everyone|कुछ नहीं है/i;` per AD-19.

**Given** regex-patterns exists,
**When** the developer authors `src/config/aria-labels.ts`,
**Then** it exports named string constants + functions for every interactive control (per EXPERIENCE.md.Accessibility Floor list: `personaSwitcherLabel`, `modeSwitcherLabel`, `chatInputLabel`, `sendButtonLabel`, `keepGoingButtonLabel`, `settingsGearLabel`, `clearSessionButtonLabel`, `modalDismissLabel`, `disclaimerLinkLabel`, `keyStatusBadgeLabel`).

**Given** aria-labels exists,
**When** the developer authors `src/config/product-copy.ts`,
**Then** it exports a single object literal with keys for every product-chrome copy string named in EXPERIENCE.md.Voice and Tone + State Patterns (landing hero, disclaimer, footer disclaimer, footer takedown, settings auto-open header, key-status-badge templates, streaming-indicator per-mode labels, `askBothGreeting` per AD-22 exception, mode-switcher labels, confirm-modal copy, etc.). Persona-voice strings (Hitesh/Piyush greetings, input placeholders, refusal templates) do NOT live here — they live in `src/personas/persona.registry.ts` (`greeting` + `inputPlaceholder`) and `src/personas/*.prompt.ts` (REFUSAL RULES) respectively per AD-22.

**Given** all 11 config files exist,
**When** the developer authors `src/personas/persona.registry.ts`,
**Then** it exports `PERSONA_REGISTRY: Record<PersonaId, { prompt: PromptComposition; greeting: string; inputPlaceholder: string; providerId: ProviderId }>` — greeting + inputPlaceholder verbatim from Addendum §D.1/§D.2, providerId per PROVIDER_DEFAULT_ROUTING, prompt reference points at `hitesh.prompt.ts` / `piyush.prompt.ts` skeletons (identityBlock/voiceRules/refusalRules/fewShots/askBothCollabExamples/driftRefresh/selfVerificationChecklist exports).

**Given** all files above compile,
**When** the developer runs `tsc --noEmit && ng lint`,
**Then** both commands exit 0 with no errors.

**verifies:** AD-5 (Provider set + KEY_PATTERN discipline), AD-6 (StorageKey union), AD-8 (prompt-format templates), AD-9 (all context-config thresholds), AD-11 (theme-vars for aria-announcer + persona-theme-check for contrast), AD-13 (ASK_BOTH_MODE separate const + ASK_BOTH_SYSTEM_NOTE_TEMPLATE), AD-15 (AnalyticsEvent enum arm coverage via later stories), AD-17 (THEME_VARS closed set), AD-19 (persona regex patterns), AD-20 (aria-labels + assertContrast), AD-22 (product-copy separation)

**touches:** `src/config/context-config.ts`, `src/config/feature-flags.ts`, `src/config/provider-registry.ts`, `src/config/model-params.ts`, `src/config/prompt-format.ts`, `src/config/theme-vars.ts`, `src/config/persona-theme-check.ts`, `src/config/storage-keys.ts`, `src/config/regex-patterns.ts`, `src/config/aria-labels.ts`, `src/config/product-copy.ts`, `src/personas/persona.registry.ts`, `src/personas/hitesh.prompt.ts` (skeleton with identityBlock + voiceRules from Addendum §C.2), `src/personas/piyush.prompt.ts` (skeleton with identityBlock + voiceRules from Addendum §C.3)

**test target:** unit test (each config's export shape verified; `assertContrast` throws for a known-bad combination + passes for a known-good; `HITESH_REGEX` matches a research §A.1 sample and `PIYUSH_REGEX` matches a research §B.1 sample; `PERSONA_REGISTRY[personaId].greeting` matches Addendum §D verbatim; `ASK_BOTH_SYSTEM_NOTE_TEMPLATE('Hitesh', 'sample')` produces the exact AD-13 v1 template string)

## Developer Context

Biggest story in Epic 0 — 11 config files + 3 persona files + the PERSONA_REGISTRY. Everything downstream reads from these. Get this right and Epic 2/4/5/6/8/9/10/11 all have a stable substrate.

**One-file-per-concern discipline:** these are 11 separate files intentionally — NOT one big config object. That's because ESLint `no-restricted-syntax` from E0-S4 will police "no shadowing/re-declaration of constants" per canonical file (e.g., `VERBATIM_TAIL_LENGTH` outside `context-config.ts` fails lint).

**Persona files start as SKELETONS:** in this story `hitesh.prompt.ts` + `piyush.prompt.ts` land the `identityBlock` + `voiceRules` exports (verbatim from Addendum §C.2 + §C.3). REFUSAL RULES + fewShots + askBothCollabExamples + capRefusalTemplate + quotaExhaustedTemplate + category-specific refusal templates + driftRefresh + selfVerificationChecklist come in later stories:
- E2-S2: `fewShots` (6 verbatim from research §C.3)
- E5-S3: `driftRefresh` (Addendum §C.4)
- E7-S1: `capRefusalTemplate` (Addendum §E)
- E7-S2: `quotaExhaustedTemplate` (Addendum §E)
- E8-S1: full `refusalRules` block + `askBothCollabExamples`
- E8-S2: category-specific templates (`offDomainTemplate`, `politicalTemplate`, `adultTemplate`, `promptInjectionTemplate`)

**Readiness-gap #4 (optional consolidation, per user request):** declare the FULL `PromptComposition` type shape upfront in this story with empty placeholder strings — every downstream story then POPULATES existing fields rather than adding new ones. This avoids 5+ separate touches on `persona.registry.ts`. **DO THIS** — the shape is:

```ts
// src/personas/persona.registry.ts — full PromptComposition type shape
// Populated incrementally: identityBlock + voiceRules (E0-S3, this story) →
// fewShots (E2-S2) → driftRefresh (E5-S3) → capRefusalTemplate (E7-S1) →
// quotaExhaustedTemplate (E7-S2) → refusalRules + askBothCollabExamples (E8-S1) →
// category templates (E8-S2). All fields declared here with '' placeholders;
// later stories fill them in-place, NEVER re-declare the type shape.

export type PromptComposition = {
  identityBlock: string;                     // E0-S3: populated from Addendum §C.2/§C.3
  voiceRules: string;                        // E0-S3: populated from Addendum §C.2/§C.3
  refusalRules: string;                      // E0-S3: '' placeholder — E8-S1 populates
  fewShots: Array<{ user: string; assistant: string }>;  // E0-S3: [] placeholder — E2-S2 populates with 3 per persona
  askBothCollabExamples: string[];           // E0-S3: [] placeholder — E8-S1 populates from Addendum §E.3
  driftRefresh: string;                      // E0-S3: '' placeholder — E5-S3 populates from Addendum §C.4
  selfVerificationChecklist: string;         // E0-S3: populated from Addendum §C.5 (per-persona variant)
  capRefusalTemplate: string;                // E0-S3: '' placeholder — E7-S1 populates from Addendum §E
  quotaExhaustedTemplate: string;            // E0-S3: '' placeholder — E7-S2 populates from Addendum §E
  offDomainTemplate: string;                 // E0-S3: '' placeholder — E8-S2 populates from Addendum §E
  politicalTemplate: string;                 // E0-S3: '' placeholder — E8-S2 populates from Addendum §E
  adultTemplate: string;                     // E0-S3: '' placeholder — E8-S2 populates from Addendum §E
  promptInjectionTemplate: string;           // E0-S3: '' placeholder — E8-S2 populates from Addendum §E
  fabricationBaitTemplate: string;           // E0-S3: '' placeholder — E8-S1/E8-S2 populates
  hostileUserTemplate: string;               // E0-S3: '' placeholder — E8-S1/E8-S2 populates
  modelFailureTemplate: string;              // E0-S3: '' placeholder — E8-S1/E8-S2 populates
  selfIdentificationResponse: string;        // E0-S3: populated from Addendum §C.2/§C.3 (BYTE-IDENTICAL — snapshot-tested per AD-22)
};
```

This is the single field-shape declaration. Later stories touch `hitesh.prompt.ts` + `piyush.prompt.ts` to fill in field values; they do NOT modify `persona.registry.ts` type shape again.

## Technical Requirements

### `src/config/context-config.ts` (AD-9)

```ts
export const VERBATIM_TAIL_LENGTH = 8;
export const SUMMARY_REFRESH_CADENCE = 10;
export const SUMMARY_TOKEN_BUDGET_PCT = 70;
export const DRIFT_REFRESH_FIRST_TURN = 15;
export const DRIFT_REFRESH_CADENCE = 10;
export const MAX_TURNS_PER_THREAD = 40;
export const KEEP_GOING_ROUNDS = 1;
export const STREAM_STALL_TIMEOUT_MS = 30000;
```

### `src/config/feature-flags.ts` (AD-1 build-time, AD-13 mode selector)

```ts
// Reads Vercel/Vite build env at bundle time per AD-1 (Pure FE — no runtime flag reads).
// A flip requires rebuild + redeploy (~1 min). Fallback true for prod safety.
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const FEATURE_ASK_BOTH_MODE: boolean = env.VITE_FEATURE_ASK_BOTH_MODE !== 'false';
export const FEATURE_ROLLING_SUMMARY: boolean = env.VITE_FEATURE_ROLLING_SUMMARY !== 'false';
export const FEATURE_MODERATION: boolean = env.VITE_FEATURE_MODERATION !== 'false';
// FEATURE_BYO_KEY: Vestigial in Pure FE per PRD §11.3 — BYO-Key is mandatory;
// retained as unconditional true for future BE-proxy pivot
export const FEATURE_BYO_KEY: boolean = true;

// SEPARATE from the kill-switch — AD-13. Selects Sequential vs Parallel branch of Ask-Both.
export const ASK_BOTH_MODE: 'sequential' | 'parallel' =
  env.VITE_ASK_BOTH_MODE === 'parallel' ? 'parallel' : 'sequential';
```

If Angular 21 doesn't expose `import.meta.env` natively, use the Angular convention (fileReplacements for `src/environments/environment.ts`) — decision documented in E10-S1 comment.

### `src/config/provider-registry.ts` (AD-5, AD-9)

```ts
import type { PersonaId } from '../domain/types/message';

export type ProviderId = 'gemini' | 'groq';

// AD-5 default routing — Hitesh → Gemini for Hinglish edge, Piyush → Groq for speed.
// SUBJECT TO SPIKE-0 OUTCOME (E0.5-S1): if Gemini browser-CORS fails, fallback (a) flips
// hitesh → 'groq' single-provider variant. Update this file post-Spike per that story's AC.
export const PROVIDER_DEFAULT_ROUTING: Record<PersonaId, ProviderId> = {
  hitesh: 'gemini',
  piyush: 'groq',
};

// AD-9: Ask-Both thread Rolling Summary uses Persona-A's default provider (Gemini) to match turn order.
export const ASK_BOTH_SUMMARY_PROVIDER_ID: ProviderId = 'gemini';

// PROVIDER_REGISTRY (Map<ProviderId, ProviderPortAdapterClass>) is populated in E2-S1
// (this story just lands the types + defaults; adapter classes land later).
```

### `src/config/model-params.ts` (Addendum §B.4)

```ts
import type { PersonaId, ChatRequestParams } from '../domain/types/message';

export type PersonaModelParams = ChatRequestParams & { modelName: string };

export const PERSONA_MODEL_PARAMS: Record<PersonaId, PersonaModelParams> = {
  hitesh: {
    modelName: 'gemini-3.1-flash-lite',
    temperature: 0.75,
    topP: 0.95,
    maxOutputTokens: 1200,
    frequencyPenalty: 0.2,
    presencePenalty: 0.3,
  },
  // INTENTIONAL: Piyush's low frequency + presence penalty is a feature, not a bug.
  // His repetition of `देखो` / `यार` / `OK?` is a signature-phrase behavior we want
  // preserved — penalizing it would flatten the persona (per Addendum §B.4).
  piyush: {
    modelName: 'openai/gpt-oss-120b',
    temperature: 0.55,
    topP: 0.9,
    maxOutputTokens: 1000,
    frequencyPenalty: 0.05,
    presencePenalty: 0.1,
  },
};
```

### `src/config/prompt-format.ts` (AD-13)

```ts
export const ASK_BOTH_SYSTEM_NOTE_TEMPLATE = (
  personaName: string,
  priorText: string,
): string => `[System note: ${personaName} just said the following to the user:\n\n${priorText}]`;

export const ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE = (
  userMessage: string,
  personaAText: string,
  personaBText: string,
): string =>
  `[System note: The user's original message was:\n\n${userMessage}\n\nPersona A said:\n\n${personaAText}\n\nPersona B said:\n\n${personaBText}\n\nRespond to Persona B's angle while addressing the user.]`;
```

### `src/config/theme-vars.ts` (AD-17)

```ts
export const THEME_VARS = [
  '--persona-accent',
  '--persona-bubble-bg',
  '--persona-avatar-url',
  '--persona-code-block-emphasis',
  '--persona-input-placeholder-style',
] as const;

export type ThemeVar = (typeof THEME_VARS)[number];
```

### `src/config/persona-theme-check.ts` (AD-20)

```ts
// WCAG 2.1 relative-luminance-ratio formula. Fails when contrast < 4.5:1 (AA normal text).
// AA large-text (>=18pt OR >=14pt bold) tolerates >= 3:1 — pass `mode: 'large-text'` to allow.
function relativeLuminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(bgHex: string, fgHex: string): number {
  const l1 = relativeLuminance(bgHex);
  const l2 = relativeLuminance(fgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function assertContrast(bg: string, fg: string, mode: 'normal' | 'large-text' = 'normal'): void {
  const ratio = contrastRatio(bg, fg);
  const threshold = mode === 'large-text' ? 3.0 : 4.5;
  if (ratio < threshold) {
    throw new Error(
      `Contrast ratio ${ratio.toFixed(2)}:1 between bg ${bg} and fg ${fg} fails WCAG AA (${mode}, threshold ${threshold}:1).`,
    );
  }
}
```

### `src/config/storage-keys.ts` (AD-6) — REPLACE the stub from E0-S2

```ts
export type StorageKey =
  | 'chat:hitesh:v1'
  | 'chat:piyush:v1'
  | 'chat:ask-both:v1'
  | 'settings:v1';
```

### `src/config/regex-patterns.ts` (AD-19)

```ts
// Observation-only per AD-19. Miss = analytics event emit, NEVER regenerate.
export const HITESH_REGEX = /Haanji|chai|samjha kya|yaar|😁|kro|msst|smjh/i;
export const PIYUSH_REGEX = /देखो|यार|बात समझ आई|OK\?|Hey everyone|कुछ नहीं है/i;
```

### `src/config/aria-labels.ts` (AD-20 per EXPERIENCE.md Accessibility Floor)

```ts
import type { PersonaId } from '../domain/types/message';
import type { ProviderId } from './provider-registry';

const personaDisplayName = (p: PersonaId): string => (p === 'hitesh' ? 'Hitesh' : 'Piyush');
const modeDisplayName = (m: 'solo' | 'ask-both'): string => (m === 'solo' ? 'Solo' : 'Ask Both');

export const personaSwitcherLabel = (p: PersonaId): string =>
  `Switch persona — currently ${personaDisplayName(p)}`;

export const modeSwitcherLabel = (m: 'solo' | 'ask-both'): string =>
  `Switch mode — currently ${modeDisplayName(m)}`;

export const chatInputLabel = (p: PersonaId | null): string =>
  p ? `Message ${personaDisplayName(p)}` : 'Ask both personas';

export const sendButtonLabel = 'Send message';
export const keepGoingButtonLabel = 'Keep going — one more round';
export const settingsGearLabel = 'Open settings';
export const clearSessionButtonLabel = 'Clear all chat history';
export const modalDismissLabel = 'Close';
export const disclaimerLinkLabel = 'Read parody disclaimer and contact for takedown';

export const personaCardLabel = (p: PersonaId): string =>
  `Chat with ${personaDisplayName(p)}`;

export const keyStatusBadgeLabel = (state: 'saved' | 'none', provider?: ProviderId): string => {
  if (state === 'saved' && provider) {
    return `Using your ${provider === 'gemini' ? 'Gemini' : 'Groq'} key`;
  }
  return 'No key saved — paste one in Settings';
};
```

### `src/config/product-copy.ts` (AD-22)

Single object literal with keys named exactly as EXPERIENCE.md.Voice and Tone + State Patterns + Component Patterns reference them. Neutral warm English + occasional light Hinglish flavor. Persona-voice strings do NOT live here.

Populate at minimum:
- `landingHeroTitle`, `landingHeroSubheader`, `landingHiteshTagline`, `landingPiyushTagline`, `landingCtaLabel`, `landingDisclaimerBand`, `continueHint`
- `footerDisclaimer`, `takedownContact`, `takedownEmail`, `takedownSubject`
- `settingsTitle`, `providerSelectLabel`, `apiKeyInputLabel`, `keyFormatHelper` (function per provider), `keyFormatWarning` (function per provider), `saveButtonLabel`, `clearButtonLabel`, `keyStatusUsingLabel` (function), `keyStatusNoKeyLabel`, `keySavedToast`, `settingsAutoOpenHeader` (`"Chai chalega? Paste an API key to start chatting."` — AD-22 documented exception)
- `streamingIndicatorSolo` (function), `streamingIndicatorAskBothA`, `streamingIndicatorAskBothB`, `streamingIndicatorAskBothParallel`, `streamStallPromptBody`, `streamStallCancelLabel`, `cancelledMessageBadge`, `switcherDisabledDuringStream` (function)
- `startNewSessionTitle`, `startNewSessionBody`, `startNewSessionConfirmLabel`, `startNewSessionCancelLabel`, `sessionClearedToast`, `startNewSessionMenuLabel`
- `modeSwitcherSoloLabel`, `modeSwitcherAskBothLabel`
- `askBothBannerLabel`, `askBothGreeting` (verbatim from Addendum §D.3 — the ONE AD-22 exception carrying fuller Hinglish), `askBothGreetingHint`, `askBothBridgeAnnouncement` (`"Piyush is now responding to Hitesh's take."`)
- `keepGoingButtonLabel` (`"Keep going"` — note: same key name as aria-labels but for visible text)
- `capReachedInputHint`, `retryAfterHint` (function taking seconds)
- Any additional keys referenced by EXPERIENCE.md or DESIGN.md that later stories will need

### `src/personas/hitesh.prompt.ts` SKELETON (Addendum §C.2)

Export the fully-typed `PromptComposition` object with `identityBlock` + `voiceRules` + `selfVerificationChecklist` + `selfIdentificationResponse` populated verbatim from Addendum §C.2. All other fields are `''` / `[]` placeholders per the readiness-gap #4 consolidation.

**`selfIdentificationResponse` MUST be byte-identical to** `"Nahi yaar, main ek AI hun jo Hitesh ki style copy karta hai — ye ChaiCode cohort ka project hai. Real Hitesh ke channel pe zaroor jao."` — snapshot-tested in E8-S1.

### `src/personas/piyush.prompt.ts` SKELETON (Addendum §C.3)

Same shape as Hitesh; `identityBlock` + `voiceRules` from Addendum §C.3; `selfIdentificationResponse` byte-identical to `"देखो actually मैं एक AI हूं जो Piyush की style copy करता है — this is a ChaiCode cohort project. Real Piyush के channel पे जाओ."`.

### `src/personas/persona.registry.ts` (AD-17)

```ts
import type { PersonaId } from '../domain/types/message';
import type { ProviderId } from '../config/provider-registry';
import { PROVIDER_DEFAULT_ROUTING } from '../config/provider-registry';
import * as hiteshPrompt from './hitesh.prompt';
import * as piyushPrompt from './piyush.prompt';

// Full type shape declared here — later stories POPULATE fields, never re-declare.
export type PromptComposition = { /* ...see field list above... */ };

export const PERSONA_REGISTRY: Record<PersonaId, {
  prompt: PromptComposition;
  greeting: string;
  inputPlaceholder: string;
  providerId: ProviderId;
}> = {
  hitesh: {
    prompt: hiteshPrompt.default,
    // Addendum §D.1 verbatim:
    greeting: "Haanji! Swagat hai. Kya seekhna hai aaj — koi tech topic, project ka doubt, ya bas thodi baat-cheet chai ke saath? Bataao, main yahi hun.",
    inputPlaceholder: "Kya doubt hai bhai? Type karo...",
    providerId: PROVIDER_DEFAULT_ROUTING.hitesh,
  },
  piyush: {
    prompt: piyushPrompt.default,
    // Addendum §D.2 verbatim:
    greeting: "Hey everyone, welcome back. Welcome back to another exciting chat. देखो, kya haal? कुछ बनाना है? कोई concept clear नहीं है? या system design का doubt? Type करो — एक काम करते हैं.",
    inputPlaceholder: "देखो, kya doubt hai? Type karo...",
    providerId: PROVIDER_DEFAULT_ROUTING.piyush,
  },
};

export const personaDisplayName = (p: PersonaId): string => (p === 'hitesh' ? 'Hitesh' : 'Piyush');
```

## Architecture Compliance

- **AD-5:** `PROVIDER_DEFAULT_ROUTING` is subject to Spike-0 outcome — if E0.5-S1 fallback (a) fires, this file gets `hitesh: 'groq'`. Story E0.5-S1 has the AC to make the change.
- **AD-6:** `StorageKey` is a closed union. Adding a key requires an AD update.
- **AD-8:** `PromptMode` union already lands in E0-S2; `ASK_BOTH_SYSTEM_NOTE_TEMPLATE` + `ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE` land here in `prompt-format.ts`.
- **AD-9:** All 8 thresholds (`VERBATIM_TAIL_LENGTH`, `SUMMARY_REFRESH_CADENCE`, `SUMMARY_TOKEN_BUDGET_PCT`, `DRIFT_REFRESH_FIRST_TURN`, `DRIFT_REFRESH_CADENCE`, `MAX_TURNS_PER_THREAD`, `KEEP_GOING_ROUNDS`, `STREAM_STALL_TIMEOUT_MS`) live in `context-config.ts` exactly once. E0-S4's ESLint `no-restricted-syntax` bans re-declaration outside this file.
- **AD-11:** `KEY_PATTERN` is a `static` on each adapter CLASS (E2-S1) — not in config. This story lands `PROVIDER_DEFAULT_ROUTING` + `ProviderId` type; adapters land the patterns.
- **AD-13:** `ASK_BOTH_MODE` and `FEATURE_ASK_BOTH_MODE` are SEPARATE — do not conflate.
- **AD-17:** `THEME_VARS` is the closed 5-element array; Stylelint from E0-S4 restricts CSS to these vars.
- **AD-19:** `HITESH_REGEX` + `PIYUSH_REGEX` are observation-only (persona_regex_miss analytics event); NEVER regenerate on miss.
- **AD-20:** `assertContrast` + `aria-labels.ts` land here; component tests call `assertContrast` from E4-S2 onwards.
- **AD-22:** persona-voice content lives in `persona.registry.ts` + `personas/*.prompt.ts`, never in `product-copy.ts` (the ONE exception is `askBothGreeting` per AD-22 documented rationale).

## Library / Framework Requirements

No new npm packages this story. Everything is pure TS + type declarations + string constants + one WCAG luminance function.

## File Structure Requirements

```
src/config/
  context-config.ts
  feature-flags.ts
  provider-registry.ts
  model-params.ts
  prompt-format.ts
  theme-vars.ts
  persona-theme-check.ts
  storage-keys.ts            # REPLACES the E0-S2 stub
  regex-patterns.ts
  aria-labels.ts
  product-copy.ts
src/personas/
  persona.registry.ts        # PERSONA_REGISTRY + PromptComposition type shape (full field list)
  hitesh.prompt.ts           # SKELETON: identityBlock + voiceRules + selfVerificationChecklist + selfIdentificationResponse populated; rest '' / []
  piyush.prompt.ts           # SKELETON: same
```

## Testing Requirements

- `src/config/*.spec.ts` — each config file has a spec verifying its exports match the documented shape/values.
- `src/config/persona-theme-check.spec.ts` — `assertContrast('#FFFFFF', '#FEF3C7')` throws (amber-100 on white ~1.7:1); `assertContrast('#FFFFFF', '#1C1917')` passes (stone-900 on white 17.4:1); Hitesh amber-600 with 500-weight 13px+ label passes at `mode: 'large-text'`.
- `src/config/regex-patterns.spec.ts` — `HITESH_REGEX.test('Haanji chai peeni hai')` true; `PIYUSH_REGEX.test('देखो actually कुछ नहीं है')` true; each regex misses a known-neutral string.
- `src/config/prompt-format.spec.ts` — `ASK_BOTH_SYSTEM_NOTE_TEMPLATE('Hitesh', 'sample text')` returns exactly `"[System note: Hitesh just said the following to the user:\n\nsample text]"`.
- `src/personas/persona.registry.spec.ts` — `PERSONA_REGISTRY.hitesh.greeting` equals the Addendum §D.1 string BYTE-IDENTICAL; `PERSONA_REGISTRY.piyush.greeting` matches §D.2; `providerId` matches `PROVIDER_DEFAULT_ROUTING`.

## Latest Tech Information

- `import.meta.env` is supported by Vite bundling; Angular 21 CLI uses ESBuild by default in Application Builder, which supports it. Verify by adding `VITE_TEST=hello` to a `.env.local` and confirming it reads at build time.
- WCAG 2.1 relative-luminance formula is stable; the implementation above is well-tested. Prefer landing the pure function over pulling a WCAG contrast npm dep.
- If Angular 21's ESBuild doesn't expose `import.meta.env` cleanly, the fallback is the Angular file-replacement pattern (E10-S1 handles the final wiring).

## Previous Story Intelligence

**E0-S2 (Ports + domain types):**
- `PersonaId` is defined in `src/domain/types/message.ts` (and re-exported from `src/domain/types/persona.ts`) — import from whichever the codebase uses consistently.
- `StorageKey` was landed as a stub `type StorageKey = string;` in `src/config/storage-keys.ts` — this story REPLACES it with the closed union.
- `ChatRequestParams` shape is `{ temperature?, topP?, maxOutputTokens?, frequencyPenalty?, presencePenalty? }` — `PersonaModelParams` extends it with `modelName`.
- `AnalyticsEvent` union already includes all 14 arms — this story doesn't touch that file, but downstream stories (E2-S3, E4-S3, etc.) will consume it.

**E0-S1:**
- `src/domain/types/persona.ts` has `PersonaId` + `assertNever` — DO NOT recreate.
- Karma+Jasmine is the default; specs use `describe`/`it`/`expect`.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-5` (Provider set, lines 100–104), `AD-6` (StoragePort, lines 106–114), `AD-8` (PromptMode + prompt-format, lines 122–139), `AD-9` (context-config thresholds, lines 141–155), `AD-11` (KEY_PATTERN discipline, lines 167–175), `AD-13` (ASK_BOTH_MODE + templates, lines 189–208), `AD-17` (theme-vars, lines 252–263), `AD-19` (regex patterns, lines 271–275), `AD-20` (aria-labels + assertContrast, lines 277–286), `AD-22` (product-copy separation, lines 300–309).
- Addendum `§B.4` (model params, lines 107–119), `§C.2` (Hitesh prompt draft, lines 146–222), `§C.3` (Piyush prompt draft, lines 224–317), `§C.5` (self-verification checklist), `§D.1/§D.2/§D.3` (persona + Ask-Both greetings, lines 349–375).
- EXPERIENCE.md Accessibility Floor (lines 145–167) — aria-label keys list.
- EXPERIENCE.md Voice and Tone (lines 45–76) — product-copy Do/Don't table.
- Sprint status: key `e0-s3-config-constants-and-registries`, blocks 18 downstream stories (see sprint-status.yaml).

## References

- [Source: ARCHITECTURE-SPINE.md#AD-9] `context-config.ts` thresholds + shadowing ban.
- [Source: ARCHITECTURE-SPINE.md#AD-13] `ASK_BOTH_SYSTEM_NOTE_TEMPLATE(personaName, priorText)` v1 form.
- [Source: ARCHITECTURE-SPINE.md#AD-17] `THEME_VARS` closed 5-var set.
- [Source: ARCHITECTURE-SPINE.md#AD-22] Persona-voice vs product-chrome separation + `askBothGreeting` documented exception.
- [Source: addendum.md#B.4] Per-persona model params + Piyush low-penalty rationale.
- [Source: addendum.md#D.1/D.2/D.3] Verbatim greetings + input placeholders + Ask-Both joint greeting.
- [Source: addendum.md#C.2/C.3] Hitesh + Piyush identity blocks + voice rules + self-identification responses.
- [Source: EXPERIENCE.md#Accessibility Floor] Full aria-label key list.
- [Source: sprint-status.yaml#deferred_readiness_gaps.gap_4] PromptComposition upfront-declaration consolidation (this story implements it).

## Story Completion Status

- [ ] All 11 config files in `src/config/` created with the exact exports listed above.
- [ ] `src/config/storage-keys.ts` STUB from E0-S2 replaced with the closed 4-key union.
- [ ] `src/personas/persona.registry.ts` exports `PERSONA_REGISTRY` with hitesh + piyush entries; greetings byte-identical to Addendum §D.1/§D.2; providerId per `PROVIDER_DEFAULT_ROUTING`.
- [ ] `src/personas/persona.registry.ts` declares full `PromptComposition` type shape (17 fields) with all-fields-declared-upfront pattern per readiness-gap #4.
- [ ] `src/personas/hitesh.prompt.ts` SKELETON: `identityBlock` + `voiceRules` + `selfVerificationChecklist` + `selfIdentificationResponse` populated verbatim from Addendum §C.2; all other fields `''` or `[]`.
- [ ] `src/personas/piyush.prompt.ts` SKELETON: same, from Addendum §C.3.
- [ ] Per-file spec tests verify shapes + `assertContrast` behavior + regex matches on §A.1 / §B.1 samples + `ASK_BOTH_SYSTEM_NOTE_TEMPLATE` exact-string output + persona greetings byte-identical.
- [ ] `tsc --noEmit && ng lint` both exit 0.
