<template>
  <div>
    <div class="flex-between mb-6">
      <h2 class="text-2xl font-bold" :class="isDark ? 'text-gray-100' : 'text-gray-800'">AI 设置</h2>
    </div>

    <n-card>
      <n-form label-placement="left" label-width="140px" :model="form">
        <div class="settings-section">
          <div class="section-title" :class="isDark ? 'text-gray-100' : 'text-gray-800'">基础配置</div>
          <n-form-item label="开启 AI 改写">
            <n-switch v-model:value="form.enabled" />
          </n-form-item>

          <n-form-item label="API 地址">
            <n-input v-model:value="form.baseUrl" placeholder="https://api.openai.com/v1" />
          </n-form-item>

          <n-form-item label="API Key">
            <n-input
              v-model:value="form.apiKey"
              type="password"
              show-password-on="click"
              :placeholder="hasApiKey ? '已保存，留空则不修改' : '请输入 API Key'"
            />
          </n-form-item>

          <n-form-item label="模型">
            <n-input v-model:value="form.model" placeholder="gpt-4o-mini" />
          </n-form-item>
        </div>

        <div class="settings-section">
          <div class="section-title" :class="isDark ? 'text-gray-100' : 'text-gray-800'">生成参数</div>
          <n-form-item label="Temperature">
            <n-input-number v-model:value="form.temperature" :min="0" :max="2" :step="0.1" />
          </n-form-item>

          <n-form-item label="请求超时">
            <n-input-number v-model:value="timeoutSeconds" :min="30" :max="600" :step="30">
              <template #suffix>秒</template>
            </n-input-number>
          </n-form-item>

          <n-form-item label="生成数量">
            <n-radio-group v-model:value="form.candidateCount">
              <n-radio-button :value="1">1 个</n-radio-button>
              <n-radio-button :value="2">2 个</n-radio-button>
              <n-radio-button :value="3">3 个</n-radio-button>
            </n-radio-group>
          </n-form-item>

          <n-form-item label="去 AI 味强度">
            <n-radio-group v-model:value="form.humanizeLevel">
              <n-radio-button value="light">轻度</n-radio-button>
              <n-radio-button value="standard">标准</n-radio-button>
              <n-radio-button value="strong">强力</n-radio-button>
            </n-radio-group>
          </n-form-item>
        </div>

        <div class="settings-section">
          <div class="section-title" :class="isDark ? 'text-gray-100' : 'text-gray-800'">提示词模板</div>
          <n-form-item label="默认提示词">
            <n-select
              :key="rewritePromptOptionsKey"
              v-model:value="form.defaultRewritePromptId"
              :options="rewritePromptOptions"
            />
          </n-form-item>

          <n-form-item label="改写提示词模板">
            <div class="prompt-manager">
              <div class="prompt-toolbar">
                <n-select
                  :key="rewritePromptOptionsKey"
                  v-model:value="selectedPromptId"
                  :options="rewritePromptOptions"
                  class="prompt-select"
                />
                <n-button size="small" secondary @click="addPrompt">新增</n-button>
                <n-button size="small" secondary :disabled="form.rewritePrompts.length <= 1" @click="removePrompt">删除</n-button>
              </div>

              <div v-if="selectedPrompt" class="prompt-editor">
                <n-input :value="selectedPrompt.name" placeholder="模板名称" @update:value="updateSelectedPromptName" />
                <n-input
                  :value="selectedPrompt.prompt"
                  type="textarea"
                  placeholder="输入改写方向，例如：改成更适合公众号发布的口吻，保留事实和结构。"
                  :autosize="{ minRows: 5, maxRows: 10 }"
                  @update:value="updateSelectedPromptContent"
                />
                <div class="prompt-actions">
                  <n-button
                    size="small"
                    secondary
                    :disabled="form.defaultRewritePromptId === selectedPrompt.id"
                    @click="form.defaultRewritePromptId = selectedPrompt.id"
                  >
                    设为默认
                  </n-button>
                  <span class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
                    去 AI 味要求会固定叠加，无需写进每个模板。
                  </span>
                </div>
              </div>
            </div>
          </n-form-item>
        </div>

        <div class="settings-note" :class="isDark ? 'bg-gray-900/70 text-gray-400' : 'bg-gray-50 text-gray-500'">
          <div>API Key 仅保存在本机扩展存储中。</div>
          <div>生成文案时会把 API Key 发送到你配置的 AI 服务地址。</div>
        </div>

        <div class="settings-actions">
          <n-button type="primary" :loading="saving" @click="saveConfig">保存设置</n-button>
          <n-button secondary :loading="testing" @click="testConnection">测试连接</n-button>
          <n-button secondary :disabled="!hasApiKey" @click="clearApiKey">清除 Key</n-button>
        </div>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { aiClient } from '../ai/client';
import { requireAiHostPermission } from '../ai/host-permissions';

const props = defineProps<{ isDark?: boolean }>();

const message = useMessage();
const saving = ref(false);
const testing = ref(false);
const hasApiKey = ref(false);

const form = reactive({
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  timeoutMs: 180000,
  candidateCount: 2,
  humanizeLevel: 'standard',
  rewritePrompts: [
    {
      id: 'general',
      name: '通用改写',
      prompt: [
        '在保留事实、观点和信息完整性的前提下，对文章进行重新编排和表达。',
        '优化标题、段落顺序、衔接和可读性，让文章更适合直接发布。',
        '不要扩写无依据的信息，不要改变原文结论。',
      ].join('\n'),
    },
  ],
  defaultRewritePromptId: 'general',
});

const selectedPromptId = ref('general');
const rewritePromptOptions = computed(() => form.rewritePrompts.map((item) => ({
  label: item.name || '未命名模板',
  value: item.id,
})));
const timeoutSeconds = computed({
  get: () => Math.round(Number(form.timeoutMs || 180000) / 1000),
  set: (value: number | null) => {
    form.timeoutMs = Math.min(Math.max(Number(value || 180), 30), 600) * 1000;
  },
});
const rewritePromptOptionsKey = computed(() => form.rewritePrompts.map((item) => `${item.id}:${item.name}`).join('|'));
const selectedPrompt = computed(() => form.rewritePrompts.find((item) => item.id === selectedPromptId.value));
const isDark = computed(() => Boolean(props.isDark));

async function loadConfig() {
  try {
    const response = await aiClient.getConfig();
    Object.assign(form, response.config);
    if (!Array.isArray(form.rewritePrompts) || form.rewritePrompts.length === 0) {
      form.rewritePrompts = [{
        id: 'general',
        name: '通用改写',
        prompt: '在保留事实和观点的前提下，对文章进行重新编排和表达。',
      }];
    }
    selectedPromptId.value = form.defaultRewritePromptId || form.rewritePrompts[0].id;
    hasApiKey.value = Boolean(response.config.hasApiKey);
    form.apiKey = '';
  } catch (error: any) {
    message.error(error?.message || '加载 AI 设置失败');
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    if (!validatePrompts()) {
      return;
    }
    await requireAiHostPermission(form.baseUrl);
    const response = await aiClient.saveConfig({ ...form });
    hasApiKey.value = Boolean(response.config.hasApiKey);
    form.apiKey = '';
    message.success('AI 设置已保存');
  } catch (error: any) {
    message.error(error?.message || '保存 AI 设置失败');
  } finally {
    saving.value = false;
  }
}

function addPrompt() {
  const id = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  form.rewritePrompts.push({
    id,
    name: '新的改写模板',
    prompt: '在保留原文事实和观点的基础上，调整表达方式、段落组织和发布口吻。',
  });
  selectedPromptId.value = id;
}

function removePrompt() {
  if (form.rewritePrompts.length <= 1) {
    return;
  }
  const index = form.rewritePrompts.findIndex((item) => item.id === selectedPromptId.value);
  if (index < 0) {
    return;
  }
  const removedId = form.rewritePrompts[index].id;
  form.rewritePrompts.splice(index, 1);
  const next = form.rewritePrompts[Math.max(0, index - 1)];
  selectedPromptId.value = next.id;
  if (form.defaultRewritePromptId === removedId || !form.rewritePrompts.some((item) => item.id === form.defaultRewritePromptId)) {
    form.defaultRewritePromptId = next.id;
  }
}

function updateSelectedPromptName(value: string) {
  const prompt = selectedPrompt.value;
  if (prompt) {
    prompt.name = value;
  }
}

function updateSelectedPromptContent(value: string) {
  const prompt = selectedPrompt.value;
  if (prompt) {
    prompt.prompt = value;
  }
}

function validatePrompts() {
  const valid = form.rewritePrompts.every((item) => item.name.trim() && item.prompt.trim());
  if (!valid) {
    message.error('提示词模板名称和内容不能为空');
    return false;
  }
  if (!form.rewritePrompts.some((item) => item.id === form.defaultRewritePromptId)) {
    form.defaultRewritePromptId = form.rewritePrompts[0].id;
  }
  return true;
}

async function testConnection() {
  testing.value = true;
  try {
    await requireAiHostPermission(form.baseUrl);
    await aiClient.saveConfig({ ...form });
    await aiClient.testConnection();
    message.success('AI 连接测试成功');
  } catch (error: any) {
    message.error(error?.message || 'AI 连接测试失败');
  } finally {
    testing.value = false;
  }
}

async function clearApiKey() {
  try {
    const response = await aiClient.clearApiKey();
    hasApiKey.value = Boolean(response.config.hasApiKey);
    form.apiKey = '';
    message.success('API Key 已清除');
  } catch (error: any) {
    message.error(error?.message || '清除 API Key 失败');
  }
}

onMounted(loadConfig);
</script>

<style scoped>
.settings-section {
  padding-bottom: 14px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.settings-section:last-of-type {
  border-bottom: 0;
}

.section-title {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 600;
}

.prompt-manager {
  width: 100%;
}

.prompt-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.prompt-select {
  min-width: 220px;
  flex: 1;
}

.prompt-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.settings-note {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
}

.settings-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}
</style>
