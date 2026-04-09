import type {
  AgentRpcAction,
  AgentRpcResponse,
} from '@synccaster/agent-protocol';
import { BridgeError, createRpcRequest, isAgentRpcResponse, RPC_TIMEOUT_MS } from './shared.js';

interface PendingRequest {
  reject: (reason?: unknown) => void;
  resolve: (value: AgentRpcResponse) => void;
  timeout: NodeJS.Timeout;
}

export class NativeMessagingSession {
  private buffer = Buffer.alloc(0);
  private connected = true;
  private pending = new Map<string, PendingRequest>();
  private disconnectHandlers = new Set<() => void>();

  constructor(
    private readonly input: NodeJS.ReadableStream = process.stdin,
    private readonly output: NodeJS.WritableStream = process.stdout
  ) {}

  start() {
    this.input.on('data', (chunk) => this.handleChunk(Buffer.from(chunk)));
    this.input.on('end', () => this.handleDisconnect());
    this.input.on('close', () => this.handleDisconnect());
    this.input.on('error', () => this.handleDisconnect());
  }

  onDisconnect(handler: () => void) {
    this.disconnectHandlers.add(handler);
  }

  isConnected() {
    return this.connected;
  }

  async request<TPayload = unknown>(
    action: AgentRpcAction,
    payload?: TPayload
  ): Promise<AgentRpcResponse> {
    if (!this.connected) {
      throw new BridgeError('extension_unavailable', 'SyncCaster extension is not connected');
    }

    const request = createRpcRequest(action, payload);

    return new Promise<AgentRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.id);
        reject(new BridgeError('extension_unavailable', `Timed out waiting for ${action}`));
      }, RPC_TIMEOUT_MS);

      this.pending.set(request.id, { resolve, reject, timeout });

      try {
        this.writeMessage(request);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(request.id);
        reject(error);
      }
    });
  }

  private writeMessage(message: unknown) {
    const payload = Buffer.from(JSON.stringify(message), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    this.output.write(Buffer.concat([header, payload]));
  }

  private handleChunk(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 4) {
      const messageLength = this.buffer.readUInt32LE(0);
      if (this.buffer.length < 4 + messageLength) {
        return;
      }

      const rawMessage = this.buffer.subarray(4, 4 + messageLength);
      this.buffer = this.buffer.subarray(4 + messageLength);

      try {
        const message = JSON.parse(rawMessage.toString('utf8'));
        if (!isAgentRpcResponse(message)) {
          continue;
        }

        const pending = this.pending.get(message.id);
        if (!pending) continue;

        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        pending.resolve(message);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(failure);
        }
        this.pending.clear();
      }
    }
  }

  private handleDisconnect() {
    if (!this.connected) return;
    this.connected = false;

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new BridgeError('extension_unavailable', 'SyncCaster extension is not connected')
      );
    }
    this.pending.clear();

    for (const handler of this.disconnectHandlers) {
      handler();
    }
  }
}
