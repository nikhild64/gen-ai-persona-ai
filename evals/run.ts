#!/usr/bin/env tsx
/*
 * evals/run.ts — Golden-Set eval runner. Reuses production provider
 * adapters + PromptAssembler per AD-18 (no re-implementation).
 *
 * Usage:
 *   EVAL_GENERATOR=gemini EVAL_JUDGE=groq \
 *   EVAL_GENERATOR_KEY=AIza… EVAL_JUDGE_KEY=gsk_… \
 *   bunx tsx evals/run.ts
 */

import { readFile, writeFile } from 'node:fs/promises';
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
import type {
  ProviderPort,
} from '../src/domain/ports/provider.port';

import { loadEvalConfig } from './config';

type Category = 'intro' | 'technical' | 'opinion' | 'edge_case';

interface GoldenPrompt {
  id: string;
  persona: PersonaId;
  category: Category;
  text: string;
  expected_signals?: string[];
}

interface GoldenSet {
  version: number;
  prompts: GoldenPrompt[];
}

interface JudgeScores {
  sig: number;
  hinglish: number;
  teaching: number;
  signal: number;
  no_drift: number;
  anecdote: boolean;
}

interface EvalResult {
  prompt_id: string;
  persona: PersonaId;
  category: Category;
  response_text: string;
  judge_scores: JudgeScores;
  anecdote_present: boolean;
}

async function main(): Promise<void> {
  const cfg = loadEvalConfig();
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = await readFile(join(here, 'golden-set.json'), 'utf-8');
  const goldenSet = JSON.parse(raw) as GoldenSet;

  const assembler = new PromptAssembler();
  const results: EvalResult[] = [];

  const GeneratorCls = getProviderAdapter(cfg.generatorProvider);
  const JudgeCls = getProviderAdapter(cfg.judgeProvider);

  let idx = 0;
  for (const item of goldenSet.prompts) {
    idx += 1;
    process.stdout.write(
      `[${idx}/${goldenSet.prompts.length}] ${item.id}… `,
    );

    const thread = stubThread(item);
    const prompt = assembler.compose(item.persona, thread, 'solo');
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
      console.error(`  generator failed: ${(err as Error).message}`);
      continue;
    }

    const judgeText = await runJudge(
      JudgeCls,
      cfg.judgeKey,
      item,
      responseText,
    );
    const scores = parseJudgeScores(judgeText);

    results.push({
      prompt_id: item.id,
      persona: item.persona,
      category: item.category,
      response_text: responseText,
      judge_scores: scores,
      anecdote_present: scores.anecdote,
    });

    process.stdout.write(
      `sig=${scores.sig} hin=${scores.hinglish} teach=${scores.teaching} sig=${scores.signal} drift=${scores.no_drift} anecdote=${scores.anecdote ? 'Y' : 'N'}\n`,
    );
  }

  const aggregates = computeAggregates(results);
  const output = {
    runDate: new Date().toISOString().slice(0, 10),
    model_generator: cfg.generatorProvider,
    model_judge: cfg.judgeProvider,
    results,
    aggregates,
  };

  const outPath = join(
    here,
    `results-${output.runDate}.json`,
  );
  await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('\nEval complete. Wrote', outPath);
  console.log('Aggregates:', JSON.stringify(aggregates, null, 2));
}

function stubThread(item: GoldenPrompt): Thread {
  const userMsg: Message = {
    id: `eval-user-${item.id}`,
    role: 'user',
    content: item.text,
    timestamp: 0,
  };
  return {
    id: `eval-${item.id}`,
    scope: item.persona,
    messages: [userMsg],
    rollingSummary: null,
    turnsSinceLastSummary: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

async function runJudge(
  JudgeCls: ReturnType<typeof getProviderAdapter>,
  judgeKey: string,
  item: GoldenPrompt,
  responseText: string,
): Promise<string> {
  const judge = new (JudgeCls as unknown as new () => ProviderPort)();
  const judgePrompt = buildJudgePrompt(item, responseText);

  let out = '';
  try {
    for await (const chunk of judge.streamChat(
      judgePrompt,
      judgeKey,
      new AbortController().signal,
    )) {
      if (chunk.type === 'delta' && chunk.text) out += chunk.text;
      if (chunk.type === 'done' || chunk.type === 'error') break;
    }
  } catch {
    /* fall through with empty output */
  }
  return out;
}

function buildJudgePrompt(item: GoldenPrompt, responseText: string) {
  const systemContent =
    `You are grading a response written in the voice of ${item.persona} (${personaDisplayName(item.persona)}). ` +
    'Rate 0-3 on each of five dimensions and answer Yes/No on anecdote presence. ' +
    'Return STRICT JSON only, no prose:\n' +
    '{"sig":<0-3>,"hinglish":<0-3>,"teaching":<0-3>,"signal":<0-3>,"no_drift":<0-3>,"anecdote":"Yes"|"No"}';
  const userContent =
    `Prompt: ${item.text}\n\n--- Response to grade ---\n${responseText}\n--- End response ---`;
  return {
    model: item.persona === 'hitesh' ? 'openai/gpt-oss-120b' : 'gemini-2.5-flash',
    messages: [
      { role: 'system' as const, content: systemContent },
      { role: 'user' as const, content: userContent },
    ],
    temperature: 0,
    maxOutputTokens: 200,
  };
}

function parseJudgeScores(text: string): JudgeScores {
  const jsonMatch = text.match(/\{[^}]*\}/);
  if (!jsonMatch) {
    return {
      sig: 0,
      hinglish: 0,
      teaching: 0,
      signal: 0,
      no_drift: 0,
      anecdote: false,
    };
  }
  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      sig: clamp03(raw['sig']),
      hinglish: clamp03(raw['hinglish']),
      teaching: clamp03(raw['teaching']),
      signal: clamp03(raw['signal']),
      no_drift: clamp03(raw['no_drift']),
      anecdote: String(raw['anecdote'] ?? '').toLowerCase().startsWith('y'),
    };
  } catch {
    return {
      sig: 0,
      hinglish: 0,
      teaching: 0,
      signal: 0,
      no_drift: 0,
      anecdote: false,
    };
  }
}

function clamp03(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.round(n)));
}

function computeAggregates(results: EvalResult[]) {
  const byPersona = new Map<PersonaId, EvalResult[]>();
  for (const r of results) {
    const list = byPersona.get(r.persona) ?? [];
    list.push(r);
    byPersona.set(r.persona, list);
  }

  const perPersona: Record<string, Record<string, number>> = {};
  for (const [persona, list] of byPersona.entries()) {
    const count = list.length || 1;
    perPersona[persona] = {
      sig: avg(list, (r) => r.judge_scores.sig),
      hinglish: avg(list, (r) => r.judge_scores.hinglish),
      teaching: avg(list, (r) => r.judge_scores.teaching),
      signal: avg(list, (r) => r.judge_scores.signal),
      no_drift: avg(list, (r) => r.judge_scores.no_drift),
      anecdote_rate:
        list.filter((r) => r.anecdote_present).length / count,
    };
  }

  const composite = Object.values(perPersona).reduce(
    (acc, dims) =>
      acc +
      (dims['sig'] + dims['hinglish'] + dims['teaching'] + dims['signal'] + dims['no_drift']) /
        5,
    0,
  ) / Math.max(1, Object.keys(perPersona).length);

  return {
    per_persona: perPersona,
    composite_avg: Number(composite.toFixed(2)),
  };
}

function avg(list: EvalResult[], pick: (r: EvalResult) => number): number {
  if (list.length === 0) return 0;
  const sum = list.reduce((acc, r) => acc + pick(r), 0);
  return Number((sum / list.length).toFixed(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
