import { AiProviderError, type AiProviderConfig, type ChatMessage } from './types';

export type AiFetch = typeof fetch;
export type AiStreamChunkHandler = (content: string) => void;
export const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120_000;

export function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new AiProviderError('invalid_config', 'AI base URL must start with http:// or https://');
  }
  const root = trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  return `${root}/chat/completions`;
}

export function mapOpenAiError(status: number, message: string): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError('auth_error', message || 'AI provider rejected the API key.', status);
  }
  if (status === 429) {
    return new AiProviderError('rate_limited', message || 'AI provider rate limit reached.', status);
  }
  return new AiProviderError('provider_error', message || 'AI provider request failed.', status);
}

function getTimeoutMs(config: AiProviderConfig): number {
  const timeoutMs = Number(config.timeoutMs);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_AI_REQUEST_TIMEOUT_MS;
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

function createAbortController(config: AiProviderConfig, signal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const abortRequest = () => controller.abort();
  if (signal?.aborted) {
    throw new AiProviderError('canceled', 'AI request was canceled.');
  }
  signal?.addEventListener('abort', abortRequest, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, getTimeoutMs(config));

  return {
    controller,
    isTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortRequest);
    },
  };
}

function mapCaughtProviderError(error: any, timedOut: boolean, signal?: AbortSignal): AiProviderError {
  if (timedOut || isAbortError(error)) {
    if (!timedOut && signal?.aborted) {
      return new AiProviderError('canceled', 'AI request was canceled.');
    }
    return new AiProviderError('timeout', 'AI provider request timed out.');
  }
  if (error instanceof AiProviderError) {
    return error;
  }
  return new AiProviderError('network_error', error?.message || 'AI provider request failed.');
}

function extractSseContent(line: string): string | null {
  if (!line.startsWith('data:')) {
    return null;
  }
  const payload = line.slice('data:'.length).trim();
  if (!payload || payload === '[DONE]') {
    return null;
  }
  const data = JSON.parse(payload);
  const content = data?.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : null;
}

export async function createChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  fetchImpl: AiFetch = fetch,
  signal?: AbortSignal
): Promise<string> {
  const abort = createAbortController(config, signal);

  try {
    const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: abort.controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || data?.message || response.statusText;
      throw mapOpenAiError(response.status, message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AiProviderError('invalid_response', 'AI provider returned an empty response.');
    }
    return content;
  } catch (error: any) {
    throw mapCaughtProviderError(error, abort.isTimedOut(), signal);
  } finally {
    abort.cleanup();
  }
}

export async function createStreamingChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  onChunk: AiStreamChunkHandler,
  fetchImpl: AiFetch = fetch,
  signal?: AbortSignal
): Promise<string> {
  const abort = createAbortController(config, signal);

  try {
    const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: abort.controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        response_format: { type: 'json_object' },
        stream: true,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || data?.message || response.statusText;
      throw mapOpenAiError(response.status, message);
    }
    if (!response.body) {
      throw new AiProviderError('invalid_response', 'AI provider did not return a streaming response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      buffer += decoder.decode(result.value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const delta = extractSseContent(line);
        if (delta) {
          content += delta;
          onChunk(content);
        }
      }
    }

    if (content.trim().length === 0) {
      throw new AiProviderError('invalid_response', 'AI provider returned an empty streaming response.');
    }
    return content;
  } catch (error: any) {
    throw mapCaughtProviderError(error, abort.isTimedOut(), signal);
  } finally {
    abort.cleanup();
  }
}

export async function testOpenAiConnection(config: AiProviderConfig, fetchImpl: AiFetch = fetch) {
  await createChatCompletion(
    config,
    [
      { role: 'system', content: 'Return valid JSON only.' },
      { role: 'user', content: '{"ping":"ok"}' },
    ],
    fetchImpl
  );
  return { success: true };
}
