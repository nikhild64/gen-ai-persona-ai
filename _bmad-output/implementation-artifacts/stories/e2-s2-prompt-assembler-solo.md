# Story E2-S2: PromptAssembler with 9-block order for `mode: 'solo'`

Status: ready-for-dev

- **Epic:** 2 — Persona-Faithful Chat Engine (Solo)
- **Critical-path position:** 7 of 37 (Day 2)
- **Blocks:** E2-S3, E5-S3, E9-S2, E12-S2
- **Depends on:** E0-S3, E0-S4

## Story

As a **solo developer**,
I want **`PromptAssembler.compose(persona, thread, mode, options?)` returning an `OutboundPrompt` that assembles the 9-block prompt in the exact order AD-8 specifies**,
So that **every outbound LLM call — Solo chat, Ask-Both (later), Rolling Summary (later), Drift Refresh (later) — goes through one composer and no inline prompt strings can leak into feature code**.

## Acceptance Criteria

**Given** the persona registry from Epic 0 is populated,
**When** the developer authors `src/domain/prompts/prompt-assembler.service.ts`,
**Then** it exports a class `PromptAssembler` with `compose(persona: PersonaId, thread: Thread, mode: PromptMode, options?: {systemNote?: string; driftRefreshTurn?: number}): OutboundPrompt` — the sole entry point for prompt composition.

**Given** the assembler is called with `mode: 'solo'` and a fresh thread (no prior messages),
**When** the assembler runs,
**Then** the returned `OutboundPrompt.messages` array has exactly ONE `role: 'system'` message whose content, in order, contains: (1) identityBlock from `PERSONA_REGISTRY[persona].prompt.identityBlock`, (2) voiceRules block, (3) refusalRules block, (4) fewShots (3-6 verbatim Q+A pairs from Addendum §F selection), (5) voice-reminder repeat block, (6) an empty Rolling Summary placeholder line, (7) an empty Verbatim Tail placeholder line, (8) the 4-item self-verification checklist from Addendum §C.5, per AD-8 block order. It then has ONE `role: 'user'` message whose content is the current user message wrapped in `<user_message>...</user_message>` delimiters per AD-8.

**Given** the thread has 3 prior messages (1 user, 1 assistant, 1 user),
**When** the assembler runs with `mode: 'solo'`,
**Then** the Verbatim Tail slot (block 7) is populated with those 3 messages verbatim in `role/content` format; the Rolling Summary slot (block 6) is empty (thread length ≤ `VERBATIM_TAIL_LENGTH = 8`).

**Given** the thread has 20 prior messages AND `thread.rollingSummary` is populated,
**When** the assembler runs,
**Then** the Rolling Summary slot (block 6) contains `thread.rollingSummary` string verbatim, and the Verbatim Tail slot (block 7) contains only the LAST 8 messages (per `VERBATIM_TAIL_LENGTH = 8`).

**Given** `mode` is any of the 5 PromptModes,
**When** the assembler's exhaustive switch runs,
**Then** the default case calls `assertNever(mode)` — a new PromptMode arm is a compile error until handled per AD-8.

**Given** the outbound prompt is built,
**When** the assembler returns,
**Then** `OutboundPrompt.meta` is populated: `{mode: 'solo', hasSummary: <boolean>, hasDriftRefresh: false (drift refresh injection is Epic 5), estimatedTokens: <number from token-estimator>}` per AD-8.

**Given** the assembler is called,
**When** the developer inspects the returned `ChatRequest`,
**Then** `model: 'gemini-2.5-flash'` (for Hitesh) or `model: 'openai/gpt-oss-120b'` (for Piyush) is set from `PERSONA_REGISTRY[persona].providerId` + `PERSONA_MODEL_PARAMS[persona].modelName`, and all model parameters (temperature, top_p, freq/presence penalties, max_output_tokens) come from `PERSONA_MODEL_PARAMS[persona]` per AD-3 + Addendum §B.4.

**Given** the assembler needs `fewShots` content to compose Block 4 of the 9-block prompt,
**When** the developer authors `src/personas/hitesh.prompt.ts` and `src/personas/piyush.prompt.ts`,
**Then** each persona file exports a `fewShots` array containing the 6 verbatim Q&A pairs specified in Addendum §F — **Hitesh:** research §C.3 Q1 (framework-choice question) + Q3 (emotional / career-doubt question) + Q5 (AI-and-future-of-coding opinion); **Piyush:** research §C.3 Q2 (system-design starter question) + Q4 (Docker starter question) + Q5 (AI-and-future-of-coding opinion) — each `fewShots` entry immediately preceded by a `// source: research §C.3 Q<n>, lines <start>-<end>` comment per PRD FR-5 (few-shots versioned in-repo with source attribution). No paraphrasing — the Hinglish register, punctuation, and signature phrases in the source quotes are preserved verbatim.

**Given** any developer tries to build an outbound prompt inline in a feature or domain file (e.g. `const prompt = 'You are Hitesh...';`),
**When** they run `npm run lint`,
**Then** the ESLint `no-restricted-syntax` rule from E0-S4 catches the Hinglish signature phrase and fails; the same string inside `src/personas/hitesh.prompt.ts` (which the assembler imports FROM) passes.

**verifies:** AD-8 (9-step prompt block order + sole composer discipline), AD-3 (model params from model-params.ts, not hard-coded), AD-22 (Hinglish strings confined to personas/, verified by ESLint from E0-S4), FR-5 (Persona Few-Shot grounding — 6 verbatim Q&As from research §C.3 per Addendum §F selection, each with `// source:` attribution)

**touches:** `src/domain/prompts/prompt-assembler.service.ts`, `src/personas/hitesh.prompt.ts` (populated fully in Epic 8 with REFUSAL RULES; here voiceRules + identityBlock + fewShots slots are exercised — the 3 Hitesh few-shots from research §C.3 Q1/Q3/Q5 are populated verbatim with source-attribution comments), `src/personas/piyush.prompt.ts` (same; 3 Piyush few-shots from research §C.3 Q2/Q4/Q5), `src/personas/persona.registry.ts` (extended if needed with any new slot the assembler reads)

**test target:** unit test (compose called with `mode: 'solo'` and a hard-coded thread; asserts the messages array shape matches the 9-block order; asserts model + params come from Addendum §B.4; asserts exhaustive switch fires `assertNever` when a fake mode is passed; asserts `PERSONA_REGISTRY.hitesh.prompt.fewShots.length === 3` and `PERSONA_REGISTRY.piyush.prompt.fewShots.length === 3`; asserts each fewShot entry's source file contains a preceding `// source: research §C.3 Q\d+` comment via a lightweight regex check on the raw source file)

## Developer Context

The composer that AD-8 mandates as the SOLE entry point. Every LLM call — Solo, Ask-Both A, Ask-Both B, Ask-Both Keep-going, Summary generation, Drift Refresh — routes through this class. No feature file writes prompt strings inline; ESLint from E0-S4 backs this up.

**This story covers ONLY `mode: 'solo'`.** The other 4 modes (`ask-both-a`, `ask-both-b`, `ask-both-keep-going`, `summarize`) are cases in the exhaustive switch that THROW `assertNever` here (or return a stub `throw new Error('not yet implemented for E5/E9')` — either works). Later stories extend:
- E5-S2: adds `case 'summarize'`
- E5-S3: adds drift-refresh injection at block 8
- E9-S2: adds `case 'ask-both-a'` + `case 'ask-both-b'`
- E9-S3: adds `case 'ask-both-keep-going'`

**Readiness-gap #3 addressed here (per user request):** the E2-S2 fewShots AC explicitly requires **6 verbatim Q&A pairs from research §C.3** — 3 per persona — with `// source:` attribution comments. This closes the gap in the FR-5 traceability.

## Research §C.3 Verbatim Few-Shots — INLINED

Populate `src/personas/hitesh.prompt.ts` `fewShots` with these 3 verbatim Q&A pairs (do NOT paraphrase). Each entry gets a `// source:` comment BEFORE it.

### Hitesh Q1 (framework, research §C.3 lines 788–795)

**User:** `"Sir/Piyush, mujhe React seekhna chahiye ya directly Next.js pe jaana chahiye?"`

**Assistant (Hitesh, verbatim):**
> Haanji, achhi baat hai ki soch rahe ho. Yaar main aapko ek story sunata hun — jab main pehli baar React seekhne baitha tha 2016 mein, us waqt Next.js tha hi nahi properly. Kaafi log directly framework pe jump kar dete hain, but foundation weak reh jaati hai n phir "hydration error" jaise cheezein dekh ke ghabra jaate hain.
>
> Meri simple recommendation: ek 2-3 hafte React ke fundamentals pe do — components, state, hooks, useEffect ka mental model. Ek chota project bana lo, todo app ya movie search app. Uske baad Next.js pe jao — bahut smooth transition hoga aur SSR/SSG/App Router samajhne mein bahut easy lagega.
>
> Chai aur Code channel pe "chai aur react" playlist hai — bilkul beginner se advanced tak. Chai ke saath enjoy karo n ek chota project bana ke GitHub pe daal do. Samjha kya? 😁

### Hitesh Q3 (emotional / career, research §C.3 lines 830–844)

**User:** `"Job market bahut kharaab hai yaar, 6 mahine se koi call nahi aa raha. Kya karun?"`

**Assistant (Hitesh, verbatim):**
> Yaar sach batau — main samajh sakta hun, 6 mahine bahut long time hota hai aur mental strength test hoti hai is dauran. Ek baat — market fluctuate karta hai, ye personal reflection nahi hai tumhari skills pe.
>
> Ek honest checklist:
>
> - Kya resume ATS-friendly hai? Kya ek human recruiter ko 15 second mein clear ho jaata hai ki tum kya kar sakte ho?
> - GitHub pe last 6 mahine mein kya activity hai? Consistency dikhti hai green squares se.
> - LinkedIn — kya tum apni learning ke baare mein likh rahe ho? Ek chota blog, ek tech doc likhna — main ye baar-baar kehta hun, ye ek tumhari real "social media presence" ban jaati hai even agar tum active nahi ho.
> - Networking — koi 5 log recall karo jinke saath tumne college/office mein kaam kiya. Unhe seedhe DM karo. Aisa nahi ki job maang rahe ho — "koi opportunity dikhi to yaad karna" enough hai.
>
> Aur ek chhoti si baat — is time mein ek open-source project bana lo, ya kisi ke open-source contribute karo. Interview mein baat karne ke liye ek concrete cheez hoti hai. Charlie Chaplin ka ek line hai jo mujhe pasand hai: "Life is a tragedy from a short lens but a funny scene from a long lens." Ye phase bhi story ban jaayega, trust karo.
>
> Tension mat lo, hum yahi hain. Bhaiya, agar chahiye to Discord (hitesh.ai/discord) pe aa jao — community bahut supportive hai.

### Hitesh Q5 (AI opinion, research §C.3 lines 892–902)

**User:** `"Vibe coding aur AI se sab kaam ho raha hai — kya coder ka future hai?"`

**Assistant (Hitesh, verbatim):**
> Haanji, ye question aajkal sab pooch rahe hain. Meri honest opinion — is time coder banna probably historically best time hai. Really.
>
> Dekho, ek fresher aaj Cursor open karega, Claude use karega, aur ek functional prototype 30 minute mein ship kar dega. Ye pehle 30 din lagte the. Iska matlab kya hai? Barrier collapse ho raha hai. 36 million naye developers 2025 mein GitHub pe join hue — 63% vibe coders hain, coders nahi. Ye achhi baat hai — zyada log building start kar rahe hain.
>
> But — big but — vibe coding tumhe pehla project ship karva sakti hai. Second project banana hai to samajhna padega ki JavaScript async kaise kaam karta hai, database index kaise design karna hai, security kya cheez hai. Existing developers already 10x mode mein hain copilots ke saath. So ye replacement nahi hai — ye amplifier hai.
>
> Meri X pe ek line hai jo mujhe khud pasand hai: "Code will be like blackbox." Yaani AI likhega, AI chalayega, human higher-level design karega. Object-Oriented Design se AI-Oriented Design pe shift ho raha hai stack.
>
> To sidha jawab — coder ka future bahut bright hai, but "coder" ki definition badal rahi hai. Purani skills matter karti hain, but naye tools kaam mein lena aana chahiye. Chai lo, Cursor download karo, ek chota project ship karo — feel karo pehle, phir opinion banao. Samjha kya? 😁

### Piyush Q2 (system design, research §C.3 lines 819–826)

**User:** `"System design kaise start karun? Bahut overwhelming lagta hai."`

**Assistant (Piyush, verbatim):**
> देखो, system design में एक बहुत बड़ी मिस्टेक जो सब करते हैं — वो पहले theory पढ़ते हैं, phir practice करते हैं. यार, opposite करो.
>
> नंबर वन — system design को आप कभी भी mug up नहीं कर सकते. आप Netflix के system design को रट सकते हो, but जब आप अपना खुद का system बनाने आओगे, आपसे नहीं हो पाएगा. Why? क्योंकि आपका budget, आपका traffic pattern, आपकी audience — सब entirely different है.
>
> तो एक काम करते हैं — छोटा सा project उठाओ. एक URL shortener बनाओ. सिर्फ एक server, एक database. चलने दो. फिर देखो — जब 10K users आ जाएंगे, कहाँ फटता है? Server? Database? Bandwidth? वहाँ जाकर fix करो — queues, caching, sharding introduce करो, तब जब actually जरूरत हो.
>
> Correct? Iterative approach — build करो, break करो, आगे बढ़ो. Homework: 3 दिन में URL shortener का MVP बनाओ, फिर मुझे बताओ कहाँ bottleneck आया — फिर उसी बात पे next step decide करेंगे।

### Piyush Q4 (Docker, research §C.3 lines 875–887)

**User:** `"Docker seekhna hai, kahaan se start karun?"`

**Assistant (Piyush, verbatim):**
> देखो, Docker सीखने का सबसे practical path बताता हूं.
>
> मेरा एक Docker course है pro.piyushgarg.dev पे — CLI, images, networking, volumes, Compose, AWS ECS/ECR तक cover करता है, hands-on projects के साथ. Coupon `AWS` लगा दो, 25% off मिलेगा.
>
> But course के अलावा, यार practical roadmap ये है:
>
> 1. **Day 1–2:** Docker install करो, `docker run hello-world`, फिर एक simple Node.js या Python app को Dockerize करो. Just a Dockerfile with `FROM node:20`, copy source, install deps, `CMD ["node", "index.js"]`.
> 2. **Day 3–4:** Docker Compose seekho — एक multi-container setup बनाओ: your app + Postgres + Redis. एक `docker-compose.yml` में सब कुछ.
> 3. **Day 5–6:** Networking + Volumes पे focus. `docker network create`, `-v` flag, mounts — ये concepts overwhelm कर सकते हैं but practically try करते हो तो बहुत simple हैं.
> 4. **Day 7+:** Multi-stage builds, image size optimization, फिर AWS ECR + ECS पे deploy.
>
> बहुत बढ़िया, iterative approach रखो. एक assignment देता हूं — एक MERN app को dockerize करो, docker-compose से चलाओ locally, फिर एक multi-stage build से image size 500MB से 100MB पे लाओ. Try करके बताना.

### Piyush Q5 (AI opinion, research §C.3 lines 904–916)

**User:** `"Vibe coding aur AI se sab kaam ho raha hai — kya coder ka future hai?"`

**Assistant (Piyush, verbatim):**
> देखो, honestly — ये question बहुत nuanced है, black-and-white answer नहीं है.
>
> मेरा take:
>
> - **Freshers के लिए:** Vibe coding एक blessing है. यार honestly, अगर आप कभी coding से डरते थे, अभी ideal time है. Cursor + Claude से एक working prototype 1 hour में बन जाता है. आप वो feeling experience करो — "अरे मैंने कुछ ship किया!" — फिर automatically motivation आएगी fundamentals सीखने की. मैं बहुत encourage करता हूं.
> - **Existing devs के लिए:** आप already 10x mode में हैं copilots के साथ. Ignore करने का कोई सेंस नहीं है. Explore करो हर tool — Cursor, Copilot, Windsurf, Zed — जो आपके workflow में fit हो, अपनाओ.
> - **Concern side:** Vibe-coded apps often insecure हैं, tokens expose होते हैं, database designs से fatega. Fresher को eventually fundamentals सीखने ही पड़ेंगे. लेकिन वो motivation ज्यादा strong होगी क्योंकि उन्होंने already कुछ ship किया है.
>
> बात समझ आई ना? At the end of the day, coder का role नहीं ख़त्म हो रहा — role shift हो रहा है. आप "raw code लिखने वाला" कम, "system design करने वाला + AI orchestrate करने वाला" ज्यादा बन रहे हो.
>
> मेरा GenAI with JavaScript cohort शुरू हुआ है exactly इस reason से — Forward Deployed Engineer बनना है, LLM + RAG + Agents + MCP सीखने हैं. देखो — डरने की बजाय, इस wave को ride करो.

## Technical Requirements

### `src/domain/prompts/prompt-assembler.service.ts`

```ts
import { Injectable } from '@angular/core';
import type { Thread, PersonaId, ChatRequest, PromptMessage } from '@domain/types/message';
import type { PromptMode, OutboundPrompt } from './types';
import { PERSONA_REGISTRY } from '@personas/persona.registry';
import { PERSONA_MODEL_PARAMS } from '@config/model-params';
import { VERBATIM_TAIL_LENGTH } from '@config/context-config';
import { estimateTokens } from '@domain/context/token-estimator'; // E5-S1 lands this; stub if needed
import { assertNever } from '@domain/types/persona';

@Injectable({ providedIn: 'root' })
export class PromptAssembler {
  compose(
    persona: PersonaId,
    thread: Thread,
    mode: PromptMode,
    options?: { systemNote?: string; driftRefreshTurn?: number },
  ): OutboundPrompt {
    const params = PERSONA_MODEL_PARAMS[persona];
    const promptData = PERSONA_REGISTRY[persona].prompt;

    switch (mode) {
      case 'solo': {
        // AD-8: 9-block order
        const systemContent = this.buildSystemBlock(persona, thread, /*driftRefresh*/ null);
        const lastUserMsg = thread.messages[thread.messages.length - 1];
        const userContent = lastUserMsg?.role === 'user'
          ? `<user_message>${lastUserMsg.content}</user_message>`
          : '<user_message></user_message>'; // fresh thread edge case
        const messages: PromptMessage[] = [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ];
        const outbound: OutboundPrompt = {
          messages,
          model: params.modelName,
          temperature: params.temperature,
          topP: params.topP,
          maxOutputTokens: params.maxOutputTokens,
          frequencyPenalty: params.frequencyPenalty,
          presencePenalty: params.presencePenalty,
          meta: {
            mode: 'solo',
            hasSummary: !!thread.rollingSummary,
            hasDriftRefresh: false, // E5-S3 injects at block 8
            estimatedTokens: estimateTokens(systemContent + userContent),
          },
        };
        return outbound;
      }
      case 'ask-both-a':
      case 'ask-both-b':
      case 'ask-both-keep-going':
        throw new Error('Ask-Both modes land in E9-S2 / E9-S3');
      case 'summarize':
        throw new Error('Summarize mode lands in E5-S2');
      default:
        return assertNever(mode);
    }
  }

  private buildSystemBlock(persona: PersonaId, thread: Thread, driftRefresh: string | null): string {
    const p = PERSONA_REGISTRY[persona].prompt;
    const parts: string[] = [];

    // Block 1: Identity
    parts.push(p.identityBlock);
    parts.push('\n---\n');

    // Block 2: Voice rules
    parts.push(p.voiceRules);
    parts.push('\n---\n');

    // Block 3: Refusal rules (E8-S1 populates fully; skeleton at E0-S3)
    parts.push('REFUSAL RULES:\n' + p.refusalRules);
    parts.push('\n---\n');

    // Block 4: Few-shots (E2-S2 populates 3 per persona from research §C.3)
    parts.push('# ---- FEW-SHOT EXAMPLES ----');
    for (const fs of p.fewShots) {
      parts.push(`User: ${fs.user}\nAssistant: ${fs.assistant}\n`);
    }
    parts.push('\n---\n');

    // Block 5: Voice-reminder repeat
    parts.push('# ---- REPEAT CRITICAL RULES ----');
    parts.push(persona === 'hitesh'
      ? 'Reminder: mirror the user\'s Hinglish register. Analogy or story FIRST, then the tech. 1–3 signature phrases max. NEVER trash a framework, other creator, or fabricate a fact.'
      : 'Reminder: mirror the user\'s Hinglish register (English syntax + Hindi phonetics). Reductive framing → whiteboard decomposition → analogy → code → homework. Comprehension checks every 2–3 sentences. Bullet lists preferred.');
    parts.push('\n---\n');

    // Block 6: Rolling Summary slot
    parts.push('# ---- ROLLING SUMMARY (injected by system) ----');
    parts.push(thread.rollingSummary ?? '(none)');
    parts.push('\n---\n');

    // Block 7: Verbatim Tail (last N messages, excluding the CURRENT user message which is Block 9)
    parts.push('# ---- VERBATIM TAIL (last N turns) ----');
    const tail = thread.messages.slice(-VERBATIM_TAIL_LENGTH - 1, -1); // exclude last (current user msg)
    for (const m of tail) {
      parts.push(`${m.role}: ${m.content}`);
    }
    parts.push('\n---\n');

    // Block 8: Drift Refresh (E5-S3 injects here) OR skip
    if (driftRefresh) {
      parts.push(driftRefresh);
      parts.push('\n---\n');
    }

    // Block 9 slot handled at the user-message level (compose() concatenates)
    // Self-verification checklist (technically before block 9 per AD-8)
    parts.push('# ---- PRE-RESPONSE SELF-VERIFICATION ----');
    parts.push(p.selfVerificationChecklist);

    return parts.join('\n');
  }
}
```

### `src/personas/hitesh.prompt.ts` — POPULATE fewShots

Add 3 verbatim entries per §C.3 Q1/Q3/Q5 above with `// source:` comments preceding each.

### `src/personas/piyush.prompt.ts` — POPULATE fewShots

Add 3 verbatim entries per §C.3 Q2/Q4/Q5 above with `// source:` comments preceding each.

## Architecture Compliance

- **AD-3:** model + params come from `PERSONA_MODEL_PARAMS[persona]` via `PERSONA_REGISTRY[persona].providerId` — never hard-coded in the assembler.
- **AD-8:** 9-block order preserved; `assertNever(mode)` default; `<user_message>...</user_message>` XML delimiters on block 9.
- **AD-22:** persona-voice strings (identityBlock, voiceRules, fewShots) live in `src/personas/`. ESLint from E0-S4 catches leaks into features/shared.
- **FR-5:** 6 verbatim few-shots (3 per persona) from research §C.3 with `// source:` attribution — addresses readiness-gap #3.

## Library / Framework Requirements

None new. Uses `@Injectable` from Angular for DI (E2-S3 orchestrator injects this service).

## File Structure Requirements

```
src/domain/prompts/
  prompt-assembler.service.ts      # NEW
  types.ts                          # from E0-S2; PromptMode + OutboundPrompt
src/personas/
  hitesh.prompt.ts                  # POPULATE fewShots (3 entries)
  piyush.prompt.ts                  # POPULATE fewShots (3 entries)
```

## Testing Requirements

- `src/domain/prompts/prompt-assembler.service.spec.ts`:
  - Compose called with `mode: 'solo'` + empty thread → messages array has exactly 2 entries (system + user); system content contains identityBlock, voiceRules, refusalRules, fewShots, voice-reminder, rolling-summary placeholder, empty verbatim tail, self-verification checklist; user content is `<user_message></user_message>`.
  - Compose with 3-message thread → verbatim tail has 3 messages (or the last 8 if more); rolling summary is empty.
  - Compose with 20-message thread + `rollingSummary = "..."` → block 6 has the summary string verbatim; block 7 has last 8 messages.
  - Compose with `mode: 'summarize'` throws (not-yet-implemented) — later stories add cases.
  - Compose with fake mode `('foo' as PromptMode)` triggers `assertNever` runtime throw.
  - `OutboundPrompt.model === 'gemini-2.5-flash'` for Hitesh; `'openai/gpt-oss-120b'` for Piyush.
  - `OutboundPrompt.temperature === 0.75` (Hitesh); `0.55` (Piyush) per Addendum §B.4.
- `src/personas/hitesh.prompt.spec.ts` + `src/personas/piyush.prompt.spec.ts`:
  - `PERSONA_REGISTRY.hitesh.prompt.fewShots.length === 3`.
  - `PERSONA_REGISTRY.piyush.prompt.fewShots.length === 3`.
  - Each `fewShots[i].assistant` byte-matches the research §C.3 verbatim quote (write the expected string as a template literal in the spec and compare `===`).
  - Source-attribution check: read `hitesh.prompt.ts` raw file (via `fs.readFileSync` in the spec — allowed for a source-file introspection test), assert 3 preceding `// source: research §C.3 Q(1|3|5)` comments exist.

## Latest Tech Information

- Angular 21 `@Injectable({ providedIn: 'root' })` for tree-shakable singleton service registration.
- Pure functions inside `buildSystemBlock` — no side effects — testable without Angular TestBed.
- `estimateTokens` from `@domain/context/token-estimator` — E5-S1 lands the real impl. Stub as `(text: string) => Math.ceil(text.length / 4)` here inline if E5-S1 hasn't landed yet (it hasn't — E5-S1 is critical-path position 17).

**Stub estimateTokens INLINE in this story** since E5-S1 depends on this story indirectly (chain: E5-S1 blocked by E2-S3 blocked by E2-S2 blocked by NOTHING — so E2-S2 comes first). Land a placeholder in `src/domain/context/token-estimator.ts`:

```ts
// STUB: E5-S1 replaces with a canonical single-source impl per AD-9.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

E5-S1 replaces without changing the signature.

## Previous Story Intelligence

**E0-S3 (Config + persona skeletons):**
- `PERSONA_REGISTRY[persona].prompt.identityBlock` + `voiceRules` + `selfVerificationChecklist` are populated verbatim from Addendum §C.2/§C.3.
- `PERSONA_REGISTRY[persona].prompt.fewShots` is `[]` empty placeholder — THIS STORY populates it.
- `PERSONA_REGISTRY[persona].prompt.refusalRules` is `''` empty — assembler concatenates the empty string (E8-S1 fills in later).
- `PERSONA_MODEL_PARAMS[persona].modelName` = `'gemini-2.5-flash'` or `'openai/gpt-oss-120b'`.
- `VERBATIM_TAIL_LENGTH = 8` in `src/config/context-config.ts`.

**E0-S4 (Lint):**
- ESLint `no-restricted-syntax` bans Hinglish signature phrases in features/shared but EXEMPTS `src/personas/**`. Populating fewShots in `hitesh.prompt.ts` / `piyush.prompt.ts` passes lint.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-3` (model params from model-params.ts, lines 78–89), `AD-8` (9-step block order + PromptAssembler sole composer, lines 122–139), `AD-22` (persona-voice in personas/, lines 300–309).
- Addendum `§C.1` (block order verbatim, line 136–144), `§C.2` (Hitesh identity + voice rules verbatim, lines 148–222), `§C.3` (Piyush identity + voice rules, lines 226–317), `§C.5` (self-verification checklist, lines 984–995), `§F` (few-shot selection per persona: Hitesh Q1/Q3/Q5, Piyush Q2/Q4/Q5, lines 455–469).
- Research `§C.3` (all 6 Q&A verbatim, lines 780–958) — INLINED above in this story context.
- Sprint status: key `e2-s2-prompt-assembler-solo`, blocks `[e2-s3-chat-orchestrator-abort-regex, e5-s3-drift-refresh-block-injection, e9-s2-ask-both-sequencer-sequential, e12-s2-persona-prompt-context-docs]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-8] `PromptMode` union + `OutboundPrompt` shape + 9-block order + `<user_message>` XML delimiters.
- [Source: ARCHITECTURE-SPINE.md#AD-3] Adapter/model params from `PERSONA_MODEL_PARAMS`.
- [Source: ARCHITECTURE-SPINE.md#AD-22] Hinglish in `src/personas/`; ESLint from E0-S4 enforces.
- [Source: addendum.md#F] Per-persona few-shot selection: Hitesh Q1/Q3/Q5, Piyush Q2/Q4/Q5.
- [Source: research §C.3 lines 780–958] 6 verbatim Q&A pairs INLINED above.
- [Source: prd.md#FR-5] Persona Few-Shot grounding — versioned in-repo with source attribution.
- [Source: sprint-status.yaml#deferred_readiness_gaps.gap_3] Few-shots population AC added explicitly to this story.

## Story Completion Status

- [ ] `src/domain/prompts/prompt-assembler.service.ts` — `PromptAssembler` service with `compose(persona, thread, mode, options?): OutboundPrompt`.
- [ ] `mode: 'solo'` case fully implemented: 9-block order, `<user_message>` XML delimiters, `PERSONA_MODEL_PARAMS` sourcing, `OutboundPrompt.meta` populated.
- [ ] `mode: 'summarize' | 'ask-both-*'` cases throw explicit not-yet-implemented errors (later stories add).
- [ ] `default: return assertNever(mode);` on exhaustive switch.
- [ ] `src/personas/hitesh.prompt.ts` — `fewShots` populated with 3 verbatim entries from research §C.3 Q1/Q3/Q5 with preceding `// source:` comments.
- [ ] `src/personas/piyush.prompt.ts` — `fewShots` populated with 3 verbatim entries from research §C.3 Q2/Q4/Q5 with preceding `// source:` comments.
- [ ] `src/domain/context/token-estimator.ts` STUB landed (`Math.ceil(text.length / 4)`) — E5-S1 replaces canonically.
- [ ] Assembler spec tests + persona fewShots byte-identical spec tests all pass.
- [ ] `npm run lint` passes (persona files exempt from the no-restricted-syntax Hinglish rule).
