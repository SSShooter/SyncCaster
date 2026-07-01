<template>
  <div>
    <div class="flex-between mb-6">
      <h2 class="text-2xl font-bold" :class="isDark ? 'text-gray-100' : 'text-gray-800'">AI 文案生成</h2>
      <n-button secondary @click="skipAi">跳过 AI，直接编辑</n-button>
    </div>

    <div v-if="loading" class="text-center py-8">
      <n-spin size="large" />
    </div>

    <div v-else-if="post" class="space-y-3">
      <n-card>
        <div class="article-summary">
          <div class="min-w-0">
            <div class="font-medium truncate" :class="isDark ? 'text-gray-100' : 'text-gray-800'">
              {{ post.title || '未命名文章' }}
            </div>
            <div class="article-meta mt-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
              <span class="truncate">{{ sourceUrl || '无来源链接' }}</span>
              <span>{{ countWords(post.body_md || '') }} 字</span>
            </div>
          </div>
          <n-button size="small" secondary @click="expanded = !expanded">
            {{ expanded ? '收起原文' : '查看原文' }}
          </n-button>
        </div>

        <n-collapse-transition :show="expanded">
          <pre class="original-preview mt-4" :class="isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-700'">{{ post.body_md || '' }}</pre>
        </n-collapse-transition>
      </n-card>

      <n-card>
        <div class="generation-toolbar">
          <n-select v-model:value="selectedPromptId" :options="rewritePromptOptions" style="width: 220px" />
          <n-button type="primary" :loading="generating" @click="generate">
            {{ candidates.length > 0 ? '重新生成' : '生成文案' }}
          </n-button>
          <n-button secondary :disabled="generating || candidates.length === 0" @click="generateOneMore">
            再生成一个
          </n-button>
          <n-button v-if="generating" secondary @click="cancelGenerate">
            取消生成
          </n-button>
          <n-button type="success" secondary :disabled="!selectedCandidate" :loading="saving" @click="useSelected">
            使用选中文案
          </n-button>
        </div>

        <div class="status-strip mt-3" :class="isDark ? 'bg-gray-900/70 text-gray-300' : 'bg-gray-50 text-gray-600'">
          <span v-if="generationProgressText">{{ generationProgressText }}</span>
          <span v-if="generationStageText">{{ generationStageText }}</span>
          <span>{{ generationModeText }}</span>
        </div>
        <div
          v-if="streamingPreview"
          class="stream-preview mt-3"
          :class="isDark ? 'bg-gray-900/70 text-gray-200' : 'bg-gray-50 text-gray-700'"
        >
          <div class="text-xs mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">实时返回预览</div>
          <pre>{{ streamingPreview }}</pre>
        </div>
        <div v-if="jobStatusText" class="text-xs mt-3" :class="jobStatusClass">{{ jobStatusText }}</div>
        <div v-if="generationErrors.length > 0" class="error-list mt-2">
          <div v-for="error in generationErrors" :key="`${error.candidateIndex}-${error.message}`">
            候选 {{ error.candidateIndex + 1 }}：{{ error.message }}
          </div>
        </div>
      </n-card>

      <div v-if="candidates.length > 0" class="candidate-grid">
        <n-card
          v-for="(candidate, index) in candidates"
          :key="candidate.id"
          class="candidate-card"
          :class="selectedId === candidate.id ? 'candidate-selected' : ''"
          @click="selectedId = candidate.id"
        >
          <div class="candidate-inner">
            <div class="candidate-head">
              <div class="flex items-center gap-2 min-w-0">
                <n-radio :checked="selectedId === candidate.id" @update:checked="selectedId = candidate.id" />
                <n-tag size="small" :type="selectedId === candidate.id ? 'primary' : 'default'">
                  候选 {{ index + 1 }}
                </n-tag>
                <div class="font-medium truncate" :class="isDark ? 'text-gray-100' : 'text-gray-800'">
                  {{ candidate.title }}
                </div>
              </div>
              <n-tag size="small">{{ countWords(candidate.bodyMd) }} 字</n-tag>
            </div>
            <pre
              class="candidate-body mt-3 text-sm"
              :class="isDark ? 'bg-gray-900/70 text-gray-200' : 'bg-gray-50 text-gray-700'"
            >{{ candidate.bodyMd }}</pre>
            <div v-if="candidate.rationale" class="text-xs mt-3" :class="isDark ? 'text-blue-300' : 'text-blue-600'">
              {{ candidate.rationale }}
            </div>
          </div>
        </n-card>
      </div>

      <n-empty v-else description="暂无 AI 文案候选" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { db } from '@synccaster/core';
import { useMessage } from 'naive-ui';
import { toCloneable } from '../ai/cloneable';
import { aiClient } from '../ai/client';
import {
  DEFAULT_FOREGROUND_AI_REQUEST_TIMEOUT_MS,
  runForegroundRewriteCandidates,
  type ForegroundRewriteDiagnostics,
  type ForegroundRewriteError,
  type ForegroundRewriteEvent,
} from '../ai/foreground-rewrite';
import { loadForegroundAiProviderSettings } from '../ai/foreground-settings';
import { requestAiHostPermission } from '../ai/host-permissions';
import {
  buildRewriteJobDone,
  buildRewriteJobError,
  buildRewriteJobRunning,
  appendRewriteCandidateToDraft,
  buildRewriteDraft,
  buildSelectedRewriteDraft,
  createNextRewriteCandidateId,
  getRewriteDraft,
  getRewriteJob,
  getRewriteJobStatusText,
  isRewriteJobForRequest,
  isRewriteJobExpired,
  mergePostMetaWithRewriteJob,
  mergePostMetaWithRewriteDraft,
  type RewriteJob,
} from '../ai/rewrite-draft';

const props = defineProps<{ isDark?: boolean }>();

const message = useMessage();
const loading = ref(false);
const generating = ref(false);
const saving = ref(false);
const post = ref<any>(null);
const candidates = ref<any[]>([]);
const selectedId = ref('');
const rewritePrompts = ref<any[]>([]);
const selectedPromptId = ref('general');
const expanded = ref(false);
const rewriteJob = ref<RewriteJob | null>(null);
const generationErrors = ref<ForegroundRewriteError[]>([]);
const generationDiagnostics = ref<ForegroundRewriteDiagnostics | null>(null);
const generationEvent = ref<ForegroundRewriteEvent | null>(null);
const generationStartedAtMs = ref<number | null>(null);
const generationElapsedMs = ref<number | null>(null);
const activeTimeoutMs = ref(DEFAULT_FOREGROUND_AI_REQUEST_TIMEOUT_MS);
const activeRequestId = ref('');
const generatedCount = ref(0);
const requestedCount = ref(0);
const nowTick = ref(Date.now());
const streamingPreview = ref('');
let timer: ReturnType<typeof setInterval> | null = null;
let generateController: AbortController | null = null;

const AI_REQUEST_TIMEOUT_MS = 120_000;

const postId = computed(() => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash.startsWith('ai-rewrite/') ? hash.slice('ai-rewrite/'.length) : '';
});

const sourceUrl = computed(() => post.value?.meta?.source_url || post.value?.canonicalUrl || '');
const selectedCandidate = computed(() => candidates.value.find((item) => item.id === selectedId.value));
const rewritePromptOptions = computed(() => rewritePrompts.value.map((item) => ({
  label: item.name || '未命名模板',
  value: item.id,
})));
const generationModeText = computed(() => `前台直连模式 / 单个候选最多等待 ${Math.round(activeTimeoutMs.value / 1000)} 秒`);
const generationProgressText = computed(() => {
  if (generating.value && requestedCount.value > 0) {
    return `正在逐个生成候选：${generatedCount.value}/${requestedCount.value}`;
  }
  if (generationDiagnostics.value) {
    return `本次生成：成功 ${generationDiagnostics.value.finishedCount} 个，失败 ${generationDiagnostics.value.failedCount} 个，用时 ${Math.round(generationDiagnostics.value.durationMs / 1000)} 秒，原文 ${generationDiagnostics.value.sourceLength} 字。`;
  }
  return '';
});
const generationStageText = computed(() => {
  const event = generationEvent.value;
  if (!event) {
    return '';
  }
  const stageMap: Record<ForegroundRewriteEvent['stage'], string> = {
    started: '准备生成',
    candidate_started: '准备候选',
    request_started: '已向 AI 接口发送请求',
    response_received: 'AI 接口已返回，正在解析和保存',
    candidate_saved: '候选已保存',
    candidate_error: '候选生成失败',
    stream_chunk: 'AI 正在返回内容',
    stream_fallback: '流式返回不可用，已切换普通模式',
    segment_started: '正在生成长文分段',
    segment_finished: '长文分段已生成',
    finished: '本轮生成结束',
    saving_job: '正在保存生成状态',
    loading_config: '正在读取 AI 配置',
    checking_permission: '正在检查 AI 服务域名权限',
  };
  const candidateText = typeof event.candidateIndex === 'number'
    ? `候选 ${event.candidateIndex + 1}`
    : '本轮';
  const elapsedMs = generationElapsedMs.value ?? (generationStartedAtMs.value
    ? Math.max(0, nowTick.value - generationStartedAtMs.value)
    : event.elapsedMs);
  const elapsedSeconds = Math.round(elapsedMs / 1000);
  const messageText = event.message ? `；${event.message}` : '';
  return `${candidateText}：${stageMap[event.stage]}，已等待 ${elapsedSeconds} 秒${messageText}`;
});
const jobStatusText = computed(() => {
  return getRewriteJobStatusText(
    rewriteJob.value,
    nowTick.value,
    Boolean(activeRequestId.value && rewriteJob.value?.requestId === activeRequestId.value)
  );
});
const jobStatusClass = computed(() => {
  if (rewriteJob.value?.status === 'error') {
    return 'text-red-500';
  }
  return rewriteJob.value?.status === 'done'
    ? (propsIsDark.value ? 'text-green-300' : 'text-green-600')
    : (propsIsDark.value ? 'text-gray-400' : 'text-gray-500');
});

const propsIsDark = computed(() => Boolean(props.isDark));

async function loadPost() {
  loading.value = true;
  try {
    post.value = await db.posts.get(postId.value);
    if (!post.value) {
      message.error('文章不存在');
      window.location.hash = 'posts';
      return;
    }
    const configResponse = await aiClient.getConfig();
    const draft = getRewriteDraft(post.value);
    rewriteJob.value = getRewriteJob(post.value);
    rewritePrompts.value = Array.isArray(configResponse.config.rewritePrompts) && configResponse.config.rewritePrompts.length > 0
      ? configResponse.config.rewritePrompts
      : [{ id: 'general', name: '通用改写', prompt: '在保留事实和观点的前提下，对文章进行重新编排和表达。' }];
    const storedPromptId = draft?.style || configResponse.config.defaultRewritePromptId || rewritePrompts.value[0].id;
    selectedPromptId.value = rewritePrompts.value.some((item) => item.id === storedPromptId)
      ? storedPromptId
      : rewritePrompts.value[0].id;
    if (draft) {
      candidates.value = draft.candidates;
      selectedId.value = draft.selectedCandidateId || draft.candidates[0]?.id || '';
    }
    if (isRewriteJobExpired(rewriteJob.value, Date.now(), AI_REQUEST_TIMEOUT_MS)) {
      const expiredJob = buildRewriteJobError({
        requestId: rewriteJob.value!.requestId,
        style: rewriteJob.value!.style,
        startedAt: rewriteJob.value!.startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: '上次生成已超时，请重新生成。',
      });
      await saveJob(expiredJob);
    }
  } catch (error: any) {
    message.error(error?.message || '加载 AI 文案页失败');
  } finally {
    loading.value = false;
  }
}

async function generate() {
  if (!post.value) {
    return;
  }
  generating.value = true;
  generationErrors.value = [];
  generationDiagnostics.value = null;
  generationEvent.value = null;
  generationElapsedMs.value = null;
  streamingPreview.value = '';
  generatedCount.value = 0;
  requestedCount.value = 0;
  candidates.value = [];
  selectedId.value = '';
  generateController?.abort();
  generateController = new AbortController();
  const startedAtMs = Date.now();
  generationStartedAtMs.value = startedAtMs;
  const startedAt = new Date(startedAtMs).toISOString();
  const requestId = crypto.randomUUID?.() || `${startedAtMs}-${Math.random().toString(36).slice(2, 8)}`;
  activeRequestId.value = requestId;
  const runningJob = buildRewriteJobRunning({
    requestId,
    style: selectedPromptId.value,
    startedAt,
  });
  try {
    setLocalGenerationStage('saving_job');
    await saveJob(runningJob);
    setLocalGenerationStage('loading_config');
    const { config, apiKey } = await loadForegroundAiProviderSettings();
    activeTimeoutMs.value = getConfiguredTimeoutMs(config);
    setLocalGenerationStage('checking_permission');
    const granted = await requestAiHostPermission(config.baseUrl);
    if (!granted) {
      throw new Error('未授予 AI 服务域名权限，请到 AI 设置中保存并允许访问该地址。');
    }
    requestedCount.value = config.candidateCount || 1;
    const result = await runForegroundRewriteCandidates({
      config,
      apiKey,
      source: {
        postId: post.value.id,
        title: post.value.title || '',
        bodyMd: post.value.body_md || '',
        sourceUrl: sourceUrl.value,
      },
      rewritePromptId: selectedPromptId.value,
      signal: generateController.signal,
      onCandidate: (candidate) => appendCandidateForRequest(candidate, requestId),
      onEvent: handleGenerationEvent,
    });
    generationErrors.value = result.errors;
    generationDiagnostics.value = result.diagnostics;
    const latestPost = await db.posts.get(post.value.id);
    if (!isRewriteJobForRequest(getRewriteJob(latestPost), requestId)) {
      return;
    }
    post.value = latestPost;
    if (result.candidates.length === 0) {
      throw new Error(result.errors[0]?.message || 'AI 未生成可用文案。');
    }
    const draft = toCloneable(buildRewriteDraft({
      style: selectedPromptId.value,
      candidates: candidates.value,
      selectedCandidateId: selectedId.value,
      generatedAt: new Date().toISOString(),
    }));
    const doneJob = toCloneable(buildRewriteJobDone({
      requestId,
      style: selectedPromptId.value,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
    }));
    const meta = toCloneable(mergePostMetaWithRewriteJob(mergePostMetaWithRewriteDraft(post.value.meta, draft), doneJob));
    await db.posts.update(post.value.id, {
      meta,
    } as any);
    post.value = {
      ...post.value,
      meta: toCloneable(meta),
    };
    rewriteJob.value = doneJob;
  } catch (error: any) {
    const latestPost = await db.posts.get(post.value.id);
    if (isRewriteJobForRequest(getRewriteJob(latestPost), requestId)) {
      post.value = latestPost;
      await saveJob(buildRewriteJobError({
        requestId,
        style: selectedPromptId.value,
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: error?.message || 'AI 生成失败',
      }));
    }
    if (error?.code !== 'canceled' && error?.message !== 'AI request was canceled.') {
      message.error(error?.message || 'AI 生成失败');
    }
  } finally {
    generating.value = false;
    generateController = null;
  }
}

async function appendCandidateForRequest(candidate: any, requestId: string) {
  if (!post.value?.id) {
    return;
  }
  const latestPost = await db.posts.get(post.value.id);
  if (!isRewriteJobForRequest(getRewriteJob(latestPost), requestId)) {
    return;
  }
  post.value = latestPost;
  const candidateId = createNextRewriteCandidateId(candidates.value);
  const normalized = {
    ...candidate,
    id: candidateId,
  };
  const draft = toCloneable(appendRewriteCandidateToDraft(buildRewriteDraft({
    style: selectedPromptId.value,
    candidates: candidates.value,
    selectedCandidateId: selectedId.value || normalized.id,
    generatedAt: new Date().toISOString(),
  }), normalized));
  candidates.value = draft.candidates;
  generatedCount.value = candidates.value.length;
  selectedId.value = draft.selectedCandidateId;
  const meta = toCloneable(mergePostMetaWithRewriteDraft(post.value.meta, draft));
  await db.posts.update(post.value.id, { meta } as any);
  post.value = {
    ...post.value,
    meta: toCloneable(meta),
  };
}

async function generateOneMore() {
  if (!post.value || generating.value || candidates.value.length === 0) {
    return;
  }
  generating.value = true;
  generationErrors.value = [];
  generationDiagnostics.value = null;
  generationEvent.value = null;
  generationElapsedMs.value = null;
  streamingPreview.value = '';
  generatedCount.value = candidates.value.length;
  requestedCount.value = candidates.value.length + 1;
  generateController?.abort();
  generateController = new AbortController();
  const startedAtMs = Date.now();
  generationStartedAtMs.value = startedAtMs;
  const startedAt = new Date(startedAtMs).toISOString();
  const requestId = crypto.randomUUID?.() || `${startedAtMs}-${Math.random().toString(36).slice(2, 8)}`;
  activeRequestId.value = requestId;
  const runningJob = buildRewriteJobRunning({
    requestId,
    style: selectedPromptId.value,
    startedAt,
  });
  try {
    setLocalGenerationStage('saving_job');
    await saveJob(runningJob);
    setLocalGenerationStage('loading_config');
    const { config, apiKey } = await loadForegroundAiProviderSettings();
    activeTimeoutMs.value = getConfiguredTimeoutMs(config);
    setLocalGenerationStage('checking_permission');
    const granted = await requestAiHostPermission(config.baseUrl);
    if (!granted) {
      throw new Error('未授予 AI 服务域名权限，请到 AI 设置中保存并允许访问该地址。');
    }
    const result = await runForegroundRewriteCandidates({
      config: {
        ...config,
        candidateCount: 1,
      },
      apiKey,
      source: {
        postId: post.value.id,
        title: post.value.title || '',
        bodyMd: post.value.body_md || '',
        sourceUrl: sourceUrl.value,
      },
      rewritePromptId: selectedPromptId.value,
      candidateCount: 1,
      signal: generateController.signal,
      onCandidate: (candidate) => appendCandidateForRequest(candidate, requestId),
      onEvent: handleGenerationEvent,
    });
    generationErrors.value = result.errors;
    generationDiagnostics.value = {
      ...result.diagnostics,
      requestedCount: requestedCount.value,
      finishedCount: candidates.value.length,
    };
    const latestPost = await db.posts.get(post.value.id);
    if (!isRewriteJobForRequest(getRewriteJob(latestPost), requestId)) {
      return;
    }
    post.value = latestPost;
    if (result.candidates.length === 0) {
      throw new Error(result.errors[0]?.message || 'AI 未生成可用文案。');
    }
    const draft = toCloneable(buildRewriteDraft({
      style: selectedPromptId.value,
      candidates: candidates.value,
      selectedCandidateId: selectedId.value,
      generatedAt: new Date().toISOString(),
    }));
    const doneJob = toCloneable(buildRewriteJobDone({
      requestId,
      style: selectedPromptId.value,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
    }));
    const meta = toCloneable(mergePostMetaWithRewriteJob(mergePostMetaWithRewriteDraft(post.value.meta, draft), doneJob));
    await db.posts.update(post.value.id, { meta } as any);
    post.value = {
      ...post.value,
      meta: toCloneable(meta),
    };
    rewriteJob.value = doneJob;
  } catch (error: any) {
    const latestPost = await db.posts.get(post.value.id);
    if (isRewriteJobForRequest(getRewriteJob(latestPost), requestId)) {
      post.value = latestPost;
      await saveJob(buildRewriteJobError({
        requestId,
        style: selectedPromptId.value,
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: error?.message || 'AI 生成失败',
      }));
    }
    if (error?.code !== 'canceled' && error?.message !== 'AI request was canceled.') {
      message.error(error?.message || 'AI 生成失败');
    }
  } finally {
    generating.value = false;
    generateController = null;
  }
}

async function saveJob(job: RewriteJob) {
  if (!post.value?.id) {
    return;
  }
  const meta = toCloneable(mergePostMetaWithRewriteJob(post.value.meta, job));
  await db.posts.update(post.value.id, { meta } as any);
  post.value = {
    ...post.value,
    meta: toCloneable(meta),
  };
  rewriteJob.value = job;
}

function handleGenerationEvent(event: ForegroundRewriteEvent) {
  generationEvent.value = event;
  generatedCount.value = event.finishedCount;
  requestedCount.value = event.requestedCount;
  if (event.stage === 'stream_chunk') {
    streamingPreview.value = event.message || '';
  }
  if (event.stage === 'candidate_saved') {
    streamingPreview.value = '';
  }
  if (event.stage === 'finished' || event.stage === 'candidate_error') {
    generationElapsedMs.value = event.elapsedMs;
  }
}

function setLocalGenerationStage(stage: ForegroundRewriteEvent['stage']) {
  generationEvent.value = {
    stage,
    at: new Date().toISOString(),
    elapsedMs: generationStartedAtMs.value ? Date.now() - generationStartedAtMs.value : 0,
    requestedCount: requestedCount.value,
    finishedCount: generatedCount.value,
    failedCount: generationErrors.value.length,
  };
}

function getConfiguredTimeoutMs(config: any) {
  const timeoutMs = Number(config?.timeoutMs);
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return Math.min(Math.max(timeoutMs, 30_000), 600_000);
  }
  return DEFAULT_FOREGROUND_AI_REQUEST_TIMEOUT_MS;
}

function cancelGenerate() {
  generateController?.abort();
}

async function useSelected() {
  if (!post.value || !selectedCandidate.value) {
    message.warning('请选择一个文案版本');
    return;
  }
  saving.value = true;
  try {
    const now = Date.now();
    const candidate = toCloneable(selectedCandidate.value);
    const draft = toCloneable(buildSelectedRewriteDraft({
      candidate,
      style: selectedPromptId.value,
      generatedAt: new Date(now).toISOString(),
    }));
    await db.posts.update(post.value.id, {
      title: candidate.title,
      body_md: candidate.bodyMd,
      summary: candidate.summary || candidate.bodyMd.slice(0, 200),
      updatedAt: now,
      meta: toCloneable({
        ...(post.value.meta || {}),
        aiRewrite: {
          selectedCandidateId: candidate.id,
          style: candidate.style,
          rewritePromptId: selectedPromptId.value,
          modelGeneratedAt: new Date(now).toISOString(),
        },
        aiRewriteDraft: draft,
      }),
    } as any);
    window.location.hash = `editor/${post.value.id}`;
  } catch (error: any) {
    message.error(error?.message || '保存 AI 文案失败');
  } finally {
    saving.value = false;
  }
}

function skipAi() {
  if (post.value?.id) {
    window.location.hash = `editor/${post.value.id}`;
  } else {
    window.location.hash = 'posts';
  }
}

function countWords(value: string) {
  return String(value || '').trim().length;
}

onMounted(() => {
  timer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  loadPost();
});

onBeforeUnmount(() => {
  generateController?.abort();
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<style scoped>
.original-preview {
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  user-select: text;
}

.article-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.article-meta {
  display: flex;
  gap: 12px;
  min-width: 0;
  font-size: 13px;
}

.generation-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status-strip {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}

.error-list {
  color: #ef4444;
  font-size: 12px;
}

.candidate-card {
  cursor: pointer;
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.candidate-selected {
  outline: 2px solid #3b82f6;
}

.candidate-inner {
  min-width: 0;
}

.candidate-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.candidate-body {
  max-height: min(52vh, 520px);
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.stream-preview {
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
}

.stream-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

@media (max-width: 960px) {
  .candidate-grid {
    grid-template-columns: 1fr;
  }
}
</style>
