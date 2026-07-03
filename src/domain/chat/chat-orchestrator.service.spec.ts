import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ChatOrchestrator,
  ADAPTER_FACTORY,
} from './chat-orchestrator.service';
import {
  STORAGE_PORT,
  MODERATION_PORT,
  ANALYTICS_PORT,
} from './di-tokens';
import { InMemoryStorageAdapter } from './testing/in-memory-storage.adapter';
import { KeyVaultService } from '../key-vault/key-vault.service';
import { MockAdapter } from '../../infrastructure/providers/testing/mock.adapter';
import type {
  AnalyticsEvent,
  AnalyticsPort,
} from '../ports/analytics.port';
import type {
  ModerationPort,
  ModerationVerdict,
} from '../ports/moderation.port';
import type { Thread } from '../types/message';

class RecordingAnalytics implements AnalyticsPort {
  readonly events: AnalyticsEvent[] = [];
  emit(event: AnalyticsEvent): void {
    this.events.push(event);
  }
}

class ScriptableModeration implements ModerationPort {
  input: ModerationVerdict = { allowed: true };
  output: ModerationVerdict = { allowed: true };
  async check(
    _text: string,
    direction: 'input' | 'output',
  ): Promise<ModerationVerdict> {
    return direction === 'input' ? this.input : this.output;
  }
}

function build(mockAdapter: MockAdapter) {
  const analytics = new RecordingAnalytics();
  const moderation = new ScriptableModeration();
  const AdapterClass = class {
    constructor() {
      return mockAdapter;
    }
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: STORAGE_PORT, useClass: InMemoryStorageAdapter },
      { provide: MODERATION_PORT, useValue: moderation },
      { provide: ANALYTICS_PORT, useValue: analytics },
      {
        provide: ADAPTER_FACTORY,
        useValue: (_id: string) => AdapterClass as unknown as new () => unknown,
      },
    ],
  });
  const keyVault = TestBed.inject(KeyVaultService);
  vi.spyOn(keyVault, 'getKeyForProvider').mockReturnValue('AIza-test-key');
  const orchestrator = TestBed.inject(ChatOrchestrator);
  return { orchestrator, analytics, moderation };
}

function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  return (async () => {
    const out: T[] = [];
    for await (const item of iterable) out.push(item);
    return out;
  })();
}

describe('ChatOrchestrator', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('accumulates delta chunks into accumulatedText and persists on done', async () => {
    const mock = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Ha' },
        { type: 'delta', text: 'anji' },
        { type: 'done', meta: { tokens: 2, model: 'mock' } },
      ],
      0,
    );
    const { orchestrator, analytics } = build(mock);
    await new Promise<void>((resolve, reject) => {
      orchestrator.sendMessage('musk', 'hi').subscribe({
        error: reject,
        complete: resolve,
      });
    });

    expect(orchestrator.accumulatedText()).toBe('Haanji');
    expect(orchestrator.inFlightStream()).toBe(false);
    const messageSent = analytics.events.find((e) => e.name === 'message_sent');
    expect(messageSent).toBeTruthy();
    const storage = TestBed.inject(STORAGE_PORT);
    const thread = (await storage.get<Thread>('chat:musk:v1'))!;
    expect(thread.messages.at(-1)?.role).toBe('assistant');
    expect(thread.messages.at(-1)?.status).toBe('complete');
  });

  it('emits persona_regex_miss when the reply lacks signature phrases', async () => {
    const mock = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Just plain English reply here.' },
        { type: 'done', meta: { tokens: 1, model: 'mock' } },
      ],
      0,
    );
    const { orchestrator, analytics } = build(mock);
    await new Promise<void>((resolve) =>
      orchestrator.sendMessage('musk', 'plz').subscribe({ complete: resolve }),
    );
    const miss = analytics.events.find((e) => e.name === 'persona_regex_miss');
    expect(miss).toBeTruthy();
  });

  it('blocks input moderation and emits moderation_blocked', async () => {
    const mock = new MockAdapter().configure([], 0);
    const { orchestrator, analytics, moderation } = build(mock);
    moderation.input = { allowed: false, category: 'off_domain' };
    await new Promise<void>((resolve) =>
      orchestrator.sendMessage('jobs', 'quantum physics').subscribe({
        complete: resolve,
      }),
    );
    expect(
      analytics.events.find((e) => e.name === 'moderation_blocked')?.payload,
    ).toMatchObject({ direction: 'input', category: 'off_domain' });
  });

  it('marks the assistant message cancelled when the stream is aborted', async () => {
    const mock = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Ha' },
        { type: 'delta', text: 'a' },
        { type: 'delta', text: 'nji' },
      ],
      15,
    );
    const { orchestrator } = build(mock);
    const done = new Promise<void>((resolve) =>
      orchestrator.sendMessage('musk', 'hi').subscribe({ complete: resolve }),
    );
    setTimeout(() => orchestrator.cancelInFlight(), 10);
    await done;
    const storage = TestBed.inject(STORAGE_PORT);
    const thread = (await storage.get<Thread>('chat:musk:v1'))!;
    const last = thread.messages.at(-1);
    expect(last?.status).toBe('cancelled');
  });

  it('exposes readonly signal views via .views', () => {
    const mock = new MockAdapter().configure([], 0);
    const { orchestrator } = build(mock);
    expect(orchestrator.views.accumulatedText()).toBe('');
    expect(orchestrator.views.inFlightStream()).toBe(false);
    expect(orchestrator.views.streamStalled()).toBe(false);
  });
});
