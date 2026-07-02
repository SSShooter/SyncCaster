import type { AiRewriteMode } from '@synccaster/ai';

export interface RewriteCandidateDraft {
  id: string;
  title: string;
  bodyMd: string;
  summary?: string;
  style?: string;
  rationale?: string;
}

export interface RewriteDraft {
  style: string;
  rewriteMode?: AiRewriteMode;
  candidates: RewriteCandidateDraft[];
  selectedCandidateId: string;
  generatedAt: string;
}

export type RewriteJobStatus = 'running' | 'done' | 'error';

export interface RewriteJob {
  requestId: string;
  style: string;
  rewriteMode?: AiRewriteMode;
  status: RewriteJobStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export function buildRewriteDraft(input: {
  style: string;
  rewriteMode?: AiRewriteMode;
  candidates: RewriteCandidateDraft[];
  selectedCandidateId?: string;
  generatedAt: string;
}): RewriteDraft {
  return {
    style: input.style,
    rewriteMode: input.rewriteMode,
    candidates: input.candidates,
    selectedCandidateId: input.selectedCandidateId || input.candidates[0]?.id || '',
    generatedAt: input.generatedAt,
  };
}

export function buildSelectedRewriteDraft(input: {
  candidate: RewriteCandidateDraft;
  style: string;
  rewriteMode?: AiRewriteMode;
  generatedAt: string;
}): RewriteDraft {
  return buildRewriteDraft({
    style: input.style,
    rewriteMode: input.rewriteMode,
    candidates: [input.candidate],
    selectedCandidateId: input.candidate.id,
    generatedAt: input.generatedAt,
  });
}

export function appendRewriteCandidateToDraft(
  draft: RewriteDraft,
  candidate: RewriteCandidateDraft,
  maxCandidates = 3
): RewriteDraft {
  const candidates = [...draft.candidates, candidate].slice(-maxCandidates);
  const selectedCandidateId = candidates.some((item) => item.id === draft.selectedCandidateId)
    ? draft.selectedCandidateId
    : candidates[0]?.id || '';
  return {
    ...draft,
    candidates,
    selectedCandidateId,
  };
}

export function createNextRewriteCandidateId(candidates: RewriteCandidateDraft[]): string {
  const maxId = candidates.reduce((max, candidate) => {
    const match = /^candidate-(\d+)$/.exec(candidate.id);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `candidate-${maxId + 1}`;
}

export function buildRewriteJobRunning(input: {
  requestId: string;
  style: string;
  rewriteMode?: AiRewriteMode;
  startedAt: string;
}): RewriteJob {
  return {
    requestId: input.requestId,
    style: input.style,
    rewriteMode: input.rewriteMode,
    status: 'running',
    startedAt: input.startedAt,
  };
}

export function buildRewriteJobDone(input: {
  requestId: string;
  style: string;
  rewriteMode?: AiRewriteMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}): RewriteJob {
  return {
    requestId: input.requestId,
    style: input.style,
    rewriteMode: input.rewriteMode,
    status: 'done',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
  };
}

export function buildRewriteJobError(input: {
  requestId: string;
  style: string;
  rewriteMode?: AiRewriteMode;
  startedAt: string;
  finishedAt: string;
  errorMessage: string;
}): RewriteJob {
  return {
    requestId: input.requestId,
    style: input.style,
    rewriteMode: input.rewriteMode,
    status: 'error',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    errorMessage: input.errorMessage,
  };
}

export function getRewriteDraft(post: any): RewriteDraft | null {
  const draft = post?.meta?.aiRewriteDraft;
  if (!draft || !Array.isArray(draft.candidates)) {
    return null;
  }
  return draft;
}

export function getRewriteJob(post: any): RewriteJob | null {
  const job = post?.meta?.aiRewriteJob;
  if (!job || typeof job.requestId !== 'string' || typeof job.status !== 'string') {
    return null;
  }
  return job;
}

export function isRewriteJobExpired(job: RewriteJob | null, now: number, timeoutMs: number): boolean {
  if (!job || job.status !== 'running') {
    return false;
  }
  const startedAt = Date.parse(job.startedAt);
  if (!Number.isFinite(startedAt)) {
    return false;
  }
  return now - startedAt > timeoutMs;
}

export function isRewriteJobForRequest(job: RewriteJob | null, requestId: string): boolean {
  return Boolean(job && job.requestId === requestId);
}

export function getRewriteJobStatusText(job: RewriteJob | null, now: number, isCurrentRequest = false): string {
  if (!job) {
    return '';
  }
  if (job.status === 'running') {
    const seconds = Math.max(0, Math.floor((now - Date.parse(job.startedAt)) / 1000));
    return `AI 正在后台逐个生成，已等待 ${seconds} 秒。可以离开页面，稍后回来查看结果。`;
  }
  if (job.status === 'done') {
    const seconds = job.durationMs ? Math.round(job.durationMs / 1000) : null;
    return seconds ? `AI 生成完成，用时约 ${seconds} 秒。` : 'AI 生成完成。';
  }
  const prefix = isCurrentRequest ? '本次 AI 生成失败' : '上次 AI 生成失败';
  return `${prefix}：${formatRewriteJobErrorMessage(job.errorMessage)}`;
}

function formatRewriteJobErrorMessage(message?: string): string {
  if (!message) {
    return '请求失败';
  }
  if (message.includes('AI candidate was too short')) {
    return 'AI 返回的文案太短，已自动重试后仍不合格。可以换个模板或降低压缩倾向后再试。';
  }
  if (message.includes('AI candidate was too close to the original')) {
    return 'AI 返回的文案与原文过于接近，已自动重试后仍不合格。可以换个模板或提高改写要求后再试。';
  }
  return message;
}

export function mergePostMetaWithRewriteDraft(meta: Record<string, any> | undefined, draft: RewriteDraft) {
  return {
    ...(meta || {}),
    aiRewriteDraft: draft,
  };
}

export function mergePostMetaWithRewriteJob(meta: Record<string, any> | undefined, job: RewriteJob) {
  return {
    ...(meta || {}),
    aiRewriteJob: job,
  };
}
