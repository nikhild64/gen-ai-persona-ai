import { describe, it, expect } from 'vitest';

import {
  HITESH_REGEX,
  PIYUSH_REGEX,
  hasBlendedSignature,
} from './regex-patterns';

describe('regex-patterns (AD-19)', () => {
  it('matches a Hitesh sample string', () => {
    expect(HITESH_REGEX.test('Haanji chai peeni hai yaar')).toBe(true);
  });

  it('matches a Piyush sample string', () => {
    expect(PIYUSH_REGEX.test('Dekho actually kuch nahi hai yaar')).toBe(true);
  });

  it('misses a fully-English neutral sentence', () => {
    expect(HITESH_REGEX.test('The quick brown fox jumps.')).toBe(false);
    expect(PIYUSH_REGEX.test('The quick brown fox jumps.')).toBe(false);
  });
});

describe('hasBlendedSignature (post-sprint Blended Ask-Both, AC-10)', () => {
  it('matches when Hitesh signature phrase is present', () => {
    expect(hasBlendedSignature('Haanji chalo baat karte hain')).toBe(true);
  });

  it('matches when Piyush signature phrase is present', () => {
    expect(hasBlendedSignature('Dekho, ek kaam karte hain')).toBe(true);
  });

  it('matches when BOTH persona signatures are present (fused voice)', () => {
    expect(
      hasBlendedSignature(
        'Haanji, dekho — chai ke saath baat samajh aayi na?',
      ),
    ).toBe(true);
  });

  it('misses when reply lacks any persona signature phrase', () => {
    expect(hasBlendedSignature('The quick brown fox jumps.')).toBe(false);
  });
});
