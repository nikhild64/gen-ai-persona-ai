# Attributions

## Avatar imagery

- `public/images/hitesh.png` — used with cohort-authorized permission per
  `docs/creator-permissions.md`. _Original source URL:_ **_fill in_**.
- `public/images/piyush.png` — same. _Original source URL:_ **_fill in_**.

If either creator asks the image be removed or replaced, follow the
`docs/creator-permissions.md` takedown flow.

## Icon set

- **PrimeIcons** (via `primeicons` npm package) — MIT licensed. Used for
  the settings gear, close, and check icons throughout the UI. Source:
  <https://primeng.org/icons>.

## UI components

- **PrimeNG 21.1.9** — MIT licensed. Modal / select / button primitives.
  Source: <https://primeng.org>.
- **Angular 21 LTS** — MIT licensed. Source: <https://angular.dev>.

## Markdown renderer

- **`marked@18`** — MIT licensed. Renders assistant markdown safely with
  GFM enabled. Source: <https://marked.js.org>.

## Storage

- **`idb-keyval@6`** — MIT licensed. Tiny IndexedDB wrapper for
  `IdbKeyvalStorageAdapter`. Source: <https://github.com/jakearchibald/idb-keyval>.

## Analytics

- **`@vercel/analytics`** + **`@vercel/speed-insights`** — MIT licensed.
  Beacon and LCP/TTFT measurement.

## Syntax highlighting

- **Deferred** — see `docs/performance.md`. `<app-code-block>` variant
  selection is wired but no highlighter library is bundled yet.

## Fonts

- System UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, Arial`).
  No third-party font shipped.

## Persona voice content

- **Verbatim few-shots** in `src/personas/hitesh.prompt.ts` +
  `src/personas/piyush.prompt.ts` are sourced from `research/domain-hitesh-choudhary-piyush-garg-personas-research-2026-07-02.md`
  §C.3. Each entry has a `// source:` comment with the line range.
- **Voice rules + identity blocks** are paraphrased from the same research
  and Addendum §C.2/§C.3.
- **Refusal templates + Ask-Both collaboration examples** are from
  Addendum §E.1 / §E.2 / §E.3.
