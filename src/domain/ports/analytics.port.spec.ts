import { describe, it, expect } from 'vitest';

import type { AnalyticsPort, AnalyticsEvent } from './analytics.port';
import { assertNever } from '../types/persona';

class InMemoryAnalytics implements AnalyticsPort {
  readonly received: AnalyticsEvent[] = [];
  emit(event: AnalyticsEvent): void {
    this.received.push(event);
  }
}

const EVERY_EVENT: AnalyticsEvent[] = [
  { name: 'persona_selected', payload: { persona: 'hitesh' } },
  { name: 'persona_switched', payload: { from: 'hitesh', to: 'piyush' } },
  { name: 'mode_switched', payload: { from: 'solo', to: 'ask-both' } },
  {
    name: 'message_sent',
    payload: { persona: 'hitesh', mode: 'solo', charCount: 12 },
  },
  { name: 'ask_both_message_sent', payload: { charCount: 20 } },
  { name: 'keep_going_clicked', payload: {} },
  { name: 'byo_key_saved', payload: { provider: 'groq' } },
  {
    name: 'moderation_blocked',
    payload: { direction: 'input', category: 'off_domain' },
  },
  { name: 'persona_regex_miss', payload: { persona: 'piyush' } },
  {
    name: 'summary_failed',
    payload: { provider: 'gemini', category: 'server_error' },
  },
  {
    name: 'provider_429_surfaced',
    payload: { provider: 'groq', retryAfterSec: 30 },
  },
  { name: 'parallel_fallback_triggered', payload: {} },
  {
    name: 'stream_stall_detected',
    payload: { persona: 'hitesh', elapsedMs: 6000 },
  },
  {
    name: 'spike_zero_gemini_cors_result',
    payload: { succeeded: true },
  },
];

describe('AnalyticsPort', () => {
  it('accepts every AnalyticsEvent variant', () => {
    const port = new InMemoryAnalytics();
    EVERY_EVENT.forEach((e) => port.emit(e));
    expect(port.received).toHaveLength(EVERY_EVENT.length);
  });

  it('discriminated-union narrowing works via switch on event.name', () => {
    const port = new InMemoryAnalytics();
    EVERY_EVENT.forEach((e) => port.emit(e));
    const perNameHandled: string[] = [];

    for (const event of port.received) {
      switch (event.name) {
        case 'persona_selected':
        case 'persona_switched':
        case 'mode_switched':
        case 'message_sent':
        case 'ask_both_message_sent':
        case 'keep_going_clicked':
        case 'byo_key_saved':
        case 'moderation_blocked':
        case 'persona_regex_miss':
        case 'summary_failed':
        case 'provider_429_surfaced':
        case 'parallel_fallback_triggered':
        case 'stream_stall_detected':
        case 'spike_zero_gemini_cors_result':
          perNameHandled.push(event.name);
          break;
        default:
          assertNever(event);
      }
    }
    expect(perNameHandled).toHaveLength(EVERY_EVENT.length);
  });
});
