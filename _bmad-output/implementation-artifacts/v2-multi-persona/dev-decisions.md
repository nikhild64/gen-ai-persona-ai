# Dev Decisions Log — Council (V2 Multi-Persona)

Generated during autonomous V2 expansion on branch `v2-multi-persona`.  
Developer: Nikhildhawan (solo, hands-off).  
Start: 2026-07-02.

## Baseline (pre-V2)

- **Branch:** `v2-multi-persona`
- **Tests:** 131 passed / 31 test files (Vitest via `bunx vitest run`)
- **Production bundle:** ~4.9 MB (`dist/gen-ai-persona-ai/browser`, 24 files) — prior build artifact

## Global — Brand name

- **Decision:** Product rebrand to **Council**.
- **Rationale:** User confirmed. Spans living + historical personas; "advisors from across time" without cohort framing. Alternatives rejected: "Timeless" (vague), "Minds" (generic).

## Global — Landing layout

- **Decision:** Category-grouped landing (Contemporary / 20th Century Icons / Historical).
- **Rationale:** 7 equal cards in one grid is dense on mobile; era badges align with grouping.

## Global — Persona switcher

- **Decision:** WAI-ARIA combobox with type-to-filter.
- **Rationale:** 7 personas exceed practical segmented-toggle UX; combobox preserves AD-20 keyboard access.

## Global — Blended provider slot

- **Decision:** Persona A (first dropdown) carries provider + model params; temperature = arithmetic mean of A and B.
- **Rationale:** Deterministic; user controls carrier via pair picker order.

## Global — Persona metadata location

- **Decision:** Extend `PersonaRegistryEntry` with `fullDisplayName`, `tagline`, `era`, `disclaimerTier`.
- **Rationale:** Avoid scattering 7-persona strings across `product-copy.ts` (AD-22 boundary).

## Global — Gandhi "be the change"

- **Decision:** Research doc cites verified 1913 Indian Opinion passage; note popular bumper-sticker is apocryphal (Quote Investigator / NYT).
- **Rationale:** Source integrity; persona may use paraphrase in voice but few-shots cite real text.

## Blockers

### Phase 4 — Avatar photos

- **Blocker:** Wikimedia Commons download blocked by environment auto-review.
- **Mitigation:** Generated local 96×96 solid-color placeholder PNGs for musk,
  jobs, gandhi, einstein, newton. Full attribution + replacement guidance in
  `docs/attributions.md` (Phase 5).

## Phase 4 — Theme tokens (WCAG-AA on light bubbles)

| Persona | Accent | Bubble bg | Rationale |
|---|---|---|---|
| musk | `#dc2626` | `#fecaca` | Electric red on light rose — readable, not full dark mode |
| jobs | `#6b7280` | `#f5f5f7` | Apple-adjacent silver / off-white |
| gandhi | `#ea580c` | `#fef3c7` | Saffron accent on khadi cream |
| einstein | `#ca8a04` | `#fef9c3` | Warm yellow on parchment (light bubble, not slate) |
| newton | `#b45309` | `#fef9c3` | Gold on parchment |

Body gradients in `src/styles.scss` mirror accent families for full-viewport
chrome.

## Phase 5 — Legal + verification

- **Footer / landing disclaimer:** Exact user-spec fair-use text in
  `product-copy.ts`.
- **In-chat banners:** `src/config/persona-disclaimers.ts` keyed by registry
  `disclaimerTier` (cohort / contemporary / deceased-recent / historical).
- **Docs:** `docs/personas.md` (new), `creator-permissions.md`, `attributions.md`,
  `README.md` updated for Council + 7 personas.

### Metrics (post-V2)

| Metric | Before | After |
|---|---|---|
| Vitest tests | 131 passed / 31 files | **154 passed / 33 files** |
| Production bundle (`dist/.../browser`) | ~4.9 MB | **~4.95 MB** (5,187,949 bytes) |
| ESLint (`bun run lint:ts`) | — | 0 errors (1 pre-existing warning) |
| `tsc --noEmit` | — | pass |
| `ng build --configuration production` | — | pass (initial budget +4.65 kB) |

### Manual smoke checklist (dev server)

- [ ] Landing: 7 cards in 3 category groups
- [ ] Each `/chat/:persona` loads theme + greeting + disclaimer banner
- [ ] Combobox switcher keyboard-only (filter, arrows, Enter)
- [ ] Blended: Hitesh+Piyush, Musk+Jobs, Gandhi+Einstein pairs
- [ ] No Devanagari in UI strings
- [ ] No ChaiCode outside Hitesh/Piyush persona bodies
- [ ] Musk (Groq) + Jobs (Gemini) produce output with BYO keys

