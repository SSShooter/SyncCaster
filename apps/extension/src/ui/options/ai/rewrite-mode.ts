import {
  DEFAULT_REWRITE_MODE,
  normalizeRewriteMode,
  type AiRewriteMode,
} from '@synccaster/ai';

export interface RewriteModeOption {
  label: string;
  value: AiRewriteMode;
  description: string;
}

export const rewriteModeOptions: RewriteModeOption[] = [
  {
    label: '参考资料重构',
    value: 'reference_rebuild',
    description: '适合单篇网络技术文章。提取事实和观点后重新组织，避免复刻原文结构和标志性表达。',
  },
  {
    label: '保真改写',
    value: 'faithful_rewrite',
    description: '适合自己的草稿或已授权素材。保留原文结构和事实顺序，主要优化表达、衔接和可读性。',
  },
  {
    label: '案例化改写',
    value: 'case_study',
    description: '适合项目实战方向。把素材改成场景、问题、方案、风险和复盘式文章，但不编造真实客户案例。',
  },
];

export function normalizeUiRewriteMode(value: unknown): AiRewriteMode {
  return normalizeRewriteMode(value);
}

export function getRewriteModeOption(value: unknown): RewriteModeOption {
  const mode = normalizeUiRewriteMode(value);
  return rewriteModeOptions.find((item) => item.value === mode) || rewriteModeOptions[0];
}

export function getDefaultRewriteMode(): AiRewriteMode {
  return DEFAULT_REWRITE_MODE;
}
