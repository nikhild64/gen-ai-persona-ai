import { Injectable } from '@angular/core';

import type {
  ModerationPort,
  ModerationVerdict,
} from '../../domain/ports/moderation.port';

/**
 * FEATURE_MODERATION=false swap target — always allows. Wired conditionally
 * in `app.config.ts` per feature-flag value.
 */
@Injectable()
export class NoOpModerationAdapter implements ModerationPort {
  async check(): Promise<ModerationVerdict> {
    return { allowed: true };
  }
}
