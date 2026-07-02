# Persona Data Collection Methodology

_Adapted from Addendum §G intro. Every voice/style claim in the persona
guide maps to at least one primary-source URL; the persona research doc
at `_bmad-output/planning-artifacts/research/domain-hitesh-choudhary-piyush-garg-personas-research-2026-07-02.md`
carries the full bibliography (1160–1222)._

## Methodology

Persona data was collected via a **deep-verification research pass** across
roughly 46 primary and secondary sources per creator, prioritising verbatim
quotes from the creators' own channels. Every voice/style claim mapped to
at least one primary source; community-consensus claims were tagged with
confidence levels; unverifiable claims were dropped rather than fabricated.

## Sources — Hitesh Choudhary

**Primary**

- <https://hitesh.ai> — personal site + community pointer (Discord
  `hitesh.ai/discord`).
- <https://chaicode.com> — ChaiCode cohort site (source-of-truth for
  cohort-specific claims).
- **YouTube — "Chai aur Code"** (Hindi channel, ~1M subs) — transcripts of
  most-watched long-form videos (VS Code developer's-journey podcast, the
  "React vs Next.js" episode).
- **YouTube — "Hitesh Choudhary"** (English channel).
- LinkedIn posts + X/Twitter posts (verbatim quotes captured for
  signature-phrase inference).
- GitHub README + bio.
- Udemy profile tagline.
- Economic Times coverage of the LCO / iNeuron acquisition.

**Secondary** — channel-stat aggregators + biographical profiles used only
for cross-referenced biographical facts (never for voice inference).

## Sources — Piyush Garg

**Primary**

- <https://piyushgarg.dev> — personal site.
- <https://teachyst.com> — product site (Teachyst LMS).
- <https://pro.piyushgarg.dev> — course platform.
- **YouTube — "Piyush Garg"** (~395K subs, ~15-min avg length, daily
  cadence) — transcripts of "Become PRO at Backend and System Design",
  "How LLMs Work", the Docker + system-design deep-dives.
- LinkedIn posts, X/Twitter posts.
- GitHub READMEs (Buildyst, Teachyst, WisprType, Skyping projects).

**Secondary** — biographical + product-context articles, cross-referenced
only.

## Style-inference discipline

- **Hinglish few-shot examples** in `src/personas/hitesh.prompt.ts` +
  `src/personas/piyush.prompt.ts` are AUTHORED to mirror the actual
  code-switching patterns observed in verified transcripts — Hitesh's
  Hindi-base grammar + English tech nouns; Piyush's English-syntax +
  Hindi phonetics + pure-Hindi analogies. Not generic Hinglish.
- **Signature phrases** (Hitesh: `Haanji`, `Chai ke saath`, `yaar`,
  `samjha kya`, `😁`; Piyush: `देखो`, `यार`, `बात समझ आई`, `OK?`,
  `कुछ नहीं है`) come from transcript observation, not invention.
- **Refusal templates** (Addendum §E) were authored based on the creators'
  own on-camera guardrails around price/date fabrication + political /
  religious topics.
- **Anecdote inventory** — Hitesh's biography anchors (LCO / iNeuron / PW
  / 45-countries / cybersecurity origin) are inline in the identity block.
  Piyush has no anecdote content (his teaching style is
  reductive-framing-first, not story-first) — the persona prompt reflects
  this by leaving the "anecdote" slot minimal.

## Known limitations

- **Only public content.** No creator interviews. All voice modelling is
  inferred from published transcripts / posts.
- **Verbatim quotes** capped at 6 per persona (research §C.3) — 3 embedded
  as few-shots (per Addendum §F selection: Hitesh Q1/Q3/Q5,
  Piyush Q2/Q4/Q5) and the rest available for the sample-conversations
  doc.
- **Two-persona conversations** (Ask-Both collaboration templates in
  Addendum §E.3) have no verbatim source — they are AUTHORED calibration
  exemplars, watched closely in the Ask-Both eval slice
  (`evals/ask-both-slice.ts`).

## Cohort authorization

Both creators granted approval for this build as part of the ChaiCode
GenAI cohort submission. Full scope + verbatim quote:
[`docs/creator-permissions.md`](./creator-permissions.md).
