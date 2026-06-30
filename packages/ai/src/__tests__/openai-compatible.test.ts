import { describe, expect, it, vi } from 'vitest';
import {
  buildChatCompletionsUrl,
  mapOpenAiError,
  testOpenAiConnection,
} from '../openai-compatible';

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
