import {
  DEFAULT_REWRITE_PROMPT,
  generateRewriteCandidates,
  normalizeHumanizeLevel,
  testOpenAiConnection,
  type AiHumanizeLevel,
  type AiRewritePromptTemplate,
  type AiRewriteStyle,
} from '@synccaster/ai';
import { db, type AppConfig, type Secret } from '@synccaster/core';

export const AI_CONFIG_ID = 'ai.rewrite.config';
export const AI_SECRET_ID = 'ai.openai.apiKey';

export const DEFAULT_AI_REWRITE_CONFIG = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  timeoutMs: 180_000,
  candidateCount: 2 as 1 | 2 | 3,
  humanizeLevel: 'standard' as AiHumanizeLevel,
  defaultStyle: 'balanced' as AiRewriteStyle,
  rewritePrompts: [DEFAULT_REWRITE_PROMPT] as AiRewritePromptTemplate[],
  defaultRewritePromptId: DEFAULT_REWRITE_PROMPT.id,
};

type ConfigTable = Pick<typeof db.config, 'get' | 'put'>;
type SecretsTable = Pick<typeof db.secrets, 'get' | 'put' | 'delete'>;
type PostsTable = Pick<typeof db.posts, 'get' | 'put'>;

export interface AiServiceDeps {
  configTable: ConfigTable;
  secretsTable: SecretsTable;
  postsTable: PostsTable;
  now: () => number;
  generateRewriteCandidates: typeof generateRewriteCandidates;
  testOpenAiConnection: typeof testOpenAiConnection;
}

function createDefaultDeps(): AiServiceDeps {
  return {
    configTable: db.config,
    secretsTable: db.secrets,
    postsTable: db.posts,
    now: () => Date.now(),
    generateRewriteCandidates,
    testOpenAiConnection,
  };
}

export function isAiMessageType(type: string): boolean {
  return [
    'AI_GET_CONFIG',
    'AI_SAVE_CONFIG',
    'AI_CLEAR_API_KEY',
    'AI_TEST_CONNECTION',
    'AI_GENERATE_CANDIDATES',
    'AI_START_REWRITE_JOB',
  ].includes(type);
}

function normalizeConfig(input: any) {
  const rewritePrompts = normalizeRewritePrompts(input?.rewritePrompts);
  const defaultRewritePromptId = rewritePrompts.some((item) => item.id === input?.defaultRewritePromptId)
    ? input.defaultRewritePromptId
    : rewritePrompts[0].id;
  const timeoutMs = Number(input?.timeoutMs);
  return {
    enabled: Boolean(input?.enabled),
    baseUrl: String(input?.baseUrl || DEFAULT_AI_REWRITE_CONFIG.baseUrl).trim(),
    model: String(input?.model || DEFAULT_AI_REWRITE_CONFIG.model).trim(),
    temperature: Number.isFinite(Number(input?.temperature)) ? Number(input.temperature) : DEFAULT_AI_REWRITE_CONFIG.temperature,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.min(Math.max(timeoutMs, 30_000), 600_000)
      : DEFAULT_AI_REWRITE_CONFIG.timeoutMs,
    candidateCount: [1, 2, 3].includes(Number(input?.candidateCount))
      ? Number(input.candidateCount) as 1 | 2 | 3
      : DEFAULT_AI_REWRITE_CONFIG.candidateCount,
    humanizeLevel: normalizeHumanizeLevel(input?.humanizeLevel),
    defaultStyle: ['balanced', 'less_ai', 'platform_ready'].includes(input?.defaultStyle)
      ? input.defaultStyle as AiRewriteStyle
      : DEFAULT_AI_REWRITE_CONFIG.defaultStyle,
    rewritePrompts,
    defaultRewritePromptId,
  };
}

function normalizeRewritePrompts(input: any): AiRewritePromptTemplate[] {
  const prompts = Array.isArray(input)
    ? input
        .map((item) => ({
          id: String(item?.id || '').trim(),
          name: String(item?.name || '').trim(),
          prompt: String(item?.prompt || '').trim(),
        }))
        .filter((item) => item.id && item.name && item.prompt)
    : [];
  return prompts.length > 0 ? prompts : [DEFAULT_REWRITE_PROMPT];
}

function resolveRewritePrompt(config: any, rewritePromptId?: string): AiRewritePromptTemplate {
  const prompts = normalizeRewritePrompts(config.rewritePrompts);
  const selectedId = rewritePromptId || config.defaultRewritePromptId;
  return prompts.find((item) => item.id === selectedId) || prompts[0];
}

export async function loadAiRewriteSettings(deps: AiServiceDeps = createDefaultDeps()) {
  const stored = await deps.configTable.get(AI_CONFIG_ID) as AppConfig | undefined;
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as Secret | undefined;
  return {
    config: {
      ...DEFAULT_AI_REWRITE_CONFIG,
      ...(stored?.value || {}),
      hasApiKey: Boolean(secret?.encrypted),
    },
  };
}

export async function saveAiRewriteSettings(input: any, deps: AiServiceDeps = createDefaultDeps()) {
  const now = deps.now();
  const config = normalizeConfig(input);
  await deps.configTable.put({
    id: AI_CONFIG_ID,
    key: AI_CONFIG_ID,
    value: config,
    updatedAt: now,
  } as AppConfig);

  if (typeof input?.apiKey === 'string' && input.apiKey.trim()) {
    await deps.secretsTable.put({
      id: AI_SECRET_ID,
      accountId: 'ai',
      encrypted: input.apiKey.trim(),
      iv: 'local-extension-storage',
      createdAt: now,
      updatedAt: now,
    } as Secret);
  }

  return loadAiRewriteSettings(deps);
}

async function requireProviderConfig(deps: AiServiceDeps) {
  const settings = await loadAiRewriteSettings(deps);
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as Secret | undefined;
  if (!settings.config.baseUrl || !settings.config.model || !secret?.encrypted) {
    throw new Error('AI base URL, model, and API key are required.');
  }
  return {
    settings,
    provider: {
      baseUrl: settings.config.baseUrl,
      apiKey: secret.encrypted,
      model: settings.config.model,
      temperature: settings.config.temperature,
      timeoutMs: settings.config.timeoutMs || DEFAULT_AI_REWRITE_CONFIG.timeoutMs,
    },
  };
}

function createRequestId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRewriteJobRunning(input: {
  requestId: string;
  style: string;
  startedAt: string;
}) {
  return {
    requestId: input.requestId,
    style: input.style,
    status: 'running',
    startedAt: input.startedAt,
  };
}

function buildRewriteJobDone(input: {
  requestId: string;
  style: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}) {
  return {
    requestId: input.requestId,
    style: input.style,
    status: 'done',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
  };
}

function buildRewriteJobError(input: {
  requestId: string;
  style: string;
  startedAt: string;
  finishedAt: string;
  errorMessage: string;
}) {
  return {
    requestId: input.requestId,
    style: input.style,
    status: 'error',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    errorMessage: input.errorMessage,
  };
}

function createNextCandidateId(candidates: any[]): string {
  const maxId = candidates.reduce((max, candidate) => {
    const match = /^candidate-(\d+)$/.exec(String(candidate?.id || ''));
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `candidate-${maxId + 1}`;
}

function appendCandidate(candidates: any[], candidate: any, maxCandidates = 3) {
  const normalized = {
    ...candidate,
    id: createNextCandidateId(candidates),
  };
  return [...candidates, normalized].slice(-maxCandidates);
}

function buildRewriteDraft(input: {
  style: string;
  existingDraft?: any;
  candidates: any[];
  append?: boolean;
  generatedAt: string;
}) {
  const existingCandidates = input.append && Array.isArray(input.existingDraft?.candidates)
    ? input.existingDraft.candidates
    : [];
  const candidates = input.append
    ? input.candidates.reduce((current, candidate) => appendCandidate(current, candidate), existingCandidates)
    : input.candidates.map((candidate, index) => ({
        ...candidate,
        id: candidate.id || `candidate-${index + 1}`,
      })).slice(-3);
  const existingSelectedId = input.existingDraft?.selectedCandidateId;
  const selectedCandidateId = candidates.some((candidate) => candidate.id === existingSelectedId)
    ? existingSelectedId
    : candidates[0]?.id || '';
  return {
    style: input.style,
    candidates,
    selectedCandidateId,
    generatedAt: input.generatedAt,
  };
}

async function savePostMeta(deps: AiServiceDeps, post: any, meta: Record<string, any>) {
  await deps.postsTable.put({
    ...post,
    meta,
  });
}

export async function runAiRewriteJob(input: {
  postId: string;
  requestId: string;
  rewritePromptId?: string;
  candidateCount?: 1 | 2 | 3;
  append?: boolean;
}, deps: AiServiceDeps = createDefaultDeps()) {
  const startedAtMs = deps.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const style = input.rewritePromptId || 'general';
  const post = await deps.postsTable.get(input.postId);
  if (!post) {
    throw new Error('Post not found.');
  }

  await savePostMeta(deps, post, {
    ...(post.meta || {}),
    aiRewriteJob: buildRewriteJobRunning({
      requestId: input.requestId,
      style,
      startedAt,
    }),
  });

  try {
    const { settings, provider } = await requireProviderConfig(deps);
    const rewritePrompt = resolveRewritePrompt(settings.config, input.rewritePromptId);
    const result = await deps.generateRewriteCandidates({
      provider,
      source: {
        postId: post.id,
        title: post.title || '',
        bodyMd: post.body_md || '',
        sourceUrl: post.meta?.source_url || post.canonicalUrl || post.source_url || '',
      },
      rewritePrompt,
      style: settings.config.defaultStyle,
      humanizeLevel: settings.config.humanizeLevel,
      candidateCount: input.candidateCount || settings.config.candidateCount,
    });
    if (result.candidates.length === 0) {
      throw new Error('AI generated no usable candidates.');
    }

    const latestPost = await deps.postsTable.get(input.postId);
    if (!latestPost) {
      throw new Error('Post not found.');
    }
    const finishedAtMs = deps.now();
    const draft = buildRewriteDraft({
      style,
      existingDraft: latestPost.meta?.aiRewriteDraft,
      candidates: result.candidates,
      append: input.append,
      generatedAt: new Date(finishedAtMs).toISOString(),
    });
    await savePostMeta(deps, latestPost, {
      ...(latestPost.meta || {}),
      aiRewriteDraft: draft,
      aiRewriteJob: buildRewriteJobDone({
        requestId: input.requestId,
        style,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
      }),
    });
    return result;
  } catch (error: any) {
    const latestPost = await deps.postsTable.get(input.postId);
    if (latestPost) {
      const finishedAtMs = deps.now();
      await savePostMeta(deps, latestPost, {
        ...(latestPost.meta || {}),
        aiRewriteJob: buildRewriteJobError({
          requestId: input.requestId,
          style,
          startedAt,
          finishedAt: new Date(finishedAtMs).toISOString(),
          errorMessage: error?.message || 'AI rewrite job failed.',
        }),
      });
    }
    throw error;
  }
}

export async function startAiRewriteJob(input: {
  postId: string;
  rewritePromptId?: string;
  candidateCount?: 1 | 2 | 3;
  append?: boolean;
}, deps: AiServiceDeps = createDefaultDeps()) {
  const requestId = createRequestId();
  void runAiRewriteJob({
    ...input,
    requestId,
  }, deps).catch(() => undefined);
  return {
    requestId,
  };
}

export async function handleAiMessage(message: any, deps: AiServiceDeps = createDefaultDeps()) {
  try {
    switch (message.type) {
      case 'AI_GET_CONFIG':
        return { success: true, ...(await loadAiRewriteSettings(deps)) };
      case 'AI_SAVE_CONFIG':
        return { success: true, ...(await saveAiRewriteSettings(message.data, deps)) };
      case 'AI_CLEAR_API_KEY':
        await deps.secretsTable.delete(AI_SECRET_ID);
        return { success: true, ...(await loadAiRewriteSettings(deps)) };
      case 'AI_TEST_CONNECTION': {
        const { provider } = await requireProviderConfig(deps);
        await deps.testOpenAiConnection(provider);
        return { success: true };
      }
      case 'AI_GENERATE_CANDIDATES': {
        const { settings, provider } = await requireProviderConfig(deps);
        const rewritePrompt = resolveRewritePrompt(settings.config, message.data.rewritePromptId);
        const result = await deps.generateRewriteCandidates({
          provider,
          source: message.data.source,
          rewritePrompt,
          style: message.data.style || settings.config.defaultStyle,
          humanizeLevel: settings.config.humanizeLevel,
          candidateCount: settings.config.candidateCount,
        });
        return { success: true, result };
      }
      case 'AI_START_REWRITE_JOB': {
        const job = await startAiRewriteJob(message.data, deps);
        return { success: true, ...job };
      }
      default:
        return { success: false, error: `Unknown AI message type: ${message.type}` };
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'AI request failed' };
  }
}
