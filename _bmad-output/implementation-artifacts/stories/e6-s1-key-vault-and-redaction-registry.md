# Story E6-S1: KeyVaultService + redaction registry structurally coupled to PROVIDER_REGISTRY

Status: ready-for-dev

- **Epic:** 6 — BYO-Key Mode
- **Critical-path position:** 20 of 37 (Day 5 morning)
- **Blocks:** E6-S2
- **Depends on:** E0-S3, E2-S3

## Story

As a **cohort grader**,
I want **my BYO-Key to live only in `sessionStorage` (cleared on tab close), passed directly into the provider fetch call at request time, never appearing in logs or analytics event payloads**,
So that **I can paste a personal API key without worrying it'll leak into the developer's telemetry**.

## Acceptance Criteria

**Given** the `PROVIDER_REGISTRY` from E2-S1 (Gemini + Groq adapter classes with `static PROVIDER_ID + KEY_PATTERN`),
**When** the developer authors `src/domain/key-vault/key-vault.service.ts`,
**Then** the service exposes `getKeyForProvider(provider: ProviderId): string | null` and `setKey(provider: ProviderId, key: string): void` and `clearKey(provider: ProviderId): void` — reading from and writing to `sessionStorage` under keys like `byo-key:${provider}` (NOT part of the AD-6 `StorageKey` union — sessionStorage is intentionally separate from the persistent IndexedDB store per AD-11).

**Given** ESLint `no-restricted-globals` from E0-S4 bans `sessionStorage` outside the two named files,
**When** the developer confirms `KeyVaultService` is one of the two allowed files (alongside `idb-keyval.adapter.ts` from Epic 3),
**Then** `sessionStorage.setItem(\`byo-key:${provider}\`, key)` inside `key-vault.service.ts` passes lint; any usage outside these two files fails.

**Given** the `LoggerService` from Epic 2 (`src/infrastructure/logger/logger.service.ts`),
**When** the developer extends its constructor to build a redaction registry,
**Then** at construction time it iterates `PROVIDER_REGISTRY.entries()`, reads each adapter class's `static KEY_PATTERN`, and builds a `redactionPatterns: RegExp[]` list per AD-11. `LoggerService.info/warn/error` scrub every string argument through the redaction list before emitting (each pattern's match is replaced with `[REDACTED-{provider-id}-KEY]`).

**Given** the `VercelAnalyticsAdapter` from Epic 2 (`src/infrastructure/analytics/vercel.adapter.ts`),
**When** the developer extends its constructor to build the same redaction registry,
**Then** every string field in an `AnalyticsEvent` payload is scrubbed the same way before being passed to `analytics.track` (or `navigator.sendBeacon` fallback).

**Given** a new `ProviderPort` adapter is written in the future (e.g., `AnthropicAdapter`),
**When** the developer forgets to declare `static readonly KEY_PATTERN: RegExp`,
**Then** the TypeScript compilation fails — the interface constraint on `ProviderPort` implementation classes is enforced at type-system level (not just lint) per AD-11. This is achieved by declaring `interface ProviderPortAdapterClass { new (): ProviderPort; readonly PROVIDER_ID: ProviderId; readonly KEY_PATTERN: RegExp; }` and typing the `PROVIDER_REGISTRY` values as `ProviderPortAdapterClass`.

**Given** the developer runs a manual redaction smoke test — pastes a fake Gemini key `AIzaXXXXXX_test_1234567890_abcdefghijklmno` into sessionStorage, triggers a `LoggerService.error("Failed to fetch with key " + fakeKey)`,
**When** the log output is inspected in DevTools Console,
**Then** the log shows `"Failed to fetch with key [REDACTED-gemini-KEY]"` — the raw key is never emitted.

**Given** a BYO-Key request fails at the provider (e.g., 401 from Gemini),
**When** the ChatOrchestrator receives the error object,
**Then** any error object properties (e.g. `error.response.body` or `error.message`) are scrubbed through the redaction registry before reaching the UI or the analytics event per AD-11.

**verifies:** AD-11 (BYO-Key isolation + redaction registry structurally coupled to PROVIDER_REGISTRY + type-system-level enforcement), AD-6 (sessionStorage confined to KeyVaultService + IdbKeyvalStorageAdapter), FR-17 (superseded — this story realizes the client-side replacement)

**touches:** `src/domain/key-vault/key-vault.service.ts`, `src/infrastructure/logger/logger.service.ts` (extend with redaction registry), `src/infrastructure/analytics/vercel.adapter.ts` (extend with redaction registry), `src/domain/ports/provider.port.ts` (add `ProviderPortAdapterClass` companion interface constraining implementation classes to expose `PROVIDER_ID + KEY_PATTERN`)

**test target:** unit test (setKey then getKeyForProvider returns the same key; sessionStorage.getItem inspection confirms the raw key; LoggerService.error with a key-shaped string emits with `[REDACTED-*-KEY]`; VercelAnalyticsAdapter.emit with a payload containing a key-shaped string produces a scrubbed payload; a fake adapter without KEY_PATTERN fails TypeScript compilation via a test file that intentionally omits the static and expects `tsc --noEmit` to error)

## Developer Context

Security-critical story. AD-11's redaction registry lives-or-dies here. Two production adapters (Gemini + Groq) each expose a static KEY_PATTERN; LoggerService + VercelAnalyticsAdapter walk PROVIDER_REGISTRY entries at construction to build the redaction list. Adding a provider = new adapter with KEY_PATTERN = automatically added to redaction (structural coupling).

**Formalizes the stub:** E2-S3 landed a stub `KeyVaultService` that read `sessionStorage.getItem('byo-key:${provider}')` directly. This story upgrades to a proper service with `setKey`/`clearKey` + a reactive `currentKey$` signal for E6-S3's badge.

## Technical Requirements

### `src/domain/key-vault/key-vault.service.ts`

```ts
import { Injectable, signal, WritableSignal } from '@angular/core';
import type { ProviderId } from '@config/provider-registry';

@Injectable({ providedIn: 'root' })
export class KeyVaultService {
  private readonly _current: WritableSignal<{ provider: ProviderId | null }> = signal({ provider: null });
  readonly currentKey$ = this._current.asReadonly();

  constructor() {
    // Initialize by checking which providers have keys already
    for (const p of ['gemini', 'groq'] as ProviderId[]) {
      if (sessionStorage.getItem(this.storageKey(p))) {
        this._current.set({ provider: p });
        break; // one primary provider at a time
      }
    }
  }

  getKeyForProvider(provider: ProviderId): string | null {
    return sessionStorage.getItem(this.storageKey(provider));
  }

  setKey(provider: ProviderId, key: string): void {
    sessionStorage.setItem(this.storageKey(provider), key);
    this._current.set({ provider });
  }

  clearKey(provider: ProviderId): void {
    sessionStorage.removeItem(this.storageKey(provider));
    if (this._current().provider === provider) {
      this._current.set({ provider: null });
    }
  }

  private storageKey(p: ProviderId): string {
    return `byo-key:${p}`;
  }
}
```

### `src/infrastructure/logger/logger.service.ts` — extend with redaction registry

```ts
import { Injectable } from '@angular/core';
import { PROVIDER_REGISTRY } from '@infrastructure/providers/provider.registry';
import type { ProviderId } from '@config/provider-registry';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly patterns: Array<{ providerId: ProviderId; regex: RegExp }>;

  constructor() {
    this.patterns = Array.from(PROVIDER_REGISTRY.entries()).map(([id, cls]) => ({
      providerId: id,
      regex: new RegExp(cls.KEY_PATTERN.source, cls.KEY_PATTERN.flags.includes('g') ? cls.KEY_PATTERN.flags : cls.KEY_PATTERN.flags + 'g'),
    }));
  }

  private scrub(text: string): string {
    let out = text;
    for (const { providerId, regex } of this.patterns) {
      out = out.replace(regex, `[REDACTED-${providerId}-KEY]`);
    }
    return out;
  }

  private scrubArg(a: unknown): unknown {
    if (typeof a === 'string') return this.scrub(a);
    if (a && typeof a === 'object') {
      try { return JSON.parse(this.scrub(JSON.stringify(a))); } catch { return a; }
    }
    return a;
  }

  info(msg: string, ...args: unknown[]): void {
    if (this.dev) console.info(this.scrub(msg), ...args.map((a) => this.scrubArg(a)));
  }
  warn(msg: string, ...args: unknown[]): void {
    if (this.dev) console.warn(this.scrub(msg), ...args.map((a) => this.scrubArg(a)));
  }
  error(msg: string, ...args: unknown[]): void {
    console.error(this.scrub(msg), ...args.map((a) => this.scrubArg(a)));
  }

  private get dev(): boolean { return !this.isProduction(); }
  private isProduction(): boolean { return false; /* wire to env */ }
}
```

### `src/infrastructure/analytics/vercel.adapter.ts` — extend with redaction

```ts
@Injectable()
export class VercelAnalyticsAdapter implements AnalyticsPort {
  private readonly patterns: RegExp[];
  constructor(private logger: LoggerService) {
    this.patterns = Array.from(PROVIDER_REGISTRY.values()).map(
      (cls) => new RegExp(cls.KEY_PATTERN.source, 'g')
    );
  }

  emit(event: AnalyticsEvent): void {
    const scrubbed = this.scrubPayload(event);
    // Real Vercel Analytics beacon (E11 verifies production):
    // navigator.sendBeacon('/_vercel/insights/event', JSON.stringify(scrubbed)) with fetch-keepalive fallback
    this.logger.info(`[analytics] ${event.name}`, scrubbed.payload);
  }

  private scrubPayload(event: AnalyticsEvent): AnalyticsEvent {
    const s = JSON.stringify(event);
    let out = s;
    for (const rx of this.patterns) out = out.replace(rx, '[REDACTED-KEY]');
    return JSON.parse(out) as AnalyticsEvent;
  }
}
```

### `ProviderPortAdapterClass` (from E0-S2) — verify constraint

E0-S2 already declared `ProviderPortAdapterClass` with `readonly PROVIDER_ID` + `readonly KEY_PATTERN`. Verify `PROVIDER_REGISTRY.values()` is typed as `ProviderPortAdapterClass` so `.KEY_PATTERN` access is compile-checked.

## Architecture Compliance

- **AD-6:** sessionStorage confined to `KeyVaultService` + `IdbKeyvalStorageAdapter`. ESLint enforces.
- **AD-11:** structural coupling — redaction registry built at construction from `PROVIDER_REGISTRY.entries()`; adding a provider without KEY_PATTERN fails TS compile via `ProviderPortAdapterClass` constraint.
- **FR-17:** superseded per AD-11 — this story realizes the client-side isolation.

## Library / Framework Requirements

No new packages.

## File Structure Requirements

```
src/domain/key-vault/key-vault.service.ts         # NEW (formalizes E2-S3 stub)
src/infrastructure/logger/logger.service.ts       # UPDATE — redaction registry
src/infrastructure/analytics/vercel.adapter.ts    # UPDATE — redaction registry
src/domain/ports/provider.port.ts                 # VERIFY — ProviderPortAdapterClass constraint
```

## Testing Requirements

- `key-vault.service.spec.ts`: setKey → getKeyForProvider returns same value; clearKey wipes; `currentKey$` signal updates reactively.
- `logger.service.spec.ts`: `logger.error("Key: AIzaSyDaGmWKa4JsXZ-HjGw7ISLan_Ps6U0uAisM")` → console output `"Key: [REDACTED-gemini-KEY]"`; same for Groq key format.
- `vercel.adapter.spec.ts`: `emit({name:'moderation_blocked', payload:{category:'AIzaSy...key-like'}})` → the payload string is scrubbed to `[REDACTED-KEY]` before log/beacon.
- Compile-fail test: create a temp `class FakeAdapter implements ProviderPort {}` without `static KEY_PATTERN`; try to add to `PROVIDER_REGISTRY as Map<ProviderId, ProviderPortAdapterClass>`; expect `tsc --noEmit` to fail. Use `// @ts-expect-error` in a spec file to assert the compile error.
- Manual smoke: paste real Gemini key → send message → check DevTools Console + Network tab — no raw key in analytics beacon body.

## Latest Tech Information

- `sessionStorage` clears on tab close per browser spec (baseline browsers).
- `Array.from(Map.entries())` — TS-safe iteration over the registry.
- `RegExp` global flag needed for `.replace(rx, ...)` to catch multiple occurrences.

## Previous Story Intelligence

**E2-S3 (ChatOrchestrator):**
- `KeyVaultService` stub with `getKeyForProvider(provider)` reading sessionStorage. This story replaces with the formal service + `currentKey$` signal (E6-S3 uses it).

**E2-S1 (Provider adapters):**
- `GeminiAdapter.KEY_PATTERN` + `GroqAdapter.KEY_PATTERN` — read at construction of LoggerService + VercelAnalyticsAdapter.

**E0-S2 (Ports):**
- `ProviderPortAdapterClass` constrains adapter classes to expose statics.

**E0-S3 (Config):**
- `ProviderId` type available.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-6` (sessionStorage confinement, lines 106–114), `AD-11` (BYO-Key isolation + structural coupling, lines 167–175).
- Sprint status: key `e6-s1-key-vault-and-redaction-registry`, blocks `[e6-s2]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-11] Redaction registry structurally coupled to PROVIDER_REGISTRY; TS-level enforcement.
- [Source: ARCHITECTURE-SPINE.md#AD-6] sessionStorage confined to KeyVaultService + IdbKeyvalStorageAdapter.

## Story Completion Status

- [ ] `KeyVaultService` with `getKeyForProvider`/`setKey`/`clearKey`/`currentKey$` reactive signal.
- [ ] `LoggerService` extended: redaction registry built from `PROVIDER_REGISTRY.entries()`; `info`/`warn`/`error` scrub string args + object arg JSON stringify+scrub+parse.
- [ ] `VercelAnalyticsAdapter` extended: payload JSON-stringify+scrub+parse before beacon/log.
- [ ] `ProviderPortAdapterClass` constraint on `PROVIDER_REGISTRY.values()` — compile-fail test for missing KEY_PATTERN.
- [ ] Manual smoke: raw key never appears in log or analytics beacon body.
