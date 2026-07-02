import { Injectable } from '@angular/core';

import type { StoragePort } from '../../ports/storage.port';
import type { StorageKey } from '../../../config/storage-keys';

/**
 * Test-only in-memory `StoragePort`. Moved here from `chat-thread.service.ts`
 * when E3-S1 swapped production storage to `IdbKeyvalStorageAdapter`.
 * TestBed fixtures inject this to keep specs hermetic.
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
