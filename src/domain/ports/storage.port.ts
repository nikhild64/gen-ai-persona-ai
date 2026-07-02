import type { StorageKey } from '../../config/storage-keys';

/**
 * AD-6 (StoragePort single-writer discipline): every disk read/write goes
 * through this port. Concrete impl in `src/infrastructure/storage/idb-keyval.adapter.ts`
 * lands in E3-S1.
 *
 * `StorageKey` is a closed union declared in `src/config/storage-keys.ts`
 * (stubbed as `string` in E0-S2, tightened in E0-S3).
 */
export interface StoragePort {
  get<T>(key: StorageKey): Promise<T | undefined>;
  set<T>(key: StorageKey, value: T): Promise<void>;
  delete(key: StorageKey): Promise<void>;
}
