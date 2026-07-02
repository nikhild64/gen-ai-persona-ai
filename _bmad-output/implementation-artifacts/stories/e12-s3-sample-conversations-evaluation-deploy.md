# Story E12-S3: sample-conversations live captures + EVALUATION.md grader crib sheet + Vercel deploy verification

Status: ready-for-dev

- **Epic:** 12 — Submission Deliverables
- **Critical-path position:** 37 of 37 (Day 7 evening)
- **Blocks:** none — FINAL STORY
- **Depends on:** E11-S1, E11-S2, E11-S3, E12-S1, E12-S2
- **SCOPE-CUT PRIORITY #3 (PARTIAL)** — live-captures portion is cut candidate per sprint-status.yaml; keep EVALUATION.md + Vercel deploy verify + verbatim-few-shots-stub.

## Story

As a **cohort grader**,
I want **`docs/sample-conversations.md` to show me real live-captured multi-turn conversations for both personas + one Ask-Both exchange (with the persona's actual voice + turn 30 memory holding + Ask-Both awareness visible), and `EVALUATION.md` at repo root to give me a 5-line grader crib sheet before the full report, all against a live-deployed Vercel URL**,
So that **I can see the product working AND read the eval AND browse the deploy in one submission-review sitting**.

## Acceptance Criteria

**Given** the developer authors `docs/sample-conversations.md`,
**When** the doc is populated,
**Then** it contains: (a) the 6 verbatim Hinglish few-shots from `[research §C.3]` (already embedded in `src/personas/*.prompt.ts` fewShots exports) reproduced with light annotation as "expected output shape" examples; (b) at least ONE live-captured multi-turn conversation per persona (10-15 turns each — captured post-Epic 5 completion so Rolling Summary and Drift Refresh are exercised; screenshots or copy-pasted transcript with `[Persona] says: ...` attribution); (c) at least ONE live-captured Ask-Both Mode exchange (Priya's UJ-4 flow or equivalent — JS-vs-Python or similar decision-oriented question — showing Hitesh's response, Piyush's response with acknowledgment, and one Keep-going round if it fits).

**Given** the developer authors `EVALUATION.md` at repo root,
**When** the doc is populated,
**Then** it starts with a **grader crib sheet** — a top-of-file 5-line summary per PRD §9 mapped to the ChaiCode rubric: (line 1) Persona Accuracy score / 30 (from `evals/results-*.json` composite); (line 2) Conversation Quality score / 25 (from drift-curve + Ask-Both slice); (line 3) Technical Implementation score / 25 (self-assessed against the SM-3 checklist — see below); (line 4) UX score / 20 (self-assessed against SM-4 with `evals/perf-report-*.md` evidence); (line 5) 5th-line "look here first" pointer to a specific file in the repo that best defends the highest-value claim (e.g., "For the persona voice: see `docs/sample-conversations.md` UJ-2 capture at turn 25").

**Given** the EVALUATION.md continues past the crib sheet,
**When** the developer inspects,
**Then** it summarizes: (a) 3-layer eval methodology (Golden-Set, drift-curve, blind attribution) per PRD §8; (b) per-persona per-dimension scores from the latest `evals/results-*.json`; (c) `hitesh_anecdote_rate` + `piyush_anecdote_rate` aggregate values; (d) drift-curve plot from `evals/drift-curve.md`; (e) Ask-Both slice results from `evals/ask-both-slice-results.md`; (f) blind-attribution results from `evals/attribution-test.md` (once evaluators finish); (g) SM-3 revised rubric verification (client-side BYO-Key isolation + redaction verified by DevTools inspection + provider 429 In-Character surfacing verified by rapid-fire test) per PRD §11.3; (h) links to each eval artifact under `evals/`.

**Given** the developer runs a final Vercel deploy,
**When** the deploy completes,
**Then** the live URL is captured in README + EVALUATION.md; a manual smoke test runs through all 4 UJs (UJ-1 grader setup with BYO-Key paste; UJ-2 long conversation drift; UJ-3 jailbreak stress-test; UJ-4 Ask-Both eavesdrop); any bugs surfaced are fixed OR documented as known-limitations in `EVALUATION.md`.

**Given** the browser-compat matrix from E12-S1 needs a final validation pass,
**When** the developer runs the manual browser matrix on the deployed URL,
**Then** at least Chromium (latest 2), Firefox (latest 2), Safari (latest 2 — desktop + iOS Safari) are smoke-tested; results captured in `docs/browser-compat.md` with pass/fail per UJ per browser.

**Given** the submission is complete,
**When** the developer confirms everything by re-reading PRD §9 checklist,
**Then** ALL of these exist and are populated: live URL, GitHub repo public, README.md, docs/persona-data-collection.md, docs/prompt-engineering.md, docs/context-management.md, docs/sample-conversations.md, docs/creator-permissions.md, docs/feature-flags.md, EVALUATION.md, LICENSE. SM-5 passes binary yes.

## SM-3 Grader-Reproducible Verification Checklist (per readiness-gap #6)

The `EVALUATION.md` SM-3 section MUST include this 5-line grader-reproducible checklist so any grader can verify the client-side BYO-Key + 429 surfacing claims without ambiguity:

1. **Open the deployed URL in a fresh incognito window.**
2. **DevTools > Application > Session Storage:** paste a Gemini key, save via Settings modal. Verify `byo-key:gemini` key visible in sessionStorage (proves AD-11 client-side sessionStorage-only).
3. **DevTools > Network tab:** send a chat message. Confirm the outbound request goes DIRECTLY to `generativelanguage.googleapis.com` (or `/api/gemini` if Fallback b) — NO intermediate `<your-vercel-domain>/api/chat` proxy. Proves AD-1 Pure-FE + AD-11 no-server-key-handling.
4. **DevTools > Network > analytics beacon:** filter by `/_vercel/insights/event`. Send a message. Inspect beacon payload — verify NO raw key string appears anywhere (proves AD-11 redaction registry).
5. **Rapid-fire 429 test:** fire 3+ messages within 30 sec (Gemini free tier 15 RPM → likely 429s). Verify response bubble is In-Character (`"Yaar chai thodi der ruk kar peete hain..."`) not a raw error toast. Proves AD-16 + Addendum §E surfacing.

**verifies:** PRD §9 (deliverables — sample-conversations, EVALUATION with grader crib sheet), SM-5 (all deliverables present), SM-3 revised (grader-reproducible verification per readiness-gap #6)

**touches:** `docs/sample-conversations.md`, `EVALUATION.md`, `docs/browser-compat.md` (extend from E12-S1 with the final matrix results), any bug-fix touches identified during the final manual smoke test, `README.md` (extend E12-S1's live URL if changed during deploy)

**test target:** manual smoke test (live URL loads; all 4 UJs work; browser matrix passes; EVALUATION.md is legible in the 60 seconds a grader will spend per UJ-1; PRD §9 checklist has zero unchecked boxes)

## Developer Context

Final story. Ties everything together. If scope-cut priority #3 fires (live-captures cut), keep:
- 6 verbatim few-shots reproduced from research §C.3
- `docs/sample-conversations.md` includes a "live-captures pending" note pointing at the deployed URL for grader to chat
- EVALUATION.md complete
- Vercel deploy verified
- Browser matrix complete

## Technical Requirements

### `docs/sample-conversations.md`

Structure:
- Intro: "Below are expected persona output shapes, plus (if landed) live-captured multi-turn conversations."
- Section 1: 6 verbatim few-shots reproduced with light annotation (Q1-Q6, both personas — from research §C.3).
- Section 2 (if not scope-cut): live-captured Hitesh conversation (10-15 turns, screenshot or transcript).
- Section 3 (if not scope-cut): live-captured Piyush conversation.
- Section 4 (if not scope-cut): live-captured Ask-Both exchange.
- Fallback note if scope-cut: "Live captures pending — grader is invited to try the deployed URL directly to verify persona voice."

### `EVALUATION.md` structure

```markdown
# EVALUATION.md — Chai Code Personas

## 🎯 Grader crib sheet (60-second read)

- **Persona Accuracy:** XX / 30 (Golden Set composite 82%; anecdote rates hit target 42% Hitesh / 4% Piyush) → [see evals/results-2026-07-XX.json]
- **Conversation Quality:** XX / 25 (drift-curve turn-35 within 12pp of turn-5; Ask-Both acknowledgment 62%) → [see evals/drift-curve.md + evals/ask-both-slice-results.md]
- **Technical Implementation:** XX / 25 (5 SM-3 checks pass per rubric below; hexagonal ports/adapters verifiable via `src/`) → [see SM-3 verification below]
- **UX:** XX / 20 (LCP 1.6s; TTFT p90 1.9s; axe-core zero violations) → [see evals/perf-report-*.md]
- **Look here first:** for persona voice → `docs/sample-conversations.md` UJ-2 turn-25 capture (or live URL).

## Methodology

3-layer eval per PRD §8:
1. Golden Set (20 prompts × 2 personas) scored via LLM judge, 5 dimensions.
2. Blind human attribution (15 outputs, 3-5 evaluators).
3. Long-conversation drift-curve (40-turn per persona, sampled at 5/15/25/35).

## Per-persona scores (latest run)

[Table from evals/results-*.json]

## Anecdote-frequency aggregates

- hitesh_anecdote_rate: XX% (target 35-50%)
- piyush_anecdote_rate: XX% (target ≤ 10%)

## Drift curve

[ASCII/markdown plot from evals/drift-curve.md]

## Ask-Both slice results

- Acknowledgment rate: XX% (target 50%+)
- Sycophancy rate: XX% (target < 30%)
- Cross-contamination: XX% (target 0%)
[Full results in evals/ask-both-slice-results.md]

## Blind attribution results

[From evals/attribution-test.md — populated after cohort peers evaluate]

## SM-3 grader-reproducible verification (revised per PRD §11.3)

1. **Open the deployed URL in a fresh incognito window.**
2. **DevTools > Application > Session Storage:** paste a Gemini key, save via Settings modal. Verify `byo-key:gemini` visible in sessionStorage (AD-11).
3. **DevTools > Network:** send a chat message. Confirm outbound goes DIRECTLY to `generativelanguage.googleapis.com` (or `/api/gemini` fallback) — no intermediate proxy (AD-1 + AD-11).
4. **DevTools > Network > analytics beacon:** filter `/_vercel/insights/event`. Send message. Inspect payload — NO raw key (AD-11 redaction).
5. **Rapid-fire 429 test:** fire 3+ messages within 30 sec. Verify response is In-Character quota-exhausted bubble (AD-16 + Addendum §E).

## Known limitations

- [Any bugs found during final smoke test]
- [If scope-cut #3 fired: "Live-captured sample conversations pending — see live URL"]
```

### Vercel deploy verification

Final deploy at demo day. Capture URL. Run manual UJ-1/2/3/4 smoke tests. Log any bugs.

### `docs/browser-compat.md` extension

Add final matrix results:

```markdown
## Final matrix (2026-07-XX)

| Browser | UJ-1 | UJ-2 | UJ-3 | UJ-4 |
|---|---|---|---|---|
| Chromium 121 | ✓ | ✓ | ✓ | ✓ |
| Firefox 121 | ✓ | ✓ | ✓ | ✓ |
| Safari 17.1 (macOS) | ✓ | ✓ | ✓ | ✓ |
| iOS Safari 17 | ✓ | ✓ | ✓ | ✓ |
```

## Architecture Compliance

- **PRD §9:** EVALUATION.md + sample-conversations.md.
- **SM-5:** binary yes/no.
- **SM-3 revised:** grader-reproducible verification per PRD §11.3.

## File Structure Requirements

```
EVALUATION.md
docs/sample-conversations.md
docs/browser-compat.md   # EXTEND with final matrix
README.md                # extend live URL if changed
```

## Testing Requirements

- Manual smoke: UJ-1 through UJ-4 on the deployed URL.
- Browser matrix: 4-6 browser/version combos.
- 60-second EVALUATION.md legibility check.
- PRD §9 checklist scan — 0 unchecked boxes.

## Latest Tech Information

- Vercel Speed Insights auto-reports LCP + FCP + TBT on deployed URL.
- iOS Safari on physical device (or BrowserStack) for touch-input verification.

## Previous Story Intelligence

- **E11-S1/S2/S3:** eval artifacts produced.
- **E12-S1:** README + LICENSE + core docs.
- **E12-S2:** deep-context docs.

## Project Context Reference

- PRD §9 Submission Deliverables.
- PRD §11.3 supersessions (SM-3 revised).
- Sprint status: key `e12-s3-sample-conversations-evaluation-deploy`, blocks `[]`, scope_cut_priority: 3 partial.

## References

- [Source: prd.md#§9] Submission deliverables list.
- [Source: prd.md#§11.3] SM-3 supersession + revised verification.
- [Source: sprint-status.yaml#deferred_readiness_gaps.gap_6] SM-3 5-line grader-reproducible checklist added (this story).

## Story Completion Status

- [ ] `docs/sample-conversations.md` — 6 verbatim few-shots + live captures (or "pending" note if scope-cut).
- [ ] `EVALUATION.md` — 5-line grader crib sheet + methodology + per-persona scores + aggregates + drift + Ask-Both slice + attribution + SM-3 verification checklist.
- [ ] Vercel final deploy; URL captured.
- [ ] Manual UJ-1/2/3/4 smoke on deployed URL.
- [ ] `docs/browser-compat.md` extended with final matrix.
- [ ] PRD §9 checklist: zero unchecked boxes.
- [ ] SM-3 5-line reproducible checklist embedded in EVALUATION.md.
