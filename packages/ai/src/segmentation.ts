import type { AiRewriteCandidate } from './types';

export interface AiSegmentationOptions {
  thresholdChars?: number;
  targetChars?: number;
}

export interface AiRewriteSegment {
  index: number;
  total: number;
  bodyMd: string;
}

export interface MergeSegmentCandidatesInput {
  title: string;
  style: string;
  segments: Array<Partial<AiRewriteCandidate> & Pick<AiRewriteCandidate, 'bodyMd'>>;
}

export const DEFAULT_SEGMENT_THRESHOLD_CHARS = 7000;
export const DEFAULT_SEGMENT_TARGET_CHARS = 3500;

function getThresholdChars(options?: AiSegmentationOptions): number {
  const value = Number(options?.thresholdChars);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SEGMENT_THRESHOLD_CHARS;
}

function getTargetChars(options?: AiSegmentationOptions): number {
  const value = Number(options?.targetChars);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SEGMENT_TARGET_CHARS;
}

export function shouldSegmentMarkdown(markdown: string, options?: AiSegmentationOptions): boolean {
  return String(markdown || '').length > getThresholdChars(options);
}

function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const current: string[] = [];
  let inFence = false;

  for (const line of String(markdown || '').split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
    }
    if (!inFence && line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current.join('\n').trim());
        current.length = 0;
      }
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    blocks.push(current.join('\n').trim());
  }
  return blocks.filter(Boolean);
}

export function splitMarkdownIntoSegments(markdown: string, options?: AiSegmentationOptions): AiRewriteSegment[] {
  if (!shouldSegmentMarkdown(markdown, options)) {
    return [{ index: 0, total: 1, bodyMd: String(markdown || '') }];
  }

  const targetChars = getTargetChars(options);
  const segments: string[] = [];
  let current = '';

  for (const block of splitMarkdownBlocks(markdown)) {
    const next = current ? `${current}\n\n${block}` : block;
    if (current && next.length > targetChars) {
      segments.push(current);
      current = block;
    } else {
      current = next;
    }
  }

  if (current) {
    segments.push(current);
  }

  const total = Math.max(segments.length, 1);
  return (segments.length > 0 ? segments : [String(markdown || '')]).map((bodyMd, index) => ({
    index,
    total,
    bodyMd,
  }));
}

export function mergeSegmentCandidates(input: MergeSegmentCandidatesInput): AiRewriteCandidate {
  const first = input.segments[0];
  return {
    id: 'candidate-1',
    title: first?.title || input.title,
    bodyMd: input.segments.map((segment) => segment.bodyMd.trim()).filter(Boolean).join('\n\n'),
    summary: first?.summary,
    rationale: [
      '分段生成后按原文顺序合并。',
      ...input.segments.map((segment) => segment.rationale).filter((value): value is string => Boolean(value)),
    ].join(' '),
    style: first?.style || input.style,
  };
}
