export type AiRewriteStyle = 'balanced' | 'less_ai' | 'platform_ready';
export type AiHumanizeLevel = 'light' | 'standard' | 'strong';
export type AiStreamChunkHandler = (content: string) => void;
export type AiStreamFallbackHandler = (message: string) => void;

export interface AiRewritePromptTemplate {
  id: string;
  name: string;
  prompt: string;
}

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs?: number;
}

export interface AiRewriteSource {
  postId: string;
  title: string;
  bodyMd: string;
  sourceUrl?: string;
}

export interface AiRewritePromptInput {
  source: AiRewriteSource;
  style?: AiRewriteStyle;
  rewritePrompt?: AiRewritePromptTemplate;
  humanizeLevel?: AiHumanizeLevel;
  candidateCount: 1 | 2 | 3;
}

export interface AiRewriteRequest extends AiRewritePromptInput {
  provider: AiProviderConfig;
  signal?: AbortSignal;
  onStreamChunk?: AiStreamChunkHandler;
  onStreamFallback?: AiStreamFallbackHandler;
}

export interface AiRewriteCandidate {
  id: string;
  title: string;
  bodyMd: string;
  summary?: string;
  rationale?: string;
  style: string;
}

export interface AiRewriteResult {
  candidates: AiRewriteCandidate[];
  raw: string;
}

export type AiErrorCode =
  | 'invalid_config'
  | 'auth_error'
  | 'rate_limited'
  | 'network_error'
  | 'timeout'
  | 'canceled'
  | 'invalid_response'
  | 'provider_error';

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.status = status;
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
