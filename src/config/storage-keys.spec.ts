import { describe, it, expect } from 'vitest';

import type { StorageKey } from './storage-keys';

describe('storage-keys (AD-6 closed union)', () => {
  it('accepts the four canonical keys via structural typing', () => {
    const keys: StorageKey[] = [
      'chat:hitesh:v1',
      'chat:piyush:v1',
      'chat:ask-both:v1',
      'settings:v1',
    ];
    expect(keys).toHaveLength(4);
    keys.forEach((k) => expect(k.length).toBeGreaterThan(0));
  });
});
