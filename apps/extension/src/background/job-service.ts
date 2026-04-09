import { db, type Job, type LogEntry, type PublishTarget } from '@synccaster/core';
import { Logger } from '@synccaster/utils';
import { publishToTarget } from './publish-engine';
import { resetSyncGroup } from './tab-group-manager';

const logger = new Logger('job-service');

export interface CreateJobInput {
  postId: string;
  targets: PublishTarget[];
}

export interface CreateJobOptions {
  initialLogs?: LogEntry[];
}

export interface CancelJobOptions {
  state?: Job['state'];
  error?: string;
}

export async function createJob(
  data: CreateJobInput,
  options: CreateJobOptions = {}
): Promise<{ jobId: string }> {
  logger.info('create', `Creating job for post: ${data.postId}`);

  const job: Job = {
    id: crypto.randomUUID(),
    postId: data.postId,
    targets: data.targets,
    state: 'PENDING',
    progress: 0,
    attempts: 0,
    maxAttempts: 3,
    logs: options.initialLogs || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.jobs.add(job);
  logger.info('create', `Job created: ${job.id}`);
  return { jobId: job.id };
}

export async function startJob(jobId: string): Promise<{ success: true }> {
  logger.info('start', `Starting job: ${jobId}`);

  const job = await db.jobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (job.state !== 'PENDING') {
    throw new Error(`Job is not in PENDING state: ${job.state}`);
  }

  await db.jobs.update(jobId, {
    state: 'RUNNING',
    updatedAt: Date.now(),
  });

  executeJob(jobId).catch((error) => {
    logger.error('execute', `Job execution failed: ${jobId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return { success: true };
}

export async function cancelJob(
  jobId: string,
  options: CancelJobOptions = {}
): Promise<{ success: true }> {
  const state = options.state || 'PAUSED';
  logger.info('cancel', `Cancelling job: ${jobId}`, { state, error: options.error });

  await db.jobs.update(jobId, {
    state,
    error: options.error,
    updatedAt: Date.now(),
  });

  return { success: true };
}

export async function getJobStatus(jobId: string) {
  const job = await db.jobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  return {
    id: job.id,
    state: job.state,
    progress: job.progress,
    logs: job.logs,
  };
}

export async function processScheduledJobs() {
  const now = Date.now();
  const jobs = await db.jobs
    .where('state')
    .equals('PENDING')
    .and((job) => !!job.scheduleAt && job.scheduleAt <= now)
    .toArray();

  logger.info('scheduler', `Found ${jobs.length} scheduled jobs`);

  for (const job of jobs) {
    await startJob(job.id);
  }
}

async function executeJob(jobId: string) {
  const job = await db.jobs.get(jobId);
  if (!job) {
    logger.error('execute', `Job not found: ${jobId}`);
    return;
  }

  const post = await db.posts.get(job.postId);
  if (!post) {
    logger.error('execute', `Post not found: ${job.postId}`);
    await db.jobs.update(jobId, {
      state: 'FAILED',
      error: 'Post not found',
      updatedAt: Date.now(),
    });
    return;
  }

  logger.info('execute', `Executing job: ${jobId}`, {
    targets: job.targets.length,
    platforms: job.targets.map((target) => target.platform).join(', '),
  });

  resetSyncGroup();
  logger.info('execute', 'Reset sync group for new publish batch');

  try {
    let successCount = 0;
    let failCount = 0;
    let unconfirmedCount = 0;
    const results: NonNullable<Job['results']> = [];

    const total = job.targets.length;
    const activeTab = total === 1;
    const concurrency = Math.min(4, Math.max(1, total));
    let completed = 0;

    const updateProgress = async () => {
      const progress = Math.round((completed / total) * 100);
      await db.jobs.update(jobId, { progress, results, updatedAt: Date.now() } as any);
    };

    const shouldStop = async () => {
      const latest = await db.jobs.get(jobId);
      return !!latest && latest.state !== 'RUNNING';
    };

    const runTarget = async (target: PublishTarget) => {
      if (await shouldStop()) return;

      const startAt = Date.now();
      logger.info('target', `Publishing to ${target.platform}`, { jobId, target });

      const result = await publishToTarget(jobId, post as any, target as any, { activeTab });

      logger.info('target', `Publish result for ${target.platform}`, {
        success: result.success,
        url: result.url,
        error: result.error,
        unconfirmed: result?.meta?.unconfirmed,
      });

      const isUnconfirmed = result?.meta?.unconfirmed === true;

      if (result.success) {
        successCount++;
        results.push({
          platform: target.platform,
          accountId: target.accountId,
          status: 'PUBLISHED',
          url: result.url,
          updatedAt: Date.now(),
        });
        const existing = await db.platformMaps
          .where('postId')
          .equals(job.postId)
          .and((mapping) => mapping.platform === target.platform && mapping.accountId === target.accountId)
          .first();

        const updates: any = {
          url: result.url,
          remoteId: result.remoteId,
          status: 'PUBLISHED',
          lastSyncAt: Date.now(),
          meta: { ...(existing?.meta || {}), lastDurationMs: Date.now() - startAt },
        };

        if (existing) {
          await db.platformMaps.update(existing.id, updates);
        } else {
          await db.platformMaps.add({
            id: crypto.randomUUID(),
            postId: job.postId,
            platform: target.platform,
            accountId: target.accountId,
            ...updates,
          } as any);
        }
      } else if (isUnconfirmed) {
        unconfirmedCount++;
        results.push({
          platform: target.platform,
          accountId: target.accountId,
          status: 'UNCONFIRMED',
          url: result?.meta?.currentUrl || undefined,
          error: result.error || '未能确认发布成功',
          updatedAt: Date.now(),
        });
        const existing = await db.platformMaps
          .where('postId')
          .equals(job.postId)
          .and((mapping) => mapping.platform === target.platform && mapping.accountId === target.accountId)
          .first();

        const updates: any = {
          status: 'DRAFT',
          lastSyncAt: Date.now(),
          lastError: result.error || '未能确认发布成功',
          meta: { ...(existing?.meta || {}), currentUrl: result?.meta?.currentUrl },
        };

        if (existing) {
          await db.platformMaps.update(existing.id, updates);
        } else {
          await db.platformMaps.add({
            id: crypto.randomUUID(),
            postId: job.postId,
            platform: target.platform,
            accountId: target.accountId,
            ...updates,
          } as any);
        }
      } else {
        failCount++;
        results.push({
          platform: target.platform,
          accountId: target.accountId,
          status: 'FAILED',
          error: result.error || 'Unknown error',
          updatedAt: Date.now(),
        });
        const existing = await db.platformMaps
          .where('postId')
          .equals(job.postId)
          .and((mapping) => mapping.platform === target.platform && mapping.accountId === target.accountId)
          .first();

        const updates: any = {
          status: 'FAILED',
          lastSyncAt: Date.now(),
          lastError: result.error || 'Unknown error',
        };

        if (existing) {
          await db.platformMaps.update(existing.id, updates);
        } else {
          await db.platformMaps.add({
            id: crypto.randomUUID(),
            postId: job.postId,
            platform: target.platform,
            accountId: target.accountId,
            ...updates,
          } as any);
        }
      }

      completed++;
      await updateProgress();
    };

    const queue = [...job.targets];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        if (await shouldStop()) return;
        const target = queue.shift();
        if (!target) return;
        await runTarget(target);
      }
    });

    await updateProgress();
    await Promise.all(workers);

    const latest = await db.jobs.get(jobId);
    if (!latest || latest.state !== 'RUNNING') {
      logger.info('execute', `Job exited early: ${jobId}`, { state: latest?.state });
      return;
    }

    const allFailed = failCount === total;
    const allPublished = successCount === total;

    let finalState: Job['state'] = 'DONE';
    if (allPublished) finalState = 'DONE';
    else if (unconfirmedCount > 0) finalState = 'PAUSED';
    else if (allFailed) finalState = 'FAILED';
    else if (successCount === 0 && failCount > 0) finalState = 'FAILED';
    else finalState = 'DONE';

    const summaryParts: string[] = [];
    if (successCount) summaryParts.push(`成功 ${successCount}/${total}`);
    if (unconfirmedCount) summaryParts.push(`待确认 ${unconfirmedCount}/${total}`);
    if (failCount) summaryParts.push(`失败 ${failCount}/${total}`);
    const summary = summaryParts.join('，');

    await db.jobs.update(jobId, {
      state: finalState as any,
      progress: 100,
      updatedAt: Date.now(),
      results,
      error:
        finalState === 'FAILED'
          ? summary || '全部失败，请查看日志'
          : unconfirmedCount > 0 || failCount > 0
            ? summary
            : undefined,
    });

    logger.info('execute', `Job completed: ${jobId}`, {
      successCount,
      unconfirmedCount,
      failCount,
    });

    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon.png'),
        title: 'SyncCaster',
        message: allFailed
          ? `文章《${post.title}》发布失败（全部失败）`
          : `文章《${post.title}》发布完成（成功${successCount}，失败${failCount}）`,
      });
    } catch (error) {
      logger.warn('execute', '通知发送失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error: any) {
    logger.error('execute', `Job failed: ${jobId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    await db.jobs.update(jobId, {
      state: 'FAILED',
      error: error.message,
      updatedAt: Date.now(),
    });
  }
}
