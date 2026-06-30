<template>
  <div class="w-96 min-h-120 bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
    <!-- 装饰性背景 -->
    <div class="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full opacity-20 -translate-y-32 translate-x-32 blur-3xl"></div>
    <div class="absolute bottom-0 left-0 w-48 h-48 bg-purple-100 rounded-full opacity-20 translate-y-24 -translate-x-24 blur-3xl"></div>
    
    <div class="relative z-10 p-6">
      <!-- 头部 -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3 select-none">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span class="text-white text-xl">✨</span>
          </div>
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SyncCaster</h1>
            <p class="text-xs text-gray-500">内容采集与发布助手</p>
          </div>
        </div>
        <button
          class="w-9 h-9 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md hover:bg-white transition-all text-gray-600 hover:text-gray-800 flex items-center justify-center border-none outline-none"
          @click="openOptions"
          title="设置"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div class="text-sm text-gray-500">加载中...</div>
        </div>
      </div>

      <template v-else>
        <!-- 快速操作 -->
        <div class="mb-5">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 select-none">快速操作</h2>
          <div class="grid grid-cols-2 gap-3">
            <button
              class="group relative bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-blue-200 select-none overflow-hidden"
              @click="collectFromCurrentPage"
            >
              <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div class="relative flex flex-col items-center gap-2">
                <div class="text-2xl">📥</div>
                <span class="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">采集当前页</span>
              </div>
            </button>
            <button
              class="group relative bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-purple-200 select-none overflow-hidden"
              @click="openEditor"
            >
              <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div class="relative flex flex-col items-center gap-2">
                <div class="text-2xl">✍️</div>
                <span class="text-sm font-medium text-gray-700 group-hover:text-purple-600 transition-colors">新建文章</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 草稿列表 -->
        <div class="mb-5">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 select-none">最近草稿</h2>
          <div v-if="recentPosts.length === 0" class="bg-white/60 backdrop-blur-sm rounded-xl p-8 text-center border border-gray-100">
            <div class="text-4xl mb-2 opacity-30">📝</div>
            <div class="text-sm text-gray-500 select-none">暂无草稿</div>
          </div>
          <div v-else class="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            <div
              v-for="post in recentPosts"
              :key="post.id"
              class="group bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer select-none transition-all duration-300 border border-gray-100 hover:border-blue-200"
              @click="editPost(post.id)"
            >
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span class="text-lg">📄</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                    {{ post.title }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {{ formatDate(post.updatedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 任务状态 -->
        <div v-if="runningJobs.length > 0">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 select-none">进行中的任务</h2>
          <div class="space-y-2">
            <div
              v-for="job in runningJobs"
              :key="job.id"
              class="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-blue-200 select-none"
            >
              <div class="flex items-center gap-2 mb-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div class="text-sm text-gray-800 font-medium">发布中...</div>
              </div>
              <div class="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  :style="{ width: `${job.progress}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </div>

    <!-- Toast 通知 -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="toast.show"
        class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div
          :class="[
            'px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-64',
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          ]"
        >
          <span class="text-lg">{{ toast.type === 'success' ? '✓' : '✗' }}</span>
          <span>{{ toast.message }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '@synccaster/core';
import { aiClient } from '../options/ai/client';
import { getPostEditUrl } from '../options/ai/post-routing';

const loading = ref(true);
const recentPosts = ref<any[]>([]);
const runningJobs = ref<any[]>([]);
const toast = ref({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error',
});

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 2000);
}

onMounted(async () => {
  await loadData();
});

async function loadData() {
  try {
    // 加载最近的草稿
    const posts = await db.posts
      .orderBy('updatedAt')
      .reverse()
      .limit(5)
      .toArray();
    recentPosts.value = posts;

    // 加载进行中的任务
    const jobs = await db.jobs
      .where('state')
      .equals('RUNNING')
      .toArray();
    runningJobs.value = jobs;
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    loading.value = false;
  }
}

async function collectFromCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab');

    const sendCollectMessage = (): Promise<any> =>
      new Promise((resolve, reject) => {
        try {
          chrome.tabs.sendMessage(tab.id!, { type: 'COLLECT_CONTENT' }, (resp) => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) return reject(new Error(lastErr.message));
            resolve(resp);
          });
        } catch (e: any) {
          reject(e);
        }
      });

    let response: any;
    try {
      // 第一次尝试，假设 content script 已注入
      response = await sendCollectMessage();
    } catch (err) {
      // 若未注入，则动态注入后重试
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts.js'],
      });
      // 等待注入完成
      await new Promise((r) => setTimeout(r, 150));
      response = await sendCollectMessage();
    }

    console.log('Collected content:', response);
    if (!response || !response.success || !response.data) {
      throw new Error('采集结果为空');
    }

    // 将采集结果交给 background 保存
    const saveResult = await chrome.runtime.sendMessage({
      type: 'SAVE_POST',
      data: response.data,
    });

    if (!saveResult?.success) {
      throw new Error(saveResult?.error || '保存失败');
    }

    showToast('内容采集并保存成功！', 'success');
    
    // 刷新草稿列表以显示新采集的文章
    await loadData();
  } catch (error: any) {
    console.error('Collection failed:', error);
    showToast('采集失败: ' + error.message, 'error');
  }
}

function openEditor() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/ui/options/index.html#/editor/new'),
  });
}

async function editPost(postId: string) {
  const post = recentPosts.value.find((item) => item.id === postId) || await db.posts.get(postId);
  if (!post) {
    showToast('文章不存在', 'error');
    return;
  }

  try {
    const response = await aiClient.getConfig();
    chrome.tabs.create({
      url: getPostEditUrl(response.config, post, chrome.runtime.getURL),
    });
    return;
  } catch (error) {
    console.warn('Failed to load AI config, opening editor directly:', error);
  }

  chrome.tabs.create({
    url: chrome.runtime.getURL(`src/ui/options/index.html#/editor/${postId}`),
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}
</script>

<style scoped>
/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #93c5fd, #c4b5fd);
  border-radius: 10px;
  transition: background 0.3s;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #60a5fa, #a78bfa);
}

/* 确保渐变文字显示正确 */
.bg-clip-text {
  -webkit-background-clip: text;
  background-clip: text;
}
</style>
