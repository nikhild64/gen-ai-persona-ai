# Story E4-S2: Persona theming — CSS custom properties + ≤300ms transition

Status: ready-for-dev

- **Epic:** 4 — Persona Switcher
- **Critical-path position:** 13 of 37 (Day 3 afternoon)
- **Blocks:** E1-S1, E9-S3
- **Depends on:** E4-S1, E0-S3, E0-S4

## Story

As a **cohort grader**,
I want **the whole chat surface (accent color, message bubble tint, input focus ring, code-block emphasis) to transition to the new persona's theme within 300ms of a switch, without a jarring flash**,
So that **the switch feels like a color-slide, not a page reload — the two personas visibly own their own space**.

## Acceptance Criteria

**Given** the `theme-vars.ts` from Epic 0 defines the closed set of `--persona-*` custom properties,
**When** the developer authors persona-theme SCSS blocks (per DESIGN.md.Colors.Persona-theme-tokens) — typically in `src/shared/styles/_personas.scss` or equivalent —
**Then** three scope blocks exist: `:root` defaults (`--persona-accent: #78716C` neutral bridge, `--persona-bubble-bg: #FAFAF9`, `--persona-avatar-url: none`, `--persona-code-block-emphasis: default`, `--persona-input-placeholder-style: normal`), `[data-persona="hitesh"]` (`--persona-accent: #D97706`, `--persona-bubble-bg: #FEF3C7`, `--persona-avatar-url: url('/avatars/hitesh.jpg')`, `--persona-code-block-emphasis: default`), and `[data-persona="piyush"]` (`--persona-accent: #2563EB`, `--persona-bubble-bg: #EFF6FF`, `--persona-avatar-url: url('/avatars/piyush.jpg')`, `--persona-code-block-emphasis: foregrounded`).

**Given** the theme scopes exist,
**When** the chat container carries `[attr.data-persona]="activePersona()"` per AD-17 (Angular signal binding),
**Then** every component inside the container that references `var(--persona-accent)`, `var(--persona-bubble-bg)`, etc. inherits the current persona's values via CSS cascade.

**Given** the user switches personas,
**When** the `[data-persona]` attribute swaps from `"hitesh"` to `"piyush"`,
**Then** all custom property values transition via `transition: all 250ms ease-out` on the component references (persona-switcher active fill, message-bubble left border, input focus ring, avatar image, code-block variant switch — Piyush code becomes foregrounded). Total transition completes in ≤ 300ms per FR-10 (measured via `performance.now()` on the DOM update triggering the transition end event).

**Given** the code-block component picks up `--persona-code-block-emphasis: foregrounded` when in Piyush's scope,
**When** it renders per DESIGN.md.Typography.Code-block-foregrounded,
**Then** typography is 15/24/500 (vs default 14/22/400), max-height is 560px (vs 400px), 3px left border in `--persona-accent` (blue-600) appears — an "ownership stripe" mirroring the message bubble's own stripe. Copy button is ALWAYS visible per UX-DR3. Same VS Code dark syntax palette both variants (per DESIGN.md.Do's — code readability trumps persona brand at syntax level).

**Given** the theme transitions are wired,
**When** a new component is authored that uses a custom property NOT in `THEME_VARS`,
**Then** Stylelint's `declaration-property-value-allowed-list` rule from E0-S4 catches it and fails `npm run stylelint`.

**Given** the persona greeting from `PERSONA_REGISTRY[personaId].inputPlaceholder` (from Epic 0) is rendered in the input placeholder,
**When** the user switches personas,
**Then** the input's `placeholder` attribute reactively updates to the new persona's placeholder per FR-10.

### Cross-cutting AC (per `cross-cutting-AC-checklist.md`)

- **AC-A20.4** — `assertContrast` verifies contrast on all message-bubble color combinations for both persona themes AND Ask-Both theme (verified across Epic 4 and Epic 9). New color combinations added here have `assertContrast(bg, fg)` assertions in the unit test.
- **AC-A20.6** — `prefers-reduced-motion` respected — persona-theme transition snaps to end state; user still sees the color change, just without the smooth 250ms morph.

**verifies:** FR-10 (themed chat surface per persona + ≤300ms transition), AD-17 (persona theming via CSS custom properties + closed var set), AD-20 (cross-cutting — contrast + reduced motion), UX-DR12, UX-DR17

**touches:** `src/shared/styles/_personas.scss` (or equivalent SCSS partial with the three scope blocks), `src/shared/styles/_transitions.scss` (or inline `transition: all 250ms ease-out` on component `.scss` files that reference the vars), `src/shared/styles/reduced-motion.scss` (`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }` or per-component variants), `src/features/chat/chat.component.ts` (bind `[attr.data-persona]="activePersona()"` on the container), `src/shared/message-bubble/message-bubble.component.ts` (bind `[attr.data-persona]` on the bubble element for Ask-Both mode Epic 9 preparation), `src/shared/code-block/code-block.component.ts` (read `--persona-code-block-emphasis` from computed style and apply the variant classes)

**test target:** unit test (`assertContrast` covers new color combinations; a mocked component with `[data-persona]` bound to a signal renders correct computed styles for each persona) + manual smoke test (switch personas rapidly, verify transition feels smooth, no flash, `prefers-reduced-motion: reduce` in DevTools > Rendering emulation snaps to end state)

## Developer Context

Turns E4-S1's route swap into a visible color-slide. Load-bearing decision from AD-17 — CSS custom properties scoped via `[data-persona]` on the container. No PrimeNG theme reload; no per-component fork.

**Bubble-level attribution for Ask-Both preparation:** E9 will render individual message bubbles with `[attr.data-persona]="message.persona"`. This story lands that binding on `<message-bubble>` in Solo mode too (it's the same code path). Solo mode: `activePersona() === message.persona` most of the time, so the bubble-level scope is a no-op. Ask-Both mode: container has `[data-mode="ask-both"]` (neutral chrome) + each bubble has its own `[data-persona]` re-scoping colors locally.

**Reduced-motion:** `src/shared/styles/accessibility.scss` from E2-S4 already has the global `@media (prefers-reduced-motion: reduce)` rule. This story CONFIRMS it's applied and adds any per-component variants needed (e.g., persona-switcher active-slide animation snaps).

## Technical Requirements

### `src/shared/styles/_personas.scss`

```scss
:root {
  --persona-accent: #78716C;
  --persona-bubble-bg: #FAFAF9;
  --persona-avatar-url: none;
  --persona-code-block-emphasis: default;
  --persona-input-placeholder-style: normal;
}

[data-persona="hitesh"] {
  --persona-accent: #D97706;
  --persona-bubble-bg: #FEF3C7;
  --persona-avatar-url: url('/avatars/hitesh.jpg');
  --persona-code-block-emphasis: default;
  --persona-input-placeholder-style: normal;
}

[data-persona="piyush"] {
  --persona-accent: #2563EB;
  --persona-bubble-bg: #EFF6FF;
  --persona-avatar-url: url('/avatars/piyush.jpg');
  --persona-code-block-emphasis: foregrounded;
  --persona-input-placeholder-style: normal;
}
```

Include in global `styles.scss`:
```scss
@import 'shared/styles/personas';
@import 'shared/styles/transitions';
```

### `src/shared/styles/_transitions.scss`

```scss
// Global 250ms ease-out transition on properties that reference persona vars.
// Total transition budget ≤ 300ms per FR-10.
.persona-themed,
[data-persona] {
  transition:
    background-color 250ms ease-out,
    border-color 250ms ease-out,
    color 250ms ease-out,
    fill 250ms ease-out,
    stroke 250ms ease-out;
}
```

Prefer per-component `transition: all 250ms ease-out` on specific classes for finer control if the global rule proves too broad.

### Component wire-in

**`chat.component.html`:**
```html
<div class="chat-container" [attr.data-persona]="activePersona()">
  <app-persona-switcher [activePersona]="activePersona()" [disabled]="orchestrator.inFlightStream$()"></app-persona-switcher>
  <!-- ... -->
</div>
```

**`message-bubble.component.ts`:**
```ts
@Component({...})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: Message;
  // Ask-Both mode preparation — bubble carries its own persona scope
  @HostBinding('attr.data-persona')
  get personaAttr(): string | null {
    return this.message.role === 'assistant' && this.message.persona ? this.message.persona : null;
  }
}
```

**`code-block.component.ts`:** already reads `--persona-code-block-emphasis` per E2-S4; this story confirms the read + applies the foregrounded variant classes.

### `src/config/persona-theme-check.spec.ts` — extend with new contrast assertions

```ts
import { assertContrast } from './persona-theme-check';

describe('persona theme contrast', () => {
  it('Hitesh bubble bg + ink-primary >= 4.5:1', () => {
    expect(() => assertContrast('#FEF3C7', '#1C1917')).not.toThrow(); // amber-100 + stone-900
  });
  it('Piyush bubble bg + ink-primary >= 4.5:1', () => {
    expect(() => assertContrast('#EFF6FF', '#1C1917')).not.toThrow(); // blue-50 + stone-900
  });
  it('Hitesh accent (white on amber-600) passes AA large-text', () => {
    expect(() => assertContrast('#D97706', '#FFFFFF', 'large-text')).not.toThrow();
  });
  it('Piyush accent (white on blue-600) passes AA normal-text', () => {
    expect(() => assertContrast('#2563EB', '#FFFFFF')).not.toThrow();
  });
});
```

## Architecture Compliance

- **AD-17:** `[attr.data-persona]` on container; ONLY the 5 `THEME_VARS`; ≤300ms transition; per-message-bubble `[data-persona]` for Ask-Both.
- **AD-20 cross-cutting:** contrast + reduced-motion + closed `THEME_VARS` set (Stylelint E0-S4 enforces).

## File Structure Requirements

```
src/shared/styles/
  _personas.scss                # NEW — 3 scope blocks
  _transitions.scss             # NEW — 250ms ease-out on persona-themed elements
src/styles.scss                 # UPDATE — @import both
src/features/chat/chat.component.html   # UPDATE — [attr.data-persona] binding
src/shared/message-bubble/message-bubble.component.ts   # UPDATE — HostBinding
src/config/persona-theme-check.spec.ts  # EXTEND — new contrast assertions
```

## Testing Requirements

- `persona-theme-check.spec.ts` — 4 new assertContrast assertions per above.
- `chat.component.spec.ts` — verifies `<div class="chat-container" data-persona="hitesh">` when route data is hitesh; swaps to `piyush` when navigated.
- Manual smoke: `ng serve`, navigate `/chat/hitesh` → `/chat/piyush`, verify visual color slide feels smooth (chai-orange → engineer-blue); Chrome DevTools > Rendering > Emulate `prefers-reduced-motion: reduce` → transition snaps.

## Library / Framework Requirements

No new packages.

## Latest Tech Information

- CSS custom properties with `transition: all` — animatable per CSS Houdini spec + Chromium 120+/Firefox 120+/Safari 16.4+ per baseline browsers.
- Angular `[attr.data-*]` binding — signal reactive.
- `HostBinding` on component — persona attribute travels with the bubble element.

## Previous Story Intelligence

**E4-S1 (Persona switcher + routing):**
- `activePersona()` signal reads from route data. This story binds it to `[attr.data-persona]` on the chat container.

**E2-S4 (Chat + shared components):**
- Message bubble already reads `--persona-bubble-bg` + `--persona-accent`.
- Code block reads `--persona-code-block-emphasis`.
- `src/shared/styles/accessibility.scss` has the global reduced-motion rule.

**E0-S3 (theme-vars):**
- `THEME_VARS` closed 5-var array in `src/config/theme-vars.ts`.
- Stylelint from E0-S4 restricts to these 5 vars.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-17` (theming, lines 252–263).
- DESIGN.md Colors (persona-theme-tokens, lines 164–196).
- EXPERIENCE.md Motion (persona-theme transition, line 188).
- Sprint status: key `e4-s2-persona-theming-transition`, blocks `[e1-s1, e9-s3]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-17] `[data-persona]` scope + `--persona-*` closed 5-var set + ≤300ms transition + bubble-level attribution for Ask-Both.
- [Source: DESIGN.md#Colors.Persona-theme-tokens] Exact color values per persona.
- [Source: cross-cutting-AC-checklist.md] AC-A20.4 + AC-A20.6.

## Story Completion Status

- [ ] `src/shared/styles/_personas.scss` — 3 scope blocks with all 5 THEME_VARS per persona.
- [ ] `src/shared/styles/_transitions.scss` — 250ms ease-out on persona-themed elements.
- [ ] `src/styles.scss` imports both.
- [ ] `chat.component.html` binds `[attr.data-persona]="activePersona()"` on container.
- [ ] `message-bubble.component.ts` HostBinding `[attr.data-persona]` for Ask-Both preparation.
- [ ] `code-block.component.ts` renders foregrounded variant when `--persona-code-block-emphasis: foregrounded`.
- [ ] `persona-theme-check.spec.ts` extended with 4 new assertContrast assertions.
- [ ] Manual smoke: rapid switch → smooth transition; reduced-motion snaps.
- [ ] Stylelint passes (no unlisted `--persona-*` vars).
