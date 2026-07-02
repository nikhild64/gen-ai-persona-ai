# Story E11-S2: Drift-curve + attribution test setup + Ask-Both slice

Status: ready-for-dev

- **Epic:** 11 — Eval Infrastructure & Golden Set
- **Critical-path position:** 33 of 37 (Day 7 afternoon)
- **Blocks:** E12-S3
- **Depends on:** E11-S1, E5-S3, E9-S3
- **SCOPE-CUT PRIORITY #2 (PARTIAL)** — blind-attribution setup is the cut candidate; drift-curve + Ask-Both slice STAY per sprint-status.yaml.

## Story

As a **cohort grader**,
I want **evidence that Hitesh's voice at turn 35 is still recognizably Hitesh (drift-curve), that humans can tell the bot apart from the real person (blind attribution), and that Ask-Both Persona-B acknowledges Persona-A without being sycophantic (Ask-Both slice)**,
So that **SM-2 (Conversation Quality) and SM-7 (Ask-Both quality) are measurable and defensible, not just claimed**.

## Acceptance Criteria

**Given** the developer authors `evals/drift-curve.ts` runnable via `npm run eval:drift`,
**When** the script runs,
**Then** it drives one 40-turn conversation per persona (Hitesh AND Piyush separately) via the production ChatOrchestrator + PromptAssembler + provider adapters (per AD-18); samples the assistant's response at turns 5, 15, 25, and 35; scores each sample against the same 5-dimension rubric from E11-S1; writes results to `evals/drift-curve.md` with a small ASCII/markdown plot of the drift trend (e.g., table of turn → score).

**Given** the drift-curve result,
**When** the developer inspects the report,
**Then** SM-2 pass criterion: score at turn 35 ≥ (score at turn 5 − 15 percentage points). Fail is a red flag for Rolling Summary + Drift Refresh from Epic 5 — the fix would be tuning `DRIFT_REFRESH_CADENCE` down or `SUMMARY_REFRESH_CADENCE` down.

**Given** the developer authors `evals/attribution-test.md`,
**When** the doc is drafted,
**Then** it (a) sets up the blind-attribution test methodology: 15 unlabeled outputs (5 Hitesh-bot + 5 Piyush-bot + 5 real verbatim quotes from research §A/§B) shown to 3-5 cohort peers who are asked "Which of these is real Hitesh? Which is real Piyush? Which is the bot?"; (b) provides a Google Form template or offline evaluator sheet template; (c) leaves a `## Results` section blank for the developer to fill in after the eval runs (target: ≥ 70% correct attribution between Persona A vs Persona B).

**Given** the developer authors `evals/ask-both-slice.ts` runnable via `npm run eval:ask-both`,
**When** the script runs,
**Then** it drives 8 Ask-Both prompts through the full sequencer (Epic 9); for each Ask-Both turn (which produces 2 messages: Hitesh + Piyush), the judge model scores: (a) acknowledgment rate — does Piyush's response reference Hitesh's take? Yes/No, per prompt; target: 50%+ per SM-7 starter hypothesis; (b) no-cross-contamination — does Persona A use Persona B's signature phrases or vice versa? Yes/No, per prompt; target: 0%; (c) collaboration-vs-debate mix — is Piyush agreeing/collaborating vs distinctly diverging? Categorical, per prompt; target: ~70% acknowledgment/collaboration, ~30% distinct-additional-angle per SM-7; (d) no-fabricated-quotes — does either persona invent things about the other? Yes/No; target: 0%; (e) sycophancy rate — is Persona B's agreement over-eager / hollow? Yes/No; target: < 30% per SM-C4. Writes results to `evals/ask-both-slice-results.md`.

**Given** the Ask-Both slice results,
**When** the developer inspects,
**Then** IF sycophancy rate > 30% AND acknowledgment rate < 25% (per FR-31 fallback trigger), the developer flips `ASK_BOTH_MODE = 'parallel'` in `feature-flags.ts` for demo day and updates `README.md` to describe Ask-Both as "both personas answer independently" per FR-31.

**verifies:** PRD §8 (blind human attribution layer + long-conversation drift-curve layer), SM-2 (Conversation Quality drift-curve target), SM-7 (Ask-Both eval slice with acknowledgment / sycophancy / cross-contamination targets), SM-C4 (do NOT optimize for maximum agreement — sycophancy rate ceiling), FR-31 (Parallel-mode fallback trigger criteria), AD-13 (Ask-Both sequencer eval)

**touches:** `evals/drift-curve.ts`, `evals/drift-curve.md` (produced by script), `evals/attribution-test.md`, `evals/ask-both-slice.ts`, `evals/ask-both-slice-results.md` (produced by script), `package.json` (add `"eval:drift": "tsx evals/drift-curve.ts"`, `"eval:ask-both": "tsx evals/ask-both-slice.ts"` scripts)

**test target:** eval (each script produces well-formed output; drift-curve produces a chart with 4 data points per persona; ask-both-slice reports acknowledgment + sycophancy + no-cross-contamination rates) + manual smoke test (recruit 3-5 cohort peers via attribution-test.md protocol; log a real attribution session before demo day)

## Developer Context

Three eval sub-slices. Drift-curve and Ask-Both slice are automated scripts. Blind-attribution is a manual protocol requiring cohort peers (part of scope-cut candidate #2).

**Drift-curve mechanics:** drive a 40-turn conversation via the sequencer/orchestrator; feed synthetic follow-up messages (e.g., "explain more", "in Python", "what about X"). Sample at 5/15/25/35; judge each against 5-dimension rubric.

**Ask-Both slice mechanics:** 8 prompts through sequencer; judge model scores acknowledgment + cross-contamination + sycophancy per turn.

**FR-31 fallback trigger:** if sycophancy > 30% AND acknowledgment < 25%, flip to Parallel mode.

## Technical Requirements

### `evals/drift-curve.ts`

```ts
#!/usr/bin/env tsx
// For each persona: run 40-turn conversation, sample at 5/15/25/35, score.
const followUps = [
  "Isko practical mein kaise implement karun?",
  "Ek small project example do?",
  "In Python how would this look?",
  "What about scaling this to 1000 users?",
  // ...40 total to cover 40 turns
];

for (const persona of ['hitesh', 'piyush']) {
  const thread: Thread = { /* fresh */ };
  const samples: any[] = [];
  for (let i = 0; i < 40; i++) {
    thread.messages.push({ id: 'u'+i, role: 'user', content: followUps[i], timestamp: Date.now() });
    const prompt = assembler.compose(persona, thread, 'solo');
    const response = await streamAndCollect(providerAdapter, prompt, key);
    thread.messages.push({ id: 'a'+i, role: 'assistant', persona, content: response, timestamp: Date.now(), status: 'complete' });
    if ([5, 15, 25, 35].includes(i + 1)) {
      const scores = await judgeSample(response);
      samples.push({ turn: i + 1, scores });
    }
    // Fire ContextManager.onTurnComplete after each turn (real drift-refresh + summary behavior)
  }
  writeToMarkdown(persona, samples);
}
```

Output `evals/drift-curve.md`:
```markdown
# Drift Curve — 2026-07-XX

## Hitesh

| Turn | Sig | Hinglish | Teaching | Signal | No-Drift | Composite |
|---|---|---|---|---|---|---|
| 5  | 3 | 3 | 3 | 3 | 3 | 3.0 |
| 15 | 3 | 3 | 2 | 3 | 3 | 2.8 |
| 25 | 2 | 3 | 3 | 2 | 3 | 2.6 |
| 35 | 2 | 3 | 3 | 3 | 3 | 2.8 |

**Pass criterion:** score at turn 35 ≥ score at turn 5 − 0.15 → 3.0 - 0.15 = 2.85. Actual: 2.8. FAIL by 0.05 pp.

## Piyush
...
```

### `evals/attribution-test.md`

```markdown
# Blind Attribution Test

## Method
Show 15 unlabeled outputs to 3-5 cohort peers. Ask: "Which of these is real Hitesh? Which is real Piyush? Which is the bot?"

- 5 Hitesh-bot outputs (from Golden Set run)
- 5 Piyush-bot outputs (from Golden Set run)
- 5 verbatim quotes from research §A / §B

## Google Form template
[Link to form template — placeholder]

## Evaluator sheet template
| Output # | Real Hitesh | Real Piyush | Bot |
|---|---|---|---|
| 1 | | | |
| ... | | | |

## Results (fill after eval)
_Target: ≥ 70% correct attribution between Persona A vs Persona B._

- Total responses: N
- Correct attribution %: XX%
- Notes: ...
```

### `evals/ask-both-slice.ts`

```ts
const askBothPrompts = [
  "JavaScript pehle seekhun ya Python?",
  "Docker seekhna hai — kaise start karun?",
  // ... 8 total decision-oriented prompts
];

for (const prompt of askBothPrompts) {
  const [hiteshText, piyushText] = await runAskBothSequential(prompt);
  const scores = await judgeAskBothTurn(hiteshText, piyushText, prompt);
  // scores: acknowledgment(yes/no), cross_contamination(yes/no), collab_vs_debate(cat), sycophancy(yes/no), fabricated_quote(yes/no)
  results.push(scores);
}
writeToMarkdown('evals/ask-both-slice-results.md', results);
```

Output includes per-target aggregates:
- Acknowledgment rate: e.g., 62% (target 50%+ ✓)
- Sycophancy rate: 20% (target < 30% ✓)
- Cross-contamination: 0% (target 0% ✓)

## Architecture Compliance

- **AD-18:** eval CLI reuses production adapters + sequencer.
- **SM-2 / SM-7:** measurable drift-curve + Ask-Both quality metrics.
- **FR-31:** trigger criteria for Parallel fallback documented.

## File Structure Requirements

```
evals/
  drift-curve.ts           # NEW
  drift-curve.md           # produced by script
  attribution-test.md      # NEW manual protocol
  ask-both-slice.ts        # NEW
  ask-both-slice-results.md  # produced by script
package.json                # UPDATE scripts
```

## Testing Requirements

- Script smoke: each produces well-formed markdown output.
- Peers-based blind attribution: run session before demo, log results.

## Latest Tech Information

- ASCII/markdown plot for drift-curve — simple table works fine.
- Google Form for attribution — free tier fine for 15-output survey.

## Previous Story Intelligence

**E11-S1 (Golden Set + runner + judge):** reuses judge model + rubric.
**E9-S3 (Ask-Both UI + Keep-going):** sequencer available.
**E5-S3 (Drift Refresh):** real drift-refresh behavior exercised over 40 turns.

## Project Context Reference

- PRD §8 Layers 2 + 3 (blind attribution + drift curve).
- ARCHITECTURE-SPINE.md `AD-13` Ask-Both eval + `AD-18` eval reuse.
- Sprint status: key `e11-s2-drift-curve-attribution-ask-both-slice`, scope_cut_priority: 2 partial.

## References

- [Source: prd.md#§8] All three eval layers.
- [Source: prd.md#SM-7] Ask-Both eval metrics.
- [Source: prd.md#SM-C4] Sycophancy ceiling.

## Story Completion Status

- [ ] `evals/drift-curve.ts` produces 4-sample drift curve per persona.
- [ ] `evals/drift-curve.md` output.
- [ ] `evals/attribution-test.md` manual protocol with form template + evaluator sheet.
- [ ] `evals/ask-both-slice.ts` produces acknowledgment + sycophancy + cross-contamination metrics.
- [ ] `evals/ask-both-slice-results.md` output.
- [ ] `package.json` scripts.
