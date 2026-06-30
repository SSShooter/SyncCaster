import {
  generateRewriteCandidates,
  normalizeHumanizeLevel,
  type AiHumanizeLevel,
  type AiProviderConfig,
  type AiRewriteCandidate,
  type AiRewritePromptTemplate,
  type AiRewriteSource,
} from '@synccaster/ai';

export interface ForegroundRewriteConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  timeoutMs?: number;
  candidateCount: 1 | 2 | 3;
  humanizeLevel?: AiHumanizeLevel;
  rewritePrompts?: AiRewritePromptTemplate[];
  defaultRewritePromptId?: string;
}

export interface ForegroundRewriteError {
  candidateIndex: number;
  message: string;
}

export interface ForegroundRewriteDiagnostics {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  requestedCount: number;
  finishedCount: number;
  failedCount: number;
  sourceLength: number;
}

export interface ForegroundRewriteResult {
  candidates: AiRewriteCandidate[];
  errors: ForegroundRewriteError[];
  diagnostics: ForegroundRewriteDiagnostics;
}

export type ForegroundRewriteEventStage =
  | 'saving_job'
  | 'loading_config'
  | 'checking_permission'
  | 'started'
  | 'candidate_started'
  | 'request_started'
  | 'response_received'
  | 'candidate_saved'
  | 'candidate_error'
  | 'finished';

export interface ForegroundRewriteEvent {
  stage: ForegroundRewriteEventStage;
  at: string;
  elapsedMs: number;
  requestedCount: number;
  finishedCount: number;
  failedCount: number;
  candidateIndex?: number;
  message?: string;
}

export interface GenerateOneCandidateInput {
  provider: AiProviderConfig;
  source: AiRewriteSource;
  rewritePrompt: AiRewritePromptTemplate | undefined;
  humanizeLevel?: AiHumanizeLevel;
  candidateIndex: number;
  signal?: AbortSignal;
}

export type GenerateOneCandidate = (input: GenerateOneCandidateInput) => Promise<{
  candidates: AiRewriteCandidate[];
  raw: string;
}>;

export interface RunForegroundRewriteInput {
  config: ForegroundRewriteConfig;
  apiKey: string;
  source: AiRewriteSource;
  rewritePromptId?: string;
  candidateCount?: 1 | 2 | 3;
  signal?: AbortSignal;
  generateOneCandidate?: GenerateOneCandidate;
  onCandidate?: (candidate: AiRewriteCandidate) => void | Promise<void>;
  onEvent?: (event: ForegroundRewriteEvent) => void;
}

export const DEFAULT_FOREGROUND_AI_REQUEST_TIMEOUT_MS = 180_000;
export const MIN_FOREGROUND_AI_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_FOREGROUND_AI_REQUEST_TIMEOUT_MS = 600_000;

function resolveRewritePrompt(config: ForegroundRewriteConfig, rewritePromptId?: string): AiRewritePromptTemplate | undefined {
  const prompts = Array.isArray(config.rewritePrompts) ? config.rewritePrompts : [];
  const selectedId = rewritePromptId || config.defaultRewritePromptId;
  return prompts.find((item) => item.id === selectedId) || prompts[0];
}

function normalizeCandidateCount(input: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  const value = Number(input);
  return value === 1 || value === 2 || value === 3 ? value : fallback;
}

function getErrorMessage(error: unknown): string {
  return (error as { message?: string } | null)?.message || 'AI candidate generation failed.';
}

function getForegroundTimeoutMs(timeoutMs: unknown): number {
  const value = Number(timeoutMs);
  if (Number.isFinite(value) && value > 0) {
    return Math.min(Math.max(value, MIN_FOREGROUND_AI_REQUEST_TIMEOUT_MS), MAX_FOREGROUND_AI_REQUEST_TIMEOUT_MS);
  }
  return DEFAULT_FOREGROUND_AI_REQUEST_TIMEOUT_MS;
}

async function defaultGenerateOneCandidate(input: GenerateOneCandidateInput) {
  return generateRewriteCandidates({
    provider: input.provider,
    source: input.source,
    rewritePrompt: input.rewritePrompt,
    humanizeLevel: input.humanizeLevel,
    candidateCount: 1,
    signal: input.signal,
  });
}

export async function runForegroundRewriteCandidates(input: RunForegroundRewriteInput): Promise<ForegroundRewriteResult> {
  const startedAtMs = Date.now();
  const requestedCount = normalizeCandidateCount(input.candidateCount, input.config.candidateCount);
  const candidates: AiRewriteCandidate[] = [];
  const errors: ForegroundRewriteError[] = [];
  const emit = (
    stage: ForegroundRewriteEventStage,
    extra: Pick<ForegroundRewriteEvent, 'candidateIndex' | 'message'> = {}
  ) => {
    input.onEvent?.({
      stage,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - startedAtMs,
      requestedCount,
      finishedCount: candidates.length,
      failedCount: errors.length,
      ...extra,
    });
  };
  const provider: AiProviderConfig = {
    baseUrl: input.config.baseUrl,
    apiKey: input.apiKey,
    model: input.config.model,
    temperature: input.config.temperature,
    timeoutMs: getForegroundTimeoutMs(input.config.timeoutMs),
  };
  const rewritePrompt = resolveRewritePrompt(input.config, input.rewritePromptId);
  const humanizeLevel = normalizeHumanizeLevel(input.config.humanizeLevel);
  const generateOneCandidate = input.generateOneCandidate || defaultGenerateOneCandidate;

  emit('started');
  for (let index = 0; index < requestedCount; index += 1) {
    if (input.signal?.aborted) {
      const message = 'AI generation was canceled.';
      errors.push({
        candidateIndex: index,
        message,
      });
      emit('candidate_error', { candidateIndex: index, message });
      break;
    }
    try {
      emit('candidate_started', { candidateIndex: index });
      emit('request_started', { candidateIndex: index });
      const result = await generateOneCandidate({
        provider,
        source: input.source,
        rewritePrompt,
        humanizeLevel,
        candidateIndex: index,
        signal: input.signal,
      });
      emit('response_received', { candidateIndex: index });
      const candidate = result.candidates[0];
      if (!candidate) {
        throw new Error('AI provider returned no candidate.');
      }
      const normalized = {
        ...candidate,
        id: `candidate-${index + 1}`,
      };
      candidates.push(normalized);
      await input.onCandidate?.(normalized);
      emit('candidate_saved', { candidateIndex: index });
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push({
        candidateIndex: index,
        message,
      });
      emit('candidate_error', { candidateIndex: index, message });
      break;
    }
  }

  const finishedAtMs = Date.now();
  emit('finished');
  return {
    candidates,
    errors,
    diagnostics: {
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      requestedCount,
      finishedCount: candidates.length,
      failedCount: errors.length,
      sourceLength: input.source.bodyMd.length,
    },
  };
}
