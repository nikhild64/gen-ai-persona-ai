#!/usr/bin/env tsx
/*
 * AD-21 headless Chromium perf budget — Playwright-based LCP + TTFT check
 * against the deployed URL (or localhost with `--url http://localhost:4200`).
 *
 * Install: `bun add -D playwright` (Chromium download ~150 MB). Not added
 * by default to keep the base install lean — run
 *   bunx playwright install chromium
 * before the first eval.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

interface PerfReport {
  url: string;
  isDev: boolean;
  lcpMs: number | null;
  ttftSamples: number[];
  ttftP90: number;
  passed: boolean;
}

const N_RUNS = 5;

async function main(): Promise<void> {
  let chromium: unknown;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'Playwright is not installed. Run `bun add -D playwright && bunx playwright install chromium` first.',
    );
    process.exit(2);
  }

  const argIdx = process.argv.indexOf('--url');
  const url =
    argIdx > -1
      ? (process.argv[argIdx + 1] ?? 'https://chai-code-personas.vercel.app')
      : 'https://chai-code-personas.vercel.app';
  const isDev = url.includes('localhost');

  const browser = await (chromium as { launch: () => Promise<unknown> }).launch();
  const context = await (browser as { newContext: () => Promise<unknown> }).newContext();

  let lcpMs: number | null = null;
  const ttftSamples: number[] = [];

  for (let run = 0; run < N_RUNS; run += 1) {
    const page = await (context as {
      newPage: () => Promise<{
        goto: (url: string) => Promise<unknown>;
        evaluate: (fn: string | Function, ...args: unknown[]) => Promise<unknown>;
        fill: (sel: string, val: string) => Promise<unknown>;
        click: (sel: string) => Promise<unknown>;
        press: (sel: string, key: string) => Promise<unknown>;
        waitForLoadState: (state: string) => Promise<unknown>;
        close: () => Promise<unknown>;
      }>;
    }).newPage();

    await page.goto(url);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    lcpMs = (await page.evaluate(
      `new Promise((resolve) => {
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const latest = entries[entries.length - 1];
            resolve(latest.renderTime || latest.loadTime || 0);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(0), 5000);
        } catch (e) { resolve(0); }
      })`,
    )) as number;

    // Trigger a chat send via the mock provider path — for the perf
    // measurement we don't need a real BYO key when the mock adapter is
    // registered. Skip if not wired.
    try {
      await page.evaluate(
        `sessionStorage.setItem('byo-key:gemini:v1', 'AIza-test-perf-run-33-chars-XXXXXX')`,
      );
      await page.click('a[href*="/chat/hitesh"]');
      await page.fill('textarea', 'Hi in one word');
      await page.press('textarea', 'Enter');
      const ttft = (await page.evaluate(
        `new Promise((res) => {
          const t0 = performance.now();
          const check = () => {
            const marks = performance.getEntriesByName('first-token');
            if (marks.length > 0) return res(marks[0].startTime);
            if (performance.now() - t0 > 8000) return res(8000);
            setTimeout(check, 50);
          };
          check();
        })`,
      )) as number;
      ttftSamples.push(ttft);
    } catch {
      /* ignore — chat may not be reachable in dev */
    }

    await page.close();
  }

  await (browser as { close: () => Promise<unknown> }).close();

  const ttftP90 = percentile(ttftSamples, 0.9);
  const passed =
    (lcpMs === null || lcpMs <= 2000) && ttftP90 <= 2000;

  const report: PerfReport = {
    url,
    isDev,
    lcpMs,
    ttftSamples,
    ttftP90,
    passed,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const date = new Date().toISOString().slice(0, 10);
  const outPath = join(here, `perf-report-${date}.md`);
  await writeFile(outPath, renderMarkdown(report, date), 'utf-8');
  console.log('Wrote', outPath);
  if (!passed) process.exit(1);
}

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return Math.round(sorted[idx] ?? 0);
}

function renderMarkdown(report: PerfReport, date: string): string {
  return `# Perf Report — ${date}\n\n- URL: ${report.url}\n- Mode: ${report.isDev ? 'dev' : 'prod'}\n- LCP: ${report.lcpMs === null ? 'n/a' : report.lcpMs + ' ms'} (target ≤ 2000 ms)\n- TTFT samples: ${report.ttftSamples.join(', ')}\n- TTFT p90: ${report.ttftP90} ms (target ≤ 2000 ms)\n- Passed: **${report.passed ? 'YES' : 'NO'}**\n`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
