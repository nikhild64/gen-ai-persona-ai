import { describe, it, expect } from 'vitest';

import type { StorageKey } from './storage-keys';

describe('storage-keys (AD-6 closed union)', () => {
  it('accepts all canonical keys via structural typing', () => {
    const keys: StorageKey[] = [
      'chat:hitesh:v1',
      'chat:piyush:v1',
      'chat:ask-both:v1',
      'settings:v1',
      'settings:ask-both-mode:v1',
    ];
    expect(keys).toHaveLength(5);
    keys.forEach((k) => expect(k.length).toBeGreaterThan(0));
  });

  it('AC-7: includes settings:ask-both-mode:v1 for the post-sprint Blended variant preference', () => {
    const key: StorageKey = 'settings:ask-both-mode:v1';
    expect(key).toBe('settings:ask-both-mode:v1');
  });
});
