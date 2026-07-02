# Story E2-S4: ChatComponent + MessageBubble + StreamingIndicator + hardcoded persona greeting

Status: ready-for-dev

- **Epic:** 2 — Persona-Faithful Chat Engine (Solo)
- **Critical-path position:** 9 of 37 (Day 2)
- **Blocks:** E3-S1, E4-S1
- **Depends on:** E2-S3, E0-S3

## Story

As a **cohort grader**,
I want **to see the chat UI — a header with persona name/avatar, a scrollable message list, and an input at the bottom — with streaming responses arriving token-by-token and a subtle "Hitesh is thinking..." indicator before the first token**,
So that **the chat feels alive, my messages have visible state, and I can immediately tell which persona is talking**.

## Acceptance Criteria

**Given** the ChatOrchestrator exists,
**When** the developer authors `src/features/chat/chat.component.ts` as an Angular standalone component,
**Then** the component renders (from top to bottom): a chat header (persona avatar 32px circular + persona name in `h1` weight + persona-switcher placeholder from Epic 4 + mode-switcher placeholder from Epic 9 + key-status-badge placeholder from Epic 6 + settings gear icon placeholder from Epic 6), a message list (scrollable, `<message-bubble>` for each Message in `thread.messages`), a `<streaming-indicator>` slot that renders when an in-flight stream is active, and an input area (textarea with `placeholder` bound to `PERSONA_REGISTRY[activePersona()].inputPlaceholder` + send button).

**Given** the chat component mounts on `/chat/hitesh` (routing wired in Epic 4 — this story uses a hardcoded route for now),
**When** the component `ngOnInit`,
**Then** if `thread.messages.length === 0`, the component renders the hardcoded Hitesh greeting from `PERSONA_REGISTRY.hitesh.greeting` (Addendum §D.1) as the FIRST assistant message (NOT an LLM call — it's hardcoded per handoff) with `status: 'complete'`, `persona: 'hitesh'`, and a hardcoded timestamp. The streaming-indicator does NOT appear for this greeting.

**Given** the user types a message and hits Enter,
**When** the send handler fires,
**Then** it calls `chatOrchestrator.sendMessage(activePersona(), inputText)`, appends the user Message immediately (`role: 'user'`, no `persona` field per AD-10), clears the input, and disables the send button per UX-DR states.

**Given** the streaming-indicator component (`src/shared/streaming-indicator/streaming-indicator.component.ts`),
**When** an in-flight stream is active AND no delta has yet arrived,
**Then** the indicator renders per DESIGN.md.Components.streaming-indicator: `full-width × 32px` bar below the last message bubble with `--persona-avatar-url` avatar left + `body-sm` `ink-secondary` text (`"Hitesh is thinking…"` from `product-copy.ts.streamingIndicatorSolo(persona)`) + 3-dot pulse animation. The pulse respects `prefers-reduced-motion` per UX-DR17.

**Given** the first `{type: 'delta'}` chunk arrives,
**When** the ChatOrchestrator writes to the `WritableSignal<string>` for that message,
**Then** the streaming-indicator disappears (streaming IS the loading state per handoff), a new `<message-bubble>` appears with `role: 'assistant'`, `persona: activePersona()`, `status: 'streaming'`, and its content grows as chunks arrive.

**Given** the message-bubble component (`src/shared/message-bubble/message-bubble.component.ts`),
**When** it renders per DESIGN.md.Components.message-bubble,
**Then** assistant bubbles have `--persona-bubble-bg` background, 3px solid `--persona-accent` left border, avatar in bubble header from `--persona-avatar-url`, `body-lg` (17/26/400) `ink-primary` body copy with markdown-rendered content (bold, italic, inline `code`, fenced code blocks, unordered/ordered lists, blockquotes); user bubbles have `surface-container` background, right-aligned, no border. Bubble's `status` from AD-10 drives visual state: `cancelled` shows `caption` badge below the bubble; `error` bubble's left border becomes `error` red — but ONLY for uncaught/network errors, in-character error copy from Addendum §E stays on the persona palette per UX-DR15.

**Given** the `<code-block>` component (`src/shared/code-block/code-block.component.ts`),
**When** the markdown-renderer encounters a fenced code block,
**Then** the code-block component reads `--persona-code-block-emphasis` from its scope. Default variant (Hitesh): `code-block-default` typography (14/22/400 JetBrains Mono), `max-height 400px`, no accent border. Foregrounded variant (Piyush, driven by `--persona-code-block-emphasis: foregrounded`): `code-block-foregrounded` typography (15/24/500), `max-height 560px`, 3px left border in `--persona-accent`, copy button ALWAYS visible per UX-DR3 + DESIGN.md.Components.code-block.

**Given** the developer needs syntax highlighting,
**When** they pick between `highlight.js` or `shiki`,
**Then** the choice is documented + weighed against AD-21's 200KB gzip ceiling — `highlight.js` common bundle is ~30KB gzip, `shiki` full VS Code palette is larger. Common languages (typescript, javascript, python, bash, json) enabled; obscure languages lazy-loaded on demand. Chosen library added to `package.json`.

**Given** the aria-announcer stub (Epic 0 landed the component; full behavior wires here),
**When** an assistant message completes streaming (`{type: 'done'}` fires),
**Then** the aria-announcer writes `"{PersonaName} says: {fullText}"` to its `WritableSignal<string>` per AD-20; chunk-by-chunk emission is NOT done (unusable for screen readers).

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.1** — Tab traverses chat header controls → message list (single stop) → input → send button.
- **AC-A20.2** — Every interactive control uses `aria-labels.ts` (chat input label, send button label).
- **AC-A20.3** — All controls have visible `:focus-visible` ring.
- **AC-A20.4** — `assertContrast` verifies all message-bubble color combinations pass 4.5:1 on both persona themes (Hitesh amber bubble + `ink-primary` text = 15+ :1; Piyush blue bubble + `ink-primary` text = 15+ :1).
- **AC-A20.5** — aria-announcer emits full completed messages with persona prefix; never chunk-by-chunk.
- **AC-A20.6** — Streaming-indicator pulse + persona-theme transitions respect `prefers-reduced-motion`.
- **AC-A21.1** — `src/features/chat/` module lazy-loaded via `loadChildren` from `app.routes.ts`.
- **AC-A21.2** — Send-message hot path is async: adapter fetch is async, moderation call is async, PromptAssembler is sync-cheap (< 5ms), analytics emit is fire-and-forget via `navigator.sendBeacon`.
- **AC-A21.4** — TTFT p90 ≤ 2.0s measured via a custom Vercel Speed Insights mark from `ChatOrchestrator` on first delta arrival (measurement wired now; validated at Epic 11).
- **AC-A22.1** — Chat header text, streaming-indicator text, error toasts all from `product-copy.ts`. Persona greeting + input placeholder from `PERSONA_REGISTRY[persona]`. Persona-voice content only in `PERSONA_REGISTRY` + `personas/*.prompt.ts`.

**verifies:** FR-3, FR-4, FR-5, FR-6 (streaming), FR-7 (per-persona formatting via code-block variants), AD-10 (Message status field drives bubble state), AD-17 (theme vars scoped via `[data-persona]`), AD-19 (regex smoke-test observable via analytics event but not user-visible), AD-20 (cross-cutting), AD-21 (cross-cutting — TTFT + lazy-loading + non-blocking hot path), AD-22 (cross-cutting)

**touches:** `src/features/chat/chat.component.ts`, `src/features/chat/chat.component.scss`, `src/features/chat/chat.component.html`, `src/features/chat/chat.routes.ts` (with `loadChildren` from `app.routes.ts`), `src/shared/message-bubble/message-bubble.component.ts` (+ scss + html), `src/shared/streaming-indicator/streaming-indicator.component.ts` (+ scss + html), `src/shared/code-block/code-block.component.ts` (+ scss + html), `src/shared/aria-announcer/aria-announcer.component.ts` (+ scss — `.sr-only` from `src/shared/styles/accessibility.scss`), `src/shared/styles/accessibility.scss` (`.sr-only` + `:focus-visible` defaults per AD-20), `src/config/product-copy.ts` (new keys: `streamingIndicatorSolo`, `streamingIndicatorAskBothA`, `streamingIndicatorAskBothB`, `sendButtonLabel`), `package.json` (syntax highlighter dependency), `docs/performance.md` (bundle-size note for Epic 12)

**test target:** component test (axe-core on `/chat/hitesh` route; markdown renders bold/italic/code/lists; code-block picks correct variant based on `--persona-code-block-emphasis` scope) + e2e test (type message, hit Enter, see streaming-indicator, see assistant bubble grow, see done state; cancel mid-stream shows partial content with `cancelled` badge) + manual smoke test (real Gemini + Groq keys via sessionStorage inject; verify streaming smoothness feels acceptable)

## Developer Context

The first user-visible UI. Grader lands, sees a chat that WORKS end-to-end via the E2-S3 orchestrator. Persona-switcher, mode-switcher, key-status-badge, settings gear are PLACEHOLDER SLOTS in the header (later epics wire them). The chat itself is functional: type, hit Enter, see streaming, see completed message.

**Hardcoded persona greeting:** on empty thread mount, render the greeting from `PERSONA_REGISTRY[persona].greeting` as the FIRST assistant Message (hardcoded per handoff — NOT an LLM call). Persist it too so page reload doesn't re-render as fresh. Adds `status:'complete'`, `persona: activePersona()`, and a fixed timestamp.

**This story hardcodes `activePersona() = 'hitesh'` since Epic 4 (persona routing) hasn't landed yet.** E4-S1 wires the actual `/chat/{persona}` routing; this story assumes Hitesh. Route: `/chat/hitesh` for now; wired to `chat.component.ts` via a minimal route in `app.routes.ts`.

**Syntax highlighter pick:** `highlight.js` is the default recommendation. Bundle ~30KB gzip for common languages; well-tested; TypeScript types available. `shiki` is heavier but produces prettier output — acceptable ONLY if bundle stays under 200KB gzip per AD-21. Log the pick in `docs/performance.md`.

## Technical Requirements

### `src/features/chat/chat.component.ts`

Standalone Angular 21 component. Injects `ChatOrchestrator`. Reads `PERSONA_REGISTRY[activePersona()].greeting` on `ngOnInit`. Subscribes to orchestrator signals via `computed` / effect. Container carries `[attr.data-persona]="activePersona()"` per AD-17 (E4-S2 exercises the actual switch).

Layout per DESIGN.md.Layout.Chat surface geometry:
- **Chat header (64px):** avatar 32px circular with 2px `--persona-accent` ring + persona name in `h1` weight + placeholder slots for `<persona-switcher>`, `<mode-switcher>`, `<key-status-badge>`, `<settings-gear>` (empty `<ng-content>` slots or inert placeholders — later epics fill).
- **Message list:** `flex-column`, `24px` horizontal padding, `16px` vertical, scrollable, one `<message-bubble>` per Message.
- **Streaming-indicator slot:** below last bubble; conditionally renders when `orchestrator.inFlightStream$() && !orchestrator.accumulatedText$()`.
- **Input area:** `min-height 96px`, `<textarea>` + send button; placeholder from `PERSONA_REGISTRY[activePersona()].inputPlaceholder`.

### `src/shared/message-bubble/message-bubble.component.ts`

Inputs: `@Input() message: Message`. Renders per DESIGN.md.Components.message-bubble:
- Assistant: `--persona-bubble-bg`, 3px `--persona-accent` left border, `body-lg ink-primary` text, avatar in header from `--persona-avatar-url`.
- User: `surface-container` bg, right-aligned, no border.
- Status handling per AD-10: `cancelled` → caption badge `product-copy.cancelledMessageBadge` below bubble; `error` → red border (network errors ONLY per UX-DR15).
- Markdown rendering: use a small MD renderer (marked.js is 30KB — acceptable, OR write a minimal renderer for bold/italic/code/lists/blockquotes/fenced code). Fenced code blocks delegate to `<code-block>`.

### `src/shared/streaming-indicator/streaming-indicator.component.ts`

Inputs: `@Input() label: string` (from `product-copy.streamingIndicatorSolo(persona)`). Renders `full-width × 32px` with avatar (from `--persona-avatar-url`) + label + 3-dot pulse.

Motion: 3 dots, opacity 0.3→1.0→0.3, staggered 133ms per dot. `@media (prefers-reduced-motion: reduce)` disables the pulse (dots stay static).

### `src/shared/code-block/code-block.component.ts`

Inputs: `@Input() code: string`, `@Input() language?: string`.
Reads `getComputedStyle(host).getPropertyValue('--persona-code-block-emphasis')` on mount. If `'foregrounded'`, apply variant classes: `code-block-foregrounded` typography, `max-height 560px`, 3px `--persona-accent` left border, always-visible copy button. Else default treatment.

Syntax highlighting: on first render (or via `NgIf` lazy import), invoke chosen highlighter (`hljs.highlightElement(el)` or shiki equivalent). Register only common languages upfront (`typescript, javascript, python, bash, json`) — obscure languages lazy-loaded.

### `src/shared/aria-announcer/aria-announcer.component.ts`

`.sr-only` positioned live region with `aria-live="polite"`. Subscribes to `ChatOrchestrator` completion events (via injected orchestrator or via a dedicated `AriaAnnouncerService`). On stream done, writes `"${personaDisplayName(persona)} says: ${fullText}"`. On Ask-Both A→B (E9-S3): writes bridge announcement.

### `src/shared/styles/accessibility.scss`

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Default focus-ring per AD-20 - all interactive elements get this unless overridden
:focus-visible {
  outline: 2px solid #0EA5E9;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

### `chat.routes.ts` + `app.routes.ts`

`app.routes.ts`:
```ts
export const routes: Routes = [
  { path: '', redirectTo: 'chat/hitesh', pathMatch: 'full' }, // E1-S1 replaces with landing
  { path: 'chat/hitesh', loadChildren: () => import('./features/chat/chat.routes').then(m => m.CHAT_ROUTES) },
];
```

`chat.routes.ts`:
```ts
export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatComponent, data: { persona: 'hitesh' } },
];
```

E4-S1 extends with `/chat/piyush` + persona-switcher routing.

## Architecture Compliance

- **AD-10:** message-bubble reads `status` field to drive visual state; ad-hoc booleans banned.
- **AD-17:** `[attr.data-persona]="activePersona()"` on chat container; `--persona-*` vars flow via CSS cascade; ≤300ms transition (E4-S2 exercises).
- **AD-19:** regex miss emitted via `persona_regex_miss` analytics; NOT rendered to user (observation-only).
- **AD-20 cross-cutting:** Tab traversal, ARIA labels from `aria-labels.ts`, focus-visible ring, contrast checks via `assertContrast`, aria-announcer full-message emission, prefers-reduced-motion.
- **AD-21 cross-cutting:** lazy-load `chat.routes` via `loadChildren`; hot path async; TTFT custom mark from `ChatOrchestrator` on first delta.
- **AD-22 cross-cutting:** all chrome copy from `product-copy.ts`; persona voice from `PERSONA_REGISTRY[persona]`.

## Library / Framework Requirements

New devDependencies:

```
marked@^12         # OR a minimal custom renderer
highlight.js@^11   # OR shiki@^1 (bundle-budget check)
```

Both are recommended additions per this story. Pin exact minor versions; document rationale in `docs/performance.md`.

## File Structure Requirements

```
src/features/chat/
  chat.component.ts / .html / .scss
  chat.routes.ts
src/shared/message-bubble/
  message-bubble.component.ts / .html / .scss
src/shared/streaming-indicator/
  streaming-indicator.component.ts / .html / .scss
src/shared/code-block/
  code-block.component.ts / .html / .scss
src/shared/aria-announcer/
  aria-announcer.component.ts / .html / .scss
src/shared/styles/
  accessibility.scss
src/app/app.routes.ts
src/config/product-copy.ts       # EXTEND with streamingIndicatorSolo(persona), sendButtonLabel, cancelledMessageBadge
docs/performance.md              # NEW — highlighter pick + bundle-budget note
```

## Testing Requirements

- Component test (`chat.component.spec.ts`): axe-core on the rendered route; hardcoded greeting appears on empty thread; typing + Enter calls `orchestrator.sendMessage`; streaming-indicator shows before first delta; assistant bubble grows with deltas; `cancelled` state shows caption badge.
- Component test (`message-bubble.component.spec.ts`): renders `role:'assistant'` with persona accent; renders `role:'user'` right-aligned; renders `status:'cancelled'` with caption badge; renders markdown (bold, italic, inline code, fenced code, lists).
- Component test (`code-block.component.spec.ts`): applies default typography when `--persona-code-block-emphasis: default`; applies foregrounded typography + always-visible copy button when `--persona-code-block-emphasis: foregrounded`; copy button triggers `navigator.clipboard.writeText`.
- Component test (`streaming-indicator.component.spec.ts`): renders label + 3-dot pulse; `prefers-reduced-motion: reduce` disables pulse.
- Component test (`aria-announcer.component.spec.ts`): writes `"Hitesh says: full text"` on stream done; NEVER emits per-chunk.
- e2e test (Playwright, if wired): type message, verify UI states in order (indicator → streaming bubble → complete bubble).
- Manual smoke: real Gemini key via sessionStorage inject; type "Hi in one word"; verify streaming feels smooth on Chrome DevTools throttled 4G.

## Latest Tech Information

- Angular 21 standalone components + `signal()` for reactive state (no NgModules for shared components).
- `getComputedStyle(el).getPropertyValue('--persona-code-block-emphasis')` — the browser-native way to read a CSS custom property from JS in the code-block component.
- `marked.js` 12.x supports async rendering + custom renderers. Safe by default (escapes HTML).
- `highlight.js` 11.x has per-language modular imports (`import 'highlight.js/lib/languages/typescript'`).

## Previous Story Intelligence

**E2-S3 (ChatOrchestrator):**
- Orchestrator signals: `accumulatedText$`, `inFlightStream$`, `streamStalled$`, `activeAssistantMessageId$`.
- `sendMessage(persona, text): Observable<never>` — subscribe returns a teardown that cancels in-flight.
- `keyMissing$: Subject<PersonaId>` — E6-S3 subscribes to auto-open settings modal.

**E2-S1 (Provider adapters):**
- Adapters exist; orchestrator uses them.

**E0-S3 (Config):**
- `PERSONA_REGISTRY[persona].greeting` + `inputPlaceholder` populated verbatim from Addendum §D.1/§D.2.
- `product-copy.ts` has `streamingIndicatorSolo(persona)` (add here if missing from E0-S3 population).

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-10` (Message.status drives bubble state, lines 157–165), `AD-17` (theme vars via CSS custom properties, lines 252–263), `AD-19` (regex smoke observation-only, lines 271–275), `AD-20` (accessibility invariants, lines 277–286), `AD-21` (performance budget, lines 288–298), `AD-22` (product-copy separation, lines 300–309).
- DESIGN.md `Components.message-bubble` (lines 332–344), `code-block` (lines 345–353), `streaming-indicator` (lines 374–379).
- EXPERIENCE.md `Component Patterns` (lines 82–94), `State Patterns` (lines 96–118), `Motion` (lines 186–196), `Accessibility Floor` (lines 145–167).
- cross-cutting-AC-checklist.md AD-20/21/22 requirements.
- Sprint status: key `e2-s4-chat-component-and-shared-ui`, blocks `[e3-s1-idb-storage-adapter, e4-s1-persona-switcher-and-routing]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-10] Message.status field drives visual state.
- [Source: ARCHITECTURE-SPINE.md#AD-17] `[attr.data-persona]` scope + `--persona-*` CSS custom properties.
- [Source: ARCHITECTURE-SPINE.md#AD-20] `aria-live="polite"` with persona prefix, full-message emission only.
- [Source: DESIGN.md#Components.message-bubble] Full visual spec.
- [Source: EXPERIENCE.md#Piyush code-block prominence] `foregrounded` variant behavior.
- [Source: cross-cutting-AC-checklist.md] AD-20/21/22 AC items applicable to this story.
- [Source: sprint-status.yaml#dependency_chain.e2-s4-chat-component-and-shared-ui] `blocked_by: [e2-s3, e0-s3]`; `blocks: [e3-s1, e4-s1]`.

## Story Completion Status

- [ ] `src/features/chat/chat.component.ts` renders header + message-list + input; hardcoded Hitesh greeting on empty thread; Enter triggers orchestrator.sendMessage.
- [ ] `src/shared/message-bubble/message-bubble.component.ts` renders per AD-10 + DESIGN.md; markdown-rendered content; status-driven visuals.
- [ ] `src/shared/streaming-indicator/streaming-indicator.component.ts` renders with 3-dot pulse; prefers-reduced-motion honored.
- [ ] `src/shared/code-block/code-block.component.ts` picks default vs foregrounded variant from `--persona-code-block-emphasis`; syntax highlighting via chosen lib.
- [ ] `src/shared/aria-announcer/aria-announcer.component.ts` writes full completed messages with persona prefix.
- [ ] `src/shared/styles/accessibility.scss` has `.sr-only` + focus-visible + reduced-motion media query.
- [ ] `chat.routes.ts` lazy-loaded via `loadChildren` in `app.routes.ts`.
- [ ] `product-copy.ts` extended with `streamingIndicatorSolo(persona)` + `sendButtonLabel` + `cancelledMessageBadge`.
- [ ] Syntax highlighter added to `package.json`; bundle-size note in `docs/performance.md`.
- [ ] Cross-cutting AC-A20.1 through A22.1 satisfied per checklist.
- [ ] Component tests + e2e + manual smoke.
