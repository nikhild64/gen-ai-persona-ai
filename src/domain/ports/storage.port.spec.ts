import { describe, it, expect } from 'vitest';

import type { StoragePort } from './storage.port';
import type { StorageKey } from '../../config/storage-keys';

class InMemoryStorage implements StoragePort {
  private readonly store = new Map<string, unknown>();
  async get<T>(key: StorageKey): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }
  async set<T>(key: StorageKey, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: StorageKey): Promise<void> {
    this.store.delete(key);
  }
}

describe('StoragePort', () => {
  it('a mock class implements the interface and round-trips values', async () => {
    const storage: StoragePort = new InMemoryStorage();
    await storage.set<number>('chat:count:v1', 3);
    expect(await storage.get<number>('chat:count:v1')).toBe(3);
    await storage.delete('chat:count:v1');
    expect(await storage.get<number>('chat:count:v1')).toBeUndefined();
  });
});
