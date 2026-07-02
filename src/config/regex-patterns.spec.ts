import { describe, it, expect } from 'vitest';

import { HITESH_REGEX, PIYUSH_REGEX } from './regex-patterns';

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
