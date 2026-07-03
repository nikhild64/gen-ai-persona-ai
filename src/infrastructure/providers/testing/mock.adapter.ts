import type {
  ProviderPort,
  ProviderId,
} from '../../../domain/ports/provider.port';
import type {
  ChatRequest,
  ChatChunk,
} from '../../../domain/types/message';

/**
 * Deterministic mock adapter for unit tests and eval scripts. Not shipped in
 * the production `PROVIDER_REGISTRY`; only `TEST_PROVIDER_REGISTRY` (below)
 * registers it. Configure with `.configure(scriptedChunks, delayMs)` and the
 * `streamChat` iterator will yield the script in order, respecting cancellation.
 */
export class MockAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'gemini';
  static readonly KEY_PATTERN: RegExp = /.*/;

  private script: ChatChunk[] = [];
  private delayMs = 5;

  configure(script: ChatChunk[], delayMs = 5): this {
    this.script = script;
    this.delayMs = delayMs;
    return this;
  }

  async *streamChat(
    _request: ChatRequest,
    _key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    for (const chunk of this.script) {
      if (signal.aborted) {
        yield { type: 'error', meta: { error: 'aborted', retryable: false } };
        return;
      }
      if (this.delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
      }
      yield chunk;
    }
  }
}
