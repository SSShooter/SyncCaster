import { db } from '@synccaster/core';

export const AI_CONFIG_ID = 'ai.rewrite.config';
export const AI_SECRET_ID = 'ai.openai.apiKey';

type ConfigTable = Pick<typeof db.config, 'get'>;
type SecretsTable = Pick<typeof db.secrets, 'get'>;

export interface ForegroundAiSettingsDeps {
  configTable: ConfigTable;
  secretsTable: SecretsTable;
}

export interface ForegroundAiProviderSettings {
  config: any;
  apiKey: string;
}

function createDefaultDeps(): ForegroundAiSettingsDeps {
  return {
    configTable: db.config,
    secretsTable: db.secrets,
  };
}

export async function loadForegroundAiProviderSettings(
  deps: ForegroundAiSettingsDeps = createDefaultDeps()
): Promise<ForegroundAiProviderSettings> {
  const configRecord = await deps.configTable.get(AI_CONFIG_ID) as any;
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as any;
  const config = configRecord?.value;

  // Foreground direct mode keeps streaming preview and cancellation responsive.
  if (!config?.baseUrl || !config?.model || !secret?.encrypted) {
    throw new Error('请先在 AI 设置中填写 API 地址、模型和 API Key。');
  }

  return {
    config,
    apiKey: secret.encrypted,
  };
}
