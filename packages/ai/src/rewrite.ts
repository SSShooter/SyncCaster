import { createChatCompletion, createStreamingChatCompletion, type AiFetch } from './openai-compatible';
import { preCleanAiCliches } from './humanize-rules';
import { buildRewriteMessages } from './prompts';
import { AiProviderError, type AiRewriteCandidate, type AiRewriteRequest, type AiRewriteResult } from './types';

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

export async function generateRewriteCandidates(
  request: AiRewriteRequest,
  fetchImpl: AiFetch = fetch
): Promise<AiRewriteResult> {
  const source = {
    ...request.source,
    bodyMd: safelyPreCleanAiCliches(request.source.bodyMd),
  };
  const messages = buildRewriteMessages({
      source,
      style: request.style,
      rewritePrompt: request.rewritePrompt,
      humanizeLevel: request.humanizeLevel,
      candidateCount: request.candidateCount,
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
      raw = await createChatCompletion(request.provider, messages, fetchImpl, request.signal);
    }
  } else {
    raw = await createChatCompletion(request.provider, messages, fetchImpl, request.signal);
  }

  return {
    raw,
    candidates: parseRewriteCandidates(raw),
  };
}
