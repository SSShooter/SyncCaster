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
  candidates: RewriteCandidateDraft[];
  selectedCandidateId: string;
  generatedAt: string;
}

export type RewriteJobStatus = 'running' | 'done' | 'error';

export interface RewriteJob {
  requestId: string;
  style: string;
  status: RewriteJobStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export function buildRewriteDraft(input: {
  style: string;
  candidates: RewriteCandidateDraft[];
  selectedCandidateId?: string;
  generatedAt: string;
}): RewriteDraft {
  return {
    style: input.style,
    candidates: input.candidates,
    selectedCandidateId: input.selectedCandidateId || input.candidates[0]?.id || '',
    generatedAt: input.generatedAt,
  };
}

export function buildSelectedRewriteDraft(input: {
  candidate: RewriteCandidateDraft;
  style: string;
  generatedAt: string;
}): RewriteDraft {
  return buildRewriteDraft({
    style: input.style,
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
  startedAt: string;
}): RewriteJob {
  return {
    requestId: input.requestId,
    style: input.style,
    status: 'running',
    startedAt: input.startedAt,
  };
}

export function buildRewriteJobDone(input: {
  requestId: string;
  style: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}): RewriteJob {
  return {
    requestId: input.requestId,
    style: input.style,
    status: 'done',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
  };
}

export function buildRewriteJobError(input: {
  requestId: string;
  style: string;
  startedAt: string;
  finishedAt: string;
  errorMessage: string;
}): RewriteJob {
  return {
    requestId: input.requestId,
    style: input.style,
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
    return `AI 正在逐个生成，已等待 ${seconds} 秒。当前页面会即时保存已生成的候选，关闭页面会中断本次生成。`;
  }
  if (job.status === 'done') {
    const seconds = job.durationMs ? Math.round(job.durationMs / 1000) : null;
    return seconds ? `AI 生成完成，用时约 ${seconds} 秒。` : 'AI 生成完成。';
  }
  const prefix = isCurrentRequest ? '本次 AI 生成失败' : '上次 AI 生成失败';
  return `${prefix}：${job.errorMessage || '请求失败'}`;
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
