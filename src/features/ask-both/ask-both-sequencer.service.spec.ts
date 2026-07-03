import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  AskBothSequencerService,
  ASK_BOTH_ADAPTER_FACTORY,
} from './ask-both-sequencer.service';
import { InMemoryStorageAdapter } from '../../domain/chat/testing/in-memory-storage.adapter';
import { MockAdapter } from '../../infrastructure/providers/testing/mock.adapter';
import {
  STORAGE_PORT,
  MODERATION_PORT,
  ANALYTICS_PORT,
} from '../../domain/chat/di-tokens';
import type {
  AnalyticsEvent,
  AnalyticsPort,
} from '../../domain/ports/analytics.port';
import type {
  ModerationPort,
  ModerationVerdict,
} from '../../domain/ports/moderation.port';
import type { Thread } from '../../domain/types/message';
import { KeyVaultService } from '../../domain/key-vault/key-vault.service';

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
        provide: ASK_BOTH_ADAPTER_FACTORY,
        useValue: (_id: string) => AdapterClass as unknown as new () => unknown,
      },
    ],
  });
  const keyVault = TestBed.inject(KeyVaultService);
  vi.spyOn(keyVault, 'getKeyForProvider').mockReturnValue('AIza-test-key');
  const sequencer = TestBed.inject(AskBothSequencerService);
  return { sequencer, analytics, moderation };
}

describe('AskBothSequencerService — blended-only Ask-Both', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('persists exactly ONE assistant bubble with attributionLabel and no persona', async () => {
    const adapter = new MockAdapter().configure(
      [
        {
          type: 'delta',
          text: 'First principles — design must be insanely great.',
        },
        { type: 'done', meta: { tokens: 5, model: 'mock' } },
      ],
      0,
    );
    const { sequencer } = build(adapter);

    await sequencer.askBoth('How should I build this product?');

    const storage = TestBed.inject(STORAGE_PORT);
    const thread = (await storage.get<Thread>('chat:ask-both:v1'))!;
    const assistantMessages = thread.messages.filter(
      (m) => m.role === 'assistant',
    );
    expect(assistantMessages).toHaveLength(1);
    const bubble = assistantMessages[0]!;
    expect(bubble.attributionLabel).toBe('Musk + Jobs');
    expect(bubble.persona).toBeUndefined();
    expect(bubble.status).toBe('complete');
    expect(bubble.content).toContain('First principles');
  });

  it('emits ask_both_blended_message_sent with sessionId, threadId, and tokenEstimate', async () => {
    const adapter = new MockAdapter().configure(
      [
        {
          type: 'delta',
          text: 'Use first principles — elegant design is how it works.',
        },
        { type: 'done', meta: { tokens: 3, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics } = build(adapter);

    await sequencer.askBoth('What matters in product design?');

    const blendedEvent = analytics.events.find(
      (e) => e.name === 'ask_both_blended_message_sent',
    );
    expect(blendedEvent).toBeTruthy();
    if (blendedEvent?.name === 'ask_both_blended_message_sent') {
      expect(blendedEvent.payload.sessionId.length).toBeGreaterThan(0);
      expect(blendedEvent.payload.threadId.length).toBeGreaterThan(0);
      expect(blendedEvent.payload.tokenEstimate).toBeGreaterThan(0);
    }
  });

  it('emits persona_regex_miss{persona:"blended"} when reply lacks any signature phrase', async () => {
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'This reply has no persona signature at all.' },
        { type: 'done', meta: { tokens: 8, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics } = build(adapter);

    await sequencer.askBoth('q');

    const miss = analytics.events.find(
      (e) =>
        e.name === 'persona_regex_miss' && e.payload.persona === 'blended',
    );
    expect(miss).toBeTruthy();
  });

  it('does NOT emit regex-miss when a blended signature phrase is present', async () => {
    const adapter = new MockAdapter().configure(
      [
        {
          type: 'delta',
          text: 'First principles on Mars — insanely great engineering.',
        },
        { type: 'done', meta: { tokens: 3, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics } = build(adapter);

    await sequencer.askBoth('q');

    const miss = analytics.events.find(
      (e) =>
        e.name === 'persona_regex_miss' && e.payload.persona === 'blended',
    );
    expect(miss).toBeUndefined();
  });

  it('Keep going adds one MORE blended bubble (single call, single bubble)', async () => {
    const adapter = new MockAdapter().configure(
      [
        {
          type: 'delta',
          text: 'First principles first — design is how it works.',
        },
        { type: 'done', meta: { tokens: 3, model: 'mock' } },
      ],
      0,
    );
    const { sequencer } = build(adapter);
    await sequencer.askBoth('React or Next.js?');

    adapter.configure(
      [
        {
          type: 'delta',
          text: 'Physics over analogy — stay hungry, stay foolish.',
        },
        { type: 'done', meta: { tokens: 4, model: 'mock' } },
      ],
      0,
    );
    await sequencer.keepGoing();

    const storage = TestBed.inject(STORAGE_PORT);
    const thread = (await storage.get<Thread>('chat:ask-both:v1'))!;
    const assistantMessages = thread.messages.filter(
      (m) => m.role === 'assistant',
    );
    expect(assistantMessages).toHaveLength(2);
    expect(
      assistantMessages.every((m) => m.attributionLabel === 'Musk + Jobs'),
    ).toBe(true);
    expect(assistantMessages.every((m) => m.persona === undefined)).toBe(true);
  });
});
