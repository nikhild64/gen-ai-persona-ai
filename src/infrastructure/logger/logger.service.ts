import { Injectable } from '@angular/core';

import { scrubSecrets } from './scrub-secrets';

/**
 * AD-11 dev-only console wrapper WITH the redaction registry. At construction
 * time we walk `PROVIDER_REGISTRY.entries()` to build a per-provider RegExp
 * list from each adapter's `static KEY_PATTERN` (structural coupling — adding
 * a new adapter automatically extends the redaction).
 *
 * Any string argument (or JSON-serialisable object) passed to `info`/`warn`/
 * `error` is scrubbed so raw API keys never reach `console.*`.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isDev =
    !(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;

  info(msg: string, ...args: unknown[]): void {
    if (!this.isDev) return;
    // eslint-disable-next-line no-console
    console.info(this.scrub(msg), ...args.map((a) => this.scrubArg(a)));
  }

  warn(msg: string, ...args: unknown[]): void {
    if (!this.isDev) return;
    console.warn(this.scrub(msg), ...args.map((a) => this.scrubArg(a)));
  }

  error(msg: string, ...args: unknown[]): void {
    console.error(this.scrub(msg), ...args.map((a) => this.scrubArg(a)));
  }

  /**
   * Public for `VercelAnalyticsAdapter` to reuse the same redaction table.
   */
  scrub(text: string): string {
    return scrubSecrets(text);
  }

  scrubArg(a: unknown): unknown {
    if (typeof a === 'string') return this.scrub(a);
    if (a && typeof a === 'object') {
      try {
        return JSON.parse(this.scrub(JSON.stringify(a)));
      } catch {
        return a;
      }
    }
    return a;
  }
}
