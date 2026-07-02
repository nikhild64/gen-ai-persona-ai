# Story E12-S2: persona-data-collection + prompt-engineering + context-management docs

Status: ready-for-dev

- **Epic:** 12 — Submission Deliverables
- **Critical-path position:** 36 of 37 (Day 7 evening)
- **Blocks:** E12-S3
- **Depends on:** E0-S3, E2-S2, E5-S3

## Story

As a **cohort grader who wants to understand HOW the personas were built**,
I want **three docs explaining the persona data collection methodology, the prompt engineering strategy, and the context-management approach**,
So that **the Technical Implementation rubric (25 pts) has explicit inspection targets and I can score the depth of thought**.

## Acceptance Criteria

**Given** the developer authors `docs/persona-data-collection.md`,
**When** the doc is populated,
**Then** it uses the ready-to-paste paragraph from Addendum §G as the base — with light editing per the developer's actual data collection process — covering: ~46 primary/secondary sources per creator, verbatim-quote priority, verification standards, methodology (deep-verification), known limitations, cohort authorization note. Cites specific sources (`hitesh.ai`, `chaicode.com`, `piyushgarg.dev`, `teachyst.com`, LinkedIn, X, YouTube transcripts of specific videos, GitHub READMEs, podcast appearances).

**Given** the developer authors `docs/prompt-engineering.md`,
**When** the doc is populated,
**Then** it explains: (a) the layered prompt structure (identity + voice rules + few-shots + rolling summary + verbatim tail + drift refresh + user message wrapped in `<user_message>` per AD-8); (b) why per-persona differences (Hitesh story-first-then-code — LCO/iNeuron/PW anecdote rate targeted at ~40% per SM-1 anecdote aggregate; Piyush concept-first — no anecdotes, whiteboard reductive framing); (c) how signature phrases are enforced (VOICE RULES block + regex smoke-test observation via `persona_regex_miss` analytics per AD-19); (d) why the model choice per persona (Hitesh → Gemini 2.5 Flash per Hinglish edge per Addendum §B.3, or Groq if Spike-0 fallback per E0.5-S1; Piyush → Groq gpt-oss-120b per speed edge); (e) model parameters + rationale (temperature, top_p, freq/presence penalties — Piyush's low freq/presence penalty INTENTIONAL to preserve `देखो`/`यार`/`OK?` repetition per Addendum §B.4); (f) deferred providers (OpenAI + Anthropic + reasons — browser CORS + `dangerouslyAllowBrowser` risks per AD-5 Deferred).

**Given** the developer authors `docs/context-management.md`,
**When** the doc is populated,
**Then** it explains: (a) the Rolling Summary + Verbatim Tail + Drift Refresh design; (b) why the Character.AI ~21%-recall-at-turn-40 was the anti-pattern; (c) drift-refresh strategy (turn 15 + every 10 thereafter per `DRIFT_REFRESH_CADENCE = 10` from `context-config.ts` — cites AD-9); (d) cost implications (Rolling Summary is a separate LLM call every ~10 turns; Verbatim Tail is bounded at 8 for prompt-token predictability); (e) token-budget math (outbound prompt fits within model context window with 30% headroom per PRD §4.4 NFR); (f) the client-side max-turn cap trade-off (40-message cap defeatable by clearing browser storage — accepted per AD-1); (g) reference to `evals/drift-curve.md` from Epic 11 for measurement.

**verifies:** PRD §9 (deliverables — persona-data-collection, prompt-engineering, context-management docs), SM-5

**touches:** `docs/persona-data-collection.md`, `docs/prompt-engineering.md`, `docs/context-management.md`

**test target:** manual smoke test (open each doc; verify it's substantive — not a stub; verify claims align with the actual code (`src/personas/*.prompt.ts` and `src/domain/context/`) and eval results (`evals/results-*.json`))

## Developer Context

Three deep-context docs targeted at Technical Implementation rubric (25 pts). Content should reference actual code paths + AD numbers + Addendum sections.

**persona-data-collection.md base:** Addendum §G provides the ready-to-paste paragraph. Light editing for developer's actual process.

**prompt-engineering.md structure:** 6 sub-sections per AC.

**context-management.md structure:** 7 sub-sections per AC.

## Technical Requirements

### `docs/persona-data-collection.md`

Start with Addendum §G verbatim paragraph. Add:
- Bulleted list of specific sources (hitesh.ai / chaicode.com / piyushgarg.dev / teachyst.com / LinkedIn / X / YouTube transcript specifics / GitHub READMEs / podcast appearances).
- Methodology: deep-verification, verbatim-quote priority, cross-reference vs primary source.
- Known limitations: only public content; no interviews.
- Cohort auth: link to `docs/creator-permissions.md`.

### `docs/prompt-engineering.md`

Section-by-section per AC:

```markdown
# Prompt Engineering — Chai Code Personas

## 1. Layered prompt structure (AD-8, 9-block order)

Each outbound LLM call is composed by `src/domain/prompts/prompt-assembler.service.ts` in this order:
1. Identity block — who the persona is
2. Voice rules — Hinglish register, teaching approach, signature phrases
3. Refusal rules — categorical no-go list
4. Few-shot examples — 3 verbatim Q&A per persona from research §C.3
5. Voice-reminder repeat
6. Rolling Summary of older turns (Epic 5)
7. Verbatim Tail (last 8 messages)
8. Self-verification checklist (Addendum §C.5)
9. Current user message wrapped in `<user_message>` XML delimiters

## 2. Per-persona differences

- **Hitesh:** story-first → analogy → concept → jargon → build-push. Anecdote rate target ~40% (LCO / iNeuron / PW / 45-countries).
- **Piyush:** reductive-framing → whiteboard → analogy → code → homework. ~0% anecdotes.

## 3. Signature-phrase enforcement

- VOICE RULES block instructs 1-3 signature phrases per response.
- Runtime regex smoke-test observation via `persona_regex_miss` analytics (AD-19) — log-only, NEVER auto-regenerate.

## 4. Model choice

- **Hitesh:** Gemini 2.5 Flash for Hinglish edge (Addendum §B.3). Fallback to Groq if Spike-0 CORS fails (E0.5-S1).
- **Piyush:** Groq openai/gpt-oss-120b for speed edge.

## 5. Model parameters (Addendum §B.4)

- Hitesh: temp 0.75, top_p 0.95, max_tokens 1200, freq_penalty 0.2, pres_penalty 0.3.
- Piyush: temp 0.55, top_p 0.9, max_tokens 1000, freq_penalty 0.05, pres_penalty 0.1.
- **Piyush's low freq/pres penalty is INTENTIONAL** to preserve `देखो` / `यार` / `OK?` signature repetition (Addendum §B.4). Penalizing it would flatten the persona.

## 6. Deferred providers

- **OpenAI:** requires `dangerouslyAllowBrowser: true` — provider account flagging risk.
- **Anthropic:** browser-direct via `anthropic-dangerous-direct-browser-access` header. Also risky.
Revisit if BE proxy is added later.
```

### `docs/context-management.md`

7 sub-sections per AC. Reference AD-9 (context-config constants) + AD-10 (Thread shape) + AD-1 (client-cap trade-off).

## Architecture Compliance

- **PRD §9:** 3 required docs.
- **SM-5:** presence check.

## File Structure Requirements

```
docs/persona-data-collection.md
docs/prompt-engineering.md
docs/context-management.md
```

## Testing Requirements

- Manual smoke: read each doc; verify claims align with code + Addendum + eval results.

## Latest Tech Information

Doc content only — no framework dependencies.

## Previous Story Intelligence

- Addendum §G — ready-to-paste base for data-collection doc.
- E0-S3 populated personas with Addendum §C.2/§C.3.
- E2-S2 populated fewShots with research §C.3.
- E5-S3 populated driftRefresh with Addendum §C.4.
- E11-S1 produced eval results referenced from context-management doc.

## Project Context Reference

- PRD §9 Deliverables.
- Addendum §G ready-to-paste for data-collection.
- Addendum §B.4 model params + rationale.
- ARCHITECTURE-SPINE.md AD-8, AD-9, AD-10, AD-19.
- Sprint status: key `e12-s2-persona-prompt-context-docs`, blocks `[e12-s3]`.

## References

- [Source: addendum.md#G] Ready-to-paste data-collection intro.
- [Source: addendum.md#B.4] Per-persona model params + rationale.
- [Source: ARCHITECTURE-SPINE.md#AD-8/9/10/19] Prompt + context + Message + regex-smoke.

## Story Completion Status

- [ ] `docs/persona-data-collection.md` — Addendum §G base + specific sources + methodology + limitations + auth link.
- [ ] `docs/prompt-engineering.md` — 6 sub-sections per AC.
- [ ] `docs/context-management.md` — 7 sub-sections per AC.
- [ ] Each doc references AD numbers + Addendum + eval results.
- [ ] Manual smoke: substantive not stub; claims align with code.
