import { Injectable, inject } from '@angular/core';

import type {
  AnalyticsPort,
  AnalyticsEvent,
} from '../../domain/ports/analytics.port';
import { LoggerService } from '../logger/logger.service';

/**
 * AD-15 — typed AnalyticsPort implementation. In this story the beacon is
 * stubbed to a `LoggerService.info` line so we can see events in the dev
 * console. E6-S1 layers the redaction registry (KEY_PATTERN scrub). E11-S3
 * verifies the production Vercel Web Analytics beacon.
 */
@Injectable()
export class VercelAnalyticsAdapter implements AnalyticsPort {
  private readonly logger = inject(LoggerService);

  emit(event: AnalyticsEvent): void {
    this.logger.info(`[analytics] ${event.name}`, event.payload);
    // Fire-and-forget: E11-S3 will replace this with navigator.sendBeacon /
    // fetch({ keepalive: true }) — never awaited per AD-21.
  }
}
