import { describe, expect, it, vi } from 'vitest';
import { loadForegroundAiProviderSettings } from '../foreground-settings';

describe('loadForegroundAiProviderSettings', () => {
  it('loads local foreground AI config and API key', async () => {
    const config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      candidateCount: 2,
    };
    const deps = {
      configTable: {
        get: vi.fn(async () => ({ value: config })),
      },
      secretsTable: {
        get: vi.fn(async () => ({ encrypted: 'sk-test' })),
      },
    };

    await expect(loadForegroundAiProviderSettings(deps)).resolves.toEqual({
      config,
      apiKey: 'sk-test',
    });
  });

  it('throws when provider settings are incomplete', async () => {
    const deps = {
      configTable: {
        get: vi.fn(async () => ({ value: { baseUrl: 'https://api.openai.com/v1' } })),
      },
      secretsTable: {
        get: vi.fn(async () => undefined),
      },
    };

    await expect(loadForegroundAiProviderSettings(deps))
      .rejects
      .toThrow('请先在 AI 设置中填写 API 地址、模型和 API Key。');
  });
});
