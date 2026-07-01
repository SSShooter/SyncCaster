import { createChatCompletion, createStreamingChatCompletion, type AiFetch } from './openai-compatible';
import { preCleanAiCliches } from './humanize-rules';
import { buildRewriteMessages } from './prompts';
import { mergeSegmentCandidates, splitMarkdownIntoSegments, shouldSegmentMarkdown } from './segmentation';
import { AiProviderError, type AiRewriteCandidate, type AiRewriteRequest, type AiRewriteResult } from './types';

const STREAMING_FALLBACK_MESSAGE = 'AI provider did not support streaming. Falling back to normal mode.';

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function createCandidateId(index: number): string {
  return `candidate-${index + 1}`;
}

function safelyPreCleanAiCliches(markdown: string): string {
  try {
    return preCleanAiCliches(markdown);
  } catch {
    return markdown;
  }
}

function shouldFallbackFromStreaming(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return false;
  }
  const code = (error as { code?: string } | null)?.code;
  return code === 'invalid_response' || code === 'provider_error' || code === 'network_error';
}

export function parseRewriteCandidates(content: string): AiRewriteCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(content));
  } catch {
    throw new AiProviderError('invalid_response', 'AI response was not valid candidate JSON.');
  }

  const candidates = (parsed as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    throw new AiProviderError('invalid_response', 'AI response did not include candidates.');
  }

  return candidates.map((candidate, index) => {
    const item = candidate as Partial<AiRewriteCandidate>;
    if (typeof item.title !== 'string' || typeof item.bodyMd !== 'string') {
      throw new AiProviderError('invalid_response', 'AI candidate was missing title or bodyMd.');
    }
    return {
      id: item.id || createCandidateId(index),
      title: item.title,
      bodyMd: item.bodyMd,
      summary: item.summary,
      rationale: item.rationale,
      style: item.style || 'balanced',
    };
  });
}

function normalizeForQualityCheck(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validateRewriteCandidates(
  candidates: AiRewriteCandidate[],
  source: AiRewriteRequest['source']
): AiRewriteCandidate[] {
  const originalBody = normalizeForQualityCheck(source.bodyMd);
  const originalTitle = normalizeForQualityCheck(source.title);
  const originalLength = originalBody.length;

  return candidates.map((candidate, index) => {
    const body = normalizeForQualityCheck(candidate.bodyMd);
    const title = normalizeForQualityCheck(candidate.title);
    if (originalLength >= 120 && body.length < originalLength * 0.25) {
      throw new AiProviderError('invalid_response', `AI candidate was too short: candidate ${index + 1}.`);
    }
    if (originalLength >= 40 && body === originalBody && title === originalTitle) {
      throw new AiProviderError('invalid_response', `AI candidate was too close to the original: candidate ${index + 1}.`);
    }
    return candidate;
  });
}

async function requestRewriteCandidates(
  request: AiRewriteRequest,
  source: AiRewriteRequest['source'],
  candidateCount: 1 | 2 | 3,
  fetchImpl: AiFetch = fetch
): Promise<AiRewriteResult> {
  const messages = buildRewriteMessages({
      source,
      style: request.style,
      rewritePrompt: request.rewritePrompt,
      humanizeLevel: request.humanizeLevel,
      segment: request.segment,
      candidateCount,
    });
  let raw: string;
  if (request.onStreamChunk) {
    try {
      raw = await createStreamingChatCompletion(
        request.provider,
        messages,
        request.onStreamChunk,
        fetchImpl,
        request.signal
      );
    } catch (error) {
      if (!shouldFallbackFromStreaming(error, request.signal)) {
        throw error;
      }
      request.onStreamFallback?.(STREAMING_FALLBACK_MESSAGE);
      raw = await createChatCompletion(request.provider, messages, fetchImpl, request.signal);
    }
  } else {
    raw = await createChatCompletion(request.provider, messages, fetchImpl, request.signal);
  }

  return {
    raw,
    candidates: validateRewriteCandidates(parseRewriteCandidates(raw), source),
  };
}

async function generateSegmentedRewriteCandidate(
  request: AiRewriteRequest,
  source: AiRewriteRequest['source'],
  fetchImpl: AiFetch
): Promise<AiRewriteResult> {
  const segments = splitMarkdownIntoSegments(source.bodyMd, request.segmentation);
  const rewrittenSegments: AiRewriteCandidate[] = [];

  for (const segment of segments) {
    request.onSegmentProgress?.({
      stage: 'segment_started',
      index: segment.index,
      total: segment.total,
    });
    const result = await requestRewriteCandidates(
      {
        ...request,
        segment: {
          index: segment.index,
          total: segment.total,
        },
      },
      {
        ...source,
        bodyMd: segment.bodyMd,
      },
      1,
      fetchImpl
    );
    const candidate = result.candidates[0];
    if (!candidate) {
      throw new AiProviderError('invalid_response', 'AI provider returned no segment candidate.');
    }
    rewrittenSegments.push(candidate);
    request.onSegmentProgress?.({
      stage: 'segment_finished',
      index: segment.index,
      total: segment.total,
    });
  }

  const merged = mergeSegmentCandidates({
    title: source.title,
    style: request.style || 'balanced',
    segments: rewrittenSegments,
  });
  return {
    raw: JSON.stringify({ candidates: [merged] }),
    candidates: [merged],
  };
}

export async function generateRewriteCandidates(
  request: AiRewriteRequest,
  fetchImpl: AiFetch = fetch
): Promise<AiRewriteResult> {
  const source = {
    ...request.source,
    bodyMd: safelyPreCleanAiCliches(request.source.bodyMd),
  };
  if (request.candidateCount === 1 && shouldSegmentMarkdown(source.bodyMd, request.segmentation)) {
    return generateSegmentedRewriteCandidate(request, source, fetchImpl);
  }
  return requestRewriteCandidates(request, source, request.candidateCount, fetchImpl);
}
