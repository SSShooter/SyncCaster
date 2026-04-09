import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { BridgeError } from '../shared.js';
import { startHttpServer } from '../http-server.js';

async function closeServer(server: Server | null) {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('startHttpServer', () => {
  let server: Server | null = null;

  afterEach(async () => {
    await closeServer(server);
    server = null;
  });

  it('maps publish routes to the expected RPC action and payload', async () => {
    const transport = {
      request: vi.fn(async () => ({
        ok: true as const,
        data: { jobId: 'job-123' },
      })),
    };

    server = await startHttpServer(transport, { host: '127.0.0.1', port: 0 });
    const address = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/posts/post-1/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets: [{ platform: 'wechat', config: { draft: true } }],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { jobId: 'job-123' },
    });
    expect(transport.request).toHaveBeenCalledWith('publish_post', {
      postId: 'post-1',
      targets: [{ platform: 'wechat', config: { draft: true } }],
    });
  });

  it('returns 503 when the extension bridge is unavailable', async () => {
    const transport = {
      request: vi.fn(async () => {
        throw new BridgeError('extension_unavailable', 'Extension is offline');
      }),
    };

    server = await startHttpServer(transport, { host: '127.0.0.1', port: 0 });
    const address = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: 'extension_unavailable',
        message: 'Extension is offline',
        details: undefined,
      },
    });
  });
});
