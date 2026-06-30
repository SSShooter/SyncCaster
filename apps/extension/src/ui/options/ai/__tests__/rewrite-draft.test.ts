import { describe, expect, it } from 'vitest';
import {
  buildRewriteDraft,
  buildSelectedRewriteDraft,
  getRewriteDraft,
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
});
