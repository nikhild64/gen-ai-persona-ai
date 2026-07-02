import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Spike-0 (E0.5-S1) — 30-min gate: does a browser-direct SSE fetch to
 * `generativelanguage.googleapis.com/v1beta/.../streamGenerateContent?alt=sse`
 * complete without a CORS preflight block from origin `http://localhost:4200`?
 *
 * The component intentionally lives OUTSIDE the adapter layer — this is a
 * raw-fetch smoke test, not the production GeminiAdapter. E2-S1 will land the
 * real adapter under `src/infrastructure/providers/gemini.adapter.ts` and
 * satisfy AD-3 / AD-11. Direct-fetching here is what the spike is testing.
 *
 * Guarded by `FEATURE_SPIKE_ROUTES` in `app.routes.ts`; not linked from any
 * primary UI surface.
 */
@Component({
  selector: 'app-spike-gemini-cors',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="spike-shell">
      <header>
        <h1>Spike-0 — Gemini browser-CORS gate</h1>
        <p class="sub">
          Paste a Gemini API key ({{ keyPattern }}). Click <b>Try streaming</b>.
          <br />
          PASS = tokens appear live in the output panel.
          <br />
          FAIL = the DevTools console shows a CORS block or a fetch error;
          copy the error into the report.
        </p>
      </header>

      <section class="input-row">
        <label>
          <span class="label">API key</span>
          <input
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="AIzaSy…"
            [ngModel]="apiKey()"
            (ngModelChange)="apiKey.set($event)"
          />
        </label>
        <button
          type="button"
          [disabled]="isStreaming() || apiKey().trim().length === 0"
          (click)="tryStreaming()"
        >
          {{ isStreaming() ? 'Streaming…' : 'Try streaming' }}
        </button>
        <button
          type="button"
          [disabled]="!isStreaming()"
          (click)="cancel()"
        >
          Cancel
        </button>
      </section>

      <section class="panels">
        <article class="panel output">
          <h2>Output — live tokens</h2>
          <p class="meta">
            HTTP status:
            <b>{{ status() ?? '—' }}</b>
            &nbsp;|&nbsp; content-type:
            <b>{{ contentType() ?? '—' }}</b>
            &nbsp;|&nbsp; tokens received:
            <b>{{ tokenCount() }}</b>
          </p>
          <pre>{{ output() || '(nothing yet)' }}</pre>
        </article>

        <article class="panel errors">
          <h2>Errors — verbatim</h2>
          <pre>{{ errorLog() || '(none)' }}</pre>
          <p class="hint">
            Also check DevTools → Console and DevTools → Network for any red
            CORS-preflight rows.
          </p>
        </article>
      </section>

      <footer>
        <p>
          Endpoint:
          <code>
            POST
            https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse
          </code>
        </p>
        <p>
          Report back:
          <b>PASS</b> (tokens streaming) or
          <b>FAIL</b> (copy the error text into the report + a screenshot of
          the DevTools Network row).
        </p>
      </footer>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 960px;
        margin: 0 auto;
        padding: 1.5rem;
        font-family:
          system-ui,
          -apple-system,
          'Segoe UI',
          Roboto,
          sans-serif;
        color: #1c1917;
      }
      h1 {
        margin: 0 0 0.25rem;
      }
      .sub {
        color: #57534e;
        line-height: 1.5;
      }
      .input-row {
        display: flex;
        gap: 0.75rem;
        align-items: flex-end;
        margin: 1.25rem 0;
        flex-wrap: wrap;
      }
      .input-row label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1 1 320px;
      }
      .input-row .label {
        font-weight: 600;
        font-size: 0.85rem;
      }
      .input-row input {
        padding: 0.5rem 0.75rem;
        border: 1px solid #d6d3d1;
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .input-row button {
        padding: 0.55rem 1rem;
        border: 1px solid #292524;
        background: #292524;
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      }
      .input-row button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .panels {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      @media (max-width: 720px) {
        .panels {
          grid-template-columns: 1fr;
        }
      }
      .panel {
        border: 1px solid #e7e5e4;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        background: #fafaf9;
      }
      .panel h2 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
      }
      .panel.errors {
        background: #fef2f2;
        border-color: #fecaca;
      }
      .panel pre {
        margin: 0.5rem 0 0;
        max-height: 320px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.85rem;
        line-height: 1.4;
      }
      .meta {
        font-size: 0.8rem;
        color: #57534e;
      }
      .hint {
        font-size: 0.8rem;
        color: #991b1b;
        margin-top: 0.5rem;
      }
      footer {
        margin-top: 1.5rem;
        font-size: 0.85rem;
        color: #57534e;
      }
      footer code {
        display: block;
        white-space: pre-wrap;
        word-break: break-all;
        background: #f5f5f4;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class SpikeGeminiCorsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private controller: AbortController | null = null;

  readonly keyPattern = 'AIza…35 chars';
  readonly apiKey = signal('');
  readonly output = signal('');
  readonly errorLog = signal('');
  readonly status = signal<number | null>(null);
  readonly contentType = signal<string | null>(null);
  readonly tokenCount = signal(0);
  readonly isStreaming = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.controller?.abort());
  }

  cancel(): void {
    this.controller?.abort();
  }

  async tryStreaming(): Promise<void> {
    if (this.isStreaming()) return;

    const key = this.apiKey().trim();
    if (!key) return;

    this.output.set('');
    this.errorLog.set('');
    this.status.set(null);
    this.contentType.set(null);
    this.tokenCount.set(0);
    this.isStreaming.set(true);

    this.controller = new AbortController();

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: 'Say hello in Hinglish, one sentence' }],
              },
            ],
          }),
          signal: this.controller.signal,
        },
      );

      this.status.set(response.status);
      this.contentType.set(response.headers.get('content-type'));

      if (!response.ok || !response.body) {
        const bodyText = await response.text().catch(() => '(no body)');
        this.errorLog.set(
          `Non-2xx or empty body.\nstatus=${response.status}\nbody=${bodyText}`,
        );
        return;
      }

      await this.consumeSseStream(response.body);
    } catch (error) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        this.errorLog.set('Cancelled by user.');
      } else {
        this.errorLog.set(
          `${err.name}: ${err.message}\n\nIf you see "Failed to fetch" or a CORS message here, ` +
            'the browser blocked the request. Fallback (a) or (b) applies — see the story doc.',
        );
      }
    } finally {
      this.isStreaming.set(false);
      this.controller = null;
    }
  }

  private async consumeSseStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let eventEndIdx = buffer.indexOf('\n\n');
      while (eventEndIdx !== -1) {
        const raw = buffer.slice(0, eventEndIdx);
        buffer = buffer.slice(eventEndIdx + 2);
        this.processSseEvent(raw);
        eventEndIdx = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    if (buffer.trim().length > 0) this.processSseEvent(buffer);
  }

  private processSseEvent(raw: string): void {
    const dataLines = raw
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));

    for (const line of dataLines) {
      if (line === '[DONE]') return;
      try {
        const parsed = JSON.parse(line) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === 'string' && text.length > 0) {
          this.output.update((prev) => prev + text);
          this.tokenCount.update((n) => n + 1);
        }
      } catch (err) {
        this.errorLog.update(
          (prev) =>
            prev +
            `\n[parse-error] ${(err as Error).message} :: ${line.slice(0, 200)}`,
        );
      }
    }
  }
}
