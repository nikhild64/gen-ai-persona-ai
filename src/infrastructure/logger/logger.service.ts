import { Injectable } from '@angular/core';

/**
 * Dev-only console wrapper. E6-S1 wires a redaction registry to strip API
 * keys and other sensitive strings before anything reaches `console.*` or
 * the Vercel analytics beacon.
 *
 * Feature code should never call `console.*` directly (per AD Consistency
 * Conventions "Logging (dev)" row) — use this service.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isDev =
    !(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;

  info(msg: string, ...args: unknown[]): void {
    if (this.isDev) {
      // eslint-disable-next-line no-console
      console.info(msg, ...args);
    }
  }

  warn(msg: string, ...args: unknown[]): void {
    if (this.isDev) {
      console.warn(msg, ...args);
    }
  }

  error(msg: string, ...args: unknown[]): void {
    console.error(msg, ...args);
  }
}
