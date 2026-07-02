import { TestBed } from '@angular/core/testing';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';

import {
  AskBothSequencerService,
  ASK_BOTH_ADAPTER_FACTORY,
} from './ask-both-sequencer.service';
import { AskBothModeService } from './ask-both-mode.service';
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
  const modeService = TestBed.inject(AskBothModeService);
  const sequencer = TestBed.inject(AskBothSequencerService);
  return { sequencer, analytics, moderation, modeService };
}

describe('AskBothSequencerService — Blended mode (post-sprint AC-4 / AC-6 / AC-10)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  afterEach(() => sessionStorage.clear());

  it('AC-4: dispatchBlended persists exactly ONE assistant bubble with attributionLabel + no persona', async () => {
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Haanji, dekho — ' },
        { type: 'delta', text: 'chalo baat karte hain kuch nahi hai yaar.' },
        { type: 'done', meta: { tokens: 5, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, modeService } = build(adapter);
    modeService.set('blended');

    await sequencer.askBoth('React seekhna chahiye?');

    const storage = TestBed.inject(STORAGE_PORT);
    const thread = (await storage.get<Thread>('chat:ask-both:v1'))!;
    const assistantMessages = thread.messages.filter(
      (m) => m.role === 'assistant',
    );
    expect(assistantMessages).toHaveLength(1);
    const bubble = assistantMessages[0]!;
    expect(bubble.attributionLabel).toBe('Hitesh + Piyush');
    expect(bubble.persona).toBeUndefined();
    expect(bubble.status).toBe('complete');
    expect(bubble.content).toContain('Haanji');
  });

  it('AC-6: emits ask_both_blended_message_sent with sessionId + threadId + tokenEstimate', async () => {
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Dekho yaar, kuch nahi hai.' },
        { type: 'done', meta: { tokens: 3, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics, modeService } = build(adapter);
    modeService.set('blended');

    await sequencer.askBoth('Docker kya hai?');

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

  it('AC-10: emits persona_regex_miss{persona:"blended"} when reply lacks any signature phrase', async () => {
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'This reply has no persona signature at all.' },
        { type: 'done', meta: { tokens: 8, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics, modeService } = build(adapter);
    modeService.set('blended');

    await sequencer.askBoth('q');

    const miss = analytics.events.find(
      (e) =>
        e.name === 'persona_regex_miss' && e.payload.persona === 'blended',
    );
    expect(miss).toBeTruthy();
  });

  it('AC-10: does NOT emit regex-miss when Hitesh signature is present', async () => {
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Haanji chai peeni hai — chalo baat karte hain.' },
        { type: 'done', meta: { tokens: 3, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics, modeService } = build(adapter);
    modeService.set('blended');

    await sequencer.askBoth('q');

    const miss = analytics.events.find(
      (e) =>
        e.name === 'persona_regex_miss' && e.payload.persona === 'blended',
    );
    expect(miss).toBeUndefined();
  });

  it('Sequential mode does NOT emit ask_both_blended_message_sent', async () => {
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Haanji reply.' },
        { type: 'done', meta: { tokens: 2, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, analytics, modeService } = build(adapter);
    modeService.set('sequential');

    await sequencer.askBoth('q');

    const blendedEvent = analytics.events.find(
      (e) => e.name === 'ask_both_blended_message_sent',
    );
    expect(blendedEvent).toBeUndefined();
  });

  it('AC-5: Keep going in blended mode adds one MORE blended bubble (single call, single bubble)', async () => {
    // First send — one blended bubble persisted.
    const adapter = new MockAdapter().configure(
      [
        { type: 'delta', text: 'Haanji first take. Dekho.' },
        { type: 'done', meta: { tokens: 3, model: 'mock' } },
      ],
      0,
    );
    const { sequencer, modeService } = build(adapter);
    modeService.set('blended');
    await sequencer.askBoth('React ya Next.js?');

    // Reconfigure adapter to answer the keep-going follow-up.
    adapter.configure(
      [
        { type: 'delta', text: 'Chai ke saath, dekho — ek aur angle.' },
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
    expect(assistantMessages.every((m) => m.attributionLabel === 'Hitesh + Piyush'))
      .toBe(true);
    expect(assistantMessages.every((m) => m.persona === undefined)).toBe(true);
  });
});
