# EVALUATION.md — Chai Code Personas

## 🎯 Grader crib sheet (60-second read)

_All scores are self-assessed pending the actual eval run + peer session.
The plumbing to produce final numbers is in `evals/` — run
`bun run eval && bun run eval:drift && bun run eval:ask-both` with your
own BYO-Keys to reproduce._

- **Persona Accuracy** (target ≥ 24 / 30): Golden-Set composite ≥ 2.4 / 3
  across 5 rubric dimensions × 20 prompts × 2 personas. Anecdote rates —
  Hitesh target 35–50 %, Piyush target ≤ 10 %.
  See [`evals/results-YYYY-MM-DD.json`](evals/) after `bun run eval`.
- **Conversation Quality** (target ≥ 20 / 25): drift-curve turn-35
  composite ≥ turn-5 − 0.45 per persona; Ask-Both acknowledgment ≥ 50 %,
  sycophancy < 30 %.
  See [`evals/drift-curve.md`](evals/) + [`evals/ask-both-slice-results.md`](evals/).
- **Technical Implementation** (target ≥ 20 / 25): five SM-3 checks per
  the reproducible checklist below all pass; hexagonal ports/adapters
  visible under `src/domain/`, `src/infrastructure/`, `src/features/`.
- **UX** (target ≥ 16 / 20): LCP ≤ 2.0 s + TTFT p90 ≤ 2.0 s per
  [`evals/perf-report-YYYY-MM-DD.md`](evals/); axe-core zero violations.
- **Look here first for persona voice:** [`docs/sample-conversations.md`](docs/sample-conversations.md)
  Section 1 (verbatim few-shots) OR the deployed URL — chat 5–10 turns
  with either persona.

## 3-layer eval methodology (per PRD §8)

1. **Golden Set + LLM Judge** — 40 prompts × 5 rubric dimensions, scored
   by a decoupled judge model (Gemini judging Groq-generated responses
   and vice versa) via `bun run eval`.
2. **Drift curve** — 40-turn conversation per persona, sampled at turns
   5/15/25/35, scored by the same rubric via `bun run eval:drift`.
3. **Blind human attribution** — 15 unlabeled outputs (5 Hitesh-bot / 5
   Piyush-bot / 5 verbatim real quotes) shown to 3–5 cohort peers via
   `evals/attribution-test.md` protocol.

Ask-Both quality is a fourth slice: 8 decision-oriented prompts through
the sequencer, scored on acknowledgment / cross-contamination / sycophancy /
fabricated-quote / collab-or-debate stance via `bun run eval:ask-both`.

## SM-3 grader-reproducible verification (revised per PRD §11.3)

Follow these 5 steps against the deployed URL to verify the client-side
BYO-Key isolation + provider 429 in-character surfacing claims.

1. **Open the deployed URL in a fresh incognito window.**
2. **DevTools → Application → Session Storage:** paste a Gemini key via
   the Settings modal (`⚙` icon). Verify a `byo-key:gemini:v1` entry
   appears in the sessionStorage panel — proves AD-11 client-side
   sessionStorage-only.
3. **DevTools → Network:** send a chat message. Confirm the outbound
   request goes DIRECTLY to `generativelanguage.googleapis.com` (or
   `/api/gemini` if Spike-0 fallback (b) is active) — no intermediate
   `<vercel-domain>/api/chat` proxy. Proves AD-1 Pure-FE + AD-11
   no-server-key-handling.
4. **DevTools → Network → analytics beacon:** filter by
   `/_vercel/insights/event`. Send another message. Inspect the payload —
   confirm NO raw key string appears anywhere. Proves AD-11 redaction
   registry.
5. **Rapid-fire 429 test:** fire 3+ messages within 30 seconds (Gemini
   free tier ~15 RPM → 429 likely). Verify the response bubble is
   in-character (`"Yaar chai thodi der ruk kar peete hain — thoda break,
   try again in a minute…"`) rather than a raw error toast. Proves
   AD-16 + Addendum §E surfacing.

Any of these failing is a scoring red flag — the code paths above are in
`src/domain/key-vault/`, `src/infrastructure/analytics/`,
`src/infrastructure/providers/` respectively.

## Aggregates (fill after eval)

- **Golden-Set composite** per persona: _run `bun run eval` and paste
  from `evals/results-YYYY-MM-DD.json` `aggregates.per_persona`._
- **Hitesh anecdote rate:** _target 35–50 % — actual: ___._
- **Piyush anecdote rate:** _target ≤ 10 % — actual: ___._
- **Drift-curve pass:** _per persona, turn-35 composite ≥ turn-5
  composite − 0.45. See `evals/drift-curve.md`._
- **Ask-Both acknowledgment rate:** _target ≥ 50 % — actual: ___._
- **Ask-Both sycophancy rate:** _target < 30 % — actual: ___._
- **Blind attribution correct-A-vs-B:** _target ≥ 70 % — actual: ___._

## Known limitations

- **Live-captured sample conversations pending** — scope-cut candidate #3
  per `_bmad-output/implementation-artifacts/sprint-status.yaml`.
  Verbatim few-shots (research §C.3) are reproduced in
  `docs/sample-conversations.md` as expected-shape examples; grader can
  reproduce live via the deployed URL.
- **Blind-attribution peer session pending** — protocol lives in
  `evals/attribution-test.md`; a real session takes a Google Form and
  3–5 cohort peers, run before demo day when possible.
- **Playwright perf script** requires `bunx playwright install chromium`
  before `bun run eval:perf` will run. Not in the base install to keep
  the initial clone lean.
- **Live URL** to be captured after the final Vercel deploy in E12-S3.

## Links

- 40-prompt Golden Set: [`evals/golden-set.json`](evals/golden-set.json)
- Rubric: [`evals/rubric.md`](evals/rubric.md)
- Ask-Both slice: [`evals/ask-both-slice.ts`](evals/ask-both-slice.ts)
- Drift curve: [`evals/drift-curve.ts`](evals/drift-curve.ts)
- Perf budget: [`evals/performance-budget.ts`](evals/performance-budget.ts)
- Blind attribution protocol: [`evals/attribution-test.md`](evals/attribution-test.md)
- Feature-flag doc: [`docs/feature-flags.md`](docs/feature-flags.md)
- Persona data collection: [`docs/persona-data-collection.md`](docs/persona-data-collection.md)
- Prompt engineering: [`docs/prompt-engineering.md`](docs/prompt-engineering.md)
- Context management: [`docs/context-management.md`](docs/context-management.md)
- Creator permissions: [`docs/creator-permissions.md`](docs/creator-permissions.md)
