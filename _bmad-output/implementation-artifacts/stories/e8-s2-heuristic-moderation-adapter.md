# Story E8-S2: HeuristicModerationAdapter (input + output) + retry-once-then-refusal

Status: ready-for-dev

- **Epic:** 8 — In-Character Safety & Refusals
- **Critical-path position:** 26 of 37 (Day 5 evening)
- **Blocks:** E9-S2, E10-S1
- **Depends on:** E0-S2, E2-S3

## Story

As a **cohort grader**,
I want **the app to catch obvious jailbreak/off-domain/hate inputs BEFORE they reach the LLM, and to double-check the LLM's output before showing it to me, retrying once if the output is flagged**,
So that **layered defense per AD-12 catches attacks the persona prompt might miss + user never sees a flagged completion**.

## Acceptance Criteria

**Given** the ModerationPort interface from Epic 0 + the moderation-adapter skeleton from Epic 2 (which returned `{allowed: true}` unconditionally),
**When** the developer authors the full `src/infrastructure/moderation/heuristic.adapter.ts` implementing `ModerationPort.check(text, direction: 'input' | 'output'): Promise<ModerationVerdict>`,
**Then** the adapter runs (a) a regex denylist for jailbreak patterns (`/ignore\s+(all\s+)?(previous\s+)?instructions/i`, `/you\s+are\s+now\s+DAN/i`, `/pretend\s+you\s+have\s+no\s+filters/i`, plus base64-signature checks); (b) a keyword denylist for adult / hate / self-harm categories; (c) a length + structure check that flags suspiciously long messages (> 8k chars) or heavy repetition. Returns `{allowed: boolean, category?: 'jailbreak' | 'off_domain' | 'adult' | 'political' | 'hate' | 'self_harm', suggested_refusal?: string}` per AD-12.

**Given** the adapter is drafted,
**When** the ChatOrchestrator (from E2-S3) calls `moderationPort.check(userText, 'input')` before every Solo / Ask-Both send with a fresh user message,
**Then** IF `verdict.allowed === false`, the orchestrator does NOT call the provider — it renders an in-character deflection bubble by looking up the appropriate template on `PERSONA_REGISTRY[activePersona()].prompt` (matching `verdict.category` to a template — e.g. `'off_domain'` → `offDomainTemplate`, `'jailbreak'` → `promptInjectionTemplate`, `'adult'` → `adultTemplate`, `'political'` → `politicalTemplate`) OR falls back to `verdict.suggested_refusal` from the adapter if the category doesn't map to a persona template; emits `moderation_blocked` analytics event with `{direction: 'input', category}` per AD-15.

**Given** the input check exempts `'summarize'` and drift-refresh modes per AD-12,
**When** the orchestrator invokes moderation only for `mode ∈ {'solo', 'ask-both-a', 'ask-both-b', 'ask-both-keep-going'}` with a fresh user message,
**Then** the ContextManager's summary-generation call (Epic 5) skips input moderation (its input is already-moderated prior history).

**Given** the orchestrator has completed streaming an assistant response,
**When** the orchestrator calls `moderationPort.check(accumulatedResponseText, 'output')`,
**Then** IF `verdict.allowed === false`, the streamed content is discarded from the UI (bubble emptied); the orchestrator retries the provider call ONCE with the same prompt; on the SECOND completion, if output STILL flags, the bubble is replaced with the canned in-character refusal from Addendum §E (matching the category via persona template) per AD-12 + FR-24 preserved semantics; emits `moderation_blocked` analytics event with `{direction: 'output', category}` per AD-15.

**Given** the retry-once-then-refuse UX per EXPERIENCE.md.State Patterns.Moderation blocked (output direction),
**When** the user observes,
**Then** they see: streaming bubble → brief empty state → refusal bubble. The retry is invisible; the user does not see a "retrying" toast per EXPERIENCE.md.

**Given** the future architecture adds a BE,
**When** a `RemoteModerationAdapter` implements the same `ModerationPort`,
**Then** no domain code changes — Angular DI swaps the concrete implementation per AD-2 + AD-12.

**Given** the `FEATURE_MODERATION` flag from Epic 10 is `false`,
**When** the app starts,
**Then** the `HeuristicModerationAdapter` becomes a `NoOpModerationAdapter` (always `{allowed: true}`) — enforced via Angular DI conditional wiring in `app.config.ts`.

**verifies:** FR-24 (mechanism changed per AD-12; requirement preserved — input AND output moderation), AD-12 (ModerationPort layered defense + retry-once-then-refusal per output flag), AD-15 (moderation_blocked typed event with direction + category)

**touches:** `src/infrastructure/moderation/heuristic.adapter.ts` (full implementation), `src/domain/chat/chat-orchestrator.service.ts` (extend input moderation call + output moderation retry-once-then-refuse logic), `src/personas/hitesh.prompt.ts` (add category-specific template exports if not already covered from E8-S1 — offDomainTemplate, politicalTemplate, adultTemplate, promptInjectionTemplate, etc.), `src/personas/piyush.prompt.ts` (analogous), `src/personas/persona.registry.ts` (extend PromptComposition shape with category-template lookup or map field)

**test target:** unit test (adapter check returns `{allowed: false, category: 'jailbreak'}` for a known jailbreak string; orchestrator handles input-flag by rendering the persona template + emitting moderation_blocked; output-flag retry-once path: mock adapter that returns allowed=false twice, verify the canned refusal renders + exactly one moderation_blocked event emits for the terminal-flag case) + e2e test (paste "ignore all previous instructions" in the chat input, verify in-character deflection appears + no LLM call was made — inspect network tab)

## Developer Context

Replaces the E2-S3 stub `HeuristicModerationAdapter` with the real regex + keyword + length checks. Also wires the E2-S3 orchestrator retry-once-then-refuse output path (which was stubbed with `checkOutputWithRetry` returning `accumulated`).

**Category templates already populated in E8-S1** — this story just needs the category→template mapping.

## Technical Requirements

### `heuristic.adapter.ts` — full implementation

```ts
@Injectable()
export class HeuristicModerationAdapter implements ModerationPort {
  private readonly jailbreakPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous\s+)?instructions/i,
    /you\s+are\s+now\s+DAN/i,
    /pretend\s+you\s+have\s+no\s+filters/i,
    /(disregard|bypass|forget)\s+your\s+(system|initial)\s+(prompt|instructions)/i,
    /developer\s+mode\s+(enabled|on)/i,
    /^(base64|b64)[:\s]/i,
  ];

  private readonly adultKeywords = ['[explicit-adult-keyword-1]', '[explicit-adult-keyword-2]']; // placeholder — populate cautiously
  private readonly hateKeywords = ['[hate-keyword-1]']; // placeholder — populate carefully with cohort review
  private readonly selfHarmKeywords = ['suicide', 'self-harm', 'kill myself']; // basic starter set
  private readonly politicalKeywords = ['modi', 'rahul gandhi', 'election', 'bjp', 'congress']; // starter — refine per FR-22

  async check(text: string, direction: 'input' | 'output'): Promise<ModerationVerdict> {
    const lower = text.toLowerCase();

    // Length + structure
    if (text.length > 8000) return { allowed: false, category: 'off_domain', suggested_refusal: 'Text too long.' };
    if (this.hasHeavyRepetition(text)) return { allowed: false, category: 'off_domain', suggested_refusal: 'Repetitive content flagged.' };

    // Jailbreak (highest priority for input; less relevant for output)
    if (direction === 'input') {
      for (const p of this.jailbreakPatterns) {
        if (p.test(text)) return { allowed: false, category: 'jailbreak' };
      }
    }

    // Categorical keyword denylist
    if (this.adultKeywords.some((k) => lower.includes(k))) return { allowed: false, category: 'adult' };
    if (this.hateKeywords.some((k) => lower.includes(k))) return { allowed: false, category: 'hate' };
    if (this.selfHarmKeywords.some((k) => lower.includes(k))) return { allowed: false, category: 'self_harm' };
    if (this.politicalKeywords.some((k) => lower.includes(k))) return { allowed: false, category: 'political' };

    return { allowed: true };
  }

  private hasHeavyRepetition(text: string): boolean {
    // Detect if a single 4-char substring repeats >20 times (spam pattern)
    for (let i = 0; i < text.length - 4; i++) {
      const chunk = text.slice(i, i + 4);
      const count = (text.match(new RegExp(chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
      if (count > 20) return true;
    }
    return false;
  }
}
```

**Note:** the exact denylist keywords are sensitive — start with the safest possible starter set (self-harm keywords are the clearest), let cohort feedback tune. Overly aggressive filtering worsens UX; under-aggressive misses attacks.

### `chat-orchestrator.service.ts` — real retry-once output path

```ts
private async checkOutputWithRetry(persona, prompt, key, firstResult, adapter): Promise<string> {
  const verdict1 = await this.moderation.check(firstResult, 'output');
  if (verdict1.allowed) return firstResult;

  // Retry once
  let retryAccum = '';
  const ctrl = new AbortController();
  try {
    for await (const chunk of adapter.streamChat(prompt, key, ctrl.signal)) {
      if (chunk.type === 'delta' && chunk.text) retryAccum += chunk.text;
      else if (chunk.type === 'done') break;
      else if (chunk.type === 'error') break;
    }
  } catch { /* ignore */ }

  const verdict2 = await this.moderation.check(retryAccum, 'output');
  if (verdict2.allowed) return retryAccum;

  // Both flagged — substitute canned refusal
  const template = this.pickRefusalTemplate(persona, verdict2.category, verdict2.suggested_refusal);
  this.analytics.emit({ name: 'moderation_blocked', payload: { direction: 'output', category: verdict2.category } });
  return template;
}
```

### `pickRefusalTemplate` extension — category mapping

E2-S3 sketched this; extend to full category coverage:

```ts
private pickRefusalTemplate(persona: PersonaId, category?: ModerationCategory, suggested?: string): string {
  const p = PERSONA_REGISTRY[persona].prompt;
  switch (category) {
    case 'jailbreak': return p.promptInjectionTemplate;
    case 'off_domain': return p.offDomainTemplate;
    case 'adult': return p.adultTemplate;
    case 'political': return p.politicalTemplate;
    case 'hate': return p.offDomainTemplate; // fallback
    case 'self_harm': return p.offDomainTemplate; // fallback — cohort review before shipping a specific template
    default: return suggested ?? p.offDomainTemplate;
  }
}
```

### `no-op.adapter.ts` for FEATURE_MODERATION=false

```ts
@Injectable()
export class NoOpModerationAdapter implements ModerationPort {
  async check(): Promise<ModerationVerdict> { return { allowed: true }; }
}
```

`app.config.ts` conditional wiring — E10-S1 lands the flag-driven DI swap. Placeholder here:
```ts
{ provide: MODERATION_PORT, useClass: FEATURE_MODERATION ? HeuristicModerationAdapter : NoOpModerationAdapter }
```

## Architecture Compliance

- **AD-2:** ModerationPort → adapter DI swap on flag.
- **AD-12:** input + output moderation; retry-once-then-refuse; summarize + drift-refresh exempt from input check.
- **AD-15:** `moderation_blocked` typed event with direction + category.
- **FR-24:** semantics preserved (input AND output moderation) even though mechanism moved server→client.

## File Structure Requirements

```
src/infrastructure/moderation/heuristic.adapter.ts    # UPDATE — real impl
src/infrastructure/moderation/no-op.adapter.ts        # NEW
src/domain/chat/chat-orchestrator.service.ts          # UPDATE — real retry-once output check
```

## Testing Requirements

- Adapter spec: `"ignore all previous instructions"` → `{allowed:false, category:'jailbreak'}`; benign text → `{allowed:true}`; text > 8000 → `{allowed:false, category:'off_domain'}`.
- Orchestrator spec: input-flag path renders template + no adapter call + moderation_blocked event; output-flag path with mock adapter that flags twice → canned refusal + one moderation_blocked event.
- E2E: paste "ignore all previous instructions" → in-character deflection.

## Latest Tech Information

- Heuristic moderation is imperfect — server-side OpenAI Moderation API would be strictly better. Deferred per AD-1 Pure-FE.
- Keyword lists should be cohort-reviewed before shipping — avoid overreach.

## Previous Story Intelligence

**E8-S1:**
- All category templates populated on persona.

**E2-S3:**
- Stub adapter always allowed=true. Orchestrator's `checkOutputWithRetry` stub returned `accumulated` unchanged. This story replaces both.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-12` (layered defense, lines 177–187), `AD-15` (moderation_blocked event, lines 221–244).
- EXPERIENCE.md State Patterns "Moderation blocked (input/output)" (lines 107–108).
- Sprint status: key `e8-s2-heuristic-moderation-adapter`, blocks `[e9-s2, e10-s1]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-12] Layered defense + retry-once + summarize exempt.
- [Source: EXPERIENCE.md#State Patterns] User-visible flow of moderation-block.

## Story Completion Status

- [ ] `HeuristicModerationAdapter` full implementation with jailbreak regex + category keyword denylists + length/structure checks.
- [ ] `NoOpModerationAdapter` for feature-flag-off path.
- [ ] Orchestrator real retry-once-then-refuse output path.
- [ ] `pickRefusalTemplate` covers all categories.
- [ ] Spec tests + e2e.
