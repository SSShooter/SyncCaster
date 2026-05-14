import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountsPut: vi.fn(),
  accountsWhereEquals: vi.fn(),
  accountsWhereFirst: vi.fn(),
  accountsGet: vi.fn(),
  accountsUpdate: vi.fn(),
  accountsToArray: vi.fn(),
  accountsDelete: vi.fn(),
  platformMapsToArray: vi.fn(),
  platformMapsUpdate: vi.fn(),
  jobsToArray: vi.fn(),
  jobsUpdate: vi.fn(),
  fetchPlatformUserInfo: vi.fn(),
  supportDirectApi: vi.fn(),
  getPlatformCookieExpiration: vi.fn(),
  fetchMultiplePlatformUserInfo: vi.fn(),
}));

vi.mock('@synccaster/core', () => {
  const AccountStatus = {
    ACTIVE: 'ACTIVE',
    ERROR: 'ERROR',
    EXPIRED: 'EXPIRED',
  };

  const accountsTable = {
    put: mocks.accountsPut,
    get: mocks.accountsGet,
    update: mocks.accountsUpdate,
    delete: mocks.accountsDelete,
    toArray: mocks.accountsToArray,
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: mocks.accountsWhereEquals,
        first: mocks.accountsWhereFirst,
      })),
    })),
  };

  return {
    AccountStatus,
    db: {
      accounts: accountsTable,
      platformMaps: {
        toArray: mocks.platformMapsToArray,
        update: mocks.platformMapsUpdate,
      },
      jobs: {
        toArray: mocks.jobsToArray,
        update: mocks.jobsUpdate,
      },
    },
  };
});

vi.mock('../platform-api', async () => {
  const actual = await vi.importActual<typeof import('../platform-api')>('../platform-api');
  return {
    ...actual,
    fetchPlatformUserInfo: mocks.fetchPlatformUserInfo,
    fetchMultiplePlatformUserInfo: mocks.fetchMultiplePlatformUserInfo,
    supportDirectApi: mocks.supportDirectApi,
    getPlatformCookieExpiration: mocks.getPlatformCookieExpiration,
  };
});

import { AccountStatus, type Account } from '@synccaster/core';
import { AccountService } from '../account-service';
import { AuthErrorType } from '../platform-api';

function createAccount(overrides: Partial<Account> = {}): Account {
  const now = Date.now();
  return {
    id: 'segmentfault-default',
    platform: 'segmentfault',
    nickname: '已绑定账号',
    enabled: true,
    createdAt: now - 60_000,
    updatedAt: now - 60_000,
    status: AccountStatus.ACTIVE,
    lastCheckAt: now - 60_000,
    consecutiveFailures: 0,
    ...overrides,
  } as Account;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accountsWhereEquals.mockResolvedValue([]);
  mocks.accountsWhereFirst.mockResolvedValue(undefined);
  mocks.accountsGet.mockResolvedValue(undefined);
  mocks.accountsUpdate.mockResolvedValue(undefined);
  mocks.accountsToArray.mockResolvedValue([]);
  mocks.platformMapsToArray.mockResolvedValue([]);
  mocks.jobsToArray.mockResolvedValue([]);
  mocks.supportDirectApi.mockReturnValue(true);
  mocks.getPlatformCookieExpiration.mockResolvedValue({
    hasValidCookies: false,
    isExpiringSoon: false,
    cookieExpiresAt: undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountService auth regressions', () => {
  it('preserves ACTIVE for SegmentFault when profile extraction fails but cookies remain valid', async () => {
    const account = createAccount({
      id: 'segmentfault-default',
      platform: 'segmentfault',
      nickname: '真实昵称',
      meta: { profileId: 'real-slug' },
    });

    mocks.fetchPlatformUserInfo.mockResolvedValue({
      loggedIn: false,
      platform: 'segmentfault',
      error: 'HTML 解析失败',
      errorType: AuthErrorType.API_ERROR,
      retryable: true,
      detectionMethod: 'html',
    });
    mocks.getPlatformCookieExpiration.mockResolvedValue({
      hasValidCookies: true,
      isExpiringSoon: false,
      cookieExpiresAt: 1234567890,
    });

    const updated = await AccountService.refreshAccount(account);

    expect(updated.status).toBe(AccountStatus.ACTIVE);
    expect(updated.lastError).toContain('[cookie]');
    expect(mocks.accountsPut).toHaveBeenCalledWith(expect.objectContaining({
      id: 'segmentfault-default',
      status: AccountStatus.ACTIVE,
      cookieExpiresAt: 1234567890,
    }));
  });

  it('preserves ACTIVE for Tencent Cloud when avatar/profile enrichment fails but cookies remain valid', async () => {
    const account = createAccount({
      id: 'tencent-cloud-default',
      platform: 'tencent-cloud',
      nickname: 'Alice',
      meta: { profileId: '123456' },
    });

    mocks.fetchPlatformUserInfo.mockResolvedValue({
      loggedIn: false,
      platform: 'tencent-cloud',
      error: 'creator 页面解析失败',
      errorType: AuthErrorType.NETWORK_ERROR,
      retryable: true,
      detectionMethod: 'api',
    });
    mocks.getPlatformCookieExpiration.mockResolvedValue({
      hasValidCookies: true,
      isExpiringSoon: false,
      cookieExpiresAt: 2233445566,
    });

    const updated = await AccountService.refreshAccount(account);

    expect(updated.status).toBe(AccountStatus.ACTIVE);
    expect(updated.lastError).toContain('creator 页面解析失败');
    expect(mocks.accountsPut).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tencent-cloud-default',
      status: AccountStatus.ACTIVE,
      cookieExpiresAt: 2233445566,
    }));
  });

  it('preserves ACTIVE for Medium when /me/stats parsing fails but login cookies remain valid', async () => {
    const account = createAccount({
      id: 'medium-default',
      platform: 'medium',
      nickname: 'MediumUser',
    });

    mocks.fetchPlatformUserInfo.mockResolvedValue({
      loggedIn: false,
      platform: 'medium',
      error: '页面解析失败',
      errorType: AuthErrorType.API_ERROR,
      retryable: true,
      detectionMethod: 'html',
    });
    mocks.getPlatformCookieExpiration.mockResolvedValue({
      hasValidCookies: true,
      isExpiringSoon: false,
      cookieExpiresAt: 3344556677,
    });

    const updated = await AccountService.refreshAccount(account);

    expect(updated.status).toBe(AccountStatus.ACTIVE);
    expect(updated.lastError).toContain('[cookie]');
    expect(mocks.accountsPut).toHaveBeenCalledWith(expect.objectContaining({
      id: 'medium-default',
      status: AccountStatus.ACTIVE,
      cookieExpiresAt: 3344556677,
    }));
  });

  it('reuses the existing OSChina platform slot when login succeeds without a numeric profileId yet', async () => {
    const existing = createAccount({
      id: 'oschina-default',
      platform: 'oschina',
      nickname: '开源中国用户',
      avatar: undefined,
      meta: {},
    });
    mocks.accountsWhereEquals.mockResolvedValue([existing]);

    mocks.fetchPlatformUserInfo.mockResolvedValue({
      loggedIn: true,
      platform: 'oschina',
      nickname: 'OSC 用户',
      avatar: 'https://img.example.com/avatar.png',
      detectionMethod: 'cookie',
    });

    const saved = await AccountService.quickAddAccount('oschina');

    expect(saved.id).toBe('oschina-default');
    expect(saved.platform).toBe('oschina');
    expect(saved.nickname).toBe('OSC 用户');
    expect(saved.meta).toEqual({});
    expect(mocks.accountsPut).toHaveBeenCalledWith(expect.objectContaining({
      id: 'oschina-default',
      platform: 'oschina',
      nickname: 'OSC 用户',
      avatar: 'https://img.example.com/avatar.png',
    }));
  });

  it('uses my.oschina.net as the relogin entry and treats /u/{id} navigation as successful login evidence', async () => {
    const account = createAccount({
      id: 'oschina-default',
      platform: 'oschina',
      nickname: '开源中国用户',
    });

    const createTab = vi.fn().mockResolvedValue({
      id: 9527,
      url: 'https://my.oschina.net/',
      status: 'complete',
    });
    const getTab = vi.fn().mockResolvedValue({
      id: 9527,
      url: 'https://my.oschina.net/u/9580420',
      status: 'complete',
    });
    const removeTab = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi
      .fn()
      .mockImplementationOnce((_tabId, message, callback) => callback?.({ pong: true }))
      .mockImplementationOnce((_tabId, message, callback) =>
        callback?.({
          loggedIn: true,
          platform: 'oschina',
          userId: '9580420',
          nickname: 'OSC 用户',
          avatar: 'https://img.example.com/avatar.png',
        })
      );

    vi.stubGlobal('chrome', {
      tabs: {
        create: createTab,
        get: getTab,
        remove: removeTab,
        query: vi.fn().mockResolvedValue([]),
        sendMessage,
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([]),
      },
      runtime: {
        lastError: undefined,
      },
    });

    mocks.fetchPlatformUserInfo
      .mockResolvedValueOnce({
        loggedIn: false,
        platform: 'oschina',
        error: '无法确认登录状态',
        retryable: true,
      })
      .mockResolvedValueOnce({
        loggedIn: false,
        platform: 'oschina',
        error: '无法确认登录状态',
        retryable: true,
      })
      .mockResolvedValueOnce({
        loggedIn: true,
        platform: 'oschina',
        userId: '9580420',
        nickname: 'OSC 用户',
        avatar: 'https://img.example.com/avatar.png',
      });

    const result = await AccountService.reloginAccount(account);

    expect(createTab).toHaveBeenCalledWith({
      url: 'https://my.oschina.net/',
      active: true,
    });
    expect(result.status).toBe(AccountStatus.ACTIVE);
    expect(result.nickname).toBe('OSC 用户');
    expect(result.meta).toEqual({ profileId: '9580420' });
    expect(removeTab).toHaveBeenCalledWith(9527);
  });
});
