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

_(none at Phase 1 start)_
