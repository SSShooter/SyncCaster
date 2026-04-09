import { db } from '../db';
import type { AppConfig, PlatformId } from '../types';

export const DEFAULT_PUBLISH_ACCOUNTS_CONFIG_ID = 'default_publish_accounts';
export const DEFAULT_PUBLISH_ACCOUNTS_CONFIG_KEY = 'default_publish_accounts';

export type DefaultPublishAccountMap = Partial<Record<PlatformId, string>>;

function normalizeMap(value: unknown): DefaultPublishAccountMap {
  if (!value || typeof value !== 'object') return {};
  return { ...(value as DefaultPublishAccountMap) };
}

export async function getDefaultPublishAccountMap(): Promise<DefaultPublishAccountMap> {
  const config = await db.config.get(DEFAULT_PUBLISH_ACCOUNTS_CONFIG_ID);
  return normalizeMap(config?.value);
}

export async function getDefaultPublishAccountId(
  platform: PlatformId
): Promise<string | undefined> {
  const config = await getDefaultPublishAccountMap();
  return config[platform];
}

export async function setDefaultPublishAccountId(
  platform: PlatformId,
  accountId: string
): Promise<DefaultPublishAccountMap> {
  const current = await getDefaultPublishAccountMap();
  const next: DefaultPublishAccountMap = {
    ...current,
    [platform]: accountId,
  };

  const config: AppConfig = {
    id: DEFAULT_PUBLISH_ACCOUNTS_CONFIG_ID,
    key: DEFAULT_PUBLISH_ACCOUNTS_CONFIG_KEY,
    value: next,
    updatedAt: Date.now(),
  };

  await db.config.put(config);
  return next;
}

export async function clearDefaultPublishAccountId(
  platform: PlatformId
): Promise<DefaultPublishAccountMap> {
  const current = await getDefaultPublishAccountMap();
  if (!(platform in current)) return current;

  const next = { ...current };
  delete next[platform];

  const config: AppConfig = {
    id: DEFAULT_PUBLISH_ACCOUNTS_CONFIG_ID,
    key: DEFAULT_PUBLISH_ACCOUNTS_CONFIG_KEY,
    value: next,
    updatedAt: Date.now(),
  };

  await db.config.put(config);
  return next;
}
