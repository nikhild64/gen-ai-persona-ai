import { describe, it, expect } from 'vitest';

import { advanceStreamingDisplay } from './streaming-typewriter';
import { appendStreamToken } from './stream-token';

describe('advanceStreamingDisplay', () => {
  it('reveals a full word at a time when the target has spaces', () => {
    const target = 'Hello world again';
    let shown = '';
    shown = advanceStreamingDisplay(shown, target);
    expect(shown).toBe('Hello ');
    shown = advanceStreamingDisplay(shown, target);
    expect(shown).toBe('Hello world ');
    shown = advanceStreamingDisplay(shown, target);
    expect(shown).toBe('Hello world again');
  });

  it('types partial characters while the trailing word is still growing', () => {
    let shown = 'Hello ';
    shown = advanceStreamingDisplay(shown, 'Hello w', { charsPerStep: 1 });
    expect(shown).toBe('Hello w');
    shown = advanceStreamingDisplay(shown, 'Hello wo', { charsPerStep: 1 });
    expect(shown).toBe('Hello wo');
    shown = advanceStreamingDisplay(shown, 'Hello wor', { charsPerStep: 1 });
    expect(shown).toBe('Hello wor');
  });

  it('can reveal multiple words per step when catching up', () => {
    const target = 'one two three four five';
    const shown = advanceStreamingDisplay('', target, { wordsPerStep: 3 });
    expect(shown).toBe('one two three ');
  });
});

describe('appendStreamToken', () => {
  it('appends incremental deltas', () => {
    expect(appendStreamToken('Hel', 'lo')).toBe('Hello');
  });

  it('replaces with cumulative provider text', () => {
    expect(appendStreamToken('Hello', 'Hello world')).toBe('Hello world');
  });
});
