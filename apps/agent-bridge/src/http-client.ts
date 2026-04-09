import type { AgentRpcAction } from '@synccaster/agent-protocol';
import { HTTP_BASE_URL, BridgeError, createRpcError } from './shared.js';

interface BridgeHttpSuccess<TData> {
  ok: true;
  data: TData;
}

interface BridgeHttpFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

type BridgeHttpEnvelope<TData> = BridgeHttpSuccess<TData> | BridgeHttpFailure;

function getHttpBaseUrl(): string {
  const override = process.env.SYNCCASTER_AGENT_HTTP_BASE_URL?.trim();
  return override || HTTP_BASE_URL;
}

async function parseHttpResponse<TData>(response: Response): Promise<TData> {
  const text = await response.text();
  let payload: BridgeHttpEnvelope<TData>;

  try {
    payload = JSON.parse(text) as BridgeHttpEnvelope<TData>;
  } catch {
    throw new BridgeError(
      'internal_error',
      `Bridge returned invalid JSON with status ${response.status}`
    );
  }

  if (payload.ok) {
    return payload.data;
  }

  throw new BridgeError(payload.error.code, payload.error.message, payload.error.details);
}

async function requestJson<TData>(
  method: string,
  path: string,
  body?: unknown
): Promise<TData> {
  const url = `${getHttpBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new BridgeError(
      'extension_unavailable',
      'SyncCaster local bridge is unavailable',
      error instanceof Error ? createRpcError('extension_unavailable', error.message) : error
    );
  }

  return parseHttpResponse<TData>(response);
}

export async function callAgentAction<TData = unknown>(
  action: AgentRpcAction,
  payload?: unknown
): Promise<TData> {
  switch (action) {
    case 'health':
      return requestJson<TData>('GET', '/v1/health');
    case 'list_platforms':
      return requestJson<TData>('GET', '/v1/platforms');
    case 'list_accounts':
      return requestJson<TData>('GET', '/v1/accounts');
    case 'create_post':
      return requestJson<TData>('POST', '/v1/posts', payload);
    case 'update_post': {
      const postId = typeof (payload as { postId?: unknown })?.postId === 'string'
        ? (payload as { postId: string }).postId
        : '';
      const { postId: _, ...updates } = (payload || {}) as Record<string, unknown>;
      return requestJson<TData>('PATCH', `/v1/posts/${encodeURIComponent(postId)}`, updates);
    }
    case 'publish_post': {
      const postId = typeof (payload as { postId?: unknown })?.postId === 'string'
        ? (payload as { postId: string }).postId
        : '';
      const { postId: _, ...publishBody } = (payload || {}) as Record<string, unknown>;
      return requestJson<TData>(
        'POST',
        `/v1/posts/${encodeURIComponent(postId)}/publish`,
        publishBody
      );
    }
    case 'get_job_status': {
      const jobId = typeof (payload as { jobId?: unknown })?.jobId === 'string'
        ? (payload as { jobId: string }).jobId
        : '';
      return requestJson<TData>('GET', `/v1/jobs/${encodeURIComponent(jobId)}`);
    }
    case 'cancel_job': {
      const jobId = typeof (payload as { jobId?: unknown })?.jobId === 'string'
        ? (payload as { jobId: string }).jobId
        : '';
      return requestJson<TData>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/cancel`);
    }
    case 'render_wechat_html':
      return requestJson<TData>('POST', '/v1/render/wechat', payload);
    default:
      throw new BridgeError('validation_error', `Unsupported action: ${String(action)}`);
  }
}
