import type { AiRewritePromptInput, ChatMessage } from './types';

const styleDescriptions = {
  balanced: 'Rewrite for clarity, structure, and readability while preserving meaning.',
  less_ai: 'Rewrite with natural human phrasing, varied sentence rhythm, and fewer generic AI patterns.',
  platform_ready: 'Rewrite into a polished article suitable for multi-platform publishing.',
} as const;

export function buildRewriteMessages(input: AiRewritePromptInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are an editorial rewriting assistant.',
        'Preserve facts, technical meaning, links, code blocks, and Markdown structure.',
        'Do not invent claims, dates, data, or references.',
        'Return only valid JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Style: ${input.style}`,
        styleDescriptions[input.style],
        `Return exactly ${input.candidateCount} candidates.`,
        'Return only valid JSON with no Markdown fences or commentary.',
        'JSON shape: {"candidates":[{"title":"string","bodyMd":"markdown string","summary":"string","rationale":"string","style":"string"}]}',
        `Source URL: ${input.source.sourceUrl || ''}`,
        `Original title: ${input.source.title}`,
        'Original Markdown:',
        input.source.bodyMd,
      ].join('\n\n'),
    },
  ];
}
