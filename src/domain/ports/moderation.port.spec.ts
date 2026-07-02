import { describe, it, expect } from 'vitest';

import type {
  ModerationPort,
  ModerationVerdict,
  ModerationCategory,
} from './moderation.port';
import { assertNever } from '../types/persona';

class AllowAllModeration implements ModerationPort {
  async check(
    _text: string,
    _direction: 'input' | 'output',
  ): Promise<ModerationVerdict> {
    return { allowed: true };
  }
}

class BlockOffDomain implements ModerationPort {
  async check(text: string): Promise<ModerationVerdict> {
    if (/quantum/i.test(text)) {
      return {
        allowed: false,
        category: 'off_domain',
        suggested_refusal: 'stay on topic',
      };
    }
    return { allowed: true };
  }
}

describe('ModerationPort', () => {
  it('a mock allow-all implementation returns allowed=true', async () => {
    const port: ModerationPort = new AllowAllModeration();
    expect((await port.check('hi', 'input')).allowed).toBe(true);
  });

  it('a mock blocker returns a categorised verdict', async () => {
    const port: ModerationPort = new BlockOffDomain();
    const v = await port.check('what about quantum computing?', 'input');
    expect(v.allowed).toBe(false);
    expect(v.category).toBe('off_domain');
  });

  it('ModerationCategory is exhaustively switchable', () => {
    const cats: ModerationCategory[] = [
      'jailbreak',
      'off_domain',
      'adult',
      'political',
      'hate',
      'self_harm',
    ];
    const label = (c: ModerationCategory): string => {
      switch (c) {
        case 'jailbreak':
        case 'off_domain':
        case 'adult':
        case 'political':
        case 'hate':
        case 'self_harm':
          return c;
        default:
          return assertNever(c);
      }
    };
    cats.forEach((c) => expect(label(c)).toBe(c));
  });
});
