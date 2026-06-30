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
        rewritePrompts: [
          { id: 'general', name: '通用改写', prompt: '保持原意，重组表达。' },
          { id: 'wechat', name: '公众号', prompt: '改成公众号文章风格。' },
        ],
        defaultRewritePromptId: 'wechat',
      },
      deps
    );

    expect(deps.configTable.rows.get(AI_CONFIG_ID).value.apiKey).toBeUndefined();
    expect(deps.configTable.rows.get(AI_CONFIG_ID).value.rewritePrompts).toHaveLength(2);
    expect(deps.configTable.rows.get(AI_CONFIG_ID).value.defaultRewritePromptId).toBe('wechat');
    expect(deps.secretsTable.rows.get(AI_SECRET_ID).encrypted).toBe('sk-local');

    const loaded = await loadAiRewriteSettings(deps);
    expect(loaded.config).toMatchObject({ enabled: true, hasApiKey: true, defaultRewritePromptId: 'wechat' });
  });

  it('returns defaults when no config is stored', async () => {
    const loaded = await loadAiRewriteSettings(createDeps());
    expect(DEFAULT_AI_REWRITE_CONFIG.humanizeLevel).toBe('standard');
    expect(loaded.config).toMatchObject({ ...DEFAULT_AI_REWRITE_CONFIG, hasApiKey: false });
    expect(loaded.config.rewritePrompts[0]).toMatchObject({ id: 'general', name: '通用改写' });
  });

  it('persists edited prompt template names', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 2,
        rewritePrompts: [
          { id: 'prompt-custom', name: '小红书风格', prompt: '改成更适合小红书的表达。' },
        ],
        defaultRewritePromptId: 'prompt-custom',
      },
      deps
    );

    const loaded = await loadAiRewriteSettings(deps);

    expect(loaded.config.rewritePrompts[0]).toMatchObject({
      id: 'prompt-custom',
      name: '小红书风格',
      prompt: '改成更适合小红书的表达。',
    });
    expect(loaded.config.defaultRewritePromptId).toBe('prompt-custom');
  });

  it('persists one rewrite candidate when configured', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 1,
      },
      deps
    );

    const loaded = await loadAiRewriteSettings(deps);

    expect(loaded.config.candidateCount).toBe(1);
  });

  it('persists the selected humanize level', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 1,
        humanizeLevel: 'strong',
      },
      deps
    );

    const loaded = await loadAiRewriteSettings(deps);

    expect(loaded.config.humanizeLevel).toBe('strong');
  });

  it('normalizes unknown humanize levels to standard', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        humanizeLevel: 'surprise',
      },
      deps
    );

    const loaded = await loadAiRewriteSettings(deps);

    expect(loaded.config.humanizeLevel).toBe('standard');
  });

  it('persists and clamps the AI request timeout', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 1,
        timeoutMs: 240_000,
      },
      deps
    );

    expect((await loadAiRewriteSettings(deps)).config.timeoutMs).toBe(240_000);

    await saveAiRewriteSettings({ timeoutMs: 10_000 }, deps);
    expect((await loadAiRewriteSettings(deps)).config.timeoutMs).toBe(30_000);

    await saveAiRewriteSettings({ timeoutMs: 900_000 }, deps);
    expect((await loadAiRewriteSettings(deps)).config.timeoutMs).toBe(600_000);
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
        candidateCount: 1,
        rewritePrompts: [
          { id: 'general', name: '通用改写', prompt: '保持原意，重组表达。' },
          { id: 'wechat', name: '公众号', prompt: '改成公众号文章风格。' },
        ],
        defaultRewritePromptId: 'general',
      },
      deps
    );

    const response = await handleAiMessage(
      {
        type: 'AI_GENERATE_CANDIDATES',
        data: {
          source: { postId: 'post-1', title: 'T', bodyMd: 'B' },
          rewritePromptId: 'wechat',
        },
      },
      deps
    );

    expect(response.success).toBe(true);
    expect(deps.generateRewriteCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({ apiKey: 'sk-local' }),
        rewritePrompt: { id: 'wechat', name: '公众号', prompt: '改成公众号文章风格。' },
        candidateCount: 1,
      })
    );
  });
});
