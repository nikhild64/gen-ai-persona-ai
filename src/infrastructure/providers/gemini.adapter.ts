import type {
  ProviderPort,
  ProviderId,
} from '../../domain/ports/provider.port';
import type {
  ChatRequest,
  ChatChunk,
  ChatChunkError,
} from '../../domain/types/message';

/**
 * AD-3 (ProviderPort SSOT) + AD-5 (Gemini for Hitesh) + AD-11 (static KEY_PATTERN).
 * Spike-0 (E0.5-S1) confirmed browser-direct SSE fetch works with `x-goog-api-key`
 * header. No proxy required.
 */
export class GeminiAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'gemini';
  /** AD-11: AIza + 35 chars. Read by the redaction registry (E6-S1). */
  static readonly KEY_PATTERN: RegExp = /^AIza[0-9A-Za-z_-]{35}$/;

  private static readonly BASE_URL =
    'https://generativelanguage.googleapis.com/v1beta/models';

  async *streamChat(
    request: ChatRequest,
    key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    const geminiBody = {
      contents: request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      systemInstruction:
        request.messages
          .filter((m) => m.role === 'system')
          .map((m) => m.content)
          .join('\n\n') || undefined,
      generationConfig: {
        temperature: request.temperature,
        topP: request.topP,
        maxOutputTokens: request.maxOutputTokens,
        // NOTE: Gemini does NOT support frequencyPenalty / presencePenalty as
        // of 2026-07. Silently dropped; PromptAssembler passes them only for
        // Groq. LoggerService can warn in dev.
      },
    };

    let response: Response;
    try {
      response = await fetch(
        `${GeminiAdapter.BASE_URL}/${request.model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify(geminiBody),
          signal,
        },
      );
    } catch (fetchErr) {
      const err = fetchErr as Error;
      yield {
        type: 'error',
        meta: {
          error: err.name === 'AbortError' ? 'aborted' : 'network_error',
          retryable: err.name !== 'AbortError',
        },
      };
      return;
    }

    if (!response.ok) {
      yield GeminiAdapter.mapHttpError(response);
      return;
    }
    if (!response.body) {
      yield {
        type: 'error',
        meta: { error: 'network_error', retryable: true },
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let totalTokens = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx = buffer.indexOf('\n\n');
        while (idx !== -1) {
          const eventBlock = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const chunk of GeminiAdapter.parseSseBlock(eventBlock)) {
            if (chunk.type === 'delta') yield chunk;
            if (chunk.type === 'done' && chunk.meta?.tokens) {
              totalTokens = chunk.meta.tokens;
            }
          }
          idx = buffer.indexOf('\n\n');
        }
      }
      buffer += decoder.decode();
      for (const chunk of GeminiAdapter.parseSseBlock(buffer)) {
        if (chunk.type === 'delta') yield chunk;
        if (chunk.type === 'done' && chunk.meta?.tokens) {
          totalTokens = chunk.meta.tokens;
        }
      }
      yield {
        type: 'done',
        meta: { tokens: totalTokens, model: request.model },
      };
    } catch (streamErr) {
      const err = streamErr as Error;
      const errorKind: ChatChunkError =
        err.name === 'AbortError' ? 'aborted' : 'network_error';
      yield {
        type: 'error',
        meta: { error: errorKind, retryable: errorKind !== 'aborted' },
      };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* already released */
      }
    }
  }

  private static *parseSseBlock(block: string): Iterable<ChatChunk> {
    const dataLines = block
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6).trim());

    for (const payload of dataLines) {
      if (payload.length === 0 || payload === '[DONE]') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const p = parsed as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: { totalTokenCount?: number };
      };
      const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string' && text.length > 0) {
        yield { type: 'delta', text };
      }
      const total = p.usageMetadata?.totalTokenCount;
      if (typeof total === 'number') {
        yield { type: 'done', meta: { tokens: total } };
      }
    }
  }

  private static mapHttpError(res: Response): ChatChunk {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterSec = retryAfterHeader
      ? parseInt(retryAfterHeader, 10) || undefined
      : undefined;
    let error: ChatChunkError = 'unknown';
    if (res.status === 429) error = 'quota_exhausted';
    else if (res.status === 401 || res.status === 403) error = 'auth_failed';
    else if (res.status === 400) error = 'invalid_request';
    else if (res.status >= 500) error = 'server_error';
    return {
      type: 'error',
      meta: {
        error,
        retryable: error === 'quota_exhausted' || error === 'server_error',
        retryAfterSec,
      },
    };
  }
}
