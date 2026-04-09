import { getAdapter } from '@synccaster/adapters';
import type {
  Account,
  DefaultPublishAccountMap,
  Job,
  PlatformId,
  PublishTarget,
} from '@synccaster/core';
import type {
  AgentErrorCode,
  AgentJobResult,
  AgentJobResultStatus,
  AgentJobState,
  AgentJobStatusResponse,
  AgentPublishTargetInput,
} from '@synccaster/agent-protocol';

export class AgentRpcRequestError extends Error {
  code: AgentErrorCode | string;
  details?: unknown;

  constructor(code: AgentErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export interface PublishResolutionResult {
  targets: PublishTarget[];
  defaultMap: DefaultPublishAccountMap;
}

export function mapJobStateForAgent(job: Pick<Job, 'state' | 'error'>): AgentJobState {
  switch (job.state) {
    case 'PENDING':
      return 'pending';
    case 'RUNNING':
      return 'running';
    case 'DONE':
      return 'done';
    case 'FAILED':
      return 'failed';
    case 'PAUSED':
      return job.error === 'Cancelled by agent' ? 'failed' : 'pending_manual_confirm';
    default:
      return 'failed';
  }
}

export function mapJobResultStatusForAgent(status: string): AgentJobResultStatus {
  switch (status) {
    case 'PUBLISHED':
      return 'published';
    case 'UNCONFIRMED':
      return 'pending_manual_confirm';
    default:
      return 'failed';
  }
}

export function buildAgentJobStatus(job: Job): AgentJobStatusResponse {
  return {
    jobId: job.id,
    postId: job.postId,
    state: mapJobStateForAgent(job),
    progress: job.progress || 0,
    error: job.error,
    results: (job.results || []).map<AgentJobResult>((result) => ({
      platform: result.platform,
      accountId: result.accountId,
      status: mapJobResultStatusForAgent(result.status),
      url: result.url,
      error: result.error,
      updatedAt: result.updatedAt,
    })),
  };
}

export function resolvePublishTargets(
  requestedTargets: AgentPublishTargetInput[],
  accounts: Account[],
  defaultMap: DefaultPublishAccountMap
): PublishResolutionResult {
  const enabledAccounts = accounts.filter((account) => account.enabled);
  const seenPlatforms = new Set<string>();

  const targets = requestedTargets.map((target) => {
    if (!target?.platform || typeof target.platform !== 'string') {
      throw new AgentRpcRequestError('validation_error', 'target.platform is required');
    }

    if (seenPlatforms.has(target.platform)) {
      throw new AgentRpcRequestError(
        'validation_error',
        `Duplicate platform target: ${target.platform}`
      );
    }
    seenPlatforms.add(target.platform);

    let adapterExists = true;
    try {
      getAdapter(target.platform as PlatformId);
    } catch {
      adapterExists = false;
    }

    if (!adapterExists) {
      throw new AgentRpcRequestError(
        'unsupported_platform',
        `Unsupported platform: ${target.platform}`
      );
    }

    const defaultAccountId = defaultMap[target.platform as PlatformId];
    if (!defaultAccountId) {
      throw new AgentRpcRequestError(
        'default_account_not_configured',
        `Default publish account is not configured for ${target.platform}`,
        { platform: target.platform }
      );
    }

    const account = enabledAccounts.find(
      (candidate) =>
        candidate.id === defaultAccountId && candidate.platform === target.platform
    );

    if (!account) {
      throw new AgentRpcRequestError(
        'default_account_not_configured',
        `Default publish account is unavailable for ${target.platform}`,
        { platform: target.platform, accountId: defaultAccountId }
      );
    }

    return {
      platform: target.platform as PlatformId,
      accountId: account.id,
      config: target.config as Record<string, any> | undefined,
    };
  });

  return { targets, defaultMap };
}

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AgentRpcRequestError('validation_error', `${fieldName} is required`);
  }
  return value.trim();
}

export function normalizeOptionalStringArray(
  value: unknown,
  fieldName: string
): string[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AgentRpcRequestError('validation_error', `${fieldName} must be an array of strings`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

export function normalizeOptionalRecord(
  value: unknown,
  fieldName: string
): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentRpcRequestError('validation_error', `${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
}
