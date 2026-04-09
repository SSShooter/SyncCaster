import {
  AGENT_ERROR_CODES,
  AGENT_HTTP_HOST,
  AGENT_HTTP_PORT,
  type AgentErrorCode,
  type AgentRpcAction,
  type AgentRpcError,
  type AgentRpcRequest,
  type AgentRpcResponse,
} from '@synccaster/agent-protocol';

export const HTTP_BASE_URL = `http://${AGENT_HTTP_HOST}:${AGENT_HTTP_PORT}`;
export const RPC_TIMEOUT_MS = 30_000;

export class BridgeError extends Error {
  code: AgentErrorCode | string;
  details?: unknown;

  constructor(code: AgentErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function isAgentRpcResponse(value: unknown): value is AgentRpcResponse {
  return !!value
    && typeof value === 'object'
    && typeof (value as AgentRpcResponse).id === 'string'
    && typeof (value as AgentRpcResponse).ok === 'boolean';
}

export function isAgentErrorCode(value: unknown): value is AgentErrorCode {
  return typeof value === 'string' && (AGENT_ERROR_CODES as readonly string[]).includes(value);
}

export function createRpcRequest<TPayload = unknown>(
  action: AgentRpcAction,
  payload?: TPayload
): AgentRpcRequest<TPayload> {
  return {
    id: crypto.randomUUID(),
    action,
    payload,
  };
}

export function createRpcError(
  code: AgentErrorCode | string,
  message: string,
  details?: unknown
): AgentRpcError {
  return { code, message, details };
}

export function ensureOkResponse<TData>(response: AgentRpcResponse<TData>): TData {
  if (response.ok) {
    return response.data as TData;
  }

  const error = response.error || createRpcError('internal_error', 'Unknown RPC error');
  throw new BridgeError(error.code, error.message, error.details);
}

export function errorToPlainObject(error: unknown): AgentRpcError {
  if (error instanceof BridgeError) {
    return createRpcError(error.code, error.message, error.details);
  }

  if (error instanceof Error) {
    return createRpcError('internal_error', error.message);
  }

  return createRpcError('internal_error', String(error));
}
