import { Injectable } from '@angular/core';

import type { StoragePort } from '../ports/storage.port';
import type { StorageKey } from '../../config/storage-keys';

/**
 * Dev-time StoragePort stub — an in-memory Map. E3-S1 swaps this out for the
 * `IdbKeyvalStorageAdapter` in `src/infrastructure/storage/` via Angular DI.
 * Nothing outside DI wiring needs to change when the swap happens.
 */
@Injectable()
export class InMemoryStorageAdapter implements StoragePort {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: StorageKey): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async set<T>(key: StorageKey, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: StorageKey): Promise<void> {
    this.map.delete(key);
  }
}
