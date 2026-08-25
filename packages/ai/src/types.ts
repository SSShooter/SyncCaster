export type AiRewriteStyle = 'balanced' | 'less_ai' | 'platform_ready';
export type AiRewriteMode = 'reference_rebuild' | 'faithful_rewrite' | 'case_study';
export type AiHumanizeLevel = 'light' | 'standard' | 'strong';
export type AiStreamChunkHandler = (content: string) => void;
export type AiStreamFallbackHandler = (message: string) => void;
export type AiSegmentProgressStage = 'segment_started' | 'segment_finished';
export type AiSegmentProgressHandler = (event: {
  stage: AiSegmentProgressStage;
  index: number;
  total: number;
}) => void;

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
  rewriteMode?: AiRewriteMode;
  rewritePrompt?: AiRewritePromptTemplate;
  humanizeLevel?: AiHumanizeLevel;
  segment?: {
    index: number;
    total: number;
  };
  candidateCount: 1 | 2 | 3;
}

export interface AiRewriteRequest extends AiRewritePromptInput {
  provider: AiProviderConfig;
  signal?: AbortSignal;
  onStreamChunk?: AiStreamChunkHandler;
  onStreamFallback?: AiStreamFallbackHandler;
  onSegmentProgress?: AiSegmentProgressHandler;
  segmentation?: {
    thresholdChars?: number;
    targetChars?: number;
  };
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
