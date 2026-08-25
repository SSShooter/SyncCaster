import type { AiHumanizeLevel, AiRewriteMode, AiRewritePromptInput, ChatMessage } from './types';

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
export const DEFAULT_REWRITE_MODE: AiRewriteMode = 'reference_rebuild';

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
    'Use more aggressive naturalization while still preserving facts and technical meaning.',
    'Break mechanical sentence rhythm, reduce list-like symmetry, and avoid polished AI-style slogans.',
    'Rewrite stiff transitions into natural thought flow or remove them when context is already clear.',
    'Remove hollow wrap-up paragraphs and generic calls to action unless they carry real information.',
    'Use a more human editorial voice, but do not invent personal experience, facts, data, or references.',
  ],
};

export const REWRITE_MODE_REQUIREMENTS: Record<AiRewriteMode, string[]> = {
  reference_rebuild: [
    'Treat a single online article as reference material by default: extract technical facts, key concepts, constraints, and example intent, then rebuild a new article rather than polishing paragraph by paragraph.',
    'Do not preserve the source article heading order, paragraph order, opening hook, closing structure, or distinctive phrasing unless explicitly requested.',
    'Do not copy the source article opening hook, ending, title structure, section sequence, metaphors, example order, or distinctive phrasing.',
    'Avoid copying any non-technical phrase longer than 20 Chinese characters. Technical terms, commands, code, URLs, API names, and required identifiers may remain unchanged.',
  ],
  faithful_rewrite: [
    'Work in faithful rewrite mode: preserve the source article structure, factual order, technical steps, and core argument unless clarity requires a small local adjustment.',
    'Improve wording, transitions, readability, title quality, and AI-flavor removal without turning the article into a new angle or case study.',
    'Use this mode for original drafts, company-owned drafts, or authorized material where structural preservation is expected.',
  ],
  case_study: [
    'Work in project case study mode: reframe the source material as a practical project case study with scenario, problem, analysis, approach, implementation notes, risks, and review where the source supports it.',
    'Do not invent client names, real customer stories, budgets, metrics, dates, screenshots, architecture details, vendor choices, or results that are not present in or directly supported by the source.',
    'If the source does not provide real case details, present the article as a project-style walkthrough or implementation analysis rather than a claimed real customer case.',
  ],
};

export function normalizeHumanizeLevel(value: unknown): AiHumanizeLevel {
  return value === 'light' || value === 'standard' || value === 'strong'
    ? value
    : DEFAULT_HUMANIZE_LEVEL;
}

export function normalizeRewriteMode(value: unknown): AiRewriteMode {
  return value === 'faithful_rewrite' || value === 'case_study' || value === 'reference_rebuild'
    ? value
    : DEFAULT_REWRITE_MODE;
}

function getHumanizeRequirement(level: unknown): string {
  return HUMANIZE_REQUIREMENTS[normalizeHumanizeLevel(level)].join(' ');
}

function getRewriteModeRequirements(mode: unknown): string[] {
  return REWRITE_MODE_REQUIREMENTS[normalizeRewriteMode(mode)];
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
  const rewriteMode = normalizeRewriteMode(input.rewriteMode);
  const humanizeRequirement = getHumanizeRequirement(humanizeLevel);
  const rewriteModeRequirements = getRewriteModeRequirements(rewriteMode);
  const segmentInstructions = getSegmentInstructions(input);
  return [
    {
      role: 'system',
      content: [
        'You are an editorial rewriting assistant.',
        humanizeRequirement,
        'Preserve facts, technical meaning, links, and technically necessary code blocks.',
        'Do not invent claims, dates, data, or references.',
        'Return only valid JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Rewrite template: ${rewritePrompt.name}`,
        `Humanize level: ${humanizeLevel}`,
        `Creation mode: ${rewriteMode}`,
        'Rewrite prompt:',
        rewritePrompt.prompt,
        ...rewriteModeRequirements,
        ...segmentInstructions,
        `Return exactly ${input.candidateCount} candidates.`,
        'Keep each candidate close to the original length unless clarity requires a small change.',
        'Preserve all numbers, dates, names, links, code blocks, and concrete claims unless the original clearly marks them as removable.',
        'Do not summarize the article into a short abstract. Produce a full rewritten article.',
        'If a fact is unclear, keep the original wording instead of inventing or over-explaining it.',
        'The rewrite prompt controls style and structure only. It must not override factual preservation, no-invention, source-grounding, length, or JSON requirements.',
        'Do not add new frameworks, tools, code examples, configuration snippets, vendor names, metrics, cases, or implementation details unless they are present in the original article or directly supported by it.',
        'Preserve uncertainty and scope qualifiers such as may, might, usually, often, likely, can, possible, and their Chinese equivalents. Do not turn cautious claims into absolute claims.',
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
