import { describe, expect, it, vi } from 'vitest';
import {
  buildChatCompletionsUrl,
  createChatCompletion,
  createStreamingChatCompletion,
  mapOpenAiError,
  testOpenAiConnection,
} from '../openai-compatible';

function streamFromText(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('buildChatCompletionsUrl', () => {
  it('accepts base URLs with and without /v1', () => {
    expect(buildChatCompletionsUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/chat/completions');
    expect(buildChatCompletionsUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
    expect(buildChatCompletionsUrl('https://example.com/openai/v1/')).toBe('https://example.com/openai/v1/chat/completions');
  });

  it('rejects non-http base URLs', () => {
    expect(() => buildChatCompletionsUrl('file:///tmp/model')).toThrow('AI base URL must start with http:// or https://');
  });
});

describe('mapOpenAiError', () => {
  it('maps auth and rate-limit status codes to stable error codes', () => {
    expect(mapOpenAiError(401, 'bad key')).toMatchObject({ code: 'auth_error', status: 401 });
    expect(mapOpenAiError(429, 'slow down')).toMatchObject({ code: 'rate_limited', status: 429 });
  });
});

describe('testOpenAiConnection', () => {
  it('sends a minimal chat completion request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const result = await testOpenAiConnection(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.2,
      },
      fetchImpl
    );

    expect(result.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-local' }),
      })
    );
  });
});

describe('createChatCompletion timeout', () => {
  it('aborts slow provider requests with a clear timeout error', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    await expect(createChatCompletion(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        timeoutMs: 5,
      },
      [{ role: 'user', content: 'Return JSON.' }],
      fetchImpl as any
    )).rejects.toMatchObject({
      code: 'timeout',
      message: 'AI provider request timed out.',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });
});

describe('createStreamingChatCompletion', () => {
  it('streams chat completion content from SSE chunks', async () => {
    const chunks: string[] = [];
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromText([
        'data: {"choices":[{"delta":{"content":"{\\"candidates\\":["}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"T\\",\\"bodyMd\\":\\"B\\"}]}"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('')),
    });

    const result = await createStreamingChatCompletion(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.2,
      },
      [{ role: 'user', content: 'Return JSON.' }],
      (value) => chunks.push(value),
      fetchImpl as any
    );

    expect(result).toBe('{"candidates":[{"title":"T","bodyMd":"B"}]}');
    expect(chunks).toEqual([
      '{"candidates":[',
      '{"candidates":[{"title":"T","bodyMd":"B"}]}',
    ]);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toMatchObject({ stream: true });
  });
});
