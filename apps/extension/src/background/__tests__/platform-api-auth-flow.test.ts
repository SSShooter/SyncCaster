import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlatformUserInfo } from '../platform-api';

const mockCookiesGet = vi.fn();
const mockCookiesGetAll = vi.fn();

function responseWithUrl(body: BodyInit, init: ResponseInit, url: string) {
  const response = new Response(body, init);
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

beforeEach(() => {
  vi.stubGlobal('chrome', {
    cookies: {
      get: mockCookiesGet,
      getAll: mockCookiesGetAll,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('platform-api auth flow regressions', () => {
  it('keeps Medium logged in when sid/uid cookies exist and /me/stats does not redirect to signin', async () => {
    mockCookiesGet.mockImplementation(async ({ name }: { name: string }) => {
      if (name === 'sid' || name === 'uid') {
        return { name, value: `${name}-cookie` };
      }
      return null;
    });

    const mediumHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<img src="https://miro.medium.com/v2/resize:fill:64:64/1*avatar.png" alt="M" />',
      '<div>Welcome back</div>',
      '</body>',
      '</html>',
    ].join('');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : (input as any).url;
        if (url === 'https://medium.com/me/stats') {
          return responseWithUrl(
            mediumHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://medium.com/me/stats'
          );
        }
        return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
      }) as any
    );

    const result = await fetchPlatformUserInfo('medium');

    expect(result.loggedIn).toBe(true);
    expect(result.platform).toBe('medium');
    expect(result.detectionMethod).toBe('html');
  });

  it('treats OSChina my.oschina.net redirect to /u/{id} as logged-in evidence', async () => {
    mockCookiesGet.mockResolvedValue(null);
    mockCookiesGetAll.mockResolvedValue([]);

    const homeHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<div class="sidebar-section user-info">',
      '<div class="avatar-wrap"><img src="https://static.oschina.net/avatar.png" /></div>',
      '<span class="name">OSC 用户</span>',
      '<a href="https://my.oschina.net/u/9580420">个人空间</a>',
      '</div>',
      '</body>',
      '</html>',
    ].join('');

    const profileHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<div class="avatar-wrap"><img src="https://static.oschina.net/avatar-real.png" /></div>',
      '<h3 class="user-name"><span class="name">OSC 用户</span></h3>',
      '</body>',
      '</html>',
    ].join('');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : (input as any).url;

        if (
          url === 'https://www.oschina.net/action/user/info' ||
          url === 'https://my.oschina.net/action/user/info'
        ) {
          return responseWithUrl(
            JSON.stringify({ code: 401, message: '未登录' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
            url
          );
        }

        if (url === 'https://my.oschina.net/') {
          return responseWithUrl(
            homeHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/u/9580420'
          );
        }

        if (url === 'https://my.oschina.net/u/9580420') {
          return responseWithUrl(
            profileHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/u/9580420'
          );
        }

        return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
      }) as any
    );

    const result = await fetchPlatformUserInfo('oschina');

    expect(result.loggedIn).toBe(true);
    expect(result.userId).toBe('9580420');
    expect(result.nickname).toBe('OSC 用户');
  });

  it('treats OSChina homepage HTML with a personal-center link as logged-in evidence when cookies are missing', async () => {
    mockCookiesGet.mockResolvedValue(null);
    mockCookiesGetAll.mockResolvedValue([]);

    const mainHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<header class="site-header">',
      '<div class="user-dropdown">',
      '<img class="avatar" src="https://static.oschina.net/nav-avatar.png" alt="OSC 用户" />',
      '<a class="user-name" href="https://my.oschina.net/u/9580420">OSC 用户</a>',
      '</div>',
      '</header>',
      '</body>',
      '</html>',
    ].join('');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : (input as any).url;

        if (
          url === 'https://www.oschina.net/action/user/info' ||
          url === 'https://my.oschina.net/action/user/info'
        ) {
          return responseWithUrl(
            JSON.stringify({ code: 401, message: '未登录' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
            url
          );
        }

        if (url === 'https://my.oschina.net/') {
          return responseWithUrl(
            '<!doctype html><html><body>公开首页</body></html>',
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/'
          );
        }

        if (url === 'https://www.oschina.net/') {
          return responseWithUrl(
            mainHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://www.oschina.net/'
          );
        }

        return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
      }) as any
    );

    const result = await fetchPlatformUserInfo('oschina');

    expect(result.loggedIn).toBe(true);
    expect(result.userId).toBe('9580420');
    expect(result.nickname).toBe('OSC 用户');
    expect(result.detectionMethod).toBe('html');
  });

  it('extracts the real OSChina nickname from the new my.oschina.net right-panel structure', async () => {
    mockCookiesGet.mockResolvedValue(null);
    mockCookiesGetAll.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://www.oschina.net/' || url === 'https://my.oschina.net/') {
        return [{ name: 'oscid', value: 'valid-session' }, { name: 'osc_id', value: '9580420' }];
      }
      return [];
    });

    const homeHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<div id="9580420">',
      '<div class="my-layout">',
      '<div class="right-panel">',
      '<div class="user-info">',
      '<div class="info-left">',
      '<h3>osc_13254252</h3>',
      '<p class="user-signature">快去设置个性签名吧～</p>',
      '</div>',
      '<span class="ant-avatar ant-avatar-circle" style="width: 56px; height: 56px; background-color: rgb(0, 153, 102)">O</span>',
      '</div>',
      '</div>',
      '</div>',
      '</div>',
      '</body>',
      '</html>',
    ].join('');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : (input as any).url;

        if (url === 'https://www.oschina.net/action/user/info' || url === 'https://my.oschina.net/action/user/info') {
          return responseWithUrl(
            JSON.stringify({ code: 401, message: '未登录' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
            url
          );
        }

        if (url === 'https://my.oschina.net/') {
          return responseWithUrl(
            homeHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/u/9580420'
          );
        }

        if (url === 'https://my.oschina.net/u/9580420') {
          return responseWithUrl(
            homeHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/u/9580420'
          );
        }

        if (url === 'https://www.oschina.net/') {
          return responseWithUrl(
            '<!doctype html><html><body>首页</body></html>',
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://www.oschina.net/'
          );
        }

        return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
      }) as any
    );

    const result = await fetchPlatformUserInfo('oschina');

    expect(result.loggedIn).toBe(true);
    expect(result.userId).toBe('9580420');
    expect(result.nickname).toBe('osc_13254252');
    expect(result.avatar).toBeUndefined();
  });

  it('ignores recommended-user noise on OSChina and keeps the current profile nickname/avatar', async () => {
    mockCookiesGet.mockResolvedValue(null);
    mockCookiesGetAll.mockImplementation(async ({ url }: { url: string }) => {
      if (url === 'https://www.oschina.net/' || url === 'https://my.oschina.net/') {
        return [{ name: 'oscid', value: 'valid-session' }, { name: 'osc_id', value: '9580420' }];
      }
      return [];
    });

    const homeHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<div class="recommend-user"><a href="https://my.oschina.net/u/1234567">推荐用户</a><img src="https://static.oschina.net/recommend.png" /></div>',
      '<div class="user-info"><div class="info-left"><h3>真实用户</h3></div><div class="avatar-wrap"><img src="https://static.oschina.net/real-avatar.png" /></div><a href="https://my.oschina.net/u/9580420">个人空间</a></div>',
      '</body>',
      '</html>',
    ].join('');

    const profileHtml = [
      '<!doctype html>',
      '<html>',
      '<body>',
      '<div class="user-info"><div class="info-left"><h3>真实用户</h3></div><div class="avatar-wrap"><img src="https://static.oschina.net/real-avatar.png" /></div><a href="https://my.oschina.net/u/9580420">个人空间</a></div>',
      '<div class="recommend-user"><a href="https://my.oschina.net/u/1234567">推荐用户</a><img src="https://static.oschina.net/recommend.png" /></div>',
      '</body>',
      '</html>',
    ].join('');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === 'string' ? input : (input as any).url;

        if (url === 'https://www.oschina.net/action/user/info' || url === 'https://my.oschina.net/action/user/info') {
          return responseWithUrl(
            JSON.stringify({ code: 401, message: '未登录' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
            url
          );
        }

        if (url === 'https://my.oschina.net/') {
          return responseWithUrl(
            homeHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/u/9580420'
          );
        }

        if (url === 'https://my.oschina.net/u/9580420') {
          return responseWithUrl(
            profileHtml,
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://my.oschina.net/u/9580420'
          );
        }

        if (url === 'https://www.oschina.net/') {
          return responseWithUrl(
            '<!doctype html><html><body>首页</body></html>',
            { status: 200, headers: { 'content-type': 'text/html' } },
            'https://www.oschina.net/'
          );
        }

        return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
      }) as any
    );

    const result = await fetchPlatformUserInfo('oschina');

    expect(result.loggedIn).toBe(true);
    expect(result.userId).toBe('9580420');
    expect(result.nickname).toBe('真实用户');
    expect(result.avatar).toBe('https://static.oschina.net/real-avatar.png');
  });
});
