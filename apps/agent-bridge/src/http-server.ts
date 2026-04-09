import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AgentRpcAction } from '@synccaster/agent-protocol';
import { AGENT_HTTP_HOST, AGENT_HTTP_PORT } from '@synccaster/agent-protocol';
import { BridgeError, errorToPlainObject } from './shared.js';

export interface RpcTransport {
  request<TPayload = unknown>(
    action: AgentRpcAction,
    payload?: TPayload
  ): Promise<{ ok: boolean; data?: unknown; error?: { code: string; message: string; details?: unknown } }>;
}

interface ResolvedRoute {
  action: AgentRpcAction;
  payload?: Record<string, unknown>;
}

export interface HttpServerOptions {
  host?: string;
  port?: number;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function getStatusCode(code: string): number {
  switch (code) {
    case 'validation_error':
      return 400;
    case 'post_not_found':
    case 'job_not_found':
      return 404;
    case 'default_account_not_configured':
      return 409;
    case 'unsupported_platform':
      return 400;
    case 'extension_unavailable':
      return 503;
    default:
      return 500;
  }
}

function unwrapTransportResponse(response: {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}) {
  if (response.ok) {
    return response.data;
  }

  const error = response.error || {
    code: 'internal_error',
    message: 'Unknown transport error',
  };
  throw new BridgeError(error.code, error.message, error.details);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new BridgeError('validation_error', 'Request body must be valid JSON');
  }
}

function resolveRoute(
  req: IncomingMessage,
  body: Record<string, unknown>,
  baseUrl: string
): ResolvedRoute {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', baseUrl);
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/v1/health') {
    return { action: 'health' };
  }
  if (method === 'GET' && pathname === '/v1/platforms') {
    return { action: 'list_platforms' };
  }
  if (method === 'GET' && pathname === '/v1/accounts') {
    return { action: 'list_accounts' };
  }
  if (method === 'POST' && pathname === '/v1/posts') {
    return { action: 'create_post', payload: body };
  }
  if (method === 'POST' && pathname === '/v1/render/wechat') {
    return { action: 'render_wechat_html', payload: body };
  }

  const updatePostMatch = pathname.match(/^\/v1\/posts\/([^/]+)$/);
  if (method === 'PATCH' && updatePostMatch) {
    return {
      action: 'update_post',
      payload: { ...body, postId: decodeURIComponent(updatePostMatch[1]) },
    };
  }

  const publishPostMatch = pathname.match(/^\/v1\/posts\/([^/]+)\/publish$/);
  if (method === 'POST' && publishPostMatch) {
    return {
      action: 'publish_post',
      payload: { ...body, postId: decodeURIComponent(publishPostMatch[1]) },
    };
  }

  const jobMatch = pathname.match(/^\/v1\/jobs\/([^/]+)$/);
  if (method === 'GET' && jobMatch) {
    return {
      action: 'get_job_status',
      payload: { jobId: decodeURIComponent(jobMatch[1]) },
    };
  }

  const cancelJobMatch = pathname.match(/^\/v1\/jobs\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelJobMatch) {
    return {
      action: 'cancel_job',
      payload: { jobId: decodeURIComponent(cancelJobMatch[1]) },
    };
  }

  throw new BridgeError('validation_error', `Unsupported route: ${method} ${pathname}`);
}

export async function startHttpServer(
  transport: RpcTransport,
  options: HttpServerOptions = {}
): Promise<Server> {
  const host = options.host || AGENT_HTTP_HOST;
  const port = options.port ?? AGENT_HTTP_PORT;
  const baseUrl = `http://${host}:${port}`;

  const server = createServer(async (req, res) => {
    try {
      const body = await readJsonBody(req);
      const route = resolveRoute(req, body, baseUrl);
      const response = await transport.request(route.action, route.payload);
      const data = unwrapTransportResponse(response);
      sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const plainError = errorToPlainObject(error);
      sendJson(res, getStatusCode(plainError.code), {
        ok: false,
        error: plainError,
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return server;
}
