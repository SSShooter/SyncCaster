import { AiProviderError, type AiProviderConfig, type ChatMessage } from './types';

export type AiFetch = typeof fetch;

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

export async function createChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  fetchImpl: AiFetch = fetch
): Promise<string> {
  const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
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
