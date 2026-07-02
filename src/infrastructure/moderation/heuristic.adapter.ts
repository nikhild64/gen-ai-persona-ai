import { Injectable } from '@angular/core';

import type {
  ModerationPort,
  ModerationVerdict,
} from '../../domain/ports/moderation.port';

/**
 * AD-12 — heuristic client-side moderation adapter. This story lands the SHAPE
 * (allow-all stub) so ChatOrchestrator can wire input + output checks. E8-S2
 * replaces with real regex/keyword denylists + persona-specific refusal
 * template lookup.
 */
@Injectable()
export class HeuristicModerationAdapter implements ModerationPort {
  async check(
    _text: string,
    _direction: 'input' | 'output',
  ): Promise<ModerationVerdict> {
    return { allowed: true };
  }
}
