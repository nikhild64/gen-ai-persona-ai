# Prompt Engineering — Chai Code Personas

## 1. Layered prompt structure (AD-8 nine-block order)

Every outbound LLM call is composed by
`src/domain/prompts/prompt-assembler.service.ts` in this exact order:

1. **Identity block** — who the persona is (2 short paragraphs).
2. **Voice rules** — Hinglish register + teaching approach + signature
   phrases + emoji policy + length target.
3. **Refusal rules** — categorical no-go list.
4. **Few-shot examples** — 3 verbatim Q&A pairs per persona, sourced from
   research §C.3 with `// source:` line-range comments in the code.
5. **Voice-reminder repeat** — a compressed re-statement of critical
   rules, counters "lost in the middle" attention degradation.
6. **Rolling Summary** slot — populated by `ContextManager` when the
   thread crosses the AD-9 trigger.
7. **Verbatim Tail** — the last `VERBATIM_TAIL_LENGTH = 8` messages,
   role-tagged.
8. **Drift-Refresh** — injected at turn 15 and every 10 thereafter
   (`DRIFT_REFRESH_FIRST_TURN` + `DRIFT_REFRESH_CADENCE`).
9. **Current user message** — wrapped in `<user_message>…</user_message>`
   XML delimiters so the model can distinguish system content from user
   input at parse time.

The self-verification checklist (Addendum §C.5) is appended between blocks
7 and 8, as the last instruction the model reads before the user message.

## 2. Per-persona differences

- **Hitesh:** story-first → analogy → concept → jargon → build-push.
  Anecdote rate targeted at **35–50 %** of Golden-Set responses
  (see `evals/rubric.md`) drawn from LCO / iNeuron / PW / cybersecurity /
  45-countries.
- **Piyush:** reductive-framing → whiteboard decomposition → analogy →
  code → homework. Anecdote rate targeted at **≤ 10 %** — his voice is
  deliberately less story-driven.

## 3. Signature-phrase enforcement

- The VOICE RULES block instructs 1–3 signature phrases per response
  (Hitesh: `Haanji`, `chai ke saath`, `yaar`, `samjha kya`, `😁`;
  Piyush: `देखो`, `यार`, `बात समझ आई`, `OK?`, `कुछ नहीं है`).
- Runtime observation via `HITESH_REGEX` / `PIYUSH_REGEX` from
  `src/config/regex-patterns.ts` — per AD-19 misses emit a
  `persona_regex_miss` analytics event but **never** auto-regenerate.

## 4. Model choice

- **Hitesh → Gemini 2.5 Flash** for Hinglish edge (Addendum §B.3;
  Spike-0 in E0.5-S1 confirmed browser-direct SSE works).
- **Piyush → Groq `openai/gpt-oss-120b`** for token-per-second speed edge
  (Groq is faster; Piyush's tone is short + high-tempo).

## 5. Model parameters (Addendum §B.4)

| Param | Hitesh (Gemini) | Piyush (Groq) |
|---|---|---|
| `temperature` | 0.75 | 0.55 |
| `topP` | 0.95 | 0.9 |
| `maxOutputTokens` | 1200 | 1000 |
| `frequencyPenalty` | 0.2 | 0.05 |
| `presencePenalty` | 0.3 | 0.1 |

**Piyush's low frequency + presence penalty is INTENTIONAL.** His repetition
of `देखो` / `यार` / `OK?` is a signature-phrase behaviour we want preserved
— penalising it would flatten the persona. See the inline comment in
`src/config/model-params.ts`.

## 6. Deferred providers

- **OpenAI** and **Anthropic** are not v1 providers because they require
  `dangerouslyAllowBrowser: true` (OpenAI) or the
  `anthropic-dangerous-direct-browser-access` header (Anthropic) — both
  carry provider-account-flagging risk. Deferred until a BE proxy pivot
  per AD-1.

## 7. Ask-Both prompt shape (AD-13)

- `ask-both-a`: same 9-block shape as Solo but with `mode: 'ask-both-a'`
  in the outbound meta.
- `ask-both-b`: extra `role: 'system'` message inserted between blocks 7
  and 8 carrying the `ASK_BOTH_SYSTEM_NOTE_TEMPLATE(personaName, priorText)`
  formatted string from `src/config/prompt-format.ts`.
- `ask-both-keep-going`: uses the analogous
  `ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE(userMsg, hiteshText, piyushText)`.

Full sequencer path in `src/features/ask-both/ask-both-sequencer.service.ts`.
