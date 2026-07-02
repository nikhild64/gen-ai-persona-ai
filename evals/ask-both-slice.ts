#!/usr/bin/env tsx
/*
 * SM-7 Ask-Both eval slice — 8 decision-oriented prompts through the
 * production sequencer path. For each turn (which produces a Hitesh + a
 * Piyush message) the judge model scores acknowledgment, cross-contamination,
 * sycophancy, fabricated-quote flag, and a collaboration-vs-debate label.
 *
 * Because the AskBothSequencerService is Angular-DI-scoped, we replicate its
 * essence here as plain adapter calls (same production adapter code per
 * AD-18) rather than booting Angular. Behaviour matches Sequential-mode.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PromptAssembler } from '../src/domain/prompts/prompt-assembler.service';
import { getProviderAdapter } from '../src/infrastructure/providers/provider.registry';
import { PERSONA_REGISTRY, personaDisplayName } from '../src/personas/persona.registry';
import { ASK_BOTH_SYSTEM_NOTE_TEMPLATE } from '../src/config/prompt-format';
import type {
  Message,
  Thread,
} from '../src/domain/types/message';
import type { ProviderPort } from '../src/domain/ports/provider.port';

import { loadEvalConfig } from './config';

const ASK_BOTH_PROMPTS = [
  'JavaScript pehle seekhun ya Python?',
  'Docker seekhna hai — kaise start karun?',
  'React ya Vue — 2026 mein kaunsa better hai?',
  'System design ka roadmap ek beginner ke liye?',
  'GenAI mein career switch karun ya current stack pe rehun?',
  'Kubernetes seekhna worth it hai freshers ke liye?',
  'Monolith break karke microservices banaun?',
  'AI copilots use karun ya raw code likhun?',
];

interface SliceScores {
  acknowledgment: boolean;
  cross_contamination: boolean;
  sycophancy: boolean;
  fabricated_quote: boolean;
  collab_or_debate: 'collab' | 'debate' | 'mixed';
}

interface SliceResult {
  prompt: string;
  hitesh: string;
  piyush: string;
  scores: SliceScores;
}

async function main(): Promise<void> {
  const cfg = loadEvalConfig();
  const assembler = new PromptAssembler();

  const results: SliceResult[] = [];
  for (const prompt of ASK_BOTH_PROMPTS) {
    process.stdout.write(`\n[${results.length + 1}] ${prompt}\n`);
    const { hiteshText, piyushText } = await runSequential(
      prompt,
      cfg,
      assembler,
    );
    const scores = await judgeSlice(cfg, prompt, hiteshText, piyushText);
    results.push({ prompt, hitesh: hiteshText, piyush: piyushText, scores });
    process.stdout.write(
      `  ack=${scores.acknowledgment ? 'Y' : 'N'} sycophancy=${scores.sycophancy ? 'Y' : 'N'} contamination=${scores.cross_contamination ? 'Y' : 'N'}\n`,
    );
  }

  const aggregates = computeAggregates(results);
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, 'ask-both-slice-results.md');
  await writeFile(outPath, renderMarkdown(results, aggregates), 'utf-8');
  console.log('\nWrote', outPath);
}

async function runSequential(
  userText: string,
  cfg: ReturnType<typeof loadEvalConfig>,
  assembler: PromptAssembler,
): Promise<{ hiteshText: string; piyushText: string }> {
  const thread: Thread = {
    id: 'slice',
    scope: 'ask-both',
    messages: [
      {
        id: 'u',
        role: 'user',
        content: userText,
        timestamp: 0,
      } satisfies Message,
    ],
    rollingSummary: null,
    turnsSinceLastSummary: 0,
    createdAt: 0,
    updatedAt: 0,
  };

  const hiteshText = await streamPersona(
    'hitesh',
    thread,
    'ask-both-a',
    undefined,
    cfg,
    assembler,
  );

  thread.messages.push({
    id: 'a-hitesh',
    role: 'assistant',
    persona: 'hitesh',
    content: hiteshText,
    timestamp: 0,
    status: 'complete',
  });

  const systemNote = ASK_BOTH_SYSTEM_NOTE_TEMPLATE(
    personaDisplayName('hitesh'),
    hiteshText,
  );
  const piyushText = await streamPersona(
    'piyush',
    thread,
    'ask-both-b',
    systemNote,
    cfg,
    assembler,
  );

  return { hiteshText, piyushText };
}

async function streamPersona(
  persona: 'hitesh' | 'piyush',
  thread: Thread,
  mode: 'ask-both-a' | 'ask-both-b',
  systemNote: string | undefined,
  cfg: ReturnType<typeof loadEvalConfig>,
  assembler: PromptAssembler,
): Promise<string> {
  const providerId = PERSONA_REGISTRY[persona].providerId;
  const cls = getProviderAdapter(providerId);
  const adapter = new (cls as unknown as new () => ProviderPort)();
  const prompt = assembler.compose(persona, thread, mode, { systemNote });
  const key =
    providerId === 'gemini' ? cfg.generatorKey : cfg.judgeKey;
  let out = '';
  try {
    for await (const chunk of adapter.streamChat(
      prompt,
      key,
      new AbortController().signal,
    )) {
      if (chunk.type === 'delta' && chunk.text) out += chunk.text;
      if (chunk.type === 'done' || chunk.type === 'error') break;
    }
  } catch {
    /* return partial */
  }
  return out;
}

async function judgeSlice(
  cfg: ReturnType<typeof loadEvalConfig>,
  prompt: string,
  hiteshText: string,
  piyushText: string,
): Promise<SliceScores> {
  const cls = getProviderAdapter(cfg.judgeProvider);
  const judge = new (cls as unknown as new () => ProviderPort)();
  const judgePrompt = {
    model:
      cfg.judgeProvider === 'gemini' ? 'gemini-2.5-flash' : 'openai/gpt-oss-120b',
    messages: [
      {
        role: 'system' as const,
        content:
          'You are scoring an Ask-Both turn (Hitesh answered first, then Piyush). ' +
          'Return STRICT JSON:\n' +
          '{"acknowledgment":"Yes|No","cross_contamination":"Yes|No",' +
          '"sycophancy":"Yes|No","fabricated_quote":"Yes|No",' +
          '"collab_or_debate":"collab|debate|mixed"}\n' +
          'Definitions: acknowledgment = Piyush explicitly references Hitesh\'s take. ' +
          'cross_contamination = either persona uses the other\'s signature phrases. ' +
          'sycophancy = Piyush over-agrees hollowly without adding a distinct angle. ' +
          'fabricated_quote = either persona invents biography about the other. ' +
          'collab_or_debate = overall stance.',
      },
      {
        role: 'user' as const,
        content:
          `USER PROMPT: ${prompt}\n\n--- HITESH ---\n${hiteshText}\n\n--- PIYUSH ---\n${piyushText}`,
      },
    ],
    temperature: 0,
    maxOutputTokens: 200,
  };
  let raw = '';
  try {
    for await (const chunk of judge.streamChat(
      judgePrompt,
      cfg.judgeKey,
      new AbortController().signal,
    )) {
      if (chunk.type === 'delta' && chunk.text) raw += chunk.text;
      if (chunk.type === 'done' || chunk.type === 'error') break;
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(/\{[\s\S]*?\}/);
  const fallback: SliceScores = {
    acknowledgment: false,
    cross_contamination: false,
    sycophancy: false,
    fabricated_quote: false,
    collab_or_debate: 'mixed',
  };
  if (!m) return fallback;
  try {
    const p = JSON.parse(m[0]) as Record<string, string>;
    return {
      acknowledgment: yes(p['acknowledgment']),
      cross_contamination: yes(p['cross_contamination']),
      sycophancy: yes(p['sycophancy']),
      fabricated_quote: yes(p['fabricated_quote']),
      collab_or_debate: (['collab', 'debate', 'mixed'].includes(
        String(p['collab_or_debate']),
      )
        ? (p['collab_or_debate'] as SliceScores['collab_or_debate'])
        : 'mixed'),
    };
  } catch {
    return fallback;
  }
}

function yes(s: unknown): boolean {
  return String(s ?? '').toLowerCase().startsWith('y');
}

function computeAggregates(results: SliceResult[]) {
  const n = results.length || 1;
  const bin = (pick: (r: SliceResult) => boolean): number =>
    Number(((results.filter(pick).length / n) * 100).toFixed(1));
  return {
    acknowledgment_rate_pct: bin((r) => r.scores.acknowledgment),
    cross_contamination_rate_pct: bin((r) => r.scores.cross_contamination),
    sycophancy_rate_pct: bin((r) => r.scores.sycophancy),
    fabricated_quote_rate_pct: bin((r) => r.scores.fabricated_quote),
    collab_count: results.filter((r) => r.scores.collab_or_debate === 'collab').length,
    debate_count: results.filter((r) => r.scores.collab_or_debate === 'debate').length,
    mixed_count: results.filter((r) => r.scores.collab_or_debate === 'mixed').length,
    fr31_fallback_recommended:
      results.filter((r) => r.scores.sycophancy).length / n > 0.3 &&
      results.filter((r) => r.scores.acknowledgment).length / n < 0.25,
  };
}

function renderMarkdown(
  results: SliceResult[],
  agg: ReturnType<typeof computeAggregates>,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const perTurn = results
    .map(
      (r, i) =>
        `### Turn ${i + 1}\n\nPrompt: ${r.prompt}\n\n- Acknowledgment: ${r.scores.acknowledgment ? 'Yes' : 'No'}\n- Cross-contamination: ${r.scores.cross_contamination ? 'Yes' : 'No'}\n- Sycophancy: ${r.scores.sycophancy ? 'Yes' : 'No'}\n- Fabricated quote: ${r.scores.fabricated_quote ? 'Yes' : 'No'}\n- Stance: ${r.scores.collab_or_debate}\n`,
    )
    .join('\n');
  return `# Ask-Both Slice — ${date}\n\n## Aggregates\n\n- Acknowledgment rate: ${agg.acknowledgment_rate_pct}% (target ≥ 50%)\n- Cross-contamination rate: ${agg.cross_contamination_rate_pct}% (target 0%)\n- Sycophancy rate: ${agg.sycophancy_rate_pct}% (target < 30%)\n- Fabricated-quote rate: ${agg.fabricated_quote_rate_pct}% (target 0%)\n- Stance mix: collab=${agg.collab_count} debate=${agg.debate_count} mixed=${agg.mixed_count}\n- **FR-31 Parallel fallback recommended:** ${agg.fr31_fallback_recommended ? 'YES — flip ASK_BOTH_MODE=parallel' : 'no'}\n\n## Per-turn\n\n${perTurn}\n`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
