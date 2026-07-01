import { describe, expect, it } from 'vitest';
import {
  buildRewriteJobDone,
  buildRewriteJobError,
  buildRewriteJobRunning,
  buildRewriteDraft,
  buildSelectedRewriteDraft,
  appendRewriteCandidateToDraft,
  createNextRewriteCandidateId,
  getRewriteDraft,
  getRewriteJob,
  isRewriteJobForRequest,
  isRewriteJobExpired,
  getRewriteJobStatusText,
  mergePostMetaWithRewriteJob,
  mergePostMetaWithRewriteDraft,
} from '../rewrite-draft';

const candidates = [
  {
    id: 'candidate-1',
    title: 'Title 1',
    bodyMd: 'Body 1',
    summary: 'Summary 1',
    style: 'less_ai',
    rationale: 'Reason 1',
  },
  {
    id: 'candidate-2',
    title: 'Title 2',
    bodyMd: 'Body 2',
    summary: 'Summary 2',
    style: 'less_ai',
  },
];

describe('rewrite draft persistence', () => {
  it('reads the latest AI rewrite draft from post metadata', () => {
    const draft = buildRewriteDraft({
      style: 'less_ai',
      candidates,
      selectedCandidateId: 'candidate-2',
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(getRewriteDraft({ meta: { aiRewriteDraft: draft } })).toEqual(draft);
    expect(getRewriteDraft({ meta: {} })).toBeNull();
  });

  it('stores only the latest candidate set in post metadata', () => {
    const existingMeta = {
      source_url: 'https://example.com/post',
      aiRewriteDraft: buildRewriteDraft({
        style: 'balanced',
        candidates: [candidates[0]],
        selectedCandidateId: 'candidate-1',
        generatedAt: '2026-06-29T00:00:00.000Z',
      }),
    };

    const nextDraft = buildRewriteDraft({
      style: 'less_ai',
      candidates,
      selectedCandidateId: 'candidate-2',
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(mergePostMetaWithRewriteDraft(existingMeta, nextDraft)).toEqual({
      source_url: 'https://example.com/post',
      aiRewriteDraft: nextDraft,
    });
  });

  it('keeps only the selected candidate after the user applies a draft', () => {
    const selectedDraft = buildSelectedRewriteDraft({
      candidate: candidates[1],
      style: 'less_ai',
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(selectedDraft.candidates).toEqual([candidates[1]]);
    expect(selectedDraft.selectedCandidateId).toBe('candidate-2');
  });

  it('keeps only the latest three candidates when appending another candidate', () => {
    const draft = buildRewriteDraft({
      style: 'less_ai',
      candidates: [
        { id: 'candidate-1', title: 'Title 1', bodyMd: 'Body 1' },
        { id: 'candidate-2', title: 'Title 2', bodyMd: 'Body 2' },
        { id: 'candidate-3', title: 'Title 3', bodyMd: 'Body 3' },
      ],
      selectedCandidateId: 'candidate-1',
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    const next = appendRewriteCandidateToDraft(draft, {
      id: 'candidate-4',
      title: 'Title 4',
      bodyMd: 'Body 4',
    });

    expect(next.candidates.map((item) => item.id)).toEqual(['candidate-2', 'candidate-3', 'candidate-4']);
    expect(next.selectedCandidateId).toBe('candidate-2');
  });

  it('creates the next candidate id from the highest existing numeric suffix', () => {
    expect(createNextRewriteCandidateId([
      { id: 'candidate-2', title: 'Title 2', bodyMd: 'Body 2' },
      { id: 'candidate-3', title: 'Title 3', bodyMd: 'Body 3' },
      { id: 'candidate-4', title: 'Title 4', bodyMd: 'Body 4' },
    ])).toBe('candidate-5');
  });
});

describe('rewrite job persistence', () => {
  it('stores a running AI rewrite job in post metadata', () => {
    const job = buildRewriteJobRunning({
      requestId: 'request-1',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(job).toEqual({
      requestId: 'request-1',
      style: 'less_ai',
      status: 'running',
      startedAt: '2026-06-30T00:00:00.000Z',
    });
    expect(getRewriteJob({ meta: { aiRewriteJob: job } })).toEqual(job);
    expect(mergePostMetaWithRewriteJob({ source_url: 'https://example.com/post' }, job)).toEqual({
      source_url: 'https://example.com/post',
      aiRewriteJob: job,
    });
  });

  it('stores done and error states without keeping stale error text', () => {
    const done = buildRewriteJobDone({
      requestId: 'request-1',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
      finishedAt: '2026-06-30T00:00:08.000Z',
      durationMs: 8000,
    });
    const error = buildRewriteJobError({
      requestId: 'request-2',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
      finishedAt: '2026-06-30T00:02:00.000Z',
      errorMessage: 'AI provider request timed out.',
    });

    expect(done).toMatchObject({ status: 'done', durationMs: 8000 });
    expect(done).not.toHaveProperty('errorMessage');
    expect(error).toMatchObject({ status: 'error', errorMessage: 'AI provider request timed out.' });
  });

  it('detects stale running jobs after the request timeout window', () => {
    const running = buildRewriteJobRunning({
      requestId: 'request-1',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(isRewriteJobExpired(running, Date.parse('2026-06-30T00:01:59.000Z'), 120000)).toBe(false);
    expect(isRewriteJobExpired(running, Date.parse('2026-06-30T00:02:01.000Z'), 120000)).toBe(true);
    expect(isRewriteJobExpired({ ...running, status: 'done' }, Date.parse('2026-06-30T00:02:01.000Z'), 120000)).toBe(false);
  });

  it('matches jobs by request id to avoid stale generation overwrites', () => {
    const running = buildRewriteJobRunning({
      requestId: 'request-1',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(isRewriteJobForRequest(running, 'request-1')).toBe(true);
    expect(isRewriteJobForRequest(running, 'request-2')).toBe(false);
    expect(isRewriteJobForRequest(null, 'request-1')).toBe(false);
  });

  it('describes running jobs as background generation', () => {
    const running = buildRewriteJobRunning({
      requestId: 'request-1',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(getRewriteJobStatusText(running, Date.parse('2026-06-30T00:00:12.000Z'), true))
      .toBe('AI 正在后台逐个生成，已等待 12 秒。可以离开页面，稍后回来查看结果。');
  });

  it('labels stale error jobs as previous generation failures', () => {
    const error = buildRewriteJobError({
      requestId: 'request-1',
      style: 'less_ai',
      startedAt: '2026-06-30T00:00:00.000Z',
      finishedAt: '2026-06-30T00:02:00.000Z',
      errorMessage: 'AI provider request timed out.',
    });

    expect(getRewriteJobStatusText(error, Date.parse('2026-06-30T00:03:00.000Z'), false))
      .toBe('上次 AI 生成失败：AI provider request timed out.');
    expect(getRewriteJobStatusText(error, Date.parse('2026-06-30T00:03:00.000Z'), true))
      .toBe('本次 AI 生成失败：AI provider request timed out.');
  });
});
