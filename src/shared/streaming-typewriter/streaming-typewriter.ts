import { DestroyRef, signal, type Signal, type WritableSignal } from '@angular/core';

import { yieldToUi } from './stream-token';

export type StreamingTypewriterOptions = {
  /** Delay between word reveals at normal pace. */
  wordIntervalMs?: number;
};

export type StreamingTypewriterSources = {
  target: () => string;
  /** True while the upstream provider is still streaming. */
  streaming: () => boolean;
};

/**
 * Reveals streamed assistant text word-by-word (chars within the active
 * trailing word). Catches up faster when the provider outruns the display.
 */
export function advanceStreamingDisplay(
  displayed: string,
  target: string,
  opts: { wordsPerStep?: number; charsPerStep?: number } = {},
): string {
  if (!target) return '';
  if (displayed.length >= target.length) return target;

  const wordsPerStep = Math.max(1, opts.wordsPerStep ?? 1);
  const charsPerStep = Math.max(1, opts.charsPerStep ?? 3);

  if (!target.startsWith(displayed)) {
    return target.slice(
      0,
      Math.min(target.length, displayed.length + charsPerStep),
    );
  }

  let next = displayed;
  for (let step = 0; step < wordsPerStep && next.length < target.length; step += 1) {
    const before = next;
    next = advanceOneStep(next, target, charsPerStep);
    if (next === before) break;
  }
  return next;
}

function advanceOneStep(
  displayed: string,
  target: string,
  charsPerStep: number,
): string {
  const remainder = target.slice(displayed.length);
  if (!remainder) return displayed;

  const whitespace = remainder.match(/^(\s+)/);
  if (whitespace) return displayed + whitespace[1];

  const wordChunk = remainder.match(/^(\S+)/);
  if (!wordChunk) return displayed + remainder.slice(0, charsPerStep);

  const word = wordChunk[1];
  const hasMoreInTarget = remainder.length > word.length;
  const nextCharIsSpace =
    hasMoreInTarget && /\s/.test(remainder.charAt(word.length));

  if (nextCharIsSpace) {
    const withSpaces = remainder.match(/^(\S+\s*)/);
    return displayed + (withSpaces?.[1] ?? word);
  }

  if (!hasMoreInTarget) {
    return displayed + word;
  }

  return displayed + word.slice(0, charsPerStep);
}

export type StreamingTypewriterController = {
  readonly displayed: Signal<string>;
  bind(sources: StreamingTypewriterSources): void;
  drain(): Promise<void>;
  reset(): void;
};

export function createStreamingTypewriterController(
  destroyRef: DestroyRef,
  options: StreamingTypewriterOptions = {},
): StreamingTypewriterController {
  const wordIntervalMs = options.wordIntervalMs ?? 52;
  const displayed: WritableSignal<string> = signal('');
  let rafId = 0;
  let lastStepAt = 0;
  let wasStreaming = false;
  let stopped = false;
  let sources: StreamingTypewriterSources | null = null;

  const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stopLoop = (): void => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const loop = (now: number): void => {
    if (stopped || !sources) return;

    const target = sources.target();
    const streaming = sources.streaming();

    if (streaming && !wasStreaming) {
      displayed.set('');
      lastStepAt = now;
    }
    wasStreaming = streaming;

    const current = displayed();

    if (target.length < current.length || !target) {
      if (current) displayed.set('');
      lastStepAt = now;
      rafId = requestAnimationFrame(loop);
      return;
    }

    if (prefersReducedMotion()) {
      if (current !== target) displayed.set(target);
      rafId = requestAnimationFrame(loop);
      return;
    }

    if (current.length < target.length) {
      const lag = target.length - current.length;
      const wordsPerStep = lag > 140 ? 3 : lag > 70 ? 2 : 1;
      const interval = lag > 140 ? wordIntervalMs * 0.55 : wordIntervalMs;
      const charsPerStep = lag > 48 ? 5 : 3;

      if (now - lastStepAt >= interval) {
        displayed.set(
          advanceStreamingDisplay(current, target, {
            wordsPerStep,
            charsPerStep,
          }),
        );
        lastStepAt = now;
      }
    }

    rafId = requestAnimationFrame(loop);
  };

  destroyRef.onDestroy(() => {
    stopped = true;
    stopLoop();
  });

  return {
    displayed: displayed.asReadonly(),
    bind(nextSources: StreamingTypewriterSources): void {
      sources = nextSources;
      if (!rafId && !stopped) {
        lastStepAt = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    },
    async drain(): Promise<void> {
      if (!sources) return;
      while (!stopped && displayed().length < sources.target().length) {
        await yieldToUi();
      }
    },
    reset(): void {
      displayed.set('');
      wasStreaming = false;
      lastStepAt = performance.now();
    },
  };
}
