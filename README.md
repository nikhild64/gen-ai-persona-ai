# Chai Code Personas

**AI chat website with Hitesh Choudhary + Piyush Garg.** Cohort-authorized
educational demo built by a student of the ChaiCode GenAI cohort.

> ⚠️ Parody — **not** the real person. See the parody disclaimer at the
> bottom and `docs/creator-permissions.md` for authorization scope.

## Live URL

- **Live:** _tbd — will be filled in after the final Vercel deploy at E12-S3._
- **Repo:** _tbd — this workspace._

## What it does

- Chat with a persona-faithful Hitesh (Hindi-base grammar, elder-brother
  pacing, story-first teaching) or Piyush (English-syntax + Hindi phonetics,
  whiteboard-first, homework-focused).
- **Ask-Both** mode where Hitesh answers first and Piyush responds with
  awareness of Hitesh's take (Sequential-With-Awareness per AD-13).
- **BYO-Key** only — paste your own Gemini or Groq key; nothing ever leaves
  your browser except direct provider calls (Pure-FE per AD-1).
- Session-persistent history via IndexedDB (AD-6), 40-message cap per
  thread (AD-9).

## Setup (local dev)

Prerequisites: Node 22 LTS + [Bun 1.3+](https://bun.sh) (this project uses
Bun as the canonical package manager).

```bash
bun install
bunx ng serve
# → http://localhost:4200
```

You'll need a BYO key (both free tiers work):

- Gemini — sign up at <https://ai.google.dev> for a free `AIza…` key.
- Groq — sign up at <https://console.groq.com> for a `gsk_…` key.

The Settings modal auto-opens on your first send if no key is saved.

## Deploy (Vercel one-click)

1. Fork this repo.
2. In Vercel Dashboard → Import Project → point at the fork.
3. Framework preset: **Angular**.
4. Output directory: `dist/gen-ai-persona-ai/browser`.
5. Optional: set env vars per `docs/feature-flags.md`
   (`NG_APP_FEATURE_ASK_BOTH_MODE`, `NG_APP_FEATURE_MODERATION`, etc.).
6. Deploy.

The included `vercel.json` already sets `installCommand: "bun install --frozen-lockfile"`
and `buildCommand: "bun run build"`.

## Docs

- [`docs/persona-data-collection.md`](docs/persona-data-collection.md) — how we sourced the persona voices.
- [`docs/prompt-engineering.md`](docs/prompt-engineering.md) — 9-block layered prompt structure.
- [`docs/context-management.md`](docs/context-management.md) — Rolling Summary + Verbatim Tail + Drift Refresh.
- [`docs/sample-conversations.md`](docs/sample-conversations.md) — verbatim few-shots + live captures.
- [`docs/creator-permissions.md`](docs/creator-permissions.md) — cohort authorization scope.
- [`docs/feature-flags.md`](docs/feature-flags.md) — env-var kill-switches.
- [`docs/browser-compat.md`](docs/browser-compat.md) — support matrix.
- [`docs/performance.md`](docs/performance.md) — perf targets + measurement.
- [`docs/attributions.md`](docs/attributions.md) — asset + library credits.
- [`docs/testing.md`](docs/testing.md) — Vitest+jsdom runner rationale.
- **[`EVALUATION.md`](EVALUATION.md)** — 5-line grader crib sheet + full report.

## Parody disclaimer

This is an **AI simulation, not the real person**. Cohort-authorized
educational demo built with permission of Hitesh Choudhary + Piyush Garg
for the ChaiCode GenAI cohort. See `docs/creator-permissions.md` for the
verbatim authorization language.

**Takedown contact:** contact@example.com (subject: "Chai Code Personas —
takedown / feedback"). See `docs/creator-permissions.md` for the real
address before shipping.
