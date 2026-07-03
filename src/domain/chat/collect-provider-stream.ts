import type { ChatChunk, ChatRequest } from '../types/message';
import type { ProviderPort } from '../ports/provider.port';
import {
  appendStreamToken,
  yieldToUi,
} from '../../shared/streaming-typewriter/stream-token';

export type ProviderStreamCollectResult = {
  accumulated: string;
  doneChunk: ChatChunk | null;
  errorChunk: ChatChunk | null;
};

export function isQuotaExhausted(chunk: ChatChunk | null | undefined): boolean {
  return chunk?.type === 'error' && chunk.meta?.error === 'quota_exhausted';
}

export async function collectProviderStream(
  adapter: ProviderPort,
  request: ChatRequest,
  key: string,
  signal: AbortSignal,
  onDelta?: (accumulated: string) => void | Promise<void>,
): Promise<ProviderStreamCollectResult> {
  let accumulated = '';
  let doneChunk: ChatChunk | null = null;
  let errorChunk: ChatChunk | null = null;

  for await (const chunk of adapter.streamChat(request, key, signal)) {
    if (chunk.type === 'delta' && chunk.text) {
      accumulated = appendStreamToken(accumulated, chunk.text);
      if (!signal.aborted) {
        await onDelta?.(accumulated);
        await yieldToUi();
      }
    } else if (chunk.type === 'done') {
      doneChunk = chunk;
      break;
    } else if (chunk.type === 'error') {
      errorChunk = chunk;
      break;
    }
  }

  return { accumulated, doneChunk, errorChunk };
}
