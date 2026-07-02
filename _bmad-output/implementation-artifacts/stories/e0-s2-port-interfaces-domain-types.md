# Story E0-S2: Port interfaces + domain types

Status: ready-for-dev

- **Epic:** 0 — Foundation
- **Critical-path position:** 2 of 37 (Day 1)
- **Blocks:** E0-S3, E2-S1, E2-S2, E3-S1, E8-S2
- **Depends on:** E0-S1

## Story

As a **solo developer**,
I want **the four port interfaces (`ProviderPort`, `StoragePort`, `ModerationPort`, `AnalyticsPort`) plus the core domain types (`Message`, `Thread`, `PersonaId`, `ChatChunk`, `ChatChunkError`, `ChatError`, `PromptMode`, `OutboundPrompt`) authored in `src/domain/ports/` and `src/domain/types/`**,
So that **domain and feature code can compile against interfaces from Day 1, before any concrete adapter exists**.

## Acceptance Criteria

**Given** an empty `src/domain/` folder,
**When** the developer creates `src/domain/ports/provider.port.ts` with `interface ProviderPort { streamChat(request: ChatRequest, key: string, signal: AbortSignal): AsyncIterable<ChatChunk>; }`,
**Then** the interface compiles and can be `import`ed from `src/infrastructure/` (once adapters exist) and from `src/domain/chat/` (once orchestrator exists).

**Given** the port files are drafted,
**When** the developer authors `src/domain/types/message.ts` with the full `Message`, `Thread`, `PersonaId`, `ChatChunk`, `ChatChunkError`, `ChatError` types per AD-4 and AD-10,
**Then** `Message` has `status: 'streaming' | 'complete' | 'cancelled' | 'error'` REQUIRED for `role === 'assistant'` and `Thread.rollingSummary: string | null` and `Thread.turnsSinceLastSummary: number` per AD-10; `ChatChunkError` is a closed union with NO `| string` escape hatch per AD-4.

**Given** the types are drafted,
**When** the developer authors `src/domain/prompts/types.ts` with `type PromptMode = 'solo' | 'ask-both-a' | 'ask-both-b' | 'ask-both-keep-going' | 'summarize'` and `type OutboundPrompt = ChatRequest & { meta: {mode: PromptMode; hasSummary: boolean; hasDriftRefresh: boolean; estimatedTokens: number} }` per AD-8,
**Then** the type union is exhaustively switchable via `assertNever(mode)` default, and adding a mode is a single compile error until updated per AD-8.

**Given** all four ports and all types exist,
**When** the developer runs `tsc --noEmit`,
**Then** compilation succeeds with zero errors and zero `any` types in the port + types files.

**verifies:** AD-2 (ports-and-adapters), AD-3 (ProviderPort SSOT), AD-4 (ChatChunk contract + closed error union), AD-6 (StoragePort interface), AD-8 (PromptMode + OutboundPrompt types), AD-10 (Message/Thread shape), AD-12 (ModerationPort interface), AD-15 (AnalyticsPort interface)

**touches:** `src/domain/ports/provider.port.ts`, `src/domain/ports/storage.port.ts`, `src/domain/ports/moderation.port.ts`, `src/domain/ports/analytics.port.ts`, `src/domain/types/message.ts`, `src/domain/prompts/types.ts`

**test target:** unit test (each type asserts exhaustive-switching via `assertNever` default; each port is `import`ed and dereferenced by a mock class to verify shape)

## Developer Context

This story lands the **interface layer** — the load-bearing shape from AD-2 (Hexagonal ports-and-adapters). No implementations. Every port is a pure `interface`; every type is a pure `type` / `interface` declaration. The rest of the codebase compiles against these; the concrete adapter classes come later (E2-S1 for Gemini/Groq, E3-S1 for IdbKeyval, E6-S1 for KeyVault, E8-S2 for HeuristicModeration).

**Why land all four ports at once?** Cross-cutting compile safety. Once these interfaces exist, downstream stories can write orchestrators (E2-S3), assemblers (E2-S2), and eval scripts (E11-S1) that all reference the same shapes. Type-driven development from Day 1.

**Closed unions matter:** every discriminated union declared here (`ChatChunkError`, `PromptMode`, later `StorageKey`, `AnalyticsEvent`) MUST be closed — no `| string` escape. Adding a variant becomes a compile error at every switch site, which is the design.

## Technical Requirements

### `src/domain/types/message.ts` — the core domain shapes

Per AD-4 + AD-10:

```ts
export type PersonaId = 'hitesh' | 'piyush';

export type PromptMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatRequestParams = {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export type ChatRequest = {
  messages: PromptMessage[];
  model: string;
} & ChatRequestParams;

// AD-4: closed union, NO | string escape hatch
export type ChatChunkError =
  | 'quota_exhausted'
  | 'network_error'
  | 'moderation_blocked'
  | 'aborted'
  | 'auth_failed'
  | 'invalid_request'
  | 'server_error'
  | 'unknown';

export type ChatChunk = {
  type: 'delta' | 'done' | 'error';
  text?: string;
  meta?: {
    tokens?: number;
    model?: string;
    error?: ChatChunkError;
    retryable?: boolean;
    retryAfterSec?: number;
  };
};

// AD Consistency Conventions: mirrors AD-4's closed ChatChunkError union
export type ChatError = {
  kind: ChatChunkError;
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
};

// AD-10: status REQUIRED when role === 'assistant'; ad-hoc booleans banned
export type Message = {
  id: string;                                     // crypto.randomUUID()
  role: 'user' | 'assistant';
  persona?: PersonaId;                            // present on assistant only
  content: string;                                // partial-so-far when cancelled/error
  timestamp: number;                              // epoch ms
  status?: 'streaming' | 'complete' | 'cancelled' | 'error';  // required for assistant
  error?: ChatError;                              // only when status === 'error'
};

// AD-10: canonical Thread persisted shape
export type Thread = {
  id: string;
  scope: PersonaId | 'ask-both';
  messages: Message[];
  rollingSummary: string | null;
  turnsSinceLastSummary: number;
  createdAt: number;
  updatedAt: number;
};
```

### `src/domain/prompts/types.ts` — prompt-composition shapes

Per AD-8:

```ts
import type { ChatRequest } from '../types/message';

export type PromptMode =
  | 'solo'
  | 'ask-both-a'
  | 'ask-both-b'
  | 'ask-both-keep-going'
  | 'summarize';

export type OutboundPrompt = ChatRequest & {
  meta: {
    mode: PromptMode;
    hasSummary: boolean;
    hasDriftRefresh: boolean;
    estimatedTokens: number;
  };
};
```

### The four ports

**`src/domain/ports/provider.port.ts`** (per AD-3):

```ts
import type { ChatRequest, ChatChunk, PersonaId } from '../types/message';

export type ProviderId = 'gemini' | 'groq';

export interface ProviderPort {
  streamChat(
    request: ChatRequest,
    key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk>;
}

// Class-side constraint per AD-11 — adapter CLASSES must expose these statics.
// The redaction registry (LoggerService, VercelAnalyticsAdapter) walks
// PROVIDER_REGISTRY.entries() and reads KEY_PATTERN off each class.
export interface ProviderPortAdapterClass {
  new (): ProviderPort;
  readonly PROVIDER_ID: ProviderId;
  readonly KEY_PATTERN: RegExp;
}
```

**`src/domain/ports/storage.port.ts`** (per AD-6):

```ts
import type { StorageKey } from '../../config/storage-keys'; // lands in E0-S3

export interface StoragePort {
  get<T>(key: StorageKey): Promise<T | undefined>;
  set<T>(key: StorageKey, value: T): Promise<void>;
  delete(key: StorageKey): Promise<void>;
}
```

Note: `StorageKey` is imported from `src/config/storage-keys.ts` — that file lands in E0-S3. This story creates the port with the forward reference; if type-checking fails right now, either (a) land a stub `export type StorageKey = string` in `src/config/storage-keys.ts` here as a placeholder (E0-S3 tightens it) or (b) inline the union in the port declaration and E0-S3 refactors. Prefer (a) — the stub is one line and the ESLint boundary rule doesn't care.

**`src/domain/ports/moderation.port.ts`** (per AD-12):

```ts
export type ModerationCategory =
  | 'jailbreak'
  | 'off_domain'
  | 'adult'
  | 'political'
  | 'hate'
  | 'self_harm';

export type ModerationVerdict = {
  allowed: boolean;
  category?: ModerationCategory;
  suggested_refusal?: string;
};

export interface ModerationPort {
  check(text: string, direction: 'input' | 'output'): Promise<ModerationVerdict>;
}
```

**`src/domain/ports/analytics.port.ts`** (per AD-15):

```ts
import type { PersonaId, ProviderId } from './provider.port';
import type { ChatChunkError } from '../types/message';

// AD-15: discriminated union — adding an arm = compile error at every emitter
export type AnalyticsEvent =
  | { name: 'persona_selected'; payload: { persona: PersonaId } }
  | { name: 'persona_switched'; payload: { from: PersonaId; to: PersonaId } }
  | { name: 'mode_switched'; payload: { from: 'solo' | 'ask-both'; to: 'solo' | 'ask-both' } }
  | { name: 'message_sent'; payload: { persona: PersonaId; mode: 'solo' | 'ask-both'; charCount: number } }
  | { name: 'ask_both_message_sent'; payload: { charCount: number } }
  | { name: 'keep_going_clicked'; payload: Record<string, never> }
  | { name: 'byo_key_saved'; payload: { provider: ProviderId } }
  | { name: 'moderation_blocked'; payload: { direction: 'input' | 'output'; category?: string } }
  | { name: 'persona_regex_miss'; payload: { persona: PersonaId } }
  | { name: 'summary_failed'; payload: { provider: ProviderId; category: ChatChunkError } }
  | { name: 'provider_429_surfaced'; payload: { provider: ProviderId; retryAfterSec?: number } }
  | { name: 'parallel_fallback_triggered'; payload: Record<string, never> }
  | { name: 'stream_stall_detected'; payload: { persona: PersonaId; elapsedMs: number } }
  | { name: 'spike_zero_gemini_cors_result'; payload: { succeeded: boolean; error?: string } };

export interface AnalyticsPort {
  emit(event: AnalyticsEvent): void;
}
```

## Architecture Compliance

**AD-2 (Ports-and-adapters):** ports are pure interfaces. NO third-party imports (no `idb-keyval`, no `fetch`, no Angular DI decorators). Zero `any`. Zero `unknown` cast escapes.

**AD-3 (ProviderPort SSOT):** `ProviderPort` is the single interface every LLM call goes through. `ProviderPortAdapterClass` is the class-side constraint (adapter classes expose `static PROVIDER_ID` + `static KEY_PATTERN`).

**AD-4 (ChatChunk contract):** `ChatChunkError` is a closed union — do NOT add `| string`. Adding a category is an AD update.

**AD-6 (StoragePort):** `StorageKey` union lives in `src/config/storage-keys.ts` (E0-S3). Stub as `type StorageKey = string` here if needed for compile — E0-S3 tightens.

**AD-8 (PromptMode + OutboundPrompt):** `PromptMode` is exhaustively switchable via `assertNever(mode)` default; adding a mode is a compile error until every switch site updates. Verify with a test that has a `switch (mode)` with all five arms and `default: return assertNever(mode)`.

**AD-10 (Message + Thread invariants):** `Message.status` REQUIRED when `role === 'assistant'` — enforce via a factory function `createAssistantMessage(...)` in a later story if you want a runtime guard, or rely on structural typing here. `Thread.rollingSummary` is `string | null` (not `string | undefined`) — this is intentional per AD-10; null means "not yet generated," undefined would be ambiguous.

**AD-12 (ModerationPort):** verdict shape includes `category` (typed union) + `suggested_refusal` (string). Adapters (E8-S2) provide the category-to-persona-template mapping.

**AD-15 (AnalyticsPort):** discriminated union with `name` as discriminator. Every arm has a `payload` field (use `Record<string, never>` for empty-payload arms like `keep_going_clicked` — this keeps `emit({ name: 'keep_going_clicked', payload: {} })` type-safe).

## Library / Framework Requirements

Zero new npm packages this story. Everything is a `.ts` file with `interface` / `type` declarations. If you find yourself reaching for a library here, stop — you're outside the port layer.

## File Structure Requirements

```
src/domain/
  ports/
    provider.port.ts       # ProviderPort + ProviderPortAdapterClass + ProviderId
    storage.port.ts        # StoragePort
    moderation.port.ts     # ModerationPort + ModerationVerdict + ModerationCategory
    analytics.port.ts      # AnalyticsPort + AnalyticsEvent (union)
  types/
    message.ts             # PersonaId + Message + Thread + ChatChunk + ChatChunkError + ChatError + PromptMessage + ChatRequest + ChatRequestParams
    persona.ts             # already lands in E0-S1 — do NOT re-create
  prompts/
    types.ts               # PromptMode + OutboundPrompt
src/config/
  storage-keys.ts          # STUB: export type StorageKey = string;  (tightened in E0-S3)
```

**Do NOT create:** `src/domain/chat/`, `src/domain/context/`, `src/domain/key-vault/` — those services land in Epic 2/5/6.

## Testing Requirements

Karma+Jasmine unit tests under Angular 21 default (Vitest pick lands in E0-S4).

- `src/domain/types/message.spec.ts` — asserts `ChatChunkError` union is exhaustively switchable (a `switch` with all 8 arms + `default: assertNever(...)` compiles); asserts a `Message` with `role: 'assistant'` but no `status` fails a runtime factory guard (if you land the factory) OR is caught by an ESLint custom rule (later — not this story).
- `src/domain/prompts/types.spec.ts` — asserts `PromptMode` exhaustive switch with `assertNever` default.
- `src/domain/ports/*.spec.ts` — each port has a spec that constructs a mock class implementing the interface (e.g., `class MockProvider implements ProviderPort { async *streamChat() { yield { type: 'done' as const, meta: { tokens: 0 } }; } }`); verifies the mock compiles and can be `for await`-iterated.
- `src/domain/ports/analytics.port.spec.ts` — mock `AnalyticsPort` receives one instance of each `AnalyticsEvent` variant; verifies discriminated-union narrowing works (accessing `event.payload.persona` inside the `persona_selected` arm compiles; accessing it inside the `keep_going_clicked` arm does not — `// @ts-expect-error` test).

Zero `any` in port + types files: verify with `tsc --noEmit --strict` (already set up in E0-S1).

## Latest Tech Information

- TypeScript 5.9.x supports `Record<string, never>` as a "definitely empty object" type — use this instead of `{}` for empty payloads (`{}` is TS's "not null/undefined" idiom, which is misleading).
- Discriminated unions with `name` as the discriminator are fully narrowable in TS 5.9 via `switch (event.name) { case 'persona_selected': /* event.payload is { persona: PersonaId } */ }`.
- `AsyncIterable<T>` is native ES2018+; no polyfills needed for Node 22 / Chromium 120+ / Firefox 120+ / Safari 16.4+ per Stack table Browser baseline.

## Previous Story Intelligence

**E0-S1 (Angular 21 + PrimeNG scaffold):**
- `src/domain/types/persona.ts` already exists with `PersonaId = 'hitesh' | 'piyush'` + `assertNever`. This story LEAVES that file alone and creates `src/domain/types/message.ts` alongside it.
- `strict: true` compiler is on; `noImplicitAny` is on. Every type in this story compiles cleanly at those settings.
- Karma+Jasmine is the default runner; Vitest pick is deferred to E0-S4.

## Project Context Reference

- Full source tree: `_bmad-output/planning-artifacts/architecture/architecture-gen-ai-persona-ai-2026-07-02/ARCHITECTURE-SPINE.md` (lines 405–510).
- AD-3 (ProviderPort): same file, lines 78–89.
- AD-4 (ChatChunk contract): lines 90–98.
- AD-6 (StoragePort): lines 106–114.
- AD-8 (PromptMode + OutboundPrompt): lines 122–139.
- AD-10 (Message + Thread shape): lines 157–165.
- AD-12 (ModerationPort): lines 177–187.
- AD-15 (AnalyticsPort + AnalyticsEvent union): lines 221–244.
- Sprint status entry: key `e0-s2-port-interfaces-domain-types`; `blocks: [e0-s3-config-constants-and-registries, e2-s1-provider-adapters-and-registry, e2-s2-prompt-assembler-solo, e3-s1-idb-storage-adapter, e8-s2-heuristic-moderation-adapter]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-2] Hexagonal ports-and-adapters paradigm.
- [Source: ARCHITECTURE-SPINE.md#AD-3] `ProviderPort` interface + `static PROVIDER_ID + KEY_PATTERN` class-side constraint.
- [Source: ARCHITECTURE-SPINE.md#AD-4] `ChatChunk` streaming contract + closed `ChatChunkError` union.
- [Source: ARCHITECTURE-SPINE.md#AD-6] `StoragePort` single-writer discipline + `StorageKey` union (E0-S3 lands the union content).
- [Source: ARCHITECTURE-SPINE.md#AD-8] Nine-step prompt block order + `PromptMode` + `OutboundPrompt`.
- [Source: ARCHITECTURE-SPINE.md#AD-10] `Message` + `Thread` shape invariants.
- [Source: ARCHITECTURE-SPINE.md#AD-11] `ProviderPortAdapterClass` companion interface with `static PROVIDER_ID + KEY_PATTERN`.
- [Source: ARCHITECTURE-SPINE.md#AD-12] `ModerationPort` layered defense (input + output).
- [Source: ARCHITECTURE-SPINE.md#AD-15] Typed `AnalyticsEvent` discriminated union.

## Story Completion Status

- [ ] `src/domain/types/message.ts` exports `PersonaId`, `PromptMessage`, `ChatRequestParams`, `ChatRequest`, `ChatChunkError`, `ChatChunk`, `ChatError`, `Message`, `Thread`.
- [ ] `src/domain/prompts/types.ts` exports `PromptMode` + `OutboundPrompt`.
- [ ] `src/domain/ports/provider.port.ts` exports `ProviderPort`, `ProviderPortAdapterClass`, `ProviderId`.
- [ ] `src/domain/ports/storage.port.ts` exports `StoragePort`.
- [ ] `src/domain/ports/moderation.port.ts` exports `ModerationPort`, `ModerationVerdict`, `ModerationCategory`.
- [ ] `src/domain/ports/analytics.port.ts` exports `AnalyticsPort` + `AnalyticsEvent` union with all 14 arms (E0.5-S1 outcome + persona_selected + persona_switched + mode_switched + message_sent + ask_both_message_sent + keep_going_clicked + byo_key_saved + moderation_blocked + persona_regex_miss + summary_failed + provider_429_surfaced + parallel_fallback_triggered + stream_stall_detected).
- [ ] `src/config/storage-keys.ts` STUB exists with `export type StorageKey = string;` (E0-S3 tightens).
- [ ] Per-file spec tests verify each type's exhaustive switching + each port's mock-class implementability.
- [ ] `tsc --noEmit --strict` passes with zero errors and zero `any` uses in port + type files.
