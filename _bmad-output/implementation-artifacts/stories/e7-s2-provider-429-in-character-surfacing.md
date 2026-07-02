# Story E7-S2: Provider 429 surfacing + In-Character quota-exhausted template + provider_429_surfaced analytics

Status: ready-for-dev

- **Epic:** 7 — Client-Side Guardrails
- **Critical-path position:** 24 of 37 (Day 5 afternoon)
- **Blocks:** none
- **Depends on:** E2-S1, E2-S3

## Story

As a **cohort grader whose free-tier Groq key just hit its per-minute rate limit**,
I want **an In-Character message from Piyush saying "yaar thoda break — rate limit hit ho gaya, try again in a minute" instead of a raw 429 error**,
So that **the boundary feels human, not broken, and I know exactly when to retry (with a Retry-After hint if the provider sends one)**.

## Acceptance Criteria

**Given** the GeminiAdapter and GroqAdapter from Epic 2 story E2-S1,
**When** the developer extends each adapter's fetch response handling,
**Then** on receiving an HTTP 429 response, the adapter emits `{type: 'error', meta: {error: 'quota_exhausted', retryable: true, retryAfterSec: <parsed from Retry-After header if present, else undefined>}}` per AD-4 + AD-16. If the response body is JSON with useful error details, extract into a subordinate log statement (through `LoggerService.info`, redacted) — but never leak into the ChatChunk.error union.

**Given** the ChatOrchestrator from Epic 2 handles the `{type: 'error'}` chunk,
**When** the error is `'quota_exhausted'`,
**Then** the orchestrator: (a) appends a synthetic assistant Message with `role: 'assistant'`, `persona: activePersona()`, `status: 'complete'`, `content: PERSONA_REGISTRY[activePersona()].prompt.quotaExhaustedTemplate` (sourced from Addendum §E "Rate limit hit" row: Hitesh `"Yaar chai thodi der ruk kar peete hain — thoda break, try again in a minute. Ya settings mein apni API key daal do, unlimited chat hoga."` and Piyush's analogous template); (b) emits `provider_429_surfaced` analytics event per AD-15 with payload `{provider, retryAfterSec}`; (c) re-enables the send input (no orphaned spinner) per UX-DR15.

**Given** the 429 error included a `Retry-After` header value,
**When** the orchestrator renders the quota-exhausted message,
**Then** a `caption` retry hint appears below the message bubble: `"Try again in ${retryAfterSec}s"` from `product-copy.ts.retryAfterHint(seconds)`. If `retryAfterSec` is undefined, no hint appears (the persona-voice copy already advises "try again in a minute").

**Given** the Ask-Both mode is active (Epic 9),
**When** Persona A (Hitesh) returns 429 mid-stream,
**Then** the AskBothSequencer's error path: Persona B is NOT invoked (per FR-27); the in-character error bubble is rendered in Hitesh's palette; a "Retry" button appears below the message per EXPERIENCE.md.State Patterns; clicking Retry restarts the full Ask-Both sequence from Persona A (per AD-14 — one AbortController covers both turns, so retry means a fresh sequence); no wasted Piyush call.

**Given** the developer runs a rapid-fire test (fire many requests in quick succession against a low-quota Gemini or Groq account),
**When** a 429 fires,
**Then** the In-Character quota-exhausted bubble renders in the persona palette; the `provider_429_surfaced` event fires exactly once per 429 response; the UI input re-enables. This verifies revised SM-3(b) per PRD §11.3.

**verifies:** FR-19 + FR-20 (both superseded by AD-16; this story is the replacement per handoff-epics.md), AD-4 (ChatChunk.error union includes 'quota_exhausted' + retryAfterSec), AD-15 (provider_429_surfaced typed event), AD-16 (provider 429 is the ceiling, In-Character surfacing per Addendum §E), AD-22 (quota-exhausted template from PERSONA_REGISTRY, not product-copy.ts), SM-3(b) revised (verifies rubric-visible property)

**touches:** `src/infrastructure/providers/gemini.adapter.ts` (extend fetch response handling), `src/infrastructure/providers/groq.adapter.ts` (extend fetch response handling), `src/domain/chat/chat-orchestrator.service.ts` (extend error handling for `'quota_exhausted'` case), `src/personas/hitesh.prompt.ts` (add `quotaExhaustedTemplate: string` from Addendum §E), `src/personas/piyush.prompt.ts` (add `quotaExhaustedTemplate: string` from Addendum §E), `src/personas/persona.registry.ts` (extend PromptComposition with `quotaExhaustedTemplate`), `src/config/product-copy.ts` (new key: `retryAfterHint(seconds)`), `src/features/chat/chat.component.ts` (render Retry button on Ask-Both mode 429 — Epic 9 wires the full sequencer-level behavior)

**test target:** unit test (adapter mock returning 429 with Retry-After: 60 emits the correct ChatChunk shape; orchestrator renders quotaExhaustedTemplate + emits provider_429_surfaced + re-enables input) + manual smoke test (create a fresh Gemini free-tier account with 2 requests + fire 3 requests rapidly; verify 3rd surfaces In-Character quota-exhausted bubble instead of a raw error)

## Developer Context

Replaces the superseded FR-19/FR-20 server-side rate-limiter concept with In-Character surfacing per AD-16. Adapter emits `{ error: 'quota_exhausted', retryable: true, retryAfterSec }`; orchestrator renders persona-voiced template.

**Quota-exhausted templates from Addendum §E:**

Hitesh (row "Rate limit hit"):
> Yaar chai thodi der ruk kar peete hain — thoda break, try again in a minute. Ya settings mein apni API key daal do, unlimited chat hoga.

Piyush (row "Rate limit hit"):
> यार thoda break — rate limit hit हो गया. Try again in a minute, या settings में अपनी API key डाल दो — unlimited chat हो जाएगा.

**Ask-Both retry:** if Hitesh returns 429 in Ask-Both mode, Piyush is NOT invoked (AD-13 / FR-27). Retry button restarts the WHOLE sequence from Hitesh (fresh AbortController). E9-S2 handles the sequencer-level flow; this story just ensures the retry-button semantics.

## Technical Requirements

### `gemini.adapter.ts` + `groq.adapter.ts` — 429 handling

E2-S1's `mapHttpError` already maps 429 → `'quota_exhausted'` + parses `Retry-After` header. Verify:

```ts
if (res.status === 429) {
  const retryAfter = res.headers.get('Retry-After');
  const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;
  return { type: 'error', meta: { error: 'quota_exhausted', retryable: true, retryAfterSec } };
}
```

Also parse the response body if JSON — log details via `LoggerService.info` (redacted) — but do NOT include in the ChatChunk.error union (AD-4 closed union).

### `chat-orchestrator.service.ts` — quota_exhausted branch

Extend `handleAdapterError`:

```ts
if (chunk.meta?.error === 'quota_exhausted') {
  const provider = PERSONA_REGISTRY[persona].providerId;
  const template = PERSONA_REGISTRY[persona].prompt.quotaExhaustedTemplate;
  const msg: Message = {
    id: assistantMsgId,
    role: 'assistant',
    persona,
    content: template,
    timestamp: Date.now(),
    status: 'complete',
  };
  thread.messages.push(msg);
  await this.storage.set(this.threadKeyFor(persona), thread);
  this.analytics.emit({
    name: 'provider_429_surfaced',
    payload: { provider, retryAfterSec: chunk.meta.retryAfterSec }
  });
  // Optionally: signal RetryAfterHint$ for E7-S2 UI to render below the bubble
  this.retryAfterSec$.set(chunk.meta.retryAfterSec ?? null);
}
```

### `hitesh.prompt.ts` + `piyush.prompt.ts` — populate quotaExhaustedTemplate

Byte-identical to Addendum §E "Rate limit hit" rows.

### `product-copy.ts`:
```ts
export const retryAfterHint = (seconds: number) => `Try again in ${seconds}s`;
```

### `chat.component.ts` — render retry hint

Below the last message bubble, conditionally render `retryAfterHint(orchestrator.retryAfterSec$())` when non-null.

## Architecture Compliance

- **AD-4:** `ChatChunk.error` closed union includes `'quota_exhausted'`; `retryAfterSec` in meta.
- **AD-13 + FR-27:** Ask-Both 429 blocks Persona B; Retry restarts sequence.
- **AD-15:** `provider_429_surfaced` typed event.
- **AD-16:** provider 429 is the sole rate ceiling; no client-side throttling.
- **AD-22:** `quotaExhaustedTemplate` in persona registry.

## File Structure Requirements

```
src/infrastructure/providers/gemini.adapter.ts   # VERIFY 429 handling
src/infrastructure/providers/groq.adapter.ts     # VERIFY 429 handling
src/domain/chat/chat-orchestrator.service.ts     # UPDATE quota_exhausted branch + retryAfterSec$ signal
src/personas/hitesh.prompt.ts                     # POPULATE quotaExhaustedTemplate
src/personas/piyush.prompt.ts                     # POPULATE quotaExhaustedTemplate
src/config/product-copy.ts                        # EXTEND retryAfterHint
src/features/chat/chat.component.ts / .html       # RENDER retry hint
```

## Testing Requirements

- Adapter spec: mock 429 response with `Retry-After: 60` → emits `{type:'error',meta:{error:'quota_exhausted',retryable:true,retryAfterSec:60}}`.
- Orchestrator spec: mock adapter emits quota_exhausted → synthetic message with persona template appended; `provider_429_surfaced` emitted with correct payload; input re-enables.
- Manual smoke: rapid-fire against free-tier key → 429 surfaces in persona voice.

## Latest Tech Information

- `Retry-After` header in seconds (integer) per RFC 7231. Both Gemini and Groq return this on 429.
- Free-tier Groq `openai/gpt-oss-120b`: 30 RPM — hitting this is easy in a rapid-fire test.

## Previous Story Intelligence

**E2-S1 (Provider adapters):**
- `mapHttpError` already maps 429; verify it parses `Retry-After` correctly.

**E2-S3 (Orchestrator):**
- `handleAdapterError` sketched; this story fleshes out `quota_exhausted` branch.

**E0-S3 (Config):**
- `PromptComposition.quotaExhaustedTemplate` declared upfront; this story populates.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-4` (ChatChunk contract, lines 90–98), `AD-15` (provider_429_surfaced event, lines 221–244), `AD-16` (provider 429 as ceiling, lines 246–250), `AD-22` (persona template sourcing, lines 300–309).
- Addendum §E.1 + §E.2 "Rate limit hit" rows + POST-ARCHITECTURE NOTE about AD-16.
- Sprint status: key `e7-s2-provider-429-in-character-surfacing`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-16] Provider 429 is the only rate ceiling; In-Character surface via Addendum §E.
- [Source: addendum.md#E.1/E.2] Rate-limit-hit templates (verbatim).
- [Source: prd.md#SM-3(b) revised] Rapid-fire test verifies rubric-visible property.

## Story Completion Status

- [ ] Adapter 429 handling emits correct ChatChunk with retryAfterSec.
- [ ] Orchestrator quota_exhausted branch renders persona template + emits event.
- [ ] Hitesh + Piyush `quotaExhaustedTemplate` populated verbatim.
- [ ] Retry hint renders below bubble when retryAfterSec present.
- [ ] Manual smoke: rapid-fire → In-Character response.
