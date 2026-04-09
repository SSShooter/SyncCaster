import { createInterface } from 'node:readline';
import {
  AGENT_RPC_ACTIONS,
  type AgentRpcAction,
} from '@synccaster/agent-protocol';
import { callAgentAction } from './http-client.js';
import { errorToPlainObject } from './shared.js';

const SERVER_NAME = 'synccaster-agent-bridge';
const SERVER_VERSION = '2.0.0';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface ToolDefinition {
  name: AgentRpcAction;
  description: string;
  inputSchema: Record<string, unknown>;
}

function writeMessage(message: JsonRpcResponse | JsonRpcResponse[]) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  });
}

function createEmptySchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {},
    additionalProperties: false,
  };
}

function createArrayOfStringsProperty(description: string) {
  return {
    type: 'array',
    description,
    items: { type: 'string' },
  };
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'health',
    description: 'Check whether the local SyncCaster bridge is reachable.',
    inputSchema: createEmptySchema(),
  },
  {
    name: 'list_platforms',
    description: 'List the supported publish platforms and their content capabilities.',
    inputSchema: createEmptySchema(),
  },
  {
    name: 'list_accounts',
    description: 'List bound accounts and whether each one is the default publish account.',
    inputSchema: createEmptySchema(),
  },
  {
    name: 'create_post',
    description: 'Create a canonical post in SyncCaster from Markdown content.',
    inputSchema: {
      type: 'object',
      required: ['title', 'body_md'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', description: 'Post title.' },
        body_md: { type: 'string', description: 'Markdown body.' },
        summary: { type: 'string', description: 'Optional summary.' },
        tags: createArrayOfStringsProperty('Optional tags.'),
        categories: createArrayOfStringsProperty('Optional categories.'),
        canonicalUrl: { type: 'string', description: 'Optional canonical URL.' },
        source_url: { type: 'string', description: 'Optional source URL.' },
        meta: {
          type: 'object',
          description: 'Optional metadata.',
          additionalProperties: true,
        },
      },
    },
  },
  {
    name: 'update_post',
    description: 'Update an existing canonical post by postId.',
    inputSchema: {
      type: 'object',
      required: ['postId'],
      additionalProperties: false,
      properties: {
        postId: { type: 'string', description: 'Existing SyncCaster post ID.' },
        title: { type: 'string' },
        body_md: { type: 'string' },
        summary: { type: 'string' },
        tags: createArrayOfStringsProperty('Optional tags.'),
        categories: createArrayOfStringsProperty('Optional categories.'),
        canonicalUrl: { type: 'string' },
        source_url: { type: 'string' },
        meta: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  },
  {
    name: 'publish_post',
    description: 'Create and start a publish job for one post. Final publish confirmation remains manual in the browser.',
    inputSchema: {
      type: 'object',
      required: ['postId', 'targets'],
      additionalProperties: false,
      properties: {
        postId: { type: 'string', description: 'Existing SyncCaster post ID.' },
        targets: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['platform'],
            additionalProperties: false,
            properties: {
              platform: { type: 'string', description: 'Target platform ID.' },
              config: {
                type: 'object',
                description: 'Optional adapter-specific config.',
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'get_job_status',
    description: 'Fetch the normalized state and per-platform results of a publish job.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      additionalProperties: false,
      properties: {
        jobId: { type: 'string', description: 'SyncCaster job ID.' },
      },
    },
  },
  {
    name: 'cancel_job',
    description: 'Cancel an in-flight publish job.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      additionalProperties: false,
      properties: {
        jobId: { type: 'string', description: 'SyncCaster job ID.' },
      },
    },
  },
  {
    name: 'render_wechat_html',
    description: 'Render Markdown into WeChat-compatible HTML and CSS without publishing it.',
    inputSchema: {
      type: 'object',
      required: ['markdown'],
      additionalProperties: false,
      properties: {
        markdown: { type: 'string', description: 'Markdown body.' },
        options: {
          type: 'object',
          description: 'Optional render settings.',
          additionalProperties: true,
        },
      },
    },
  },
];

const TOOL_MAP = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return !!value && typeof value === 'object';
}

function isToolName(value: string): value is AgentRpcAction {
  return TOOL_MAP.has(value as AgentRpcAction);
}

function normalizeStructuredContent(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (Array.isArray(value)) {
    return { items: value };
  }
  return { value };
}

function buildToolResult(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
    structuredContent: normalizeStructuredContent(value),
  };
}

function buildToolErrorResult(error: unknown) {
  const plain = errorToPlainObject(error);
  return {
    content: [
      {
        type: 'text',
        text: `${plain.code}: ${plain.message}`,
      },
    ],
    structuredContent: {
      error: plain,
    },
    isError: true,
  };
}

function negotiateProtocolVersion(clientVersion: unknown): string {
  if (typeof clientVersion === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(clientVersion as never)) {
    return clientVersion;
  }
  return SUPPORTED_PROTOCOL_VERSIONS[0];
}

async function callTool(name: string, args: unknown) {
  if (!(AGENT_RPC_ACTIONS as readonly string[]).includes(name)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) {
    throw new Error('Tool arguments must be an object');
  }

  try {
    const data = await callAgentAction(name as AgentRpcAction, args);
    return buildToolResult(data);
  } catch (error) {
    return buildToolErrorResult(error);
  }
}

async function handleRequest(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;

  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: JSONRPC_INVALID_REQUEST,
        message: 'Invalid JSON-RPC request',
      },
    };
  }

  switch (message.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: negotiateProtocolVersion(message.params?.protocolVersion),
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
          instructions:
            'Use these tools to create posts, start publish jobs, inspect status, and render WeChat HTML. Final publish confirmation remains manual in the browser.',
        },
      };
    case 'notifications/initialized':
    case 'notifications/cancelled':
    case '$/cancelRequest':
      return null;
    case 'ping':
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };
    case 'logging/setLevel':
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOL_DEFINITIONS,
        },
      };
    case 'tools/call': {
      const toolName = message.params?.name;
      if (typeof toolName !== 'string') {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: JSONRPC_INVALID_PARAMS,
            message: 'tools/call requires params.name',
          },
        };
      }

      if (!isToolName(toolName)) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: JSONRPC_INVALID_PARAMS,
            message: `Unknown tool: ${toolName}`,
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: await callTool(toolName, message.params?.arguments),
      };
    }
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: JSONRPC_METHOD_NOT_FOUND,
          message: `Method not found: ${message.method}`,
        },
      };
  }
}

async function handleIncoming(rawLine: string) {
  if (!rawLine.trim()) return;

  let payload: unknown;
  try {
    payload = JSON.parse(rawLine);
  } catch (error) {
    writeError(null, JSONRPC_PARSE_ERROR, 'Failed to parse JSON-RPC message', {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  if (messages.length === 0) {
    writeError(null, JSONRPC_INVALID_REQUEST, 'JSON-RPC batch must not be empty');
    return;
  }

  const responses: JsonRpcResponse[] = [];
  for (const message of messages) {
    if (!isJsonRpcRequest(message)) {
      responses.push({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_INVALID_REQUEST,
          message: 'Invalid JSON-RPC request payload',
        },
      });
      continue;
    }

    try {
      const response = await handleRequest(message);
      if (response && message.id !== undefined) {
        responses.push(response);
      }
    } catch (error) {
      responses.push({
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: {
          code: JSONRPC_INTERNAL_ERROR,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (responses.length === 1) {
    writeMessage(responses[0]);
  } else if (responses.length > 1) {
    writeMessage(responses);
  }
}

process.stdin.setEncoding('utf8');

const readline = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false,
});

readline.on('line', (line) => {
  void handleIncoming(line);
});

readline.on('close', () => {
  process.exit(0);
});
