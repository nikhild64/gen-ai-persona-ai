/** Yields so the browser can paint between stream chunks. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Merge an incoming stream token into the running buffer. Providers may send
 * either incremental deltas or cumulative text — handle both.
 */
export function appendStreamToken(buffer: string, token: string): string {
  if (!token) return buffer;
  if (token.startsWith(buffer)) return token;
  if (buffer.endsWith(token)) return buffer;
  return buffer + token;
}

export function waitUntil(
  predicate: () => boolean,
  timeoutMs = 120_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = (): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (performance.now() - started > timeoutMs) {
        reject(new Error('waitUntil timed out'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
