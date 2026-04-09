export const AGENT_NATIVE_HOST_NAME = 'org.synccaster.bridge';
export const AGENT_HTTP_HOST = '127.0.0.1';
export const AGENT_HTTP_PORT = 39123;

export const AGENT_RPC_ACTIONS = [
  'health',
  'list_platforms',
  'list_accounts',
  'create_post',
  'update_post',
  'publish_post',
  'get_job_status',
  'cancel_job',
  'render_wechat_html',
] as const;

export type AgentRpcAction = (typeof AGENT_RPC_ACTIONS)[number];

export const AGENT_ERROR_CODES = [
  'extension_unavailable',
  'default_account_not_configured',
  'post_not_found',
  'job_not_found',
  'unsupported_platform',
  'validation_error',
  'internal_error',
] as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

export interface AgentRpcError {
  code: AgentErrorCode | string;
  message: string;
  details?: unknown;
}

export interface AgentRpcRequest<TPayload = unknown> {
  id: string;
  action: AgentRpcAction;
  payload?: TPayload;
}

export interface AgentRpcResponse<TData = unknown> {
  id: string;
  ok: boolean;
  data?: TData;
  error?: AgentRpcError;
}

export interface AgentHealthResponse {
  status: 'ok';
  version: string;
  connected: boolean;
}

export interface AgentPlatformInfo {
  id: string;
  name: string;
  supportsMarkdown: boolean;
  supportsHtml: boolean;
  supportsLatex: boolean;
}

export interface AgentAccountInfo {
  platform: string;
  accountId: string;
  nickname: string;
  enabled: boolean;
  status?: string;
  isDefaultPublish: boolean;
}

export interface AgentCreatePostPayload {
  title: string;
  body_md: string;
  summary?: string;
  tags?: string[];
  categories?: string[];
  canonicalUrl?: string;
  source_url?: string;
  meta?: Record<string, unknown>;
}

export interface AgentCreatePostResponse {
  postId: string;
}

export interface AgentUpdatePostPayload {
  postId: string;
  title?: string;
  body_md?: string;
  summary?: string;
  tags?: string[];
  categories?: string[];
  canonicalUrl?: string;
  source_url?: string;
  meta?: Record<string, unknown>;
}

export interface AgentPublishTargetInput {
  platform: string;
  config?: Record<string, unknown>;
}

export interface AgentPublishPostPayload {
  postId: string;
  targets: AgentPublishTargetInput[];
}

export interface AgentPublishPostResponse {
  jobId: string;
}

export type AgentJobState =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'pending_manual_confirm';

export type AgentJobResultStatus = 'published' | 'failed' | 'pending_manual_confirm';

export interface AgentJobResult {
  platform: string;
  accountId: string;
  status: AgentJobResultStatus;
  url?: string;
  error?: string;
  updatedAt: number;
}

export interface AgentJobStatusResponse {
  jobId: string;
  postId: string;
  state: AgentJobState;
  progress: number;
  error?: string;
  results: AgentJobResult[];
}

export interface AgentRenderWechatPayload {
  markdown: string;
  options?: Record<string, unknown>;
}

export interface AgentRenderWechatResponse {
  html: string;
  css: string;
  meta?: Record<string, unknown>;
}
