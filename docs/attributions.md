# Attributions

## Avatar imagery

| File | Persona | License / note |
|---|---|---|
| `public/images/hitesh.png` | Hitesh Choudhary | Cohort-authorized per `docs/creator-permissions.md`. _Original source URL: fill in._ |
| `public/images/piyush.png` | Piyush Garg | Same. _Original source URL: fill in._ |
| `public/images/musk.png` | Elon Musk | **Placeholder** — solid-color 96×96 PNG generated locally (Wikimedia download blocked in CI). Replace with a properly licensed portrait before production; attribute source here. |
| `public/images/jobs.png` | Steve Jobs | **Placeholder** — same as above. |
| `public/images/gandhi.png` | Mahatma Gandhi | **Placeholder** — same. Recommended replacement: Wikimedia Commons public-domain portrait. |
| `public/images/einstein.png` | Albert Einstein | **Placeholder** — same. Recommended: Wikimedia Commons (many PD portraits). |
| `public/images/newton.png` | Isaac Newton | **Placeholder** — same. Recommended: Wikimedia Commons historical portrait. |

If any rights-holder requests removal or replacement, follow the takedown flow in
`docs/creator-permissions.md`.

---

## Persona voice research (V2)

Full research docs with bibliography:

- `_bmad-output/implementation-artifacts/v2-multi-persona/research/persona-musk.md`
- `persona-jobs.md`, `persona-gandhi.md`, `persona-einstein.md`, `persona-newton.md`

### Elon Musk — key sources

- TED2013: <https://www.ted.com/talks/elon_musk_the_future_we_re_building_and_boring>
- Lex Fridman podcast interviews (public transcripts)
- Tesla / SpaceX public earnings-call excerpts
- Walter Isaacson, *Elon Musk* (2023) — publicly quoted excerpts only

### Steve Jobs — key sources

- Stanford 2005 commencement address (public transcript)
- Apple WWDC / keynote transcripts (publicly available)
- Walter Isaacson, *Steve Jobs* (2011) — publicly quoted excerpts

### Mahatma Gandhi — key sources

- *The Story of My Experiments with Truth* (public domain)
- *Collected Works of Mahatma Gandhi* (publicly available)
- Mahatma.org reference material

### Albert Einstein — key sources

- *Ideas and Opinions* (Einstein essays)
- Princeton University archives — public letter excerpts
- Wikimedia Commons quote collections (cross-checked against primary sources)

### Isaac Newton — key sources

- *Philosophiæ Naturalis Principia Mathematica* — modern English translation (PD)
- *Opticks* (public domain)
- The Newton Project — <https://www.newtonproject.ox.ac.uk/>

### Hitesh & Piyush (v1)

- `_bmad-output/planning-artifacts/research/domain-hitesh-choudhary-piyush-garg-personas-research-2026-07-02.md`
- Few-shots in `src/personas/hitesh.prompt.ts` + `piyush.prompt.ts` carry
  `// source:` comments.

---

## Icon set

- **PrimeIcons** (via `primeicons` npm package) — MIT licensed. Source:
  <https://primeng.org/icons>.

## UI components

- **PrimeNG 21.1.9** — MIT licensed. Source: <https://primeng.org>.
- **Angular 21 LTS** — MIT licensed. Source: <https://angular.dev>.

## Markdown renderer

- **`marked@18`** — MIT licensed. Source: <https://marked.js.org>.

## Storage

- **`idb-keyval@6`** — MIT licensed. Source:
  <https://github.com/jakearchibald/idb-keyval>.

## Analytics

- **`@vercel/analytics`** + **`@vercel/speed-insights`** — MIT licensed.

## Syntax highlighting

- **Deferred** — see `docs/performance.md`.

## Fonts

- System UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, Arial`).
  No third-party font shipped.
