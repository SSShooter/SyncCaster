import type { AiRewritePromptInput, ChatMessage } from './types';

export const DEFAULT_REWRITE_PROMPT = {
  id: 'general',
  name: '通用改写',
  prompt: [
    '在保留事实、观点和信息完整性的前提下，对文章进行重新编排和表达。',
    '优化标题、段落顺序、衔接和可读性，让文章更适合直接发布。',
    '不要扩写无依据的信息，不要改变原文结论。',
  ].join('\n'),
};

export const HUMANIZE_REQUIREMENT = [
  'Always rewrite and remove AI-written flavor in the same pass.',
  'Avoid formulaic transitions, generic conclusions, hollow praise, and over-neat parallel phrasing.',
  'Vary sentence length and rhythm. Prefer concrete, natural, practical wording.',
  'Keep technical facts, links, code blocks, tables, dates, numbers, and Markdown structure intact.',
].join(' ');

const legacyStyleDescriptions = {
  balanced: 'Rewrite for clarity, structure, and readability while preserving meaning.',
  less_ai: 'Rewrite with natural human phrasing, varied sentence rhythm, fewer template transitions, and less polished AI-style symmetry.',
  platform_ready: 'Rewrite into a polished article suitable for multi-platform publishing.',
} as const;

function getRewritePrompt(input: AiRewritePromptInput) {
  if (input.rewritePrompt?.prompt?.trim()) {
    return input.rewritePrompt;
  }
  if (input.style && legacyStyleDescriptions[input.style]) {
    return {
      ...DEFAULT_REWRITE_PROMPT,
      prompt: legacyStyleDescriptions[input.style],
    };
  }
  return DEFAULT_REWRITE_PROMPT;
}

export function buildRewriteMessages(input: AiRewritePromptInput): ChatMessage[] {
  const rewritePrompt = getRewritePrompt(input);
  return [
    {
      role: 'system',
      content: [
        'You are an editorial rewriting assistant.',
        HUMANIZE_REQUIREMENT,
        'Preserve facts, technical meaning, links, code blocks, and Markdown structure.',
        'Do not invent claims, dates, data, or references.',
        'Return only valid JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Rewrite template: ${rewritePrompt.name}`,
        'Rewrite prompt:',
        rewritePrompt.prompt,
        `Return exactly ${input.candidateCount} candidates.`,
        'Keep each candidate close to the original length unless clarity requires a small change.',
        'Each candidate must apply both the rewrite prompt and the AI-flavor removal requirements.',
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
