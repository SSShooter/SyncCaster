import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlatformUserInfo } from '../platform-api';

const mockCookiesGetAll = vi.fn();

beforeEach(() => {
  vi.stubGlobal('chrome', {
    cookies: {
      getAll: mockCookiesGetAll,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs?.();
  vi.clearAllMocks();
});

describe('segmentfault cookie fallback', () => {
  it('keeps the account logged in when html detection says logged out but session cookies still exist', async () => {
    mockCookiesGetAll.mockResolvedValue([
      { name: 'sf_session', value: 'valid-session' },
      { name: 'sf_token', value: 'valid-token' },
    ]);

    const mockFetch = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as any).url;

      if (url.includes('/api/users/-/info') || url.includes('/api/user/info') || url.includes('/api/user/-/info') || url.includes('/gateway/user/-/info')) {
        return new Response('{"code":500}', {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url === 'https://segmentfault.com/write' || url === 'https://segmentfault.com/user/settings') {
        return new Response('<html><body>redirecting to login</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }

      if (url === 'https://segmentfault.com/') {
        return new Response('<html><header><a href="/user/login">登录</a></header></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }

      return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
    });

    vi.stubGlobal('fetch', mockFetch as any);

    const result = await fetchPlatformUserInfo('segmentfault');

    expect(result.loggedIn).toBe(true);
    expect(result.platform).toBe('segmentfault');
    expect(result.detectionMethod).toBe('cookie');
    expect(result.errorType).toBeUndefined();
    expect(result.retryable).toBeUndefined();
  });
});
