#!/usr/bin/env tsx
/*
 * SM-2 drift curve — drive a 40-turn conversation per persona through the
 * production adapters (AD-18) + PromptAssembler + ContextManager, sample the
 * assistant response at turns 5/15/25/35 and score each sample against the
 * same 5-dimension rubric used by `run.ts`. Writes `drift-curve.md`.
 *
 * Not a Karma spec — invoked via `bun run eval:drift`.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PromptAssembler } from '../src/domain/prompts/prompt-assembler.service';
import { getProviderAdapter } from '../src/infrastructure/providers/provider.registry';
import { PERSONA_REGISTRY, personaDisplayName } from '../src/personas/persona.registry';
import type {
  Message,
  Thread,
} from '../src/domain/types/message';
import type { PersonaId } from '../src/domain/types/persona';
import type { ProviderPort } from '../src/domain/ports/provider.port';

import { loadEvalConfig } from './config';

const FOLLOW_UPS = [
  'Isko practical mein kaise implement karun?',
  'Ek small project example do?',
  'In Python how would this look?',
  'Scaling to 1000 users — kya karna hoga?',
  'Ek analogy do jo aasaan lage.',
  'Ismein common mistakes kya hote hain?',
  'Kya kisi cheap alternative se ye ho sakta hai?',
  'Aur ek use case bataao.',
  'Debug kaise karun agar break ho jaaye?',
  'Testing strategy suggest karo.',
  'Ismein performance kaisi rehti hai?',
  'Kya production mein ye reliable hai?',
  'Isko learn karne mein kitna time lagega?',
  'Kya kisi book ya video ka recommendation?',
  'Ek homework do jo ek weekend mein ho jaaye.',
  'Ismein security ka kya scene hai?',
  'Team mein isko rollout kaise karun?',
  'Kya iske alternate ho sakte hain?',
  'Long-term maintainability kaisi hoti hai?',
  'Kya freelance projects mein ye help karega?',
  'Show me an example error and how to fix it.',
  'Ismein CI/CD kaise setup karun?',
  'Ek starter template kahan milega?',
  'Kya isko GraphQL ke saath integrate kar sakte hain?',
  'Cost efficient design kaise karun?',
  'Ismein observability ka role kya hai?',
  'Ek anti-pattern bhi bataao.',
  'Kya kisi framework upgrade ka impact aayega?',
  'Rollback plan kaise banayein?',
  'Cache strategy kya rakhein?',
  'Kya database sharding help karega?',
  'Ek quick decision matrix do.',
  'What about internationalisation?',
  'Kya isko mobile pe optimize kar sakte hain?',
  'Ismein analytics kaise wire karun?',
  'Ek small PR review checklist do.',
  'Ismein feature flag ka role?',
  'Kya team of 3 devs is enough?',
  'Kis edge case ke liye stress test karun?',
  'Wrap-up main takeaways.',
];

const SAMPLE_TURNS = [5, 15, 25, 35];

async function main(): Promise<void> {
  const cfg = loadEvalConfig();
  const assembler = new PromptAssembler();
  const GeneratorCls = getProviderAdapter(cfg.generatorProvider);
  const JudgeCls = getProviderAdapter(cfg.judgeProvider);

  const perPersonaRows: Record<
    PersonaId,
    Array<{ turn: number; sig: number; hinglish: number; teaching: number; signal: number; no_drift: number; composite: number }>
  > = { hitesh: [], piyush: [] };

  for (const persona of ['hitesh', 'piyush'] as PersonaId[]) {
    process.stdout.write(`\n=== ${personaDisplayName(persona)} 40-turn drift ===\n`);
    const thread: Thread = {
      id: `drift-${persona}`,
      scope: persona,
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: 0,
      updatedAt: 0,
    };

    for (let turn = 1; turn <= 40; turn += 1) {
      const userText = FOLLOW_UPS[(turn - 1) % FOLLOW_UPS.length]!;
      thread.messages.push({
        id: `u-${turn}`,
        role: 'user',
        content: userText,
        timestamp: 0,
      });
      const prompt = assembler.compose(persona, thread, 'solo');
      const generator = new (
        GeneratorCls as unknown as new () => ProviderPort
      )();

      let responseText = '';
      try {
        for await (const chunk of generator.streamChat(
          prompt,
          cfg.generatorKey,
          new AbortController().signal,
        )) {
          if (chunk.type === 'delta' && chunk.text) responseText += chunk.text;
          if (chunk.type === 'done' || chunk.type === 'error') break;
        }
      } catch (err) {
        console.error(`turn ${turn} failed: ${(err as Error).message}`);
        continue;
      }

      const assistantMsg: Message = {
        id: `a-${turn}`,
        role: 'assistant',
        persona,
        content: responseText,
        timestamp: 0,
        status: 'complete',
      };
      thread.messages.push(assistantMsg);

      if (SAMPLE_TURNS.includes(turn)) {
        const scores = await judgeResponse(
          JudgeCls,
          cfg.judgeKey,
          persona,
          responseText,
        );
        const composite = Number(
          ((scores.sig + scores.hinglish + scores.teaching + scores.signal + scores.no_drift) / 5).toFixed(2),
        );
        perPersonaRows[persona].push({ turn, ...scores, composite });
        process.stdout.write(
          `  turn ${turn} composite=${composite}\n`,
        );
      }
    }
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const md = renderMarkdown(perPersonaRows);
  const outPath = join(here, 'drift-curve.md');
  await writeFile(outPath, md, 'utf-8');
  console.log('\nWrote', outPath);
}

interface DimScores {
  sig: number;
  hinglish: number;
  teaching: number;
  signal: number;
  no_drift: number;
}

async function judgeResponse(
  JudgeCls: ReturnType<typeof getProviderAdapter>,
  judgeKey: string,
  persona: PersonaId,
  responseText: string,
): Promise<DimScores> {
  const judge = new (JudgeCls as unknown as new () => ProviderPort)();
  const prompt = {
    model: PERSONA_REGISTRY[persona].providerId === 'gemini'
      ? 'openai/gpt-oss-120b'
      : 'gemini-2.5-flash',
    messages: [
      {
        role: 'system' as const,
        content:
          `Score this ${personaDisplayName(persona)}-persona response 0-3 on each of the 5 dimensions ` +
          `from rubric.md. Return STRICT JSON: {"sig":n,"hinglish":n,"teaching":n,"signal":n,"no_drift":n}`,
      },
      {
        role: 'user' as const,
        content: responseText.slice(0, 4000),
      },
    ],
    temperature: 0,
    maxOutputTokens: 100,
  };
  let raw = '';
  try {
    for await (const chunk of judge.streamChat(
      prompt,
      judgeKey,
      new AbortController().signal,
    )) {
      if (chunk.type === 'delta' && chunk.text) raw += chunk.text;
      if (chunk.type === 'done' || chunk.type === 'error') break;
    }
  } catch {
    /* return zeros */
  }
  const m = raw.match(/\{[^}]*\}/);
  if (!m) return { sig: 0, hinglish: 0, teaching: 0, signal: 0, no_drift: 0 };
  try {
    const p = JSON.parse(m[0]) as Record<string, unknown>;
    return {
      sig: clamp(p['sig']),
      hinglish: clamp(p['hinglish']),
      teaching: clamp(p['teaching']),
      signal: clamp(p['signal']),
      no_drift: clamp(p['no_drift']),
    };
  } catch {
    return { sig: 0, hinglish: 0, teaching: 0, signal: 0, no_drift: 0 };
  }
}

function clamp(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.round(n)));
}

function renderMarkdown(
  rows: Record<PersonaId, Array<{ turn: number; composite: number; sig: number; hinglish: number; teaching: number; signal: number; no_drift: number }>>,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const sections = (['hitesh', 'piyush'] as PersonaId[]).map((persona) => {
    const list = rows[persona];
    const header = `## ${personaDisplayName(persona)}\n\n| Turn | Sig | Hinglish | Teaching | Signal | No-Drift | Composite |\n|---|---|---|---|---|---|---|`;
    const body = list
      .map(
        (r) =>
          `| ${r.turn} | ${r.sig} | ${r.hinglish} | ${r.teaching} | ${r.signal} | ${r.no_drift} | ${r.composite} |`,
      )
      .join('\n');
    const t5 = list.find((r) => r.turn === 5)?.composite ?? 0;
    const t35 = list.find((r) => r.turn === 35)?.composite ?? 0;
    const pass = t35 >= t5 - 0.45; // 15 percentage points on a 3-scale ≈ 0.45.
    return `${header}\n${body}\n\n**SM-2 pass criterion:** turn-35 composite ≥ turn-5 composite − 0.45. ` +
      `Turn 5 = ${t5}, Turn 35 = ${t35}. **${pass ? 'PASS' : 'FAIL'}**.\n`;
  });
  return `# Drift Curve — ${date}\n\n${sections.join('\n')}\n`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
