import { Injectable, inject } from '@angular/core';

import type { StorageKey } from '../../config/storage-keys';
import { STORAGE_PORT } from '../chat/di-tokens';
import type { Thread } from '../types/message';
import type { CustomPersonaId } from '../types/custom-persona';

export const CUSTOM_PERSONA_THREADS_KEY: StorageKey = 'chat:custom-personas:v1';

type CustomThreadBucket = Record<string, Thread>;

/**
 * IndexedDB bucket for custom persona chat threads — one key, many threads.
 */
@Injectable({ providedIn: 'root' })
export class CustomPersonaThreadService {
  private readonly storage = inject(STORAGE_PORT);

  async getThread(id: CustomPersonaId): Promise<Thread | undefined> {
    const bucket = await this.loadBucket();
    return bucket[id];
  }

  async saveThread(id: CustomPersonaId, thread: Thread): Promise<void> {
    const bucket = await this.loadBucket();
    bucket[id] = thread;
    await this.storage.set(CUSTOM_PERSONA_THREADS_KEY, bucket);
  }

  async deleteThread(id: CustomPersonaId): Promise<void> {
    const bucket = await this.loadBucket();
    delete bucket[id];
    await this.storage.set(CUSTOM_PERSONA_THREADS_KEY, bucket);
  }

  async clearAllThreads(): Promise<void> {
    await this.storage.delete(CUSTOM_PERSONA_THREADS_KEY);
  }

  private async loadBucket(): Promise<CustomThreadBucket> {
    const existing = await this.storage.get<CustomThreadBucket>(
      CUSTOM_PERSONA_THREADS_KEY,
    );
    return existing ?? {};
  }
}
