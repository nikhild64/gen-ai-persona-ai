import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const map = new Map<string, unknown>();
  return {
    get: vi.fn(async (k: string) => map.get(k)),
    set: vi.fn(async (k: string, v: unknown) => {
      map.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
      map.delete(k);
    }),
    __map: map,
  };
});

import { IdbKeyvalStorageAdapter } from './idb-keyval.adapter';
import type { Thread } from '../../domain/types/message';

describe('IdbKeyvalStorageAdapter', () => {
  let adapter: IdbKeyvalStorageAdapter;

  beforeEach(() => {
    adapter = new IdbKeyvalStorageAdapter();
  });

  it('round-trips a Thread through set/get', async () => {
    const thread: Thread = {
      id: 't',
      scope: 'musk',
      messages: [],
      rollingSummary: null,
      turnsSinceLastSummary: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    await adapter.set<Thread>('chat:musk:v1', thread);
    const back = await adapter.get<Thread>('chat:musk:v1');
    expect(back).toEqual(thread);
  });

  it('delete clears the value', async () => {
    await adapter.set<number>('settings:v1', 42);
    await adapter.delete('settings:v1');
    expect(await adapter.get<number>('settings:v1')).toBeUndefined();
  });
});
