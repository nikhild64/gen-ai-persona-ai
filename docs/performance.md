# Performance Notes

AD-21 caps the initial-load bundle at 200 KB gzip; this doc tracks the
choices that eat into that budget.

## Markdown renderer — `marked@18`

- ~29 KB gzip. Used by `MessageBubbleComponent` to render assistant
  markdown safely (GFM + linebreaks).
- Rendered synchronously; no runtime dependency on the DOM.

## Syntax highlighting — deferred

- `highlight.js` (~30 KB common bundle) and `shiki` (larger) were both
  considered.
- **Decision:** landed the `<app-code-block>` variant selector logic (default
  vs foregrounded via `--persona-code-block-emphasis`) WITHOUT syntax
  highlighting for the E2-S4 slice. Feature works — code is rendered in a
  themed `<pre><code>` block. Highlighting can be layered later without
  touching the bubble/component contract.
- Reason: cohort demo runs work fine on plain-monospace code; the bundle
  budget is more valuable elsewhere.

## Bundle-budget checklist for Epic 11

- Base Angular 21 + PrimeNG selective imports: measure with
  `bunx ng build --configuration production --stats-json` + a `webpack-bundle-analyzer`
  pass in E11-S3.
- If under 200 KB gzip with room to spare, revisit `highlight.js` (import
  only `typescript`, `javascript`, `python`, `bash`, `json`).
- If tight, keep code un-highlighted; document in the EVALUATION crib sheet.
