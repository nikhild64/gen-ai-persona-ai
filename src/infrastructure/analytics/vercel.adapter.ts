import { Injectable, inject } from '@angular/core';

import type {
  AnalyticsPort,
  AnalyticsEvent,
} from '../../domain/ports/analytics.port';
import { LoggerService } from '../logger/logger.service';

/**
 * AD-15 + AD-11 — typed analytics emitter with the shared redaction registry
 * from `LoggerService`. Payloads round-trip through
 * `JSON.stringify → scrub → JSON.parse` before either the dev-console line
 * or the eventual Vercel Web Analytics beacon (E11-S3 wires the real
 * beacon; this story keeps the console fallback so events are inspectable
 * during development).
 */
@Injectable()
export class VercelAnalyticsAdapter implements AnalyticsPort {
  private readonly logger = inject(LoggerService);

  emit(event: AnalyticsEvent): void {
    const scrubbed = this.scrubEvent(event);
    this.logger.info(`[analytics] ${scrubbed.name}`, scrubbed.payload);
    // E11-S3 will layer `navigator.sendBeacon('/_vercel/insights/event', ...)`
    // with a `fetch({ keepalive: true })` fallback here — fire-and-forget per
    // AD-21.
  }

  private scrubEvent(event: AnalyticsEvent): AnalyticsEvent {
    try {
      const scrubbedJson = this.logger.scrub(JSON.stringify(event));
      return JSON.parse(scrubbedJson) as AnalyticsEvent;
    } catch {
      return event;
    }
  }
}
