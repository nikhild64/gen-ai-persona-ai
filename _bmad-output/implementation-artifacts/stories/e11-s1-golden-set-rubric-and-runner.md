# Story E11-S1: Golden Set + rubric.md + `evals/run.ts` with Judge model

Status: ready-for-dev

- **Epic:** 11 — Eval Infrastructure & Golden Set
- **Critical-path position:** 32 of 37 (Day 7 midday)
- **Blocks:** E11-S2, E11-S3, E12-S3
- **Depends on:** E0-S3, E2-S1

## Story

As a **cohort grader**,
I want **an `EVALUATION.md` report at repo root that shows per-persona per-dimension scores across a 20-prompt Golden Set (technical + emotional + opinion + edge-case), plus an anecdote-frequency aggregate (Hitesh 35-50% / Piyush ≤10%)**,
So that **within 60 seconds of opening the report I can see the persona fidelity is real, not aspirational, and score the submission accordingly**.

## Acceptance Criteria

**Given** the developer authors `evals/golden-set.json`,
**When** the file is populated,
**Then** it contains 40 prompts total (20 per persona): 5 intro / 5 technical / 5 opinion / 5 edge-case-and-refusal per persona. Sourced from research §C.3 verbatim exemplars (Q1-Q6 for both personas) + composed prompts covering the remaining slots. Each prompt is `{id: string, persona: PersonaId, category: 'intro' | 'technical' | 'opinion' | 'edge_case', text: string, expected_signals?: string[]}` — `expected_signals` lists optional per-prompt hints (e.g. "should mention Groq/Vercel", "should redirect off-domain").

**Given** the developer authors `evals/rubric.md`,
**When** the doc is drafted,
**Then** it defines the 5 per-response dimensions (each scored 0-3 by the LLM judge): (1) signature-phrase presence; (2) Hinglish code-switch fidelity; (3) teaching-approach match (story-first for Hitesh, whiteboard-first for Piyush); (4) persona-signal presence (analogies, tics); (5) no-drift-into-other-persona. Plus the Golden-Set aggregate: `hitesh_anecdote_rate` (target 35-50% of 20 responses) and `piyush_anecdote_rate` (target ≤10%). Judge prompt for anecdote count: "Does this response contain a first-person anecdote drawn from the persona's real biography (LCO / iNeuron / PW / travel / cyber-security)? Yes/No."

**Given** the rubric is drafted,
**When** the developer authors `evals/run.ts` runnable via `npm run eval` (which invokes `tsx evals/run.ts`),
**Then** the script (a) loads `evals/golden-set.json`; (b) for each prompt, uses `PROVIDER_REGISTRY.get(providerId)` from `src/infrastructure/providers/` (same code as production per AD-18) to stream a response using the persona's default provider + prompt from `PERSONA_REGISTRY[persona].prompt`; (c) collects the full response text; (d) for each response, calls a JUDGE model via `PROVIDER_REGISTRY.get(judgeProviderId)` (default judge: Groq's largest model if Gemini is the generator; Gemini if Groq is the generator — decoupled generator from judge per PRD §8) with a rubric prompt asking for 0-3 scores on each dimension + Yes/No on anecdote presence; (e) writes results to `evals/results-YYYY-MM-DD.json`.

**Given** the eval run completes,
**When** the developer inspects `evals/results-YYYY-MM-DD.json`,
**Then** the structure is `{ runDate, model_generator, model_judge, results: [{prompt_id, persona, category, response_text, judge_scores: {sig, hinglish, teaching, signal, no_drift}, anecdote_present: boolean, ...}], aggregates: {per_persona_avg_dim1..5, hitesh_anecdote_rate, piyush_anecdote_rate, composite_avg} }`.

**Given** the judge model is decoupled from the generator per PRD §8,
**When** the developer configures `evals/config.ts` (or env vars),
**Then** generator provider AND judge provider are separately configurable — the same Golden Set can be re-run with Gemini generating + Groq judging OR Groq generating + Gemini judging.

**Given** any adapter in `src/infrastructure/providers/` is refactored,
**When** the developer runs `npm run eval`,
**Then** the eval reuses the exact same adapter code — no re-implementation in Python or another language per AD-18. This satisfies PRD SM-3(f) Provider-Agnostic verification by construction.

**verifies:** PRD §8 (Golden-Set Rubric Scoring layer + anecdote-frequency aggregate check), SM-1 (Persona Accuracy ≥ 80% avg per persona), SM-6 (100% pass on fabrication-bait + off-domain), AD-18 (eval CLI reuses production adapters)

**touches:** `evals/golden-set.json`, `evals/rubric.md`, `evals/run.ts`, `evals/config.ts` (or `.env.eval`), `evals/README.md` (short usage guide: `npm run eval`, env-var setup, JSON output schema), `package.json` (add `"eval": "tsx evals/run.ts"` script)

**test target:** eval (`npm run eval` produces a well-formed results.json + a legible score summary printed to stdout) + unit test (rubric.md parses correctly; golden-set.json validates against a schema; judge prompt template renders correctly for a sample response)

## Developer Context

Highest-leverage rubric play per PRD §8. Solid `EVALUATION.md` with concrete per-dimension scores makes graders confident.

**Golden Set structure per PRD §8:**
- 20 prompts per persona (40 total)
- Categories: 5 intro / 5 technical / 5 opinion / 5 edge_case
- Source verbatim from research §C.3 Q1-Q6 where possible; compose remaining
- Each prompt: `{id, persona, category, text, expected_signals?}`

**Rubric.md structure per PRD §8:**
- 5 per-response dimensions, each 0-3
- Composite avg across dimensions per persona
- Aggregate: `hitesh_anecdote_rate` (35-50% target), `piyush_anecdote_rate` (≤10% target)
- Judge prompt for anecdote: "Does this response contain a first-person anecdote drawn from the persona's real biography (LCO / iNeuron / PW / travel / cyber-security)? Yes/No."

**AD-18 discipline:** eval script imports adapters directly from `src/infrastructure/providers/` — same TS code as production. No re-implementation. Judge model calls also go through `PROVIDER_REGISTRY`.

## Technical Requirements

### `evals/golden-set.json` structure

```json
{
  "version": 1,
  "prompts": [
    {
      "id": "hitesh-intro-01",
      "persona": "hitesh",
      "category": "intro",
      "text": "Sir, main GenAI seekhna chahta hun, kahaan se start karun?",
      "expected_signals": ["chai", "story-first", "starts warmly"]
    },
    {
      "id": "hitesh-technical-01",
      "persona": "hitesh",
      "category": "technical",
      "text": "Sir/Piyush, mujhe React seekhna chahiye ya directly Next.js pe jaana chahiye?",
      "expected_signals": ["analogy", "React first"]
    },
    // ... 18 more Hitesh prompts covering intro/technical/opinion/edge_case (5 each)
    // ... 20 Piyush prompts
  ]
}
```

Compose the remaining prompts per persona style — intros are casual "kaise start karun" openers, technicals are like Q1/Q4 from research, opinions are like Q5, edge_cases are jailbreak/fabrication-bait/off-domain like Q3 stress + political/adult/etc.

### `evals/rubric.md`

Markdown doc describing the 5 dimensions + aggregate check. Referenced by `evals/run.ts` for judge prompt construction.

### `evals/run.ts`

```ts
#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { PROVIDER_REGISTRY } from '../src/infrastructure/providers/provider.registry';
import { PromptAssembler } from '../src/domain/prompts/prompt-assembler.service';
import { PERSONA_REGISTRY } from '../src/personas/persona.registry';
import type { Thread, PersonaId } from '../src/domain/types/message';

const goldenSet = JSON.parse(readFileSync('evals/golden-set.json', 'utf-8'));
const generatorProvider = process.env.EVAL_GENERATOR ?? 'gemini';
const judgeProvider = process.env.EVAL_JUDGE ?? 'groq';
const generatorKey = process.env.EVAL_GENERATOR_KEY!;
const judgeKey = process.env.EVAL_JUDGE_KEY!;

const results = [];
const assembler = new PromptAssembler();

for (const item of goldenSet.prompts) {
  // Build stub thread with just this prompt as the current user message
  const thread: Thread = {
    id: 'eval', scope: item.persona,
    messages: [{ id: 'u', role: 'user', content: item.text, timestamp: 0 }],
    rollingSummary: null, turnsSinceLastSummary: 0,
    createdAt: 0, updatedAt: 0,
  };
  const prompt = assembler.compose(item.persona, thread, 'solo');
  const AdapterClass = PROVIDER_REGISTRY.get(generatorProvider)!;
  const adapter = new AdapterClass();
  let responseText = '';
  for await (const chunk of adapter.streamChat(prompt, generatorKey, new AbortController().signal)) {
    if (chunk.type === 'delta' && chunk.text) responseText += chunk.text;
    else if (chunk.type === 'done' || chunk.type === 'error') break;
  }
  // Judge call
  const judgePrompt = buildJudgePrompt(item, responseText);
  const JudgeAdapter = PROVIDER_REGISTRY.get(judgeProvider)!;
  const judge = new JudgeAdapter();
  let judgeText = '';
  for await (const chunk of judge.streamChat(judgePrompt, judgeKey, new AbortController().signal)) {
    if (chunk.type === 'delta' && chunk.text) judgeText += chunk.text;
    else if (chunk.type === 'done' || chunk.type === 'error') break;
  }
  const scores = parseJudgeScores(judgeText);
  results.push({ prompt_id: item.id, persona: item.persona, category: item.category, response_text: responseText, judge_scores: scores, anecdote_present: scores.anecdote });
}

const aggregates = computeAggregates(results);
const output = {
  runDate: new Date().toISOString().slice(0, 10),
  model_generator: generatorProvider,
  model_judge: judgeProvider,
  results,
  aggregates,
};
writeFileSync(`evals/results-${output.runDate}.json`, JSON.stringify(output, null, 2));
console.log('Eval complete. Aggregates:', aggregates);
```

### `evals/config.ts` OR `.env.eval` — separate config for eval-time provider selection.

### `package.json`

```json
"scripts": {
  "eval": "tsx evals/run.ts",
  "eval:drift": "tsx evals/drift-curve.ts",       // E11-S2
  "eval:ask-both": "tsx evals/ask-both-slice.ts", // E11-S2
  "eval:perf": "tsx evals/performance-budget.ts"  // E11-S3
}
```

Add `tsx` to devDependencies.

## Architecture Compliance

- **AD-18:** eval imports directly from `src/infrastructure/providers/` — same code as production.
- **AD-3:** ProviderPort — judge model call via same interface.
- **PRD §8:** 5 dimensions + anecdote aggregate.
- **SM-1:** Persona Accuracy ≥ 80% avg per persona.
- **SM-6:** 100% pass on fabrication + off-domain edge cases.

## Library / Framework Requirements

```
tsx@^4       # Runs the .ts files in Node
```

## File Structure Requirements

```
evals/
  golden-set.json           # NEW — 40 prompts
  rubric.md                 # NEW — 5 dimensions + aggregate
  run.ts                    # NEW — CLI runner
  config.ts                 # NEW — eval-time config
  README.md                 # NEW — usage
package.json                # UPDATE scripts + devDeps
```

## Testing Requirements

- Schema-validate golden-set.json (40 entries, all required fields).
- Unit test rubric.md parse (regex extraction of dimension definitions).
- Manual smoke: `npm run eval` with real BYO-Keys produces well-formed results.json.

## Latest Tech Information

- `tsx` is the modern replacement for `ts-node` — no config, fast.

## Previous Story Intelligence

**E0-S3:** PERSONA_REGISTRY, PROVIDER_REGISTRY all in place.
**E2-S1:** adapters usable directly from Node via `tsx` (browser-native fetch works in Node 22 too).
**E2-S2:** PromptAssembler.compose returns OutboundPrompt.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-18` (eval reuses production adapters, lines 265–269).
- PRD §8 Persona Fidelity Evaluation (lines 656–685).
- Sprint status: key `e11-s1-golden-set-rubric-and-runner`, blocks `[e11-s2, e11-s3, e12-s3]`.

## References

- [Source: prd.md#§8] Golden-Set + rubric + anecdote aggregate.
- [Source: ARCHITECTURE-SPINE.md#AD-18] eval CLI reuses production adapters.
- [Source: research §C.3] Verbatim Q&As for Golden Set intros/technicals.

## Story Completion Status

- [ ] `evals/golden-set.json` — 40 prompts (20 per persona) covering intro/technical/opinion/edge_case.
- [ ] `evals/rubric.md` — 5 dimensions + aggregate + judge prompt template.
- [ ] `evals/run.ts` — TSX-runnable CLI reusing production adapters.
- [ ] `evals/config.ts` — env-var-driven provider selection.
- [ ] `evals/README.md` — usage guide.
- [ ] `package.json` — `eval` script + `tsx` devDep.
- [ ] Manual smoke: results.json produced with per-dimension scores + aggregates.
