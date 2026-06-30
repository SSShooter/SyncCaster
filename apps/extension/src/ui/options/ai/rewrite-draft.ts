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

export function getRewriteDraft(post: any): RewriteDraft | null {
  const draft = post?.meta?.aiRewriteDraft;
  if (!draft || !Array.isArray(draft.candidates)) {
    return null;
  }
  return draft;
}

export function mergePostMetaWithRewriteDraft(meta: Record<string, any> | undefined, draft: RewriteDraft) {
  return {
    ...(meta || {}),
    aiRewriteDraft: draft,
  };
}
