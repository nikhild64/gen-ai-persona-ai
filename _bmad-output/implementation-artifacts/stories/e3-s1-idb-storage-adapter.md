# Story E3-S1: IdbKeyvalStorageAdapter + persistence integration

Status: ready-for-dev

- **Epic:** 3 — Chat History (Session-Persistent)
- **Critical-path position:** 10 of 37 (Day 3 morning)
- **Blocks:** E3-S2, E4-S1, E5-S2, E9-S1
- **Depends on:** E0-S2, E0-S3, E2-S4

## Story

As a **cohort grader**,
I want **my chat with Hitesh (or Piyush, or Ask-Both) to survive a page reload or a close-and-reopen of the tab**,
So that **I can walk away, come back an hour later, and continue evaluating without losing the conversation**.

## Acceptance Criteria

**Given** the `StoragePort` interface from Epic 0,
**When** the developer authors `src/infrastructure/storage/idb-keyval.adapter.ts`,
**Then** it implements `StoragePort` with `get<T>(key: StorageKey): Promise<T | undefined>`, `set<T>(key: StorageKey, value: T): Promise<void>`, `delete(key: StorageKey): Promise<void>` — each method wrapping `idb-keyval`'s `get`, `set`, `del` functions. Only this file (and Epic 6's `KeyVaultService`) references browser `IndexedDB` / `localStorage` / `sessionStorage` / `caches` / `document.cookie` per AD-6 + E0-S4's ESLint `no-restricted-globals` rule.

**Given** the adapter is drafted,
**When** the developer wires it into Angular DI as the concrete implementation of `StoragePort` (`{ provide: STORAGE_PORT, useClass: IdbKeyvalStorageAdapter }`),
**Then** `ChatOrchestrator.appendMessage` / `ChatOrchestrator.updateThread` (from Epic 2 story E2-S3, which used an in-memory Map stub) transparently persist to IndexedDB — no orchestrator code changes required.

**Given** the adapter persists a Thread,
**When** the payload is inspected in DevTools > Application > IndexedDB > `keyval-store` > `chat:hitesh:v1`,
**Then** the value matches `type Thread = {id, scope: 'hitesh', messages: Message[], rollingSummary: string | null, turnsSinceLastSummary: number, createdAt, updatedAt}` per AD-10 — no drift from the canonical shape; IDs are `crypto.randomUUID()` strings; timestamps are epoch milliseconds.

**Given** a Thread with 100 messages is persisted,
**When** the app is reloaded and `StoragePort.get<Thread>('chat:hitesh:v1')` is called on cold-cache mount,
**Then** the get resolves within 500ms median per AD-21's restore-perf target (measured via `performance.now()` around the `get` call in a manual timing test on a mid-range laptop — no assertion in unit test since IndexedDB perf varies by device, but a `docs/performance.md` note captures the observation).

**Given** any Storage-adjacent code exists outside `idb-keyval.adapter.ts` and (later) `key-vault.service.ts`,
**When** the developer runs `npm run lint`,
**Then** ESLint `no-restricted-globals` from E0-S4 catches `localStorage.setItem(...)`, `sessionStorage.getItem(...)`, `caches.open(...)`, `indexedDB.open(...)`, `document.cookie` references outside the two allowed files and fails.

**Given** a future schema change is needed (e.g., adding a field to Thread),
**When** the developer bumps the storage key version (e.g., `chat:hitesh:v1` → `chat:hitesh:v2`),
**Then** the change requires (a) updating the `StorageKey` union in `src/config/storage-keys.ts`, (b) updating the AD-6 documentation, (c) writing a migration path in the same PR — enforced by the AD-6 discipline (code review, not lint).

**verifies:** AD-6 (StoragePort single-writer discipline + closed StorageKey union), AD-10 (Thread shape invariants persisted), AD-21 (restore-perf target of ≤ 500ms median on 100-message thread), FR-14 (session-persistent chat threads)

**touches:** `src/infrastructure/storage/idb-keyval.adapter.ts`, `src/app/app.config.ts` (Angular DI wiring: `{ provide: STORAGE_PORT, useClass: IdbKeyvalStorageAdapter }`), `src/domain/chat/chat-thread.service.ts` (drop the in-memory Map stub from Epic 2, delegate to StoragePort)

**test target:** unit test (mock idb-keyval; `set` then `get` returns the same object; `delete` clears it; verify no `localStorage`/`sessionStorage`/`caches`/`indexedDB` references outside this file via `npm run lint`) + manual smoke test (send 3 messages, reload page, verify messages restored; 100-message thread restores within 500ms observed in DevTools performance profile)

## Developer Context

The DI swap that makes chat history real. The orchestrator wrote to a `Map<StorageKey, unknown>` stub in E2-S3; now it transparently writes to IndexedDB. **Zero orchestrator code changes** — the whole beauty of the port/adapter pattern.

**Sole IndexedDB touch point:** this adapter is one of TWO files in the entire codebase that touches browser storage APIs (the other is `KeyVaultService` from E6-S1). ESLint from E0-S4 enforces via `no-restricted-globals`.

## Technical Requirements

### `src/infrastructure/storage/idb-keyval.adapter.ts`

```ts
import { Injectable } from '@angular/core';
import { get, set, del } from 'idb-keyval';
import type { StoragePort } from '@domain/ports/storage.port';
import type { StorageKey } from '@config/storage-keys';

@Injectable()
export class IdbKeyvalStorageAdapter implements StoragePort {
  async get<T>(key: StorageKey): Promise<T | undefined> {
    return get<T>(key);
  }
  async set<T>(key: StorageKey, value: T): Promise<void> {
    await set(key, value);
  }
  async delete(key: StorageKey): Promise<void> {
    await del(key);
  }
}
```

That is intentionally the whole file. `idb-keyval` handles the IndexedDB session/transaction management; wrapping it in a class just satisfies the port shape + DI.

### `src/app/app.config.ts` — swap the stub

```ts
import { STORAGE_PORT } from '@domain/chat/di-tokens';
import { IdbKeyvalStorageAdapter } from '@infrastructure/storage/idb-keyval.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: STORAGE_PORT, useClass: IdbKeyvalStorageAdapter }, // was: InMemoryStorageAdapter (E2-S3)
    // ...MODERATION_PORT, ANALYTICS_PORT unchanged
  ],
};
```

### `src/domain/chat/chat-thread.service.ts` — remove the in-memory stub

The `InMemoryStorageAdapter` class from E2-S3 can be moved to `src/domain/chat/testing/in-memory-storage.adapter.ts` for test reuse (spec tests still need a fast in-memory storage). Or deleted if not needed. The E2-S3 spec tests should already use TestBed to inject `InMemoryStorageAdapter` — those tests keep working.

## Architecture Compliance

- **AD-6:** single-writer discipline. `IdbKeyvalStorageAdapter` is the SOLE writer to IndexedDB in the app. `KeyVaultService` (E6-S1) is the other exempt file for sessionStorage. ESLint `no-restricted-globals` catches all others.
- **AD-10:** the adapter persists whatever shape it's given; the CONSUMER (ChatOrchestrator, ContextManager) ensures Thread shape conforms. No validation in the adapter — pure passthrough.
- **AD-21:** 500ms median restore target on 100-message thread. Not a unit-testable assertion (IndexedDB perf varies); a manual timing note in `docs/performance.md`.
- **FR-14:** session-persistent chat threads — this story realizes it.

## Library / Framework Requirements

`idb-keyval@^6` was installed in E0-S1. No new packages.

## File Structure Requirements

```
src/infrastructure/storage/
  idb-keyval.adapter.ts             # NEW
src/app/app.config.ts               # UPDATE — swap DI
src/domain/chat/testing/
  in-memory-storage.adapter.ts      # MOVED from chat-thread.service.ts (spec test reuse)
```

## Testing Requirements

- `src/infrastructure/storage/idb-keyval.adapter.spec.ts`:
  - Mock `idb-keyval` (Karma+Jasmine `spyOn` or explicit mock module).
  - `set('chat:hitesh:v1', {id:'x',scope:'hitesh',...})` then `get('chat:hitesh:v1')` returns the same object shape.
  - `delete('chat:hitesh:v1')` clears; subsequent `get` returns `undefined`.
  - Type-check: `get<Thread>('chat:hitesh:v1')` returns `Promise<Thread | undefined>` (TS narrows correctly).
- **Lint verification:** temporarily add `localStorage.setItem('x','y')` to `src/features/chat/chat.component.ts`, run `npm run lint`, confirm failure (from E0-S4 `no-restricted-globals`); delete the line.
- **Manual smoke:**
  1. Open `localhost:4200/chat/hitesh`. Type a message, wait for stream to complete.
  2. Open DevTools → Application → IndexedDB → `keyval-store` (idb-keyval default) → verify `chat:hitesh:v1` key exists with expected Thread shape.
  3. Reload the page. Verify prior messages restore.
  4. 100-message thread perf: script the orchestrator to append 100 messages (Karma test or dev-only helper), reload, use Performance profile to measure the `IdbKeyvalStorageAdapter.get` call — should be < 500ms median across 3-5 runs.

## Latest Tech Information

- `idb-keyval` 6.x — <1KB gzip per https://www.npmjs.com/package/idb-keyval — minimal wrapper around IndexedDB.
- Default store: `keyval-store` database, `keyval` object store. All 4 StorageKey values live in this one store.
- `crypto.randomUUID()` for Message IDs — native in all baseline browsers.
- IndexedDB restore perf on 100-message thread depends on serialization size (~5-50KB) — well within `idb-keyval`'s single-transaction get.

## Previous Story Intelligence

**E2-S3 (ChatOrchestrator):**
- `ChatOrchestrator` injects `STORAGE_PORT` via DI token; calls `storage.get<Thread>(key)` and `storage.set<Thread>(key, thread)` — port shape is stable; this story's DI swap doesn't touch orchestrator code.
- `InMemoryStorageAdapter` stub was in `src/domain/chat/chat-thread.service.ts` — MOVE to testing folder for spec reuse.

**E2-S4 (ChatComponent):**
- Component reads Thread from orchestrator's signal chain — no direct StoragePort access. This story's swap is invisible to the UI.

**E0-S3 (Config):**
- `StorageKey` union is closed: `'chat:hitesh:v1' | 'chat:piyush:v1' | 'chat:ask-both:v1' | 'settings:v1'`.

**E0-S2 (Ports):**
- `StoragePort` interface exists.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-6` (StoragePort single-writer discipline, lines 106–114), `AD-10` (Thread shape invariants, lines 157–165), `AD-21` (restore-perf target, lines 288–298).
- Sprint status: key `e3-s1-idb-storage-adapter`, blocks `[e3-s2-start-new-session-modal, e4-s1-persona-switcher-and-routing, e5-s2-rolling-summary-hybrid-trigger, e9-s1-mode-switcher-and-joint-greeting]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-6] Single implementation `IdbKeyvalStorageAdapter` wraps `idb-keyval`.
- [Source: ARCHITECTURE-SPINE.md#AD-21] IdbKeyvalStorageAdapter.get on 100-message thread ≤ 500ms median.
- [Source: prd.md#FR-14] Session-persistent chat threads.
- [Source: sprint-status.yaml#dependency_chain.e3-s1-idb-storage-adapter] `blocked_by: [e0-s2, e0-s3, e2-s4]`; `blocks: [e3-s2, e4-s1, e5-s2, e9-s1]`.

## Story Completion Status

- [ ] `src/infrastructure/storage/idb-keyval.adapter.ts` — `IdbKeyvalStorageAdapter implements StoragePort` wrapping `idb-keyval`'s `get`/`set`/`del`.
- [ ] `src/app/app.config.ts` — `STORAGE_PORT` provider swapped from `InMemoryStorageAdapter` (E2-S3 stub) to `IdbKeyvalStorageAdapter`.
- [ ] In-memory stub moved to `src/domain/chat/testing/in-memory-storage.adapter.ts` for spec reuse (existing E2-S3 spec tests still pass by using the test-injected in-memory version).
- [ ] Adapter spec verifies get/set/delete roundtrip + type narrowing.
- [ ] Lint verification: `localStorage` / `sessionStorage` / `indexedDB` outside the 2 allowed files fails lint.
- [ ] Manual smoke: send message → reload → messages restore.
- [ ] `docs/performance.md` note captures the observed IndexedDB restore perf on a 100-message thread.
