# Story E0.5-S1: Spike-0 — Gemini browser-CORS 30-minute verification (blocking gate)

Status: ready-for-dev

- **Epic:** 0.5 — Spike-0 (Gated)
- **Critical-path position:** 5 of 37 (Day 1 morning)
- **Blocks:** E2-S1 (Provider adapters) — **BLOCKING GATE**
- **Depends on:** E0-S1 (needs `package.json` + `npm install` working; NOT full Epic 0 setup)
- **Timebox:** 30 minutes hard; 45 minutes absolute halt-and-decide-by-decree

## Story

As a **solo developer**,
I want **to verify in 30 minutes that a browser-direct `fetch('https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse', ...)` from origin `http://localhost:4200` returns a streaming SSE response without a CORS preflight failure**,
So that **AD-5's Provider set holds (Gemini for Hitesh, Groq for Piyush, no server) OR I know Day 1 which fallback to take (single-provider variant OR Vercel serverless proxy) before any adapter code is written**.

## Acceptance Criteria

**Given** a free-tier Gemini API key (`AIza...`) in the developer's clipboard,
**When** the developer creates a bare-bones test file — either `evals/spike-zero-gemini-cors.ts` runnable via `tsx`, OR a plain `spike-zero.html` opened via `ng serve` at `http://localhost:4200/spike-zero.html`, OR a curl-equivalent in a browser DevTools Console at an `http://localhost:4200` origin —
**Then** the file issues a POST to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse` with headers `{ 'Content-Type': 'application/json', 'x-goog-api-key': KEY }` (NOT `Authorization: Bearer` — Google uses `x-goog-api-key` for API key auth) and body `{ contents: [{ role: 'user', parts: [{ text: 'Hi in one word' }] }] }`.

**Given** the fetch is issued,
**When** the browser processes the request,
**Then** ONE of three outcomes fires:

- **Outcome A (PASS)** — response is `200 OK` with `Content-Type: text/event-stream`, and the developer sees `data: {...}` SSE chunks arriving in the DevTools Network tab within 2 seconds. This confirms AD-5 holds — proceed to Epic 2.

- **Outcome B (FAIL — CORS preflight blocked)** — browser blocks the request with a console error like `"Access to fetch at '...' from origin 'http://localhost:4200' has been blocked by CORS policy: Response to preflight request doesn't pass access control check"`. This means the Gemini endpoint does not send `Access-Control-Allow-Origin` for browser-direct calls.

- **Outcome C (FAIL — other error)** — response is `401`/`403` (key format wrong) OR `429` (rate limit) OR `500`+ (Gemini outage). If the failure is a key format problem, retry with a fresh key and confirm outcome A. If it's a rate limit or outage, retry after 5 minutes and confirm outcome A or a genuine CORS block.

**Given** Outcome A fires,
**When** the developer logs the result,
**Then** they write `spike_zero_gemini_cors_result: { succeeded: true }` to `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/.memlog.md` (append entry) and (once the analytics adapter exists in Epic 2) emit the `spike_zero_gemini_cors_result` analytics event per AD-15.

**Given** Outcome B fires,
**When** the developer chooses a fallback branch,
**Then** they pick ONE of the two options and log the choice to `.memlog.md`:
  - **Fallback (a) — Route Hitesh through Groq too (single-provider variant):** update `src/config/provider-registry.ts` `PROVIDER_DEFAULT_ROUTING` so `hitesh → 'groq'` (both personas use Groq). Note the Hinglish quality trade-off in `docs/prompt-engineering.md` at Epic 12. Log `spike_zero_gemini_cors_result: { succeeded: false, fallback: 'groq-only' }`.
  - **Fallback (b) — Add minimal Vercel Serverless Function proxy for Gemini:** create `api/gemini.ts` at repo root (Vercel serverless format — Node runtime). The function reads the request body + `x-goog-api-key` header from the request and proxies to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse` server-side, streaming the SSE response back to the client. `GeminiAdapter` (from Epic 2) POSTs to `/api/gemini` instead of `generativelanguage.googleapis.com` directly. Log `spike_zero_gemini_cors_result: { succeeded: false, fallback: 'vercel-proxy' }` and note that AD-1 (Pure-FE topology) has one narrow exception — this proxy — that must be documented in `bmad-prd update` at Epic 12 (adds a topology addendum, keeps everything else Pure-FE).

**Given** Outcome C persists after key + rate-limit retries,
**When** 30 minutes have elapsed since spike start,
**Then** the developer halts, treats the outcome as effectively a CORS fail, and picks Fallback (a) or (b) by decree. The 30-minute timebox is a hard rule; chasing a red herring past 45 minutes is an anti-pattern (per handoff-epics.md line 20).

**Given** the outcome is logged,
**When** the developer starts Epic 2,
**Then** the `PROVIDER_DEFAULT_ROUTING` and the presence-or-absence of `api/gemini.ts` reflect the spike outcome — Epic 2 story E2-S1 (Provider adapters) does not have to re-decide.

**verifies:** AD-5 (Provider set v1 verification — Gemini browser-CORS-clean IS the claim being tested), AD-1 (Pure-FE topology preserved on pass; narrow proxy exception on fallback (b))

**touches:** `evals/spike-zero-gemini-cors.ts` OR `spike-zero.html` (one-off, may be deleted after spike), `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/.memlog.md` (append outcome entry), conditionally `src/config/provider-registry.ts` (if fallback a), conditionally `api/gemini.ts` + `vercel.json` (if fallback b)

**test target:** manual smoke test (30-min timebox; success/failure is directly observable in DevTools Network tab)

## Developer Context — pass/fail branch definitions

**PASS branch (Outcome A):**
- Success looks like: 200 OK, `Content-Type: text/event-stream`, SSE data chunks arriving within 2 seconds.
- Cost of PASS: 0 (proceed to Epic 2 with AD-5 as written; `PROVIDER_DEFAULT_ROUTING` unchanged).
- Downstream impact: E2-S1 GeminiAdapter uses direct browser-fetch to `generativelanguage.googleapis.com`; AD-1 Pure-FE stays clean; no serverless functions in repo.

**FAIL branch — Fallback (a) — Groq-only single-provider:**
- Trigger: any Outcome B or persistent C after 45 min.
- Cost: lose Hitesh's Gemini Hinglish edge (Addendum §B.3 rationale: Google's Indian-language corpus edge). Piyush's fidelity is unaffected.
- Change surface: 1 line in `src/config/provider-registry.ts` (`hitesh: 'groq'`). Add trade-off note in `docs/prompt-engineering.md` at E12-S2.
- Downstream impact: E2-S1 ships only `GroqAdapter` (well, both adapters still exist for future, but `PROVIDER_DEFAULT_ROUTING` sends both personas to Groq).

**FAIL branch — Fallback (b) — Vercel serverless proxy:**
- Trigger: same as (a), if developer prefers to preserve Gemini for Hitesh.
- Cost: narrow AD-1 topology exception. Add ~15 min for proxy setup + Vercel deploy verification.
- Change surface: NEW file `api/gemini.ts` at repo root (Vercel Serverless Function format — Node runtime, `handler(req, res)` pattern). Update `vercel.json` if function config needed. Update `docs/creator-permissions.md` / `docs/prompt-engineering.md` at E12 to note the topology exception.
- Downstream impact: E2-S1 `GeminiAdapter` fetches `/api/gemini` (relative URL, same-origin) instead of `generativelanguage.googleapis.com`. Everything else unchanged.

**30-min timebox rule (per handoff-epics.md line 20):**
- Start timer when the test file is written and the first fetch is issued.
- If Outcome A doesn't fire in 30 min → check whether it's a genuine CORS block or an environmental issue.
- Absolute halt at 45 min. At that point, treat as CORS fail regardless of root cause and pick a fallback by decree.
- Chasing a red herring past 45 min is the documented anti-pattern.

## Technical Requirements

### Option 1 — TS runnable via `tsx` (`evals/spike-zero-gemini-cors.ts`)

**Note:** this runs in NODE, not browser. It does NOT test browser CORS. Only use for a quick auth/endpoint sanity check BEFORE the real browser test. Skip if pressed for time.

```ts
const KEY = process.env.GEMINI_KEY!;
const res = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hi in one word' }] }] }),
  },
);
console.log('status', res.status, 'content-type', res.headers.get('content-type'));
const reader = res.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}
```

### Option 2 — The REAL test — `spike-zero.html` served via `ng serve` at `localhost:4200`

Create `src/spike-zero.html` (or `public/spike-zero.html` per Angular 21 assets convention) with:

```html
<!doctype html>
<html>
<body>
<h1>Spike-0 — Gemini browser-CORS test</h1>
<input id="key" placeholder="AIza..." style="width:400px;" />
<button id="go">Fetch</button>
<pre id="out"></pre>
<script>
document.getElementById('go').onclick = async () => {
  const key = document.getElementById('key').value.trim();
  const out = document.getElementById('out');
  out.textContent = 'sending...';
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hi in one word' }] }] }),
      },
    );
    out.textContent = `status ${res.status} content-type ${res.headers.get('content-type')}\n\n`;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      out.textContent += decoder.decode(value);
    }
  } catch (e) {
    out.textContent = 'ERROR: ' + e.message + '\n(check DevTools Console + Network tab for CORS details)';
  }
};
</script>
</body>
</html>
```

Run `ng serve`, open `http://localhost:4200/spike-zero.html`, paste key, click Fetch, watch DevTools Network tab.

### Option 3 — DevTools Console at `localhost:4200`

Simplest — no file to write. Open any page on `localhost:4200`, open DevTools Console:

```js
const key = 'AIza...';
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hi' }] }] }),
});
console.log(res.status, res.headers.get('content-type'));
```

Recommended sequence: Option 3 (fastest) → if inconclusive, Option 2 → Option 1 only for Node auth sanity.

### `.memlog.md` entry format

Append to `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/.memlog.md`:

```
- (spike-outcome) [2026-07-02 HH:MM] Spike-0 Gemini browser-CORS: {A pass | B CORS block | C other} — decision: {proceed with AD-5 as written | Fallback (a) Groq-only | Fallback (b) Vercel proxy}. Notes: <status codes, content-type, error message from DevTools Console>.
```

## Architecture Compliance

- **AD-5:** this story's outcome directly determines whether AD-5's default routing survives or fallback (a) fires.
- **AD-1:** PASS preserves AD-1 (Pure-FE, no server). Fallback (b) introduces one narrow proxy exception that must be reconciled via `bmad-prd update` at Epic 12.
- **AD-15:** `spike_zero_gemini_cors_result` analytics event is defined in the AnalyticsEvent union (E0-S2); actual emission via `VercelAnalyticsAdapter` happens once E2-S3 lands. This story only writes the outcome to `.memlog.md`.

## Library / Framework Requirements

None new. Uses browser-native `fetch` + `ReadableStream` + `TextDecoder`.

## File Structure Requirements

- CREATE (one of): `src/spike-zero.html` OR `public/spike-zero.html` OR `evals/spike-zero-gemini-cors.ts`. May be deleted after spike concludes.
- APPEND: `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/.memlog.md`.
- CONDITIONAL on Fallback (a): update `src/config/provider-registry.ts` `PROVIDER_DEFAULT_ROUTING.hitesh = 'groq'`.
- CONDITIONAL on Fallback (b): create `api/gemini.ts` at repo root; update `vercel.json` if serverless-function config needed.

## Testing Requirements

Not testable in unit tests — this is a manual browser-based smoke test with a 30-min timebox. The outcome is directly observable in DevTools.

If PASS: a follow-up assertion lands in E2-S1 (mock adapter + real network smoke test).

## Latest Tech Information

- **Gemini API endpoint** as of 2026-07-02: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse`. Use `v1beta` (not `v1`) — the streaming SSE endpoint is under v1beta.
- **Auth header:** `x-goog-api-key: AIza...` (NOT `Authorization: Bearer`). The key format is `AIza[0-9A-Za-z_-]{35}`.
- **Free tier (verify at spike time):** `gemini-3.1-flash-lite` ~15 RPM / ~1500 RPD per Google project per https://ai.google.dev/gemini-api/docs/rate-limits. Volatile — if rate-limited during spike, retry with a fresh key.
- **Browser CORS status (empirically unverified per architecture review):** third-party writeups are mixed; Google does not officially document browser-direct as supported. Spike-0 exists BECAUSE the answer isn't in the docs.
- **If Fallback (b):** Vercel Serverless Functions in Node runtime use the `export default async function handler(req: VercelRequest, res: VercelResponse) { ... }` shape. For SSE streaming, set `res.setHeader('Content-Type', 'text/event-stream')`, `res.setHeader('Cache-Control', 'no-cache')`, then pipe/forward the upstream response body chunk-by-chunk.

## Previous Story Intelligence

**E0-S1 (Angular 21 + PrimeNG scaffold):**
- `package.json` + `npm install` working; `ng serve` runs on `localhost:4200`.
- Options 2 + 3 both rely on this — the whole test is "what does browser-fetch from `localhost:4200` origin do."

**E0-S2, E0-S3, E0-S4 (Ports + config + lint):**
- Not required for Spike-0 to execute. The spike can technically run right after E0-S1 (just needs `ng serve` up). Sprint plan places it after E0-S4 for critical-path convenience (Day 1 morning), but the actual dependency is E0-S1 only.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-1` (Pure-FE topology, lines 66–71) — flags the Spike-0 fallback (b) as the ONE narrow exception.
- ARCHITECTURE-SPINE.md `AD-5` (Provider set, lines 100–104) — names Spike-0 explicitly.
- ARCHITECTURE-SPINE.md Deferred item "Gemini CORS Spike-0 outcome fallbacks" (line 773).
- Handoff-epics.md line 20: "30-min bare-bones fetch... 30-minute timebox; chasing a red herring past 45 minutes is an anti-pattern."
- Sprint status: key `e0-5-s1-spike-zero-gemini-cors`, blocks `[e2-s1-provider-adapters-and-registry]`, timebox_minutes: 30, halt_at_minutes: 45.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-5] Gemini + Groq provider set; Spike-0 verification clause.
- [Source: ARCHITECTURE-SPINE.md#AD-1] Pure-FE topology; Spike-0 fallback (b) is the one narrow exception.
- [Source: architecture .memlog.md line 45] Spike-0 decision rationale + rejected alternatives (preemptive proxy, single-provider-Groq-only, accept-without-spike).
- [Source: handoff-epics.md line 20] 30-min timebox rule + halt-and-decide-by-decree.
- [Source: sprint-status.yaml#dependency_chain.e0-5-s1-spike-zero-gemini-cors] `blocks: [e2-s1-provider-adapters-and-registry]` — BLOCKING GATE.
- [Source: reviews/review-web-versions.md#Gemini browser-CORS claim] Third-party evidence is mixed; empirical Spike-0 warranted.

## Story Completion Status

- [ ] Spike test file created (Option 1, 2, or 3 — recommend starting with Option 3 for speed).
- [ ] Fetch issued from `localhost:4200` origin (or Node for Option 1 auth sanity only).
- [ ] Outcome observed: A (PASS) / B (CORS block) / C (other, retried).
- [ ] Outcome logged to `_bmad-output/planning-artifacts/architecture/.../\.memlog.md` in the format documented above.
- [ ] If Outcome B or persistent C: fallback chosen (a Groq-only OR b Vercel proxy) and logged.
- [ ] If Fallback (a): `src/config/provider-registry.ts` `PROVIDER_DEFAULT_ROUTING.hitesh` updated to `'groq'`; trade-off note added for Epic 12's `docs/prompt-engineering.md`.
- [ ] If Fallback (b): `api/gemini.ts` created; `vercel.json` updated if needed; PRD update task queued for Epic 12.
- [ ] 30-min timebox respected; 45-min halt-and-decide invoked if hit.
- [ ] Spike test file deleted (or moved to `evals/` and marked archived) — do not leave `spike-zero.html` in production build.
- [ ] Epic 2 unblocked — E2-S1 can start with `PROVIDER_DEFAULT_ROUTING` and (conditionally) `api/gemini.ts` reflecting the outcome.
