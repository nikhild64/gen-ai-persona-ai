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
  templateUrl: './spike-gemini-cors.component.html',
  styleUrls: ['./spike-gemini-cors.component.scss'],
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
