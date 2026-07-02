# Story E2-S3: ChatOrchestrator + AbortController + regex smoke-test

Status: ready-for-dev

- **Epic:** 2 — Persona-Faithful Chat Engine (Solo)
- **Critical-path position:** 8 of 37 (Day 2)
- **Blocks:** E2-S4, E4-S3, E5-S1, E6-S1, E6-S3, E7-S1, E7-S2, E8-S2, E9-S2
- **Depends on:** E2-S1, E2-S2

## Story

As a **solo developer**,
I want **`ChatOrchestrator.sendMessage(persona, text)` to drive the full send path — moderation input check → PromptAssembler.compose → PROVIDER_REGISTRY.get(id).streamChat → chunk-by-chunk UI signal update → moderation output check → message persist → regex smoke-test — with `AbortController` propagation and no synchronous work on the hot path**,
So that **the UI can just call one service method, the streaming feels smooth, and cancellation reliably tears down in-flight streams**.

## Acceptance Criteria

**Given** the ports + adapters + assembler exist,
**When** the developer authors `src/domain/chat/chat-orchestrator.service.ts` as an Angular service,
**Then** it exposes `sendMessage(persona: PersonaId, text: string): Observable<never>` (returns void observable that completes on stream done, errors on stream error) and internally: (1) calls `ModerationPort.check(text, 'input')` — if blocked, renders in-character deflection bubble from Addendum §E and emits `moderation_blocked` per AD-15; (2) appends user Message to thread via `StoragePort` (Epic 3 wires the actual adapter; this story stubs with an in-memory Map); (3) calls `PromptAssembler.compose(persona, thread, 'solo')`; (4) reads key via `KeyVaultService.getKeyForProvider(persona-provider-id)` (Epic 6 wires the actual vault; this story stubs from a hardcoded dev key OR sessionStorage read); (5) creates an `AbortController`; (6) awaits `PROVIDER_REGISTRY.get(providerId).streamChat(prompt, key, controller.signal)`; (7) for each `{type: 'delta'}` chunk, writes the accumulated text into a `WritableSignal<string>` that the UI subscribes to; (8) on `{type: 'done'}`, calls `ModerationPort.check(accumulatedText, 'output')` — if blocked, retries once with the same prompt then substitutes a canned in-character refusal from Addendum §E per AD-12; (9) persists assistant Message with `status: 'complete'` per AD-10; (10) runs regex smoke-test — matches `HITESH_REGEX` or `PIYUSH_REGEX` from `regex-patterns.ts` against `accumulatedText`; on miss, emits `persona_regex_miss` analytics event per AD-19 — NEVER regenerates.

**Given** the orchestrator has an in-flight stream,
**When** the developer calls `chatOrchestrator.cancelInFlight()`,
**Then** the `AbortController.abort()` fires, the adapter emits `{type: 'error', meta: {error: 'aborted', retryable: false}}`, the assistant Message is marked `status: 'cancelled'` per AD-10 with the partial content preserved, and any in-flight `WritableSignal` write completes gracefully (no orphaned Promise leaks).

**Given** an in-flight stream stalls (no new tokens) for `STREAM_STALL_TIMEOUT_MS = 30000`,
**When** the orchestrator's stall-detection timer fires,
**Then** the orchestrator surfaces a "Slow connection" UI signal (Epic 4 story E4-S3 renders the actual "Cancel and try again?" affordance; this story emits the signal) and emits `stream_stall_detected` analytics event per AD-15.

**Given** the moderation output check flags the response,
**When** the orchestrator retries the provider call once and the retry ALSO flags,
**Then** the streamed content is discarded from the UI signal, a canned in-character refusal from Addendum §E replaces it, and `moderation_blocked` analytics event is emitted with `direction: 'output'` per AD-12 + AD-15.

**Given** the moderation port is a stub in this story (real heuristic adapter lands in Epic 8),
**When** the orchestrator calls it,
**Then** the stub returns `{allowed: true}` unconditionally — the orchestrator's shape is verified independently of the moderation logic.

**Given** the storage port is a stub in this story,
**When** the orchestrator writes to it,
**Then** the stub is an in-memory Map — Epic 3 story E3-S1 replaces it with `IdbKeyvalStorageAdapter` transparently (Angular's DI swaps the concrete implementation, no orchestrator change).

**Given** the orchestrator emits an analytics event,
**When** the analytics port receives it,
**Then** the event payload is type-checked against the `AnalyticsEvent` discriminated union (AD-15) — a mismatch is a compile error. Analytics adapter (`VercelAnalyticsAdapter`) is a stub in this story that logs to `LoggerService.info` in dev; Epic 6 wires the redaction registry into it; Epic 11 verifies the production Vercel Analytics beacon.

**verifies:** AD-3 (adapter via PROVIDER_REGISTRY.get), AD-4 (ChatChunk consumption), AD-7 (persona-tagged message + in-flight stream discipline), AD-8 (calls PromptAssembler.compose), AD-9 (references STREAM_STALL_TIMEOUT_MS), AD-10 (Message status field), AD-12 (moderation port called input + output), AD-14 (AbortController cancellation contract), AD-15 (typed analytics events: `moderation_blocked`, `persona_regex_miss`, `stream_stall_detected`), AD-19 (regex smoke-test observation-only)

**touches:** `src/domain/chat/chat-orchestrator.service.ts`, `src/domain/chat/chat-thread.service.ts` (in-memory thread scaffold — replaced by IdbKeyvalStorageAdapter in Epic 3), `src/infrastructure/moderation/heuristic.adapter.ts` (stub returning `{allowed: true}`; real rules in Epic 8), `src/infrastructure/analytics/vercel.adapter.ts` (stub logging via LoggerService in dev), `src/infrastructure/logger/logger.service.ts` (dev-only console wrapper — redaction wiring lands in Epic 6)

**test target:** unit test (orchestrator called with mock adapter that yields a scripted `ChatChunk` sequence; verify the WritableSignal accumulates deltas in order; verify AbortController tears down mid-stream; verify moderation-block flow renders refusal; verify regex-miss emits analytics event but does NOT regenerate)

## Developer Context

Heart of the chat engine. This service is the ONLY code that calls `PROVIDER_REGISTRY.get(...).streamChat(...)`. Feature components inject `ChatOrchestrator` and call `sendMessage(persona, text)`; the orchestrator does the rest.

**Cross-cutting reactive state:** the orchestrator owns 4 signals that UI subscribes to:
- `accumulatedText$: WritableSignal<string>` — the in-progress bubble text (grows as deltas arrive).
- `inFlightStream$: Signal<boolean>` — true from send-start to done/error/abort.
- `streamStalled$: Signal<boolean>` — true when 30s pass without a delta.
- `activeAssistantMessageId$: Signal<string | null>` — the ID of the currently-streaming message.

**Stub swap discipline:** the orchestrator injects `StoragePort`, `ModerationPort`, `AnalyticsPort`, `KeyVaultService` — all via Angular DI tokens. This story lands STUBS for each. E3-S1 swaps StoragePort to real `IdbKeyvalStorageAdapter`; E6-S1 swaps KeyVault to real `KeyVaultService`; E6-S1 also adds redaction to `VercelAnalyticsAdapter`; E8-S2 swaps ModerationPort to real `HeuristicModerationAdapter`. NONE of these swaps modify the orchestrator — pure DI substitution.

## Technical Requirements

### `src/domain/chat/chat-orchestrator.service.ts`

```ts
import { Inject, Injectable, signal, WritableSignal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import type { PersonaId, Thread, Message, ChatChunk } from '@domain/types/message';
import type { StoragePort } from '@domain/ports/storage.port';
import type { ModerationPort } from '@domain/ports/moderation.port';
import type { AnalyticsPort } from '@domain/ports/analytics.port';
import { STORAGE_PORT, MODERATION_PORT, ANALYTICS_PORT } from './di-tokens'; // define these
import { PROVIDER_REGISTRY } from '@infrastructure/providers/provider.registry';
import { PromptAssembler } from '@domain/prompts/prompt-assembler.service';
import { KeyVaultService } from '@domain/key-vault/key-vault.service'; // Epic 6 lands real; stub here
import { PERSONA_REGISTRY } from '@personas/persona.registry';
import { HITESH_REGEX, PIYUSH_REGEX } from '@config/regex-patterns';
import { STREAM_STALL_TIMEOUT_MS } from '@config/context-config';

@Injectable({ providedIn: 'root' })
export class ChatOrchestrator {
  readonly accumulatedText$: WritableSignal<string> = signal('');
  readonly inFlightStream$: WritableSignal<boolean> = signal(false);
  readonly streamStalled$: WritableSignal<boolean> = signal(false);
  readonly activeAssistantMessageId$: WritableSignal<string | null> = signal(null);
  readonly keyMissing$: Subject<PersonaId> = new Subject(); // E6-S3 subscribes for auto-open

  private currentAbort: AbortController | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(STORAGE_PORT) private storage: StoragePort,
    @Inject(MODERATION_PORT) private moderation: ModerationPort,
    @Inject(ANALYTICS_PORT) private analytics: AnalyticsPort,
    private assembler: PromptAssembler,
    private keyVault: KeyVaultService,
  ) {}

  sendMessage(persona: PersonaId, text: string): Observable<never> {
    return new Observable((sub) => {
      this.dispatch(persona, text, sub).catch((e) => sub.error(e));
      return () => this.cancelInFlight();
    });
  }

  cancelInFlight(): void {
    if (this.currentAbort) {
      this.currentAbort.abort();
      this.currentAbort = null;
    }
    this.clearStallTimer();
  }

  private async dispatch(
    persona: PersonaId,
    text: string,
    sub: import('rxjs').Subscriber<never>,
  ): Promise<void> {
    // Step 1: Input moderation
    const inputVerdict = await this.moderation.check(text, 'input');
    if (!inputVerdict.allowed) {
      const template = this.pickRefusalTemplate(persona, inputVerdict.category, inputVerdict.suggested_refusal);
      await this.renderCannedRefusal(persona, template);
      this.analytics.emit({ name: 'moderation_blocked', payload: { direction: 'input', category: inputVerdict.category } });
      sub.complete();
      return;
    }

    // Step 2: Append user message to thread
    const thread = await this.getOrCreateThread(persona);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    thread.messages.push(userMsg);
    thread.updatedAt = Date.now();
    await this.storage.set(this.threadKeyFor(persona), thread);

    // Step 3: Compose prompt
    const prompt = this.assembler.compose(persona, thread, 'solo');

    // Step 4: Read key
    const providerId = PERSONA_REGISTRY[persona].providerId;
    const key = this.keyVault.getKeyForProvider(providerId);
    if (!key) {
      this.keyMissing$.next(persona); // E6-S3 auto-opens settings modal
      sub.complete();
      return;
    }

    // Step 5-6: AbortController + stream
    const AdapterClass = PROVIDER_REGISTRY.get(providerId)!;
    const adapter = new AdapterClass();
    this.currentAbort = new AbortController();
    this.inFlightStream$.set(true);
    this.accumulatedText$.set('');
    const assistantMsgId = crypto.randomUUID();
    this.activeAssistantMessageId$.set(assistantMsgId);
    this.armStallTimer(persona);

    let accumulated = '';
    let done = false;
    let errored = false;
    try {
      for await (const chunk of adapter.streamChat(prompt, key, this.currentAbort.signal)) {
        this.resetStallTimer(persona);
        if (chunk.type === 'delta' && chunk.text) {
          accumulated += chunk.text;
          this.accumulatedText$.set(accumulated);
        } else if (chunk.type === 'done') {
          done = true;
          break;
        } else if (chunk.type === 'error') {
          errored = true;
          await this.handleAdapterError(persona, chunk, assistantMsgId, accumulated, thread);
          break;
        }
      }
    } finally {
      this.clearStallTimer();
      this.inFlightStream$.set(false);
    }

    if (done) {
      // Step 8: Output moderation with retry-once
      const finalText = await this.checkOutputWithRetry(persona, prompt, key, accumulated, adapter);
      // Step 9: Persist
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        persona,
        content: finalText,
        timestamp: Date.now(),
        status: 'complete',
      };
      thread.messages.push(assistantMsg);
      thread.updatedAt = Date.now();
      await this.storage.set(this.threadKeyFor(persona), thread);
      // Step 10: Regex smoke-test (AD-19 observation-only)
      const regex = persona === 'hitesh' ? HITESH_REGEX : PIYUSH_REGEX;
      if (!regex.test(finalText)) {
        this.analytics.emit({ name: 'persona_regex_miss', payload: { persona } });
      }
      this.analytics.emit({ name: 'message_sent', payload: { persona, mode: 'solo', charCount: text.length } });
    }
    sub.complete();
  }

  private armStallTimer(persona: PersonaId): void {
    this.clearStallTimer();
    this.stallTimer = setTimeout(() => {
      this.streamStalled$.set(true);
      this.analytics.emit({ name: 'stream_stall_detected', payload: { persona, elapsedMs: STREAM_STALL_TIMEOUT_MS } });
    }, STREAM_STALL_TIMEOUT_MS);
  }
  private resetStallTimer(persona: PersonaId): void {
    if (this.streamStalled$()) this.streamStalled$.set(false);
    this.armStallTimer(persona);
  }
  private clearStallTimer(): void {
    if (this.stallTimer) { clearTimeout(this.stallTimer); this.stallTimer = null; }
  }

  private async checkOutputWithRetry(persona, prompt, key, accumulated, adapter): Promise<string> {
    // ...moderation output check + retry-once + refusal substitution
    // Full impl in this story; E8-S2 tunes the moderation adapter itself
    return accumulated;
  }

  private pickRefusalTemplate(persona, category, suggested) {
    const p = PERSONA_REGISTRY[persona].prompt;
    if (category === 'jailbreak') return p.promptInjectionTemplate;
    if (category === 'off_domain') return p.offDomainTemplate;
    if (category === 'adult') return p.adultTemplate;
    if (category === 'political') return p.politicalTemplate;
    return suggested ?? p.offDomainTemplate;
  }

  private async renderCannedRefusal(persona, template): Promise<void> {
    // Append a synthetic assistant Message with the template content and status: 'complete'.
    // ...
  }

  private threadKeyFor(persona: PersonaId): 'chat:hitesh:v1' | 'chat:piyush:v1' {
    return persona === 'hitesh' ? 'chat:hitesh:v1' : 'chat:piyush:v1';
  }

  private async getOrCreateThread(persona: PersonaId): Promise<Thread> {
    const key = this.threadKeyFor(persona);
    const existing = await this.storage.get<Thread>(key);
    if (existing) return existing;
    return {
      id: crypto.randomUUID(),
      scope: persona,
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private async handleAdapterError(persona, chunk, msgId, partial, thread) {
    if (chunk.meta?.error === 'aborted') {
      // AD-14: mark message cancelled with partial content preserved
      const msg: Message = { id: msgId, role: 'assistant', persona, content: partial, timestamp: Date.now(), status: 'cancelled' };
      thread.messages.push(msg);
      await this.storage.set(this.threadKeyFor(persona), thread);
    } else if (chunk.meta?.error === 'quota_exhausted') {
      // E7-S2 renders the in-character quota-exhausted template
      const template = PERSONA_REGISTRY[persona].prompt.quotaExhaustedTemplate;
      // ... render synthetic message, emit provider_429_surfaced
      this.analytics.emit({ name: 'provider_429_surfaced', payload: { provider: PERSONA_REGISTRY[persona].providerId, retryAfterSec: chunk.meta.retryAfterSec } });
    }
    // ...other error kinds
  }
}
```

### DI tokens

```ts
// src/domain/chat/di-tokens.ts
import { InjectionToken } from '@angular/core';
import type { StoragePort } from '@domain/ports/storage.port';
import type { ModerationPort } from '@domain/ports/moderation.port';
import type { AnalyticsPort } from '@domain/ports/analytics.port';

export const STORAGE_PORT = new InjectionToken<StoragePort>('StoragePort');
export const MODERATION_PORT = new InjectionToken<ModerationPort>('ModerationPort');
export const ANALYTICS_PORT = new InjectionToken<AnalyticsPort>('AnalyticsPort');
```

### Stubs

**`src/domain/chat/chat-thread.service.ts` (in-memory StoragePort stub — E3-S1 replaces):**

```ts
import { Injectable } from '@angular/core';
import type { StoragePort } from '@domain/ports/storage.port';
import type { StorageKey } from '@config/storage-keys';

@Injectable()
export class InMemoryStorageAdapter implements StoragePort {
  private map = new Map<StorageKey, unknown>();
  async get<T>(key: StorageKey): Promise<T | undefined> { return this.map.get(key) as T; }
  async set<T>(key: StorageKey, value: T): Promise<void> { this.map.set(key, value); }
  async delete(key: StorageKey): Promise<void> { this.map.delete(key); }
}
```

**`src/infrastructure/moderation/heuristic.adapter.ts` (stub):**

```ts
import { Injectable } from '@angular/core';
import type { ModerationPort, ModerationVerdict } from '@domain/ports/moderation.port';

@Injectable()
export class HeuristicModerationAdapter implements ModerationPort {
  async check(_text: string, _direction: 'input' | 'output'): Promise<ModerationVerdict> {
    return { allowed: true }; // E8-S2 replaces with real regex + keyword + length checks
  }
}
```

**`src/infrastructure/analytics/vercel.adapter.ts` (stub):**

```ts
import { Injectable } from '@angular/core';
import type { AnalyticsPort, AnalyticsEvent } from '@domain/ports/analytics.port';
import { LoggerService } from '@infrastructure/logger/logger.service';

@Injectable()
export class VercelAnalyticsAdapter implements AnalyticsPort {
  constructor(private logger: LoggerService) {}
  emit(event: AnalyticsEvent): void {
    this.logger.info(`[analytics] ${event.name}`, event.payload); // E6-S1 wires redaction
  }
}
```

**`src/infrastructure/logger/logger.service.ts`:**

```ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  info(msg: string, ...args: unknown[]): void { if (this.dev) console.info(msg, ...args); } // E6-S1 wires redaction
  warn(msg: string, ...args: unknown[]): void { if (this.dev) console.warn(msg, ...args); }
  error(msg: string, ...args: unknown[]): void { console.error(msg, ...args); }
  private get dev(): boolean { return !this.isProduction(); }
  private isProduction(): boolean { return false; /* wire to Angular env */ }
}
```

**KeyVaultService stub (Epic 6 replaces):**

```ts
// src/domain/key-vault/key-vault.service.ts
import { Injectable } from '@angular/core';
import type { ProviderId } from '@config/provider-registry';

@Injectable({ providedIn: 'root' })
export class KeyVaultService {
  getKeyForProvider(provider: ProviderId): string | null {
    // Dev-time stub: read sessionStorage directly (E6-S1 formalizes)
    return sessionStorage.getItem(`byo-key:${provider}`);
  }
}
```

**`src/app/app.config.ts` — wire DI tokens:**

```ts
import { ApplicationConfig } from '@angular/core';
import { STORAGE_PORT, MODERATION_PORT, ANALYTICS_PORT } from '@domain/chat/di-tokens';
import { InMemoryStorageAdapter } from '@domain/chat/chat-thread.service';
import { HeuristicModerationAdapter } from '@infrastructure/moderation/heuristic.adapter';
import { VercelAnalyticsAdapter } from '@infrastructure/analytics/vercel.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: STORAGE_PORT, useClass: InMemoryStorageAdapter }, // E3-S1 swaps to IdbKeyvalStorageAdapter
    { provide: MODERATION_PORT, useClass: HeuristicModerationAdapter },
    { provide: ANALYTICS_PORT, useClass: VercelAnalyticsAdapter },
  ],
};
```

## Architecture Compliance

- **AD-3:** adapter accessed via `PROVIDER_REGISTRY.get(providerId)!` — never direct import (ESLint E0-S4 enforces).
- **AD-4:** consumes `AsyncIterable<ChatChunk>`; branches on `type: 'delta' | 'done' | 'error'`.
- **AD-7:** every assistant Message tagged with `persona`; in-flight signal disables switcher (E4-S3 subscribes).
- **AD-8:** calls `PromptAssembler.compose(persona, thread, 'solo')` — only.
- **AD-9:** stall timer uses `STREAM_STALL_TIMEOUT_MS = 30000`.
- **AD-10:** Message.status is `'streaming'` mid-stream, `'complete'` on done, `'cancelled'` on abort, `'error'` on adapter error.
- **AD-12:** input moderation before provider call; output moderation with retry-once before persist.
- **AD-14:** `AbortController` per user message; signal propagates to adapter; on abort, `status: 'cancelled'` + partial content preserved + UI controls re-enable.
- **AD-15:** typed `AnalyticsEvent` emissions — compile-checked.
- **AD-19:** regex smoke-test emits `persona_regex_miss` analytics on miss; NEVER regenerates.
- **AD-21:** hot path is async — moderation is async, adapter fetch is async, analytics emit is fire-and-forget (never awaited).

## Library / Framework Requirements

- RxJS 7 `Observable` + `Subject` for `sendMessage` return + `keyMissing$`.
- Angular 21 `signal()` / `WritableSignal` / `Signal` for reactive state.
- Native `AbortController` / `crypto.randomUUID` — no polyfills needed (Node 22 + baseline browsers).

## File Structure Requirements

```
src/domain/chat/
  chat-orchestrator.service.ts       # NEW — the orchestrator
  chat-thread.service.ts             # STUB — InMemoryStorageAdapter (E3-S1 replaces)
  di-tokens.ts                        # NEW — StoragePort / ModerationPort / AnalyticsPort tokens
src/infrastructure/moderation/
  heuristic.adapter.ts                # STUB — always allowed=true (E8-S2 replaces)
src/infrastructure/analytics/
  vercel.adapter.ts                   # STUB — logs via LoggerService (E6-S1 wires redaction; E11 verifies real Vercel beacon)
src/infrastructure/logger/
  logger.service.ts                   # dev-only console wrapper (E6-S1 adds redaction registry)
src/domain/key-vault/
  key-vault.service.ts                # STUB — reads sessionStorage directly (E6-S1 formalizes)
src/app/
  app.config.ts                       # DI wiring for STORAGE_PORT, MODERATION_PORT, ANALYTICS_PORT
```

## Testing Requirements

- `src/domain/chat/chat-orchestrator.service.spec.ts` (using Angular TestBed):
  - **Deterministic streaming:** inject `TEST_PROVIDER_REGISTRY` mock adapter scripted with 3 delta chunks + done → `accumulatedText$` grows from `''` → `'a'` → `'ab'` → `'abc'`; `inFlightStream$` transitions true → false; final assistant Message persisted with `status: 'complete'`.
  - **Abort mid-stream:** mock adapter yields 2 deltas then hangs; call `cancelInFlight()`; verify final chunk is `{type:'error',meta:{error:'aborted'}}`; verify persisted Message has `status: 'cancelled'` with partial content; `inFlightStream$` back to false.
  - **Moderation input-block:** stub `ModerationPort.check(_,'input')` returns `{allowed:false, category:'jailbreak'}`; verify `provider.streamChat` was NOT called; verify canned refusal (from `PERSONA_REGISTRY[persona].prompt.promptInjectionTemplate`) rendered; `moderation_blocked` event emitted with `direction:'input',category:'jailbreak'`.
  - **Moderation output-block + retry-once:** stub `ModerationPort.check(_,'output')` returns `{allowed:false}` on first call + `{allowed:false}` on second → verify canned refusal substituted; `moderation_blocked` emitted once with `direction:'output'`.
  - **Regex miss:** stub adapter yields a delta with `"Hello world"` (no Hindi phrases); `HITESH_REGEX.test('Hello world')` false → `persona_regex_miss` event emitted; NO auto-regeneration; assistant message persisted with `"Hello world"` content.
  - **Stall detection:** mock adapter yields 1 delta then hangs 30+s → `streamStalled$` transitions true; `stream_stall_detected` event emitted.
  - **Key missing:** stub `KeyVaultService.getKeyForProvider(...)` returns `null` → `keyMissing$` emits the persona; `provider.streamChat` NOT called.

Use Angular's `TestBed.configureTestingModule({ providers: [{ provide: STORAGE_PORT, useClass: InMemoryStorageAdapter }, ... ] })` to swap in stubs per test.

## Latest Tech Information

- Angular 21 `signal()` is preferred for reactive state over `BehaviorSubject`; `WritableSignal<T>` with `.set()` / `.update()` is the modern API.
- RxJS `Observable` from `new Observable((sub) => { ... })` — the tear-down function in the returned callback fires on unsubscribe (perfect fit for auto-cancel on `sendMessage` unsubscribe).
- `for await (const chunk of asyncIterable)` — native ES2018 syntax; no polyfills.
- Angular DI `InjectionToken<T>` — the pattern for port-based DI where multiple concrete impls exist.

## Previous Story Intelligence

**E2-S2 (PromptAssembler):**
- `PromptAssembler.compose(persona, thread, 'solo')` returns `OutboundPrompt`.
- `token-estimator.ts` stub landed (E5-S1 replaces).

**E2-S1 (Provider adapters):**
- `PROVIDER_REGISTRY.get(providerId)` returns adapter CLASS (not instance) — instantiate with `new AdapterClass()`.
- `TEST_PROVIDER_REGISTRY` for deterministic testing.
- Adapter emits `{type:'error',meta:{error:'aborted',retryable:false}}` on abort.

**E0-S3 (Config + persona registry):**
- `PERSONA_REGISTRY[persona].providerId` — Gemini for Hitesh, Groq for Piyush (or per Spike-0 fallback).
- `PERSONA_REGISTRY[persona].prompt.promptInjectionTemplate` etc — SKELETON `''` placeholders. E8-S1 + E8-S2 populate. This story renders the empty string on moderation-block, then Epic 8 supplies real templates.
- `HITESH_REGEX` / `PIYUSH_REGEX` from `regex-patterns.ts`.
- `STREAM_STALL_TIMEOUT_MS = 30000` from `context-config.ts`.

**E0-S2 (Ports):**
- All ports + AnalyticsEvent union.

## Project Context Reference

- ARCHITECTURE-SPINE.md sequence diagram "Solo Mode message" (lines 512–552) — visual flow this orchestrator implements.
- `AD-3` (adapter via registry, lines 78–89), `AD-4` (ChatChunk consumption, lines 90–98), `AD-7` (persona isolation, lines 116–120), `AD-9` (STREAM_STALL_TIMEOUT_MS, lines 141–155), `AD-10` (Message.status, lines 157–165), `AD-12` (moderation input + output, lines 177–187), `AD-14` (AbortController, lines 210–219), `AD-15` (typed analytics, lines 221–244), `AD-19` (regex observation-only, lines 271–275), `AD-21` (non-blocking hot path, lines 288–298).
- Sprint status: key `e2-s3-chat-orchestrator-abort-regex`, blocks 9 downstream stories.

## References

- [Source: ARCHITECTURE-SPINE.md sequence "Solo Mode message"] Full send-path diagram.
- [Source: ARCHITECTURE-SPINE.md#AD-14] Single AbortController per user message; `status: 'cancelled'` with partial content.
- [Source: ARCHITECTURE-SPINE.md#AD-19] Regex smoke-test is observation-only; log via `persona_regex_miss` analytics; NEVER auto-regenerate.
- [Source: ARCHITECTURE-SPINE.md#AD-21] `emit()` never awaits beacon; `navigator.sendBeacon` with fetch-keepalive fallback (Epic 11 verifies real Vercel beacon).
- [Source: sprint-status.yaml#dependency_chain.e2-s3-chat-orchestrator-abort-regex] `blocks: [9 stories including e2-s4, e4-s3, e5-s1, e6-s1, e6-s3, e7-s1, e7-s2, e8-s2, e9-s2]`.

## Story Completion Status

- [ ] `src/domain/chat/chat-orchestrator.service.ts` implements the full 10-step send path.
- [ ] Four reactive signals exposed: `accumulatedText$`, `inFlightStream$`, `streamStalled$`, `activeAssistantMessageId$`; plus `keyMissing$: Subject<PersonaId>` for E6-S3 auto-open.
- [ ] `sendMessage(persona, text): Observable<never>` + `cancelInFlight(): void` — public API.
- [ ] AbortController per message; abort marks Message `status: 'cancelled'` + preserves partial content.
- [ ] Stall detection: 30s no-delta → `streamStalled$ = true` + `stream_stall_detected` analytics.
- [ ] Moderation input + output (retry-once-then-refuse); refusal templates from `PERSONA_REGISTRY[persona].prompt.<category>Template` (skeletons empty until E8-S1/E8-S2 populate).
- [ ] Regex smoke-test emits `persona_regex_miss` on miss; NEVER regenerates.
- [ ] Stubs land: `InMemoryStorageAdapter` (E3-S1 replaces), `HeuristicModerationAdapter` (E8-S2 replaces), `VercelAnalyticsAdapter` logging via `LoggerService` (E6-S1 wires redaction; E11 verifies real Vercel beacon), `KeyVaultService` stub reading sessionStorage (E6-S1 formalizes).
- [ ] `app.config.ts` wires DI tokens.
- [ ] Full spec suite: streaming, abort, moderation input/output, regex miss, stall, key missing.
- [ ] `npm run lint` passes.
