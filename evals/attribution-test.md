# Blind Attribution Protocol

_Per PRD §8 Layer 2 — human-in-the-loop persona-accuracy triangulation._
_Scope-cut candidate #2: setup lives here; the actual peer session runs
manually if time permits before submission._

## Method

Show **15 unlabeled outputs** to **3–5 cohort peers**. Ask the peer to
guess for each output:

- Is this the **real Hitesh** (from a verified transcript / tweet / video)?
- Is this the **real Piyush** (same standard)?
- Or is this the **AI bot**?

### Composition of the 15 outputs

- **5 Hitesh-bot** outputs — sampled from the latest `results-YYYY-MM-DD.json`
  produced by `bun run eval` (E11-S1). Pick a range across categories.
- **5 Piyush-bot** outputs — same selection method.
- **5 verbatim quotes** from `_bmad-output/planning-artifacts/research/domain-hitesh-choudhary-piyush-garg-personas-research-2026-07-02.md`
  §A (Hitesh) and §B (Piyush). Prefer paragraphs of 3–8 sentences that
  match the length of the bot samples.

### Presentation

Shuffle the 15 outputs, number them 1–15, publish as a Google Form or a
simple markdown checklist. Do **not** disclose which persona each output
targets before the peer answers.

## Evaluator sheet template

| Output # | Real Hitesh | Real Piyush | Bot |
|---|---|---|---|
| 1 | ☐ | ☐ | ☐ |
| 2 | ☐ | ☐ | ☐ |
| 3 | ☐ | ☐ | ☐ |
| … | … | … | … |
| 15 | ☐ | ☐ | ☐ |

## Google Form template

Free-tier Google Forms → new form → for each of the 15 outputs create a
multiple-choice question with three options (Real Hitesh / Real Piyush /
Bot). Turn on "Show answer after submit" once responses are collected.

## Target

- **≥ 70 %** correct attribution between Persona A vs Persona B (i.e. peers
  can tell Hitesh apart from Piyush ≥ 70 % of the time).
- **≤ 60 %** correct bot vs real attribution (i.e. the bot is
  indistinguishable-ish more than 40 % of the time — good persona
  fidelity).

## Results (fill after peer session)

_Session date:_
_Number of peers:_
_Number of outputs:_ 15
_Correct A-vs-B attribution %:_
_Correct bot-vs-real %:_

_Peer notes / free-form:_
