<template>
  <div>
    <div class="flex-between mb-6">
      <h2 class="text-2xl font-bold" :class="isDark ? 'text-gray-100' : 'text-gray-800'">AI 设置</h2>
    </div>

    <n-card>
      <n-form label-placement="left" label-width="140px" :model="form">
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

        <n-form-item label="Temperature">
          <n-input-number v-model:value="form.temperature" :min="0" :max="2" :step="0.1" />
        </n-form-item>

        <n-form-item label="生成数量">
          <n-radio-group v-model:value="form.candidateCount">
            <n-radio-button :value="2">2 个</n-radio-button>
            <n-radio-button :value="3">3 个</n-radio-button>
          </n-radio-group>
        </n-form-item>

        <n-form-item label="默认风格">
          <n-select v-model:value="form.defaultStyle" :options="styleOptions" />
        </n-form-item>

        <div class="text-sm mb-4" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
          <div>API Key 仅保存在本机扩展存储中。</div>
          <div>生成文案时会把 API Key 发送到你配置的 AI 服务地址。</div>
        </div>

        <div class="flex gap-2">
          <n-button type="primary" :loading="saving" @click="saveConfig">保存</n-button>
          <n-button :loading="testing" @click="testConnection">测试连接</n-button>
          <n-button :disabled="!hasApiKey" @click="clearApiKey">清除 Key</n-button>
        </div>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { aiClient } from '../ai/client';
import { requestAiHostPermission } from '../ai/host-permissions';

defineProps<{ isDark?: boolean }>();

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
  candidateCount: 2,
  defaultStyle: 'balanced',
});

const styleOptions = [
  { label: '平衡改写', value: 'balanced' },
  { label: '降低 AI 味', value: 'less_ai' },
  { label: '平台发布优化', value: 'platform_ready' },
];

async function loadConfig() {
  try {
    const response = await aiClient.getConfig();
    Object.assign(form, response.config);
    hasApiKey.value = Boolean(response.config.hasApiKey);
    form.apiKey = '';
  } catch (error: any) {
    message.error(error?.message || '加载 AI 设置失败');
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    const granted = await requestAiHostPermission(form.baseUrl);
    if (!granted) {
      message.error('未授权 AI 服务域名，无法保存该地址');
      return;
    }
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

async function testConnection() {
  testing.value = true;
  try {
    await requestAiHostPermission(form.baseUrl);
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
