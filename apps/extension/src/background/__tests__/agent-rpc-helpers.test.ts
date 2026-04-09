import { describe, expect, it } from 'vitest';
import type { Account, DefaultPublishAccountMap, Job } from '@synccaster/core';
import {
  AgentRpcRequestError,
  buildAgentJobStatus,
  mapJobStateForAgent,
  resolvePublishTargets,
} from '../agent-rpc-helpers';

function createAccount(overrides: Partial<Account> = {}): Account {
  const now = Date.now();
  return {
    id: 'account-1',
    platform: 'wechat',
    nickname: 'Primary Account',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createJob(overrides: Partial<Job> = {}): Job {
  const now = Date.now();
  return {
    id: 'job-1',
    postId: 'post-1',
    targets: [],
    state: 'PENDING',
    progress: 0,
    attempts: 0,
    maxAttempts: 3,
    logs: [],
    results: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('resolvePublishTargets', () => {
  it('maps platform targets to the configured default publish accounts', () => {
    const accounts: Account[] = [
      createAccount({
        id: 'wechat-default',
        platform: 'wechat',
      }),
      createAccount({
        id: 'juejin-default',
        platform: 'juejin',
        nickname: 'Juejin Account',
      }),
    ];
    const defaultMap: DefaultPublishAccountMap = {
      wechat: 'wechat-default',
      juejin: 'juejin-default',
    };

    const result = resolvePublishTargets(
      [
        { platform: 'wechat', config: { draft: true } },
        { platform: 'juejin' },
      ],
      accounts,
      defaultMap
    );

    expect(result.targets).toEqual([
      {
        platform: 'wechat',
        accountId: 'wechat-default',
        config: { draft: true },
      },
      {
        platform: 'juejin',
        accountId: 'juejin-default',
        config: undefined,
      },
    ]);
  });

  it('throws a typed error when the default publish account is missing', () => {
    expect(() =>
      resolvePublishTargets(
        [{ platform: 'wechat' }],
        [createAccount({ id: 'wechat-default', platform: 'wechat' })],
        {}
      )
    ).toThrowError(AgentRpcRequestError);

    try {
      resolvePublishTargets(
        [{ platform: 'wechat' }],
        [createAccount({ id: 'wechat-default', platform: 'wechat' })],
        {}
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'default_account_not_configured',
      });
    }
  });
});

describe('job status mapping', () => {
  it('maps paused jobs to pending_manual_confirm unless they were cancelled', () => {
    expect(mapJobStateForAgent(createJob({ state: 'PAUSED' }))).toBe('pending_manual_confirm');
    expect(
      mapJobStateForAgent(createJob({ state: 'PAUSED', error: 'Cancelled by agent' }))
    ).toBe('failed');
  });

  it('normalizes result statuses for agent clients', () => {
    const response = buildAgentJobStatus(
      createJob({
        state: 'PAUSED',
        progress: 66,
        results: [
          {
            platform: 'wechat',
            accountId: 'wechat-default',
            status: 'UNCONFIRMED',
            updatedAt: 100,
          },
          {
            platform: 'juejin',
            accountId: 'juejin-default',
            status: 'PUBLISHED',
            url: 'https://juejin.cn/post/1',
            updatedAt: 200,
          },
          {
            platform: 'csdn',
            accountId: 'csdn-default',
            status: 'FAILED',
            error: 'Cookie expired',
            updatedAt: 300,
          },
        ],
      })
    );

    expect(response.state).toBe('pending_manual_confirm');
    expect(response.progress).toBe(66);
    expect(response.results).toEqual([
      {
        platform: 'wechat',
        accountId: 'wechat-default',
        status: 'pending_manual_confirm',
        url: undefined,
        error: undefined,
        updatedAt: 100,
      },
      {
        platform: 'juejin',
        accountId: 'juejin-default',
        status: 'published',
        url: 'https://juejin.cn/post/1',
        error: undefined,
        updatedAt: 200,
      },
      {
        platform: 'csdn',
        accountId: 'csdn-default',
        status: 'failed',
        url: undefined,
        error: 'Cookie expired',
        updatedAt: 300,
      },
    ]);
  });
});
