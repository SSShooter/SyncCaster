<template>
  <div>
    <div class="flex-between mb-6">
      <h2 class="text-2xl font-bold" :class="isDark ? 'text-gray-100' : 'text-gray-800'">AI 文案生成</h2>
      <n-button @click="skipAi">跳过 AI，直接编辑</n-button>
    </div>

    <div v-if="loading" class="text-center py-8">
      <n-spin size="large" />
    </div>

    <div v-else-if="post" class="space-y-3">
      <n-card>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="font-medium truncate" :class="isDark ? 'text-gray-100' : 'text-gray-800'">
              {{ post.title || '未命名文章' }}
            </div>
            <div class="text-sm truncate mt-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
              {{ sourceUrl || '无来源链接' }}
            </div>
          </div>
          <n-button size="small" @click="expanded = !expanded">
            {{ expanded ? '收起原文' : '查看原文' }}
          </n-button>
        </div>

        <n-collapse-transition :show="expanded">
          <pre class="original-preview mt-4" :class="isDark ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-700'">{{ post.body_md || '' }}</pre>
        </n-collapse-transition>
      </n-card>

      <n-card>
        <div class="flex items-center gap-3 flex-wrap">
          <n-select v-model:value="style" :options="styleOptions" style="width: 180px" />
          <n-button type="primary" :loading="generating" @click="generate">
            {{ candidates.length > 0 ? '重新生成' : '生成文案' }}
          </n-button>
          <n-button :disabled="!selectedCandidate" :loading="saving" @click="useSelected">
            使用选中文案
          </n-button>
        </div>
      </n-card>

      <div v-if="candidates.length > 0" class="space-y-3">
        <n-card
          v-for="candidate in candidates"
          :key="candidate.id"
          class="candidate-card"
          :class="selectedId === candidate.id ? 'candidate-selected' : ''"
          @click="selectedId = candidate.id"
        >
          <div class="flex items-start gap-3">
            <n-radio :checked="selectedId === candidate.id" @update:checked="selectedId = candidate.id" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-3">
                <div class="font-medium truncate" :class="isDark ? 'text-gray-100' : 'text-gray-800'">
                  {{ candidate.title }}
                </div>
                <n-tag size="small">{{ countWords(candidate.bodyMd) }} 字</n-tag>
              </div>
              <pre
                class="candidate-body mt-3 text-sm"
                :class="isDark ? 'bg-gray-900/70 text-gray-200' : 'bg-gray-50 text-gray-700'"
              >
                {{ candidate.bodyMd }}
              </pre>
              <div v-if="candidate.rationale" class="text-xs mt-3" :class="isDark ? 'text-blue-300' : 'text-blue-600'">
                {{ candidate.rationale }}
              </div>
            </div>
          </div>
        </n-card>
      </div>

      <n-empty v-else description="暂无 AI 文案候选" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { db } from '@synccaster/core';
import { useMessage } from 'naive-ui';
import { aiClient } from '../ai/client';

defineProps<{ isDark?: boolean }>();

const message = useMessage();
const loading = ref(false);
const generating = ref(false);
const saving = ref(false);
const post = ref<any>(null);
const candidates = ref<any[]>([]);
const selectedId = ref('');
const style = ref('balanced');
const expanded = ref(false);

const styleOptions = [
  { label: '平衡改写', value: 'balanced' },
  { label: '降低 AI 味', value: 'less_ai' },
  { label: '平台发布优化', value: 'platform_ready' },
];

const postId = computed(() => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash.startsWith('ai-rewrite/') ? hash.slice('ai-rewrite/'.length) : '';
});

const sourceUrl = computed(() => post.value?.meta?.source_url || post.value?.canonicalUrl || '');
const selectedCandidate = computed(() => candidates.value.find((item) => item.id === selectedId.value));

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
    style.value = configResponse.config.defaultStyle || 'balanced';
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
  try {
    const response = await aiClient.generateCandidates({
      source: {
        postId: post.value.id,
        title: post.value.title || '',
        bodyMd: post.value.body_md || '',
        sourceUrl: sourceUrl.value,
      },
      style: style.value,
    });
    candidates.value = response.result.candidates;
    selectedId.value = candidates.value[0]?.id || '';
  } catch (error: any) {
    message.error(error?.message || 'AI 生成失败');
  } finally {
    generating.value = false;
  }
}

async function useSelected() {
  if (!post.value || !selectedCandidate.value) {
    message.warning('请选择一个文案版本');
    return;
  }
  saving.value = true;
  try {
    const now = Date.now();
    await db.posts.update(post.value.id, {
      title: selectedCandidate.value.title,
      body_md: selectedCandidate.value.bodyMd,
      summary: selectedCandidate.value.summary || selectedCandidate.value.bodyMd.slice(0, 200),
      updatedAt: now,
      meta: {
        ...(post.value.meta || {}),
        aiRewrite: {
          selectedCandidateId: selectedCandidate.value.id,
          style: selectedCandidate.value.style,
          modelGeneratedAt: new Date(now).toISOString(),
        },
      },
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

onMounted(loadPost);
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

.candidate-card {
  cursor: pointer;
}

.candidate-selected {
  outline: 2px solid #3b82f6;
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
</style>
