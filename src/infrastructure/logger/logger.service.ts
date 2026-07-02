import { Injectable } from '@angular/core';

import { PROVIDER_REGISTRY } from '../providers/provider.registry';
import type { ProviderId } from '../../config/provider-registry';

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
  private readonly patterns: Array<{
    providerId: ProviderId;
    regex: RegExp;
  }>;

  private readonly isDev =
    !(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;

  constructor() {
    this.patterns = Array.from(PROVIDER_REGISTRY.entries()).map(
      ([id, cls]) => ({
        providerId: id,
        regex: LoggerService.toGlobalRegex(
          (cls as unknown as { KEY_PATTERN: RegExp }).KEY_PATTERN,
        ),
      }),
    );
  }

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
    let out = text;
    for (const { providerId, regex } of this.patterns) {
      out = out.replace(regex, `[REDACTED-${providerId}-KEY]`);
    }
    return out;
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

  private static toGlobalRegex(rx: RegExp): RegExp {
    return rx.flags.includes('g') ? rx : new RegExp(rx.source, rx.flags + 'g');
  }
}
