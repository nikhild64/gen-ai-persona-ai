# Story E2-S1: Provider adapters (Gemini + Groq) + registry wiring

Status: ready-for-dev

- **Epic:** 2 — Persona-Faithful Chat Engine (Solo)
- **Critical-path position:** 6 of 37 (Day 2)
- **Blocks:** E2-S3, E7-S2, E9-S2, E11-S1
- **Depends on:** E0-S3, E0-S4, E0.5-S1 (Spike outcome determines Gemini fetch target)

## Story

As a **solo developer**,
I want **`GeminiAdapter` and `GroqAdapter` implementing `ProviderPort` with `static PROVIDER_ID + KEY_PATTERN`, wired into `PROVIDER_REGISTRY` and swappable via `TEST_PROVIDER_REGISTRY` for unit tests**,
So that **every downstream LLM call goes through one interface, adding a new provider is one adapter file + one registry entry, and unit tests can pin a mock adapter for deterministic streaming**.

## Acceptance Criteria

**Given** Epic 0.5 outcome is known,
**When** the developer authors `src/infrastructure/providers/gemini.adapter.ts` implementing `ProviderPort`,
**Then** it exposes `static readonly PROVIDER_ID: ProviderId = 'gemini'` and `static readonly KEY_PATTERN: RegExp = /^AIza[0-9A-Za-z_-]{35}$/` per AD-3 + AD-11, and `streamChat(request, key, signal)` uses native `fetch` + `ReadableStream` + `TextDecoder` against `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse` (or `/api/gemini` if Spike-0 fallback (b) is active per E0.5-S1).

**Given** the Gemini adapter is drafted,
**When** the developer authors `src/infrastructure/providers/groq.adapter.ts`,
**Then** it exposes `static readonly PROVIDER_ID: ProviderId = 'groq'` and `static readonly KEY_PATTERN: RegExp = /^gsk_[0-9A-Za-z]{52}$/` and streams via `fetch` against `https://api.groq.com/openai/v1/chat/completions` with `stream: true` and model `openai/gpt-oss-120b` per AD-5.

**Given** both adapter classes exist,
**When** each adapter's `streamChat` receives a valid `ChatRequest` + key + `AbortSignal`,
**Then** it returns an `AsyncIterable<ChatChunk>` that yields `{type: 'delta', text}` per SSE token, `{type: 'done', meta: {tokens, model}}` on stream complete, and `{type: 'error', meta: {error: <one of the closed ChatChunkError union>, retryable, retryAfterSec?}}` on any error — per AD-4. Per-provider quirks (Gemini's `contents[].parts[].text` shape vs Groq's OpenAI-compatible `messages[].content` shape) are hidden inside the adapter.

**Given** an adapter's fetch is aborted via `signal.abort()`,
**When** the AbortSignal fires mid-stream,
**Then** the adapter tears down its `ReadableStream` reader and emits a final `{type: 'error', meta: {error: 'aborted', retryable: false}}` per AD-14.

**Given** the adapter emits an error,
**When** the closed `ChatChunkError` union receives an unknown provider error string,
**Then** it maps to `'unknown'` — never to `| string` (no escape hatch per AD-4).

**Given** both adapters are drafted,
**When** the developer authors `src/infrastructure/providers/provider.registry.ts`,
**Then** it exports `PROVIDER_REGISTRY: Map<ProviderId, ProviderPortAdapterClass>` populated with both adapters. Feature/domain code accesses adapters ONLY via `PROVIDER_REGISTRY.get(id)` — direct imports of `*.adapter.ts` are banned by ESLint (verified in E0-S4).

**Given** the provider registry is populated,
**When** the developer authors `src/infrastructure/providers/testing/mock.adapter.ts` and `TEST_PROVIDER_REGISTRY`,
**Then** the mock adapter accepts a scripted `ChatChunk[]` sequence and yields it via `AsyncIterable`, enabling deterministic unit tests without hitting real Gemini/Groq.

**Given** all adapters and the registry exist,
**When** the developer runs a manual smoke test — DevTools sessionStorage-inject a Gemini key, use `PROVIDER_REGISTRY.get('gemini').streamChat({messages: [{role: 'user', content: 'Hi in one word'}], model: 'gemini-2.5-flash'}, key, new AbortController().signal)` from the browser console,
**Then** the AsyncIterable yields at least one `{type: 'delta'}` chunk within 2 seconds and a `{type: 'done'}` chunk within 8 seconds — proves the fetch works end-to-end (or the Spike-0 fallback is correctly in play).

**verifies:** AD-3 (ProviderPort SSOT + static PROVIDER_ID + KEY_PATTERN), AD-4 (uniform ChatChunk contract + closed error union), AD-5 (Provider set v1 = Gemini + Groq only)

**touches:** `src/infrastructure/providers/gemini.adapter.ts`, `src/infrastructure/providers/groq.adapter.ts`, `src/infrastructure/providers/provider.registry.ts`, `src/infrastructure/providers/testing/mock.adapter.ts`, `src/infrastructure/providers/testing/test-provider.registry.ts`

**test target:** unit test (each adapter's static properties match the pattern; mock adapter yields the scripted sequence via `for await (const chunk of adapter.streamChat(...))`) + manual smoke test (Gemini + Groq browser-console test each yields real SSE deltas)

## Developer Context

The moment the architecture becomes real. Two production adapters + one mock adapter + one registry. This is the ONLY story in the sprint that touches Gemini or Groq SDK-shaped code — every downstream LLM call flows through this layer.

**Spike-0 outcome matters:**
- **If Spike PASSED (Outcome A):** `GeminiAdapter.streamChat` fetches `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse` directly. Standard AD-5 wiring.
- **If Fallback (a) fires (Groq-only):** `PROVIDER_DEFAULT_ROUTING.hitesh = 'groq'` already updated in E0.5-S1. `GeminiAdapter` STILL LANDS in this story (for future use + docs completeness), but the registry sends Hitesh through Groq at runtime.
- **If Fallback (b) fires (Vercel proxy):** `GeminiAdapter.streamChat` fetches `/api/gemini` (relative same-origin URL) instead of `generativelanguage.googleapis.com`. `api/gemini.ts` already exists from E0.5-S1.

**Adapter shape discipline:**
- `implements ProviderPort` — the class conforms to the port interface.
- `static readonly PROVIDER_ID` and `static readonly KEY_PATTERN` — class-side per AD-3 + AD-11. TypeScript enforces this via the `ProviderPortAdapterClass` constructor-signature interface from E0-S2.
- Adapters use ONLY browser-native `fetch` + `ReadableStream` + `TextDecoder`. NO third-party SDK (`@google/generative-ai`, `groq-sdk`, etc.) — those add bundle weight + hidden abstractions per AD-3.
- Per-provider quirks (Gemini's nested `contents[].parts[].text` shape vs Groq's OpenAI-compatible `messages[].content`) are TRANSFORMED inside the adapter. Domain code sees uniform `PromptMessage[]`.

## Technical Requirements

### `src/infrastructure/providers/gemini.adapter.ts` — canonical shape

```ts
import type { ProviderPort, ProviderId } from '@domain/ports/provider.port';
import type { ChatRequest, ChatChunk, ChatChunkError } from '@domain/types/message';

export class GeminiAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'gemini';
  // AD-11: 39-char AIza key format. Redaction registry walks PROVIDER_REGISTRY.entries()
  // and reads this pattern to scrub keys from logs/analytics.
  static readonly KEY_PATTERN: RegExp = /^AIza[0-9A-Za-z_-]{35}$/;

  // Toggle between direct browser fetch (Spike-A) and same-origin proxy (Spike-B).
  // Set at build time from feature-flags or a config const. E0.5-S1 outcome decides.
  private static readonly ENDPOINT =
    // If /api/gemini exists (Fallback b), use it; else direct
    '/api/gemini' /* Fallback (b) */ ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse';

  async *streamChat(
    request: ChatRequest,
    key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    // 1. Transform ChatRequest.messages → Gemini's contents[].parts[].text shape
    const geminiBody = {
      contents: request.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : m.role, // Gemini uses 'model' not 'assistant'
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: request.temperature,
        topP: request.topP,
        maxOutputTokens: request.maxOutputTokens,
        // Gemini does NOT support frequency_penalty / presence_penalty as of 2026-07
        // — silently drop them. Log a dev-time warning via LoggerService in E6-S1.
      },
    };

    let res: Response;
    try {
      res = await fetch(GeminiAdapter.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiBody),
        signal,
      });
    } catch (e) {
      // AbortError on cancel; other errors → network_error
      yield { type: 'error', meta: {
        error: (e as Error).name === 'AbortError' ? 'aborted' : 'network_error',
        retryable: (e as Error).name !== 'AbortError',
      }};
      return;
    }

    if (!res.ok) {
      yield GeminiAdapter.mapHttpError(res);
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let totalTokens = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        // Gemini SSE: `data: {...}\n\n`. Parse per-line.
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const deltaText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (deltaText) yield { type: 'delta', text: deltaText };
            const usage = parsed?.usageMetadata?.totalTokenCount;
            if (typeof usage === 'number') totalTokens = usage;
          } catch { /* malformed SSE payload, skip */ }
        }
      }
      yield { type: 'done', meta: { tokens: totalTokens, model: request.model } };
    } catch (e) {
      const err: ChatChunkError = (e as Error).name === 'AbortError' ? 'aborted' : 'network_error';
      yield { type: 'error', meta: { error: err, retryable: err !== 'aborted' } };
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
    }
  }

  private static mapHttpError(res: Response): ChatChunk {
    // AD-4: closed ChatChunkError union. Never | string.
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    let err: ChatChunkError = 'unknown';
    if (res.status === 429) err = 'quota_exhausted';
    else if (res.status === 401 || res.status === 403) err = 'auth_failed';
    else if (res.status === 400) err = 'invalid_request';
    else if (res.status >= 500) err = 'server_error';
    return {
      type: 'error',
      meta: { error: err, retryable: err === 'quota_exhausted' || err === 'server_error', retryAfterSec },
    };
  }
}
```

### `src/infrastructure/providers/groq.adapter.ts` — canonical shape

```ts
import type { ProviderPort, ProviderId } from '@domain/ports/provider.port';
import type { ChatRequest, ChatChunk, ChatChunkError } from '@domain/types/message';

export class GroqAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'groq';
  // AD-11: Groq gsk_ + 52 chars (per Groq docs 2026-07)
  static readonly KEY_PATTERN: RegExp = /^gsk_[0-9A-Za-z]{52}$/;

  private static readonly ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  async *streamChat(
    request: ChatRequest,
    key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    // Groq is OpenAI-compatible — ChatRequest.messages maps 1:1
    const body = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxOutputTokens,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stream: true,
    };

    let res: Response;
    try {
      res = await fetch(GroqAdapter.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      yield { type: 'error', meta: {
        error: (e as Error).name === 'AbortError' ? 'aborted' : 'network_error',
        retryable: (e as Error).name !== 'AbortError',
      }};
      return;
    }

    if (!res.ok) {
      yield GroqAdapter.mapHttpError(res);
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let totalTokens = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const deltaText = parsed?.choices?.[0]?.delta?.content;
            if (deltaText) yield { type: 'delta', text: deltaText };
            const usage = parsed?.x_groq?.usage?.total_tokens ?? parsed?.usage?.total_tokens;
            if (typeof usage === 'number') totalTokens = usage;
          } catch { /* skip malformed */ }
        }
      }
      yield { type: 'done', meta: { tokens: totalTokens, model: request.model } };
    } catch (e) {
      const err: ChatChunkError = (e as Error).name === 'AbortError' ? 'aborted' : 'network_error';
      yield { type: 'error', meta: { error: err, retryable: err !== 'aborted' } };
    } finally {
      try { reader.releaseLock(); } catch { /* released */ }
    }
  }

  private static mapHttpError(res: Response): ChatChunk { /* same shape as GeminiAdapter.mapHttpError */ }
}
```

### `src/infrastructure/providers/provider.registry.ts`

```ts
import type { ProviderId, ProviderPortAdapterClass } from '@domain/ports/provider.port';
import { GeminiAdapter } from './gemini.adapter';
import { GroqAdapter } from './groq.adapter';

export const PROVIDER_REGISTRY: Map<ProviderId, ProviderPortAdapterClass> = new Map([
  ['gemini', GeminiAdapter as ProviderPortAdapterClass],
  ['groq', GroqAdapter as ProviderPortAdapterClass],
]);
```

### `src/infrastructure/providers/testing/mock.adapter.ts`

```ts
import type { ProviderPort, ProviderId } from '@domain/ports/provider.port';
import type { ChatRequest, ChatChunk } from '@domain/types/message';

export class MockAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'gemini'; // stubbed; TEST_PROVIDER_REGISTRY overrides
  static readonly KEY_PATTERN: RegExp = /.*/;

  private script: ChatChunk[] = [];
  private delayMs = 10;

  configure(script: ChatChunk[], delayMs = 10): this {
    this.script = script;
    this.delayMs = delayMs;
    return this;
  }

  async *streamChat(_request: ChatRequest, _key: string, signal: AbortSignal): AsyncIterable<ChatChunk> {
    for (const chunk of this.script) {
      if (signal.aborted) {
        yield { type: 'error', meta: { error: 'aborted', retryable: false } };
        return;
      }
      await new Promise((r) => setTimeout(r, this.delayMs));
      yield chunk;
    }
  }
}
```

### `src/infrastructure/providers/testing/test-provider.registry.ts`

```ts
import type { ProviderId, ProviderPortAdapterClass } from '@domain/ports/provider.port';
import { MockAdapter } from './mock.adapter';

export const TEST_PROVIDER_REGISTRY: Map<ProviderId, ProviderPortAdapterClass> = new Map([
  ['gemini', MockAdapter as unknown as ProviderPortAdapterClass],
  ['groq', MockAdapter as unknown as ProviderPortAdapterClass],
]);
```

## Architecture Compliance

- **AD-3:** `ProviderPort` is the sole interface; class-side `static PROVIDER_ID + KEY_PATTERN`; adapters constructed only via `PROVIDER_REGISTRY.get(id)` (ESLint from E0-S4 bans direct `*.adapter.ts` imports from features/domain).
- **AD-4:** uniform `ChatChunk` contract; closed `ChatChunkError` union; NO `| string` escape hatch. `mapHttpError` maps to one of the 8 union members.
- **AD-5:** ships EXACTLY `GeminiAdapter` (`gemini-2.5-flash`) + `GroqAdapter` (`openai/gpt-oss-120b`). OpenAI + Anthropic deferred per Deferred list.
- **AD-11:** `static KEY_PATTERN` is the class-side contract the redaction registry (E6-S1) reads from. Adding a provider without `KEY_PATTERN` fails TypeScript compilation via the `ProviderPortAdapterClass` interface.
- **AD-14:** `AbortSignal` propagates to `fetch`; on abort, adapter emits `{ type: 'error', meta: { error: 'aborted', retryable: false } }` and releases the reader.

## Library / Framework Requirements

No new npm packages. Uses browser-native `fetch` + `ReadableStream` + `TextDecoder`.

**Explicitly forbidden:** `@google/generative-ai`, `groq-sdk`, `openai` npm packages. AD-3 mandates raw `fetch` + native streaming for zero bundle bloat + zero hidden abstractions.

## File Structure Requirements

```
src/infrastructure/providers/
  gemini.adapter.ts
  groq.adapter.ts
  provider.registry.ts
  testing/
    mock.adapter.ts
    test-provider.registry.ts
```

## Testing Requirements

- `src/infrastructure/providers/gemini.adapter.spec.ts` — static properties test (`GeminiAdapter.PROVIDER_ID === 'gemini'`, `GeminiAdapter.KEY_PATTERN.test('AIzaSyDaGmWKa4JsXZ-HjGw7ISLan_Ps6U0uAisM')` === true, KEY_PATTERN misses `'AIza-too-short'` and `'gsk_...'`).
- `src/infrastructure/providers/groq.adapter.spec.ts` — analogous.
- `src/infrastructure/providers/mock.adapter.spec.ts` — configure with `[{type:'delta',text:'Hi'},{type:'done',meta:{tokens:1,model:'test'}}]`; `for await` yields exactly these 2 chunks in order.
- Fetch mocking: use `jasmine.createSpy('fetch')` or `MockFetch` — mock `Response.body.getReader()` with a `ReadableStream` from a fixed byte array to test SSE parsing without hitting real Gemini/Groq.
- Abort test: create `AbortController`, kick off `streamChat`, `controller.abort()` mid-stream, verify final chunk is `{type:'error',meta:{error:'aborted',retryable:false}}`.
- **Manual smoke test:** DevTools Console at `localhost:4200`:
  ```js
  const { PROVIDER_REGISTRY } = window.__DEBUG_PROVIDERS__; // expose in dev per app.config.ts
  const gemini = new (PROVIDER_REGISTRY.get('gemini'))();
  const ctrl = new AbortController();
  for await (const chunk of gemini.streamChat({messages:[{role:'user',content:'Hi in one word'}], model:'gemini-2.5-flash'}, 'AIza...', ctrl.signal)) {
    console.log(chunk);
  }
  ```

## Latest Tech Information

- **Gemini 2.5 Flash** `streamGenerateContent?alt=sse` per https://ai.google.dev/gemini-api/docs/text-generation. Body shape: `contents[].parts[].text`. Response SSE chunks: `data: { "candidates": [{ "content": { "parts": [{ "text": "..." }] } }] }`.
- **Gemini role naming:** `role: 'model'` for assistant (NOT `'assistant'`). Transform in adapter.
- **Gemini frequency/presence penalty:** NOT supported as of 2026-07. Silently drop; log warning in dev.
- **Groq** `openai/gpt-oss-120b` per https://console.groq.com/docs/model/openai/gpt-oss-120b — OpenAI-compatible endpoint. Free tier: 30 RPM / 1000 RPD / 8000 TPM / 200000 TPD per https://console.groq.com/docs/rate-limits (verified 2026-07-02; NOT 14,400 RPD — that's for `llama-3.1-8b-instant`).
- **Groq fallback model:** `qwen/qwen3.6-27b` if `openai/gpt-oss-120b` deprecates.
- **SSE parsing:** split on `\n`, filter lines starting with `data: `, JSON.parse the remainder. Both providers emit `[DONE]` as a terminal marker (skip).

## Previous Story Intelligence

**E0.5-S1 (Spike-0):**
- `.memlog.md` entry documents the outcome. Check it first.
- If Fallback (a): `PROVIDER_DEFAULT_ROUTING.hitesh = 'groq'` — verify `provider-registry.ts` reflects this.
- If Fallback (b): `api/gemini.ts` exists at repo root — `GeminiAdapter.ENDPOINT` uses `/api/gemini`.

**E0-S3 (Config + registries):**
- `PROVIDER_DEFAULT_ROUTING` and `ProviderId` type exist.
- `PERSONA_MODEL_PARAMS` has per-persona params — adapters do NOT read this; the assembler (E2-S2) passes them via `ChatRequest`.

**E0-S2 (Ports + types):**
- `ProviderPort` interface + `ProviderPortAdapterClass` constructor interface + `ChatChunk` + `ChatChunkError` + `ChatRequest` all exist.

**E0-S4 (Lint):**
- ESLint `no-restricted-imports` bans `*.adapter.ts` direct imports from features/domain. Verify by attempting a direct import from `src/features/chat/leak.ts` and confirming lint failure.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-3` (ProviderPort SSOT + static contract, lines 78–89), `AD-4` (ChatChunk uniform contract, lines 90–98), `AD-5` (Provider set v1 = Gemini + Groq, lines 100–104), `AD-11` (KEY_PATTERN discipline, lines 167–175), `AD-14` (Cancellation contract, lines 210–219).
- Sequence diagram "Solo Mode message" (lines 512–552) — visual flow.
- Sprint status: key `e2-s1-provider-adapters-and-registry`, blocks `[e2-s3-chat-orchestrator-abort-regex, e7-s2-provider-429-in-character-surfacing, e9-s2-ask-both-sequencer-sequential, e11-s1-golden-set-rubric-and-runner]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-3] `interface ProviderPort { streamChat(request, key, signal): AsyncIterable<ChatChunk>; }` + class-side `static PROVIDER_ID + KEY_PATTERN`.
- [Source: ARCHITECTURE-SPINE.md#AD-4] Closed `ChatChunkError` union: 8 variants + `unknown` catch-all; no `| string`.
- [Source: ARCHITECTURE-SPINE.md#AD-5] Gemini 2.5 Flash + Groq openai/gpt-oss-120b; browser-CORS-clean only.
- [Source: ARCHITECTURE-SPINE.md#AD-11] `static readonly KEY_PATTERN: RegExp` — redaction registry reads this at construction.
- [Source: ARCHITECTURE-SPINE.md#AD-14] AbortController → AbortSignal → adapter fetch → `{ type:'error', meta:{ error:'aborted', retryable:false } }`.
- [Source: E0.5-S1 story] Spike-0 outcome + fallback branches.
- [Source: sprint-status.yaml#dependency_chain.e2-s1-provider-adapters-and-registry] `blocked_by: [e0-s3, e0-s4, e0-5-s1]`; `blocks: [e2-s3, e7-s2, e9-s2, e11-s1]`.

## Story Completion Status

- [ ] `src/infrastructure/providers/gemini.adapter.ts` — `GeminiAdapter implements ProviderPort` with `static PROVIDER_ID + KEY_PATTERN`; `streamChat` uses `fetch` + `ReadableStream` + `TextDecoder`; endpoint reflects Spike-0 outcome; error handling maps HTTP codes to closed `ChatChunkError` union.
- [ ] `src/infrastructure/providers/groq.adapter.ts` — analogous, OpenAI-compatible endpoint.
- [ ] `src/infrastructure/providers/provider.registry.ts` — `PROVIDER_REGISTRY: Map<ProviderId, ProviderPortAdapterClass>` with both adapters.
- [ ] `src/infrastructure/providers/testing/mock.adapter.ts` — `MockAdapter` accepts scripted `ChatChunk[]` + delay.
- [ ] `src/infrastructure/providers/testing/test-provider.registry.ts` — `TEST_PROVIDER_REGISTRY` with mock adapters registered under both provider IDs.
- [ ] Spec tests: static-property checks + KEY_PATTERN regex matches + fetch mocking + abort mid-stream + mock adapter yields scripted sequence.
- [ ] Manual smoke test: real Gemini + Groq keys yield real SSE deltas in DevTools Console at `localhost:4200` (or `/api/gemini` if Fallback b).
- [ ] `npm run lint` passes (no `*.adapter.ts` direct imports from features/domain — ESLint from E0-S4 enforces).
- [ ] No third-party provider SDK dependencies added to `package.json`.
