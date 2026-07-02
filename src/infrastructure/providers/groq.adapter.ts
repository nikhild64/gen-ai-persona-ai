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
 * AD-3 + AD-5 (Groq for Piyush) + AD-11 (static KEY_PATTERN). Groq is
 * OpenAI-compatible so `ChatRequest.messages` maps 1:1.
 */
export class GroqAdapter implements ProviderPort {
  static readonly PROVIDER_ID: ProviderId = 'groq';
  /** AD-11: gsk_ + 52 alphanumeric. */
  static readonly KEY_PATTERN: RegExp = /^gsk_[0-9A-Za-z]{52}$/;

  private static readonly ENDPOINT =
    'https://api.groq.com/openai/v1/chat/completions';

  async *streamChat(
    request: ChatRequest,
    key: string,
    signal: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    const body = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxOutputTokens,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(GroqAdapter.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal,
      });
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
      yield GroqAdapter.mapHttpError(response);
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
          for (const chunk of GroqAdapter.parseSseBlock(eventBlock)) {
            if (chunk.type === 'delta') yield chunk;
            if (chunk.type === 'done' && chunk.meta?.tokens) {
              totalTokens = chunk.meta.tokens;
            }
          }
          idx = buffer.indexOf('\n\n');
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
        /* released */
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
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: { total_tokens?: number };
        x_groq?: { usage?: { total_tokens?: number } };
      };
      const text = p.choices?.[0]?.delta?.content;
      if (typeof text === 'string' && text.length > 0) {
        yield { type: 'delta', text };
      }
      const total = p.usage?.total_tokens ?? p.x_groq?.usage?.total_tokens;
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
