import { describe, it, expect } from 'vitest';

import {
  HITESH_REGEX,
  PIYUSH_REGEX,
  MUSK_REGEX,
  JOBS_REGEX,
  GANDHI_REGEX,
  EINSTEIN_REGEX,
  NEWTON_REGEX,
  hasBlendedSignature,
  hasBlendedSignatureLegacy,
} from './regex-patterns';

describe('regex-patterns (AD-19)', () => {
  it('matches a Hitesh sample string', () => {
    expect(HITESH_REGEX.test('Haanji chai peeni hai yaar')).toBe(true);
  });

  it('matches a Piyush sample string', () => {
    expect(PIYUSH_REGEX.test('Dekho actually kuch nahi hai yaar')).toBe(true);
  });

  it('matches a Musk sample string', () => {
    expect(MUSK_REGEX.test('Use first principles and physics')).toBe(true);
  });

  it('matches a Jobs sample string', () => {
    expect(JOBS_REGEX.test('Think different — design must be elegant')).toBe(
      true,
    );
  });

  it('matches a Gandhi sample string', () => {
    expect(GANDHI_REGEX.test('Truth and ahimsa through satyagraha')).toBe(
      true,
    );
  });

  it('matches an Einstein sample string', () => {
    expect(
      EINSTEIN_REGEX.test('Imagination and curiosity in a thought experiment'),
    ).toBe(true);
  });

  it('matches a Newton sample string', () => {
    expect(
      NEWTON_REGEX.test(
        'Standing on the shoulders of giants in natural philosophy',
      ),
    ).toBe(true);
  });

  it('misses a fully-English neutral sentence', () => {
    expect(HITESH_REGEX.test('The quick brown fox jumps.')).toBe(false);
    expect(PIYUSH_REGEX.test('The quick brown fox jumps.')).toBe(false);
    expect(MUSK_REGEX.test('The quick brown fox jumps.')).toBe(false);
  });
});

describe('hasBlendedSignature (V2 pair-aware)', () => {
  it('matches when persona A signature is present', () => {
    expect(hasBlendedSignature('Haanji chalo baat karte hain', 'hitesh', 'musk')).toBe(
      true,
    );
  });

  it('matches when persona B signature is present', () => {
    expect(hasBlendedSignature('first principles on Mars', 'hitesh', 'musk')).toBe(
      true,
    );
  });

  it('matches Musk + Jobs pair signatures', () => {
    expect(hasBlendedSignature('elegant design', 'musk', 'jobs')).toBe(true);
    expect(hasBlendedSignature('first principles physics', 'musk', 'jobs')).toBe(
      true,
    );
  });

  it('misses when neither persona signature is present', () => {
    expect(
      hasBlendedSignature('The weather is nice today.', 'gandhi', 'einstein'),
    ).toBe(false);
  });

  it('legacy helper defaults to Hitesh + Piyush', () => {
    expect(hasBlendedSignatureLegacy('Dekho, ek kaam karte hain')).toBe(true);
  });
});
