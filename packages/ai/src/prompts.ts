import type { AiHumanizeLevel, AiRewritePromptInput, ChatMessage } from './types';

export const DEFAULT_REWRITE_PROMPT = {
  id: 'general',
  name: '通用改写',
  prompt: [
    '在保留事实、观点和信息完整性的前提下，对文章进行重新编排和表达。',
    '优化标题、段落顺序、衔接和可读性，让文章更适合直接发布。',
    '不要扩写无依据的信息，不要改变原文结论。',
  ].join('\n'),
};

export const DEFAULT_HUMANIZE_LEVEL: AiHumanizeLevel = 'standard';

export const HUMANIZE_REQUIREMENTS: Record<AiHumanizeLevel, string[]> = {
  light: [
    'Humanize level: light.',
    'Remove obvious AI-written flavor without changing the article voice too much.',
    'Avoid formulaic transitions, generic conclusions, hollow praise, and over-neat parallel phrasing.',
  ],
  standard: [
    'Humanize level: standard.',
    'Rewrite and remove AI-written flavor in the same pass.',
    'Vary sentence rhythm and sentence structure. Break overly even pacing.',
    'Detemplate stiff transitions such as firstly, secondly, in summary, meanwhile, and more importantly.',
    'Trim hollow summaries, repeated paraphrases, and correct-but-low-information filler.',
    'Prefer concrete, natural, practical wording.',
  ],
  strong: [
    'Humanize level: strong.',
    'Use more aggressive naturalization while still preserving facts and structure.',
    'Break mechanical sentence rhythm, reduce list-like symmetry, and avoid polished AI-style slogans.',
    'Rewrite stiff transitions into natural thought flow or remove them when context is already clear.',
    'Remove hollow wrap-up paragraphs and generic calls to action unless they carry real information.',
    'Use a more human editorial voice, but do not invent personal experience, facts, data, or references.',
  ],
};

export function normalizeHumanizeLevel(value: unknown): AiHumanizeLevel {
  return value === 'light' || value === 'standard' || value === 'strong'
    ? value
    : DEFAULT_HUMANIZE_LEVEL;
}

function getHumanizeRequirement(level: unknown): string {
  return HUMANIZE_REQUIREMENTS[normalizeHumanizeLevel(level)].join(' ');
}

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

function getSegmentInstructions(input: AiRewritePromptInput): string[] {
  const segment = input.segment;
  if (!segment || segment.total <= 1) {
    return [];
  }
  return [
    `Segment ${segment.index + 1} of ${segment.total}.`,
    'Rewrite only this segment.',
    'Do not add a full-article introduction or conclusion unless it exists in this segment.',
    'Keep continuity with neighboring segments, but do not summarize or rewrite other segments.',
  ];
}

export function buildRewriteMessages(input: AiRewritePromptInput): ChatMessage[] {
  const rewritePrompt = getRewritePrompt(input);
  const humanizeLevel = normalizeHumanizeLevel(input.humanizeLevel);
  const humanizeRequirement = getHumanizeRequirement(humanizeLevel);
  const segmentInstructions = getSegmentInstructions(input);
  return [
    {
      role: 'system',
      content: [
        'You are an editorial rewriting assistant.',
        humanizeRequirement,
        'Preserve facts, technical meaning, links, code blocks, and Markdown structure.',
        'Do not invent claims, dates, data, or references.',
        'Return only valid JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Rewrite template: ${rewritePrompt.name}`,
        `Humanize level: ${humanizeLevel}`,
        'Rewrite prompt:',
        rewritePrompt.prompt,
        ...segmentInstructions,
        `Return exactly ${input.candidateCount} candidates.`,
        'Keep each candidate close to the original length unless clarity requires a small change.',
        'Preserve all numbers, dates, names, links, code blocks, and concrete claims unless the original clearly marks them as removable.',
        'Do not summarize the article into a short abstract. Produce a full rewritten article.',
        'If a fact is unclear, keep the original wording instead of inventing or over-explaining it.',
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

export function buildRewritePromptPreview(input: AiRewritePromptInput): string {
  return buildRewriteMessages(input)
    .map((message) => `### ${message.role}\n\n${message.content}`)
    .join('\n\n---\n\n');
}
