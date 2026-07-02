import { Injectable } from '@angular/core';
import { get, set, del } from 'idb-keyval';

import type { StoragePort } from '../../domain/ports/storage.port';
import type { StorageKey } from '../../config/storage-keys';

/**
 * AD-6 single-writer discipline — the SOLE writer to IndexedDB. All other
 * files reach IndexedDB through this port. `KeyVaultService` (AD-11) is the
 * only other browser-storage-privileged file, and it uses `sessionStorage`,
 * not IndexedDB.
 */
@Injectable()
export class IdbKeyvalStorageAdapter implements StoragePort {
  async get<T>(key: StorageKey): Promise<T | undefined> {
    return get<T>(key);
  }

  async set<T>(key: StorageKey, value: T): Promise<void> {
    await set(key, value);
  }

  async delete(key: StorageKey): Promise<void> {
    await del(key);
  }
}
