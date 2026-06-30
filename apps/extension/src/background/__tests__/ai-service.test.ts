import { describe, expect, it, vi } from 'vitest';
import {
  AI_CONFIG_ID,
  AI_SECRET_ID,
  DEFAULT_AI_REWRITE_CONFIG,
  handleAiMessage,
  isAiMessageType,
  loadAiRewriteSettings,
  saveAiRewriteSettings,
} from '../ai-service';

function createTable<T extends { id: string }>() {
  const rows = new Map<string, T>();
  return {
    rows,
    async get(id: string) {
      return rows.get(id);
    },
    async put(value: T) {
      rows.set(value.id, value);
    },
    async delete(id: string) {
      rows.delete(id);
    },
  };
}

function createDeps() {
  return {
    configTable: createTable<any>(),
    secretsTable: createTable<any>(),
    now: () => 123,
    generateRewriteCandidates: vi.fn(),
    testOpenAiConnection: vi.fn(),
  };
}

describe('ai-service settings storage', () => {
  it('stores API keys in secrets and excludes them from config', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 2,
        defaultStyle: 'balanced',
      },
      deps
    );

    expect(deps.configTable.rows.get(AI_CONFIG_ID).value.apiKey).toBeUndefined();
    expect(deps.secretsTable.rows.get(AI_SECRET_ID).encrypted).toBe('sk-local');

    const loaded = await loadAiRewriteSettings(deps);
    expect(loaded.config).toMatchObject({ enabled: true, hasApiKey: true });
  });

  it('returns defaults when no config is stored', async () => {
    const loaded = await loadAiRewriteSettings(createDeps());
    expect(loaded.config).toMatchObject({ ...DEFAULT_AI_REWRITE_CONFIG, hasApiKey: false });
  });
});

describe('ai-service messages', () => {
  it('identifies AI message types', () => {
    expect(isAiMessageType('AI_GET_CONFIG')).toBe(true);
    expect(isAiMessageType('SAVE_POST')).toBe(false);
  });

  it('generates candidates with the locally stored API key', async () => {
    const deps = createDeps();
    deps.generateRewriteCandidates.mockResolvedValue({
      raw: '{"candidates":[]}',
      candidates: [],
    });

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 2,
        defaultStyle: 'less_ai',
      },
      deps
    );

    const response = await handleAiMessage(
      {
        type: 'AI_GENERATE_CANDIDATES',
        data: {
          source: { postId: 'post-1', title: 'T', bodyMd: 'B' },
          style: 'platform_ready',
        },
      },
      deps
    );

    expect(response.success).toBe(true);
    expect(deps.generateRewriteCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({ apiKey: 'sk-local' }),
        style: 'platform_ready',
        candidateCount: 2,
      })
    );
  });
});
