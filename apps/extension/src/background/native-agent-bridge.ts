import {
  AGENT_NATIVE_HOST_NAME,
  type AgentRpcRequest,
} from '@synccaster/agent-protocol';
import { Logger } from '@synccaster/utils';
import { handleAgentRpcRequest } from './agent-rpc';

const logger = new Logger('native-agent-bridge');
const INITIAL_RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

let nativePort: chrome.runtime.Port | null = null;
let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
let reconnectTimer: number | null = null;
let initialized = false;

function isAgentRpcRequest(value: unknown): value is AgentRpcRequest {
  return !!value
    && typeof value === 'object'
    && typeof (value as AgentRpcRequest).id === 'string'
    && typeof (value as AgentRpcRequest).action === 'string';
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return;

  reconnectTimer = globalThis.setTimeout(() => {
    reconnectTimer = null;
    connectNativeHost();
  }, reconnectDelayMs) as unknown as number;

  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
}

function resetReconnectDelay() {
  reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
}

async function handleNativeMessage(message: unknown) {
  if (!isAgentRpcRequest(message)) {
    logger.warn('message', 'Ignoring non-agent native message', {
      messageType: typeof message,
    });
    return;
  }

  const response = await handleAgentRpcRequest(message);
  nativePort?.postMessage(response);
}

function onDisconnect() {
  const error = chrome.runtime.lastError?.message;
  logger.warn('disconnect', 'Native host disconnected', { error });
  nativePort = null;
  scheduleReconnect();
}

function connectNativeHost() {
  if (nativePort) return;

  try {
    logger.info('connect', 'Connecting native host', {
      host: AGENT_NATIVE_HOST_NAME,
    });
    const port = chrome.runtime.connectNative(AGENT_NATIVE_HOST_NAME);
    nativePort = port;
    resetReconnectDelay();
    port.onMessage.addListener(handleNativeMessage);
    port.onDisconnect.addListener(onDisconnect);
  } catch (error) {
    logger.warn('connect', 'Failed to connect native host', {
      error: error instanceof Error ? error.message : String(error),
    });
    nativePort = null;
    scheduleReconnect();
  }
}

export function initNativeAgentBridge() {
  if (initialized) return;
  initialized = true;
  connectNativeHost();
}
