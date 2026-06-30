import {
  generateRewriteCandidates,
  testOpenAiConnection,
  type AiRewriteStyle,
} from '@synccaster/ai';
import { db, type AppConfig, type Secret } from '@synccaster/core';

export const AI_CONFIG_ID = 'ai.rewrite.config';
export const AI_SECRET_ID = 'ai.openai.apiKey';

export const DEFAULT_AI_REWRITE_CONFIG = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  candidateCount: 2 as 2 | 3,
  defaultStyle: 'balanced' as AiRewriteStyle,
};

type ConfigTable = Pick<typeof db.config, 'get' | 'put'>;
type SecretsTable = Pick<typeof db.secrets, 'get' | 'put' | 'delete'>;

export interface AiServiceDeps {
  configTable: ConfigTable;
  secretsTable: SecretsTable;
  now: () => number;
  generateRewriteCandidates: typeof generateRewriteCandidates;
  testOpenAiConnection: typeof testOpenAiConnection;
}

function createDefaultDeps(): AiServiceDeps {
  return {
    configTable: db.config,
    secretsTable: db.secrets,
    now: () => Date.now(),
    generateRewriteCandidates,
    testOpenAiConnection,
  };
}

export function isAiMessageType(type: string): boolean {
  return [
    'AI_GET_CONFIG',
    'AI_SAVE_CONFIG',
    'AI_CLEAR_API_KEY',
    'AI_TEST_CONNECTION',
    'AI_GENERATE_CANDIDATES',
  ].includes(type);
}

function normalizeConfig(input: any) {
  return {
    enabled: Boolean(input?.enabled),
    baseUrl: String(input?.baseUrl || DEFAULT_AI_REWRITE_CONFIG.baseUrl).trim(),
    model: String(input?.model || DEFAULT_AI_REWRITE_CONFIG.model).trim(),
    temperature: Number.isFinite(Number(input?.temperature)) ? Number(input.temperature) : DEFAULT_AI_REWRITE_CONFIG.temperature,
    candidateCount: Number(input?.candidateCount) === 3 ? 3 as const : 2 as const,
    defaultStyle: ['balanced', 'less_ai', 'platform_ready'].includes(input?.defaultStyle)
      ? input.defaultStyle as AiRewriteStyle
      : DEFAULT_AI_REWRITE_CONFIG.defaultStyle,
  };
}

export async function loadAiRewriteSettings(deps: AiServiceDeps = createDefaultDeps()) {
  const stored = await deps.configTable.get(AI_CONFIG_ID) as AppConfig | undefined;
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as Secret | undefined;
  return {
    config: {
      ...DEFAULT_AI_REWRITE_CONFIG,
      ...(stored?.value || {}),
      hasApiKey: Boolean(secret?.encrypted),
    },
  };
}

export async function saveAiRewriteSettings(input: any, deps: AiServiceDeps = createDefaultDeps()) {
  const now = deps.now();
  const config = normalizeConfig(input);
  await deps.configTable.put({
    id: AI_CONFIG_ID,
    key: AI_CONFIG_ID,
    value: config,
    updatedAt: now,
  } as AppConfig);

  if (typeof input?.apiKey === 'string' && input.apiKey.trim()) {
    await deps.secretsTable.put({
      id: AI_SECRET_ID,
      accountId: 'ai',
      encrypted: input.apiKey.trim(),
      iv: 'local-extension-storage',
      createdAt: now,
      updatedAt: now,
    } as Secret);
  }

  return loadAiRewriteSettings(deps);
}

async function requireProviderConfig(deps: AiServiceDeps) {
  const settings = await loadAiRewriteSettings(deps);
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as Secret | undefined;
  if (!settings.config.baseUrl || !settings.config.model || !secret?.encrypted) {
    throw new Error('AI base URL, model, and API key are required.');
  }
  return {
    settings,
    provider: {
      baseUrl: settings.config.baseUrl,
      apiKey: secret.encrypted,
      model: settings.config.model,
      temperature: settings.config.temperature,
    },
  };
}

export async function handleAiMessage(message: any, deps: AiServiceDeps = createDefaultDeps()) {
  try {
    switch (message.type) {
      case 'AI_GET_CONFIG':
        return { success: true, ...(await loadAiRewriteSettings(deps)) };
      case 'AI_SAVE_CONFIG':
        return { success: true, ...(await saveAiRewriteSettings(message.data, deps)) };
      case 'AI_CLEAR_API_KEY':
        await deps.secretsTable.delete(AI_SECRET_ID);
        return { success: true, ...(await loadAiRewriteSettings(deps)) };
      case 'AI_TEST_CONNECTION': {
        const { provider } = await requireProviderConfig(deps);
        await deps.testOpenAiConnection(provider);
        return { success: true };
      }
      case 'AI_GENERATE_CANDIDATES': {
        const { settings, provider } = await requireProviderConfig(deps);
        const result = await deps.generateRewriteCandidates({
          provider,
          source: message.data.source,
          style: message.data.style || settings.config.defaultStyle,
          candidateCount: settings.config.candidateCount,
        });
        return { success: true, result };
      }
      default:
        return { success: false, error: `Unknown AI message type: ${message.type}` };
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'AI request failed' };
  }
}
