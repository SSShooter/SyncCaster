import {
  db,
  getDefaultPublishAccountMap,
  getSupportedPlatforms,
  mdToWechatHtml,
  type Account,
} from '@synccaster/core';
import {
  type AgentAccountInfo,
  type AgentCreatePostPayload,
  type AgentCreatePostResponse,
  type AgentHealthResponse,
  type AgentJobStatusResponse,
  type AgentPlatformInfo,
  type AgentPublishPostPayload,
  type AgentPublishPostResponse,
  type AgentRenderWechatPayload,
  type AgentRenderWechatResponse,
  type AgentRpcRequest,
  type AgentRpcResponse,
  type AgentUpdatePostPayload,
} from '@synccaster/agent-protocol';
import { Logger } from '@synccaster/utils';
import { cancelJob, createJob, startJob } from './job-service';
import {
  AgentRpcRequestError,
  assertNonEmptyString,
  buildAgentJobStatus,
  normalizeOptionalRecord,
  normalizeOptionalStringArray,
  resolvePublishTargets,
} from './agent-rpc-helpers';

const logger = new Logger('agent-rpc');

async function listAccounts(): Promise<AgentAccountInfo[]> {
  const [accounts, defaultMap] = await Promise.all([
    db.accounts.toArray(),
    getDefaultPublishAccountMap(),
  ]);

  return accounts
    .slice()
    .sort((left, right) => {
      if (left.platform !== right.platform) return left.platform.localeCompare(right.platform);
      return left.nickname.localeCompare(right.nickname);
    })
    .map((account) => ({
      platform: account.platform,
      accountId: account.id,
      nickname: account.nickname,
      enabled: account.enabled,
      status: account.status,
      isDefaultPublish: defaultMap[account.platform] === account.id,
    }));
}

async function createPost(payload: AgentCreatePostPayload): Promise<AgentCreatePostResponse> {
  const title = assertNonEmptyString(payload?.title, 'title');
  const bodyMd = assertNonEmptyString(payload?.body_md, 'body_md');
  const summary = typeof payload.summary === 'string' ? payload.summary : undefined;
  const canonicalUrl =
    typeof payload.canonicalUrl === 'string' ? payload.canonicalUrl : undefined;
  const sourceUrl = typeof payload.source_url === 'string' ? payload.source_url : undefined;

  const now = Date.now();
  const postId = crypto.randomUUID();

  await db.posts.add({
    id: postId,
    title,
    body_md: bodyMd,
    summary,
    tags: normalizeOptionalStringArray(payload.tags, 'tags') || [],
    categories: normalizeOptionalStringArray(payload.categories, 'categories') || [],
    canonicalUrl,
    source_url: sourceUrl,
    meta: normalizeOptionalRecord(payload.meta, 'meta') || {},
    createdAt: now,
    updatedAt: now,
  } as any);

  logger.info('create-post', 'Agent post created', { postId, title });
  return { postId };
}

async function updatePost(payload: AgentUpdatePostPayload): Promise<AgentCreatePostResponse> {
  const postId = assertNonEmptyString(payload?.postId, 'postId');
  const existing = await db.posts.get(postId);
  if (!existing) {
    throw new AgentRpcRequestError('post_not_found', `Post not found: ${postId}`);
  }

  const updates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  if (payload.title !== undefined) {
    updates.title = assertNonEmptyString(payload.title, 'title');
  }
  if (payload.body_md !== undefined) {
    updates.body_md = assertNonEmptyString(payload.body_md, 'body_md');
  }
  if (payload.summary !== undefined) {
    if (typeof payload.summary !== 'string') {
      throw new AgentRpcRequestError('validation_error', 'summary must be a string');
    }
    updates.summary = payload.summary;
  }
  if (payload.tags !== undefined) {
    updates.tags = normalizeOptionalStringArray(payload.tags, 'tags') || [];
  }
  if (payload.categories !== undefined) {
    updates.categories = normalizeOptionalStringArray(payload.categories, 'categories') || [];
  }
  if (payload.canonicalUrl !== undefined) {
    if (typeof payload.canonicalUrl !== 'string') {
      throw new AgentRpcRequestError('validation_error', 'canonicalUrl must be a string');
    }
    updates.canonicalUrl = payload.canonicalUrl;
  }
  if (payload.source_url !== undefined) {
    if (typeof payload.source_url !== 'string') {
      throw new AgentRpcRequestError('validation_error', 'source_url must be a string');
    }
    updates.source_url = payload.source_url;
  }
  if (payload.meta !== undefined) {
    updates.meta = {
      ...(existing.meta || {}),
      ...(normalizeOptionalRecord(payload.meta, 'meta') || {}),
    };
  }

  await db.posts.update(postId, updates as any);
  logger.info('update-post', 'Agent post updated', { postId });
  return { postId };
}

async function publishPost(payload: AgentPublishPostPayload): Promise<AgentPublishPostResponse> {
  const postId = assertNonEmptyString(payload?.postId, 'postId');
  const post = await db.posts.get(postId);
  if (!post) {
    throw new AgentRpcRequestError('post_not_found', `Post not found: ${postId}`);
  }

  if (!Array.isArray(payload.targets) || payload.targets.length === 0) {
    throw new AgentRpcRequestError(
      'validation_error',
      'targets must be a non-empty array'
    );
  }

  const [accounts, defaultMap] = await Promise.all([
    db.accounts.toArray(),
    getDefaultPublishAccountMap(),
  ]);
  const { targets } = resolvePublishTargets(payload.targets, accounts, defaultMap);

  const initialLog = {
    id: crypto.randomUUID(),
    level: 'info' as const,
    step: 'agent',
    message: `Agent 创建发布任务，目标平台：${targets.map((target) => target.platform).join('、')}`,
    timestamp: Date.now(),
  };

  const { jobId } = await createJob(
    { postId, targets },
    { initialLogs: [initialLog] }
  );
  await startJob(jobId);

  logger.info('publish-post', 'Agent publish job created', { jobId, postId });
  return { jobId };
}

async function getJobStatusForAgent(jobId: string): Promise<AgentJobStatusResponse> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    throw new AgentRpcRequestError('job_not_found', `Job not found: ${jobId}`);
  }
  return buildAgentJobStatus(job);
}

async function cancelJobForAgent(jobId: string): Promise<AgentJobStatusResponse> {
  const existing = await db.jobs.get(jobId);
  if (!existing) {
    throw new AgentRpcRequestError('job_not_found', `Job not found: ${jobId}`);
  }

  await cancelJob(jobId, { state: 'FAILED', error: 'Cancelled by agent' });
  const updated = await db.jobs.get(jobId);
  if (!updated) {
    throw new AgentRpcRequestError('job_not_found', `Job not found: ${jobId}`);
  }

  logger.info('cancel-job', 'Agent cancel requested', { jobId });
  return buildAgentJobStatus(updated);
}

async function renderWechatHtml(
  payload: AgentRenderWechatPayload
): Promise<AgentRenderWechatResponse> {
  const markdown = assertNonEmptyString(payload?.markdown, 'markdown');
  const result = await mdToWechatHtml(markdown, (payload?.options || {}) as any);

  return {
    html: result.html,
    css: result.css,
    meta: result.meta ? { ...result.meta } : undefined,
  };
}

export async function handleAgentRpcRequest(
  request: AgentRpcRequest
): Promise<AgentRpcResponse> {
  try {
    let data: unknown;

    switch (request.action) {
      case 'health':
        data = {
          status: 'ok',
          version: chrome.runtime.getManifest().version,
          connected: true,
        } satisfies AgentHealthResponse;
        break;
      case 'list_platforms':
        data = getSupportedPlatforms().map<AgentPlatformInfo>((platform) => ({
          id: platform.id,
          name: platform.name,
          supportsMarkdown: platform.support.markdown,
          supportsHtml: platform.support.html,
          supportsLatex: platform.support.latex,
        }));
        break;
      case 'list_accounts':
        data = await listAccounts();
        break;
      case 'create_post':
        data = await createPost(request.payload as AgentCreatePostPayload);
        break;
      case 'update_post':
        data = await updatePost(request.payload as AgentUpdatePostPayload);
        break;
      case 'publish_post':
        data = await publishPost(request.payload as AgentPublishPostPayload);
        break;
      case 'get_job_status': {
        const payload = normalizeOptionalRecord(request.payload, 'payload');
        data = await getJobStatusForAgent(assertNonEmptyString(payload?.jobId, 'jobId'));
        break;
      }
      case 'cancel_job': {
        const payload = normalizeOptionalRecord(request.payload, 'payload');
        data = await cancelJobForAgent(assertNonEmptyString(payload?.jobId, 'jobId'));
        break;
      }
      case 'render_wechat_html':
        data = await renderWechatHtml(request.payload as AgentRenderWechatPayload);
        break;
      default:
        throw new AgentRpcRequestError(
          'validation_error',
          `Unsupported action: ${String(request.action)}`
        );
    }

    return {
      id: request.id,
      ok: true,
      data,
    };
  } catch (error) {
    const agentError =
      error instanceof AgentRpcRequestError
        ? error
        : new AgentRpcRequestError(
            'internal_error',
            error instanceof Error ? error.message : String(error)
          );

    logger.error('request', 'Agent RPC request failed', {
      action: request.action,
      code: agentError.code,
      message: agentError.message,
    });

    return {
      id: request.id,
      ok: false,
      error: {
        code: agentError.code,
        message: agentError.message,
        details: agentError.details,
      },
    };
  }
}
