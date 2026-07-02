# Golden-Set Eval

Runs the 40-prompt Golden Set (`golden-set.json`) through the same
production provider adapters the browser uses (per AD-18), grades each
response with a separate judge model, and writes per-run results to
`results-YYYY-MM-DD.json`. Grader-facing summary is in `EVALUATION.md`
at repo root.

## Usage

```bash
EVAL_GENERATOR=gemini \
EVAL_JUDGE=groq \
EVAL_GENERATOR_KEY=AIza… \
EVAL_JUDGE_KEY=gsk_… \
bun run eval
```

- `EVAL_GENERATOR` / `EVAL_JUDGE` (default `gemini` / `groq`) — the two
  provider IDs. Decoupled per PRD §8.
- Keys must be supplied at runtime, never committed.

## Other eval commands

- `bun run eval:drift` — long-conversation drift curve (E11-S2).
- `bun run eval:ask-both` — Ask-Both slice (E11-S2).
- `bun run eval:perf` — headless-Chromium perf budget (E11-S3).

## Output schema

```
{
  runDate, model_generator, model_judge,
  results: [{prompt_id, persona, category, response_text, judge_scores, anecdote_present}],
  aggregates: { per_persona: {hitesh: {...}, piyush: {...}}, composite_avg }
}
```

See `rubric.md` for dimension definitions + targets.
