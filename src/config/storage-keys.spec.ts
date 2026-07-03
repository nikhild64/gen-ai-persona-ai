import { describe, it, expect } from 'vitest';

import type { StorageKey } from './storage-keys';
import { CHAT_STORAGE_KEYS } from './storage-keys';
import { PERSONA_IDS } from '../domain/types/persona';

describe('storage-keys (AD-6 closed union)', () => {
  it('accepts all canonical keys via structural typing', () => {
    const keys: StorageKey[] = [
      'chat:hitesh:v1',
      'chat:piyush:v1',
      'chat:musk:v1',
      'chat:jobs:v1',
      'chat:gandhi:v1',
      'chat:einstein:v1',
      'chat:newton:v1',
      'chat:ask-both:v1',
      'chat:custom-personas:v1',
      'settings:v1',
      'settings:ask-both-mode:v1',
      'settings:blended-pair:v1',
    ];
    expect(keys).toHaveLength(12);
    keys.forEach((k) => expect(k.length).toBeGreaterThan(0));
  });

  it('maps every PersonaId to a solo chat storage key', () => {
    for (const id of PERSONA_IDS) {
      expect(CHAT_STORAGE_KEYS[id]).toMatch(/^chat:/);
    }
  });
});
