# Story E11-S3: Performance-budget synthetic check via headless Chromium

Status: ready-for-dev

- **Epic:** 11 — Eval Infrastructure & Golden Set
- **Critical-path position:** 34 of 37 (Day 7 afternoon)
- **Blocks:** E12-S3
- **Depends on:** E11-S1

## Story

As a **cohort grader**,
I want **an `npm run eval:perf` command that verifies the deployed URL hits LCP ≤ 2.0s and chat TTFT ≤ 2.0s p90, so I know the SM-4 UX rubric target is met**,
So that **performance isn't just claimed in the docs — it's measurably enforced in CI on demand**.

## Acceptance Criteria

**Given** the developer authors `evals/performance-budget.ts` using `playwright` (added to `devDependencies`) headless Chromium,
**When** the script runs against a URL (default the deployed Vercel URL, override via CLI arg for staging preview),
**Then** it (a) loads the URL and measures LCP via `PerformanceObserver`; (b) triggers a chat send via a scripted flow with a mock provider key that returns a canned response with a deterministic latency; (c) measures TTFT via `performance.mark('first-token')` custom mark from `ChatOrchestrator` (Epic 2); (d) asserts LCP ≤ 2.0s on cable simulation, TTFT p90 ≤ 2.0s across 5 warm runs; (e) exits non-zero on regression, writes a report to `evals/perf-report-YYYY-MM-DD.md`.

**Given** the script runs against `localhost:4200` (dev server),
**When** the developer runs `npm run eval:perf -- --url http://localhost:4200`,
**Then** the perf test skips the "cable simulation" throttling (dev-server has no CDN caching, LCP will be higher) and just reports raw numbers with a `[dev-mode]` tag.

**Given** the developer runs `npm run eval:perf` against production without a real BYO-Key handy,
**When** the script uses the `TEST_PROVIDER_REGISTRY` mock adapter,
**Then** TTFT is measured against the mock's deterministic delay (e.g., 500ms first delta) — this proves the plumbing hits the target without depending on real Gemini/Groq quota.

**Given** the perf test is not run per-commit,
**When** the developer documents run cadence,
**Then** `docs/performance.md` (Epic 12) captures: "Run `npm run eval:perf` pre-release (before Vercel deploy tag) and after any change to `src/features/chat/` or `src/infrastructure/providers/`. Not run in every commit."

**Given** the bundle-size ceiling is separately monitored,
**When** the developer runs `ng build --stats-json` + `source-map-explorer dist/gen-ai-persona-ai/browser/main-*.js` pre-release,
**Then** the initial JS is ≤ 200KB gzip per AD-21; if the ceiling is breached, `docs/performance.md` gets a note + a mitigation plan (e.g., lazy-load a large dependency).

**verifies:** SM-4 (UX rubric — LCP + TTFT targets), AD-21 (performance budget + measurement discipline), PRD §6 (performance targets)

**touches:** `evals/performance-budget.ts`, `evals/perf-report-YYYY-MM-DD.md` (produced by script), `package.json` (add `"eval:perf": "tsx evals/performance-budget.ts"` script + `playwright` in devDependencies), `docs/performance.md` (Epic 12 hosts the file; the perf-cadence content lives here)

**test target:** eval (`npm run eval:perf` against deployed URL produces a report; assertions fire on LCP > 2.0s or TTFT p90 > 2.0s) + manual smoke test (run against dev-server, run against deployed Vercel URL, compare numbers)

## Developer Context

Synthetic perf check via Playwright headless Chromium. Loads URL, measures LCP, triggers chat send, measures TTFT via custom mark from ChatOrchestrator, asserts against PRD §6 thresholds.

**TTFT custom mark:** ChatOrchestrator emits `performance.mark('first-token')` on first delta arrival. E2-S4 wired this into the send flow (via TTFT custom mark for AD-21 measurement). Playwright reads back marks via `page.evaluate(() => performance.getEntriesByName('first-token'))`.

## Technical Requirements

### `evals/performance-budget.ts`

```ts
#!/usr/bin/env tsx
import { chromium } from 'playwright';

const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'https://chai-code-personas.vercel.app';
const isDev = url.includes('localhost');
const N_RUNS = 5;

const browser = await chromium.launch();
const context = await browser.newContext();
const ttftSamples: number[] = [];
let lcp: number | null = null;

for (let run = 0; run < N_RUNS; run++) {
  const page = await context.newPage();
  if (!isDev) await page.route('**/*', (route) => { /* apply throttling */ route.continue(); });

  // Load + measure LCP
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  lcp = await page.evaluate(() => new Promise<number>((res) => {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
      res(latest.renderTime ?? latest.loadTime ?? 0);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }));

  // Trigger chat send via mock provider (inject key + text via URL param or DOM)
  await page.evaluate(() => sessionStorage.setItem('byo-key:gemini', 'AIzaSy_test_35_chars_XXXXXXXXXXXXXXXXX'));
  await page.click('a[href*="/chat/hitesh"]');
  await page.fill('textarea', 'Hi in one word');
  await page.press('textarea', 'Enter');

  const ttft = await page.evaluate(() => new Promise<number>((res) => {
    const check = () => {
      const marks = performance.getEntriesByName('first-token');
      if (marks.length > 0) res(marks[0].startTime);
      else setTimeout(check, 50);
    };
    check();
  }));
  ttftSamples.push(ttft);

  await page.close();
}

const ttftP90 = percentile(ttftSamples, 0.9);
const passed = (lcp ?? 0) <= 2000 && ttftP90 <= 2000;

writeReport({ url, isDev, lcp, ttftSamples, ttftP90, passed });
if (!passed) process.exit(1);
```

### `docs/performance.md` — content authored here, file placed in E12-S1

```markdown
# Performance — Chai Code Personas

## Targets per PRD §6 + AD-21

- **LCP** ≤ 2.0s on cable simulation (landing route).
- **TTFT** p90 ≤ 2.0s (chat message send to first token).
- **Total response** p50 ≤ 8s for 150-300 word responses.
- **Ask-Both total** p50 ≤ 16s (2× Solo).
- **IndexedDB restore** ≤ 500ms median on 100-message thread cold cache (AD-21 FR-14).
- **Initial JS bundle** ≤ 200KB gzip (measured pre-release via `ng build --stats-json` + `source-map-explorer`).

## Run cadence

- `npm run eval:perf` — pre-release (before Vercel deploy tag) and after any change to `src/features/chat/` or `src/infrastructure/providers/`.
- Bundle-size check — pre-release only.
- Not run in every commit.

## Last measured values (fill after eval)

- LCP: XXms
- TTFT p90: XXms
- Initial JS: XX KB gzip
```

## Architecture Compliance

- **AD-21:** performance budget measurement + assertion.
- **SM-4:** UX rubric perf targets verified.

## Library / Framework Requirements

```
playwright@^1.40   # devDependency
```

## File Structure Requirements

```
evals/
  performance-budget.ts    # NEW
  perf-report-*.md         # produced by script
package.json                # UPDATE scripts + devDeps
docs/performance.md         # CONTENT authored here; E12-S1 places file
```

## Testing Requirements

- Script smoke: run against local dev server (dev-mode tag); run against deployed URL.
- Assert non-zero exit on LCP > 2.0s.

## Latest Tech Information

- Playwright `page.evaluate` with `PerformanceObserver` is standard for LCP measurement.
- Custom performance marks from ChatOrchestrator persist across page.evaluate boundaries.

## Previous Story Intelligence

**E11-S1:** basic eval infrastructure.
**E2-S4 / E2-S3:** ChatOrchestrator emits `performance.mark('first-token')` on first delta.

## Project Context Reference

- ARCHITECTURE-SPINE.md `AD-21` performance budget + measurement (lines 288–298).
- PRD §6 performance targets.
- Sprint status: key `e11-s3-performance-budget-headless-check`, blocks `[e12-s3]`.

## References

- [Source: ARCHITECTURE-SPINE.md#AD-21] LCP + TTFT + bundle-size ceilings.
- [Source: prd.md#§6] Performance targets.

## Story Completion Status

- [ ] `evals/performance-budget.ts` runs against URL, measures LCP + TTFT, produces report.
- [ ] `playwright` added to devDependencies.
- [ ] `npm run eval:perf` script added.
- [ ] `docs/performance.md` content authored (E12-S1 places file).
- [ ] Manual smoke against dev-server + production URL.
