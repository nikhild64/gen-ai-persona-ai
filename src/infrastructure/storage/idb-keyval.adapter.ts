import { Injectable } from '@angular/core';
import { get, set, del } from 'idb-keyval';

import type { StoragePort } from '../../domain/ports/storage.port';
import { StorageUnavailableError } from '../../domain/ports/storage.port';
import type { StorageKey } from '../../config/storage-keys';

/**
 * AD-6 single-writer discipline — the SOLE writer to IndexedDB. All other
 * files reach IndexedDB through this port. `KeyVaultService` (AD-11) is the
 * only other browser-storage-privileged file, and it uses in-memory keys,
 * not IndexedDB.
 */
@Injectable()
export class IdbKeyvalStorageAdapter implements StoragePort {
  async get<T>(key: StorageKey): Promise<T | undefined> {
    try {
      return await get<T>(key);
    } catch (err) {
      throw new StorageUnavailableError(err);
    }
  }

  async set<T>(key: StorageKey, value: T): Promise<void> {
    try {
      await set(key, value);
    } catch (err) {
      throw new StorageUnavailableError(err);
    }
  }

  async delete(key: StorageKey): Promise<void> {
    try {
      await del(key);
    } catch (err) {
      throw new StorageUnavailableError(err);
    }
  }
}
