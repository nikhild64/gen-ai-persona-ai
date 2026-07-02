# Council

**AI chat with seven educational parody personas — advisors from across time.**

Pick one persona for solo chat, or blend any two in **Ask Both** mode for a
single fused answer. BYO-Key only — your API key never leaves the browser.

> ⚠️ **AI parody personas** — not affiliated with or endorsed by the real
> individuals or their estates. Educational research project exploring LLM-based
> persona modeling. All content is derived from publicly available materials
> under fair use for non-commercial educational purposes.
>
> **Takedown:** contact@example.com (subject: `Council — takedown / feedback`).
> See [`docs/creator-permissions.md`](docs/creator-permissions.md).

## Live URL

- **Live:** _tbd — fill in after Vercel deploy._
- **Repo:** _this workspace._

## Personas

| Persona | Era | Provider | Notes |
|---|---|---|---|
| Hitesh Choudhary | Living | Groq | ChaiCode cohort-authorized |
| Piyush Garg | Living | Gemini | ChaiCode cohort-authorized |
| Elon Musk | Living | Groq | No financial / political advice |
| Steve Jobs | 20th century | Gemini | Public speeches only |
| Mahatma Gandhi | 20th century | Gemini | Latin transliteration; no modern politics |
| Albert Einstein | 20th century | Gemini | Published views only |
| Isaac Newton | 17th century | Gemini | Writings vs myths distinguished |

Full voice notes: [`docs/personas.md`](docs/personas.md).

## What it does

- **Solo chat** with any of seven persona-faithful voices at `/chat/:persona`.
- **Ask Both → Blended** — pick Persona A + Persona B; one fused LLM call per
  turn (default pair: Hitesh + Piyush).
- **BYO-Key** — paste Gemini or Groq key; nothing sent to our servers (Pure-FE).
- Session-persistent history via IndexedDB; 40-message cap per thread.

## Setup (local dev)

Prerequisites: Node 22 LTS + [Bun 1.3+](https://bun.sh).

```bash
bun install
bunx ng serve
# → http://localhost:4200
```

API keys (free tiers work):

- **Gemini** — <https://ai.google.dev> (`AIza…` key) — Jobs, Gandhi, Einstein,
  Newton, Piyush.
- **Groq** — <https://console.groq.com> (`gsk_…` key) — Musk, Hitesh.

Settings auto-opens on first send if no key is saved.

## Verify

```bash
bunx tsc --noEmit
bunx ng lint
bunx vitest run
bunx ng build --configuration production
```

## Deploy (Vercel)

1. Fork this repo.
2. Vercel Dashboard → Import → point at the fork.
3. Framework: **Angular**. Output: `dist/gen-ai-persona-ai/browser`.
4. Optional env vars: `docs/feature-flags.md`.
5. Deploy.

`vercel.json` sets `installCommand: "bun install --frozen-lockfile"` and
`buildCommand: "bun run build"`.

## Docs

- [`docs/personas.md`](docs/personas.md) — all seven personas + disclaimers.
- [`docs/creator-permissions.md`](docs/creator-permissions.md) — authorization scope.
- [`docs/attributions.md`](docs/attributions.md) — sources + asset credits.
- [`docs/prompt-engineering.md`](docs/prompt-engineering.md) — 9-block prompt structure.
- [`docs/context-management.md`](docs/context-management.md) — rolling summary + drift refresh.
- [`docs/sample-conversations.md`](docs/sample-conversations.md) — few-shots + captures.
- [`docs/feature-flags.md`](docs/feature-flags.md) — env-var kill-switches.
- [`docs/browser-compat.md`](docs/browser-compat.md) — support matrix.
- [`docs/performance.md`](docs/performance.md) — perf targets.
- [`docs/testing.md`](docs/testing.md) — Vitest runner.
- **[`EVALUATION.md`](EVALUATION.md)** — v1 grader crib sheet (unchanged).

## Parody disclaimer

This product uses **AI parody personas** for educational research. Hitesh and
Piyush retain ChaiCode cohort authorization (see `docs/creator-permissions.md`).
All other personas use fair-use framing from publicly available material.

Every solo chat surface shows a persona-specific in-chat disclaimer banner.
The app footer repeats the global disclaimer on every route.

**Takedown contact:** contact@example.com (subject: `Council — takedown /
feedback`).
