# Story E7-S1: Max-turn cap enforcement + In-Character cap-refusal

Status: ready-for-dev

- **Epic:** 7 — Client-Side Guardrails
- **Critical-path position:** 23 of 37 (Day 5 afternoon)
- **Blocks:** none
- **Depends on:** E5-S1, E2-S3

## Story

As a **cohort grader running Anjali's UJ-2 flow past turn 40**,
I want **the app to stop me at message 40 with an In-Character offer from Hitesh to start a new session, rather than silently truncating my history**,
So that **I know the boundary exists, I'm not surprised by data loss, and the persona itself frames the transition**.

## Acceptance Criteria

**Given** the ChatOrchestrator from Epic 2 + the turn-counting helpers from Epic 5,
**When** the developer extends `chat-orchestrator.service.ts.sendMessage` with cap-enforcement,
**Then** at send-attempt (before any adapter call), the orchestrator computes `assistantMessageCount(thread) + expectedAssistantMessagesForMode(mode) > MAX_TURNS_PER_THREAD` from `src/config/context-config.ts` per AD-9.

**Given** the cap check fires (the outbound message would push the thread past 40 assistant messages),
**When** the orchestrator handles the cap-exceeded branch,
**Then** it does NOT call the provider — instead, it appends a synthetic assistant Message to the thread with `role: 'assistant'`, `persona: activePersona()`, `status: 'complete'`, `content: PERSONA_REGISTRY[activePersona()].prompt.capRefusalTemplate` (a new field on the persona-prompt export sourced from Addendum §E cap-refusal row: Hitesh `"Yaar ab thread thoda lamba ho gaya — main sochta hun ki hum ek fresh session start karein? Old baatein IndexedDB mein safe hain, but freshness ke liye 'Start new session' pe click karo (settings mein hai)."` and Piyush's analogous template).

**Given** the cap-refusal is rendered,
**When** the user tries to send another message,
**Then** the input area remains disabled per UX-DR states — the send button is inert until the user starts a new session (Epic 3 story E3-S2). A small `caption` `ink-secondary` line below the input reads `"Start a new session to keep chatting."` from `product-copy.ts.capReachedInputHint`.

**Given** the Ask-Both mode is active (Epic 9),
**When** the cap check runs,
**Then** `expectedAssistantMessagesForMode('ask-both-a')` returns 2 (both A + B count toward the cap per AD-9); `expectedAssistantMessagesForMode('ask-both-keep-going')` returns 1 (Keep-going is one additional assistant message on top of the A+B already counted). Verified in unit test.

**Given** the cap is defeatable by clearing browser storage,
**When** the developer documents this accepted trade-off,
**Then** `docs/context-management.md` (Epic 12) includes a note: "The 40-message max-turn cap is enforced client-side per AD-1 (Pure-FE trade-off). Defeatable by clearing browser storage. The cap's primary purpose in Pure FE is user-cost-per-BYO-Key protection, not abuse prevention (abuse is already gated by the user needing to bring their own paid quota)."

**verifies:** FR-21 (max-turn conversation cap — retained per AD-9), AD-9 (MAX_TURNS_PER_THREAD + turn-counting invariants), AD-10 (synthetic message has status: 'complete' + persona field), AD-13 (Ask-Both mode counting: 2 for a+b, 3 with keep-going), AD-22 (cap-refusal copy sourced from PERSONA_REGISTRY, not product-copy.ts — persona voice)

**touches:** `src/domain/chat/chat-orchestrator.service.ts` (add cap-check branch before provider call), `src/personas/hitesh.prompt.ts` (add `capRefusalTemplate: string` export from Addendum §E), `src/personas/piyush.prompt.ts` (add `capRefusalTemplate: string` export from Addendum §E), `src/personas/persona.registry.ts` (extend PromptComposition shape with `capRefusalTemplate` field), `src/features/chat/chat.component.ts` (bind input-area disabled state to a `capReached$` signal from ChatOrchestrator), `src/config/product-copy.ts` (new key: `capReachedInputHint`)

**test target:** unit test (mock a thread with 40 assistant messages, verify sendMessage does not call the provider + renders the cap-refusal template + emits no analytics event related to send; verify Ask-Both cap counting via expectedAssistantMessagesForMode) + e2e test (script a 40-turn conversation via mock provider, verify turn 41 triggers cap-refusal + input disabled)

## Developer Context

Client-side spending guardrail. Prevents runaway threads from burning the user's BYO-Key quota. Persona-voiced boundary — Hitesh (or Piyush) explains via `capRefusalTemplate` sourced from Addendum §E.

**PromptComposition field:** `capRefusalTemplate: string` already declared in E0-S3 (readiness-gap #4). This story POPULATES the value in `hitesh.prompt.ts` + `piyush.prompt.ts`.

**Cap-refusal templates from Addendum §E:**

Hitesh:
> Yaar ab thread thoda lamba ho gaya — main sochta hun ki hum ek fresh session start karein? Old baatein IndexedDB mein safe hain, but freshness ke liye 'Start new session' pe click karo (settings mein hai).

Piyush (analogous — synthesize from Addendum §E style):
> देखो, ये thread अब काफी लंबा हो गया है — एक काम करते हैं, fresh session start करें. पुरानी baatein IndexedDB में safe हैं, but एक clean slate से बात continue करना बेहतर होगा. Settings में 'Start new session' पे click करो।

## Technical Requirements

### Persona prompt population

**`hitesh.prompt.ts`:**
```ts
capRefusalTemplate: "Yaar ab thread thoda lamba ho gaya — main sochta hun ki hum ek fresh session start karein? Old baatein IndexedDB mein safe hain, but freshness ke liye 'Start new session' pe click karo (settings mein hai).",
```

**`piyush.prompt.ts`:**
```ts
capRefusalTemplate: "देखो, ye thread ab kaafi lamba ho gaya hai — एक काम करते हैं, fresh session start करें. पुरानी बातें IndexedDB में safe हैं, but एक clean slate से बात continue करना बेहतर होगा. Settings में 'Start new session' पे click करो।",
```

### `chat-orchestrator.service.ts` extension

```ts
import { assistantMessageCount, expectedAssistantMessagesForMode } from '@domain/context/turn-counting';
import { MAX_TURNS_PER_THREAD } from '@config/context-config';

readonly capReached$: WritableSignal<boolean> = signal(false);

private async dispatch(persona: PersonaId, text: string, sub): Promise<void> {
  // ...moderation input check first

  const thread = await this.getOrCreateThread(persona);
  const mode: PromptMode = 'solo';
  if (assistantMessageCount(thread) + expectedAssistantMessagesForMode(mode) > MAX_TURNS_PER_THREAD) {
    // Cap exceeded
    const capMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      persona,
      content: PERSONA_REGISTRY[persona].prompt.capRefusalTemplate,
      timestamp: Date.now(),
      status: 'complete',
    };
    thread.messages.push(capMsg);
    thread.updatedAt = Date.now();
    await this.storage.set(this.threadKeyFor(persona), thread);
    this.capReached$.set(true);
    sub.complete();
    return;
  }
  // ...rest of dispatch
}
```

### `chat.component.ts` — bind input disabled

```ts
readonly inputDisabled = computed(() =>
  this.orchestrator.inFlightStream$() || this.orchestrator.capReached$()
);
readonly capReachedHint = computed(() =>
  this.orchestrator.capReached$() ? copy.capReachedInputHint : ''
);
```

Template:
```html
<textarea [disabled]="inputDisabled()"></textarea>
<button [disabled]="inputDisabled()">{{sendButtonLabel}}</button>
<span class="caption ink-secondary" *ngIf="capReachedHint()">{{capReachedHint()}}</span>
```

### `product-copy.ts`:
```ts
export const capReachedInputHint = 'Start a new session to keep chatting.';
```

## Architecture Compliance

- **AD-9:** `MAX_TURNS_PER_THREAD = 40`; cap check at send-attempt; `assistantMessageCount + expectedAssistantMessagesForMode > MAX`.
- **AD-10:** synthetic message has `status: 'complete'` + `persona`.
- **AD-13:** Ask-Both mode counts: 2 for `ask-both-a`, 1 for `ask-both-keep-going` (via `expectedAssistantMessagesForMode`).
- **AD-22:** `capRefusalTemplate` in persona registry (persona voice), not product-copy.

## File Structure Requirements

```
src/domain/chat/chat-orchestrator.service.ts    # UPDATE — cap-check branch + capReached$ signal
src/personas/hitesh.prompt.ts                    # POPULATE capRefusalTemplate
src/personas/piyush.prompt.ts                    # POPULATE capRefusalTemplate
src/features/chat/chat.component.ts / .html      # WIRE inputDisabled + capReachedHint
src/config/product-copy.ts                       # EXTEND capReachedInputHint
```

## Testing Requirements

- Orchestrator spec: thread with 40 assistant messages → sendMessage returns without calling adapter; synthetic Message appended; `capReached$` true.
- Turn counting spec (E5-S1): `expectedAssistantMessagesForMode('ask-both-a') === 2`; `'ask-both-keep-going' === 1`.
- E2E: script 40 turns via mock adapter; verify turn 41 shows cap-refusal + input disabled; click Start-new-session → resets.

## Latest Tech Information

- Cap defeatable by user clearing IndexedDB — accepted per AD-1 Pure-FE.

## Previous Story Intelligence

**E5-S1 (Turn counting):**
- Canonical helpers.

**E2-S3 (Orchestrator):**
- Base dispatch flow; this story adds the cap-check branch BEFORE provider call.

**E0-S3 (Config):**
- `MAX_TURNS_PER_THREAD = 40`; `PromptComposition.capRefusalTemplate` declared upfront.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-9` (cap enforcement + expectedAssistantMessagesForMode, lines 141–155), `AD-13` (Ask-Both counting, lines 189–208).
- Addendum §E Hitesh row 6 "Max-turn cap" (implicit from cap-refusal row pattern).
- Sprint status: key `e7-s1-max-turn-cap-refusal`, blocks `[]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-9] `MAX_TURNS_PER_THREAD = 40` + turn counting.
- [Source: prd.md#FR-21] Max-turn conversation cap.
- [Source: addendum.md#E.1] Hitesh cap-refusal row.

## Story Completion Status

- [ ] Orchestrator adds cap-check branch before provider call.
- [ ] `capReached$` signal exposed.
- [ ] Hitesh + Piyush `capRefusalTemplate` populated.
- [ ] Chat input disables + shows hint when cap reached.
- [ ] Ask-Both mode counting verified (E9-S2 will exercise real Ask-Both path).
- [ ] Docs note for E12-S2 `context-management.md` about client-side cap trade-off.
