import type { PlatformAdapter } from './base';
import { renderMarkdownToHtmlForPaste } from '@synccaster/core';

export interface BaijiahaoTitleCandidateMeta {
  className?: string;
  parentClassName?: string;
  id?: string;
  placeholder?: string;
  tagName?: string;
  width?: number;
  height?: number;
  textLength?: number;
}

const baijiahaoTitleHaystack = (meta: BaijiahaoTitleCandidateMeta) =>
  [
    meta.className,
    meta.parentClassName,
    meta.id,
    meta.placeholder,
    meta.tagName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function scoreBaijiahaoTitleCandidate(meta: BaijiahaoTitleCandidateMeta): number {
  const haystack = baijiahaoTitleHaystack(meta);
  const width = meta.width || 0;
  const height = meta.height || 0;
  const tagName = String(meta.tagName || '').toLowerCase();
  let score = 0;

  if (tagName === 'input' || tagName === 'textarea') score += 180;
  if (/titleinput|title-input|title_input|title/.test(haystack)) score += 220;
  if (/placeholder|请输入标题|标题/.test(haystack)) score += 120;
  if (/client_components_titleinput|client_pages_edit_components_titleinput/.test(haystack)) score += 180;
  if (/editor|ueditor|content|paragraph|draft/.test(haystack)) score -= 260;
  if (width > 300) score += 20;
  if (height > 120) score -= 60;
  if ((meta.textLength || 0) > 120) score -= 90;

  return score;
}

export interface BaijiahaoBodyCandidateMeta {
  className?: string;
  parentClassName?: string;
  id?: string;
  tagName?: string;
  role?: string;
  width?: number;
  height?: number;
  textLength?: number;
}

const baijiahaoBodyHaystack = (meta: BaijiahaoBodyCandidateMeta) =>
  [
    meta.className,
    meta.parentClassName,
    meta.id,
    meta.tagName,
    meta.role,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function scoreBaijiahaoBodyCandidate(meta: BaijiahaoBodyCandidateMeta): number {
  const haystack = baijiahaoBodyHaystack(meta);
  const width = meta.width || 0;
  const height = meta.height || 0;
  const area = width * height;
  const tagName = String(meta.tagName || '').toLowerCase();
  let score = 0;

  if (/ueditor|editor|content|paragraph|draft|write|article|rich/.test(haystack)) score += 180;
  if (/textbox|data-block|public-drafteditor/.test(haystack)) score += 120;
  if (/title|headline|placeholder/.test(haystack)) score -= 340;
  if (tagName === 'input' || tagName === 'textarea') score -= 420;
  if (height < 120) score -= 140;
  score += Math.min(220, Math.round(area / 3000));
  score += Math.min(60, Math.round((meta.textLength || 0) / 40));

  return score;
}

function isLikelyBaijiahaoBodyCandidate(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return scoreBaijiahaoBodyCandidate({
    className: el.className || '',
    parentClassName: el.parentElement?.className || '',
    id: el.id || '',
    tagName: el.tagName,
    role: el.getAttribute('role') || '',
    width: rect.width,
    height: rect.height,
    textLength: (el.textContent || '').trim().length,
  }) >= 80;
}

/**
 * 百家号适配器
 *
 * 平台特点：
 * - 入口：https://baijiahao.baidu.com/builder/rc/edit 或相关写作页面
 * - 编辑器：UEditor 富文本（内容在 iframe 中）
 * - 标题：contenteditable div
 * - 不支持：Markdown 识别
 *
 * 发布策略：
 * - 将 Markdown 转为 HTML 后注入编辑器
 * - 不执行最终发布操作，由用户手动完成
 */
export const baijiahaoAdapter: PlatformAdapter = {
  id: 'baijiahao',
  name: '百家号',
  kind: 'dom',
  icon: 'baijiahao',
  capabilities: {
    domAutomation: true,
    supportsMarkdown: false,
    supportsHtml: true,
    supportsTags: true,
    supportsCategories: false,
    supportsCover: true,
    supportsSchedule: false,
    imageUpload: 'dom',
    rateLimit: { rpm: 20, concurrent: 1 },
  },

  async ensureAuth() {
    return { type: 'cookie', valid: true };
  },

  async transform(post) {
    const markdown = post.body_md || '';
    // 百家号不支持 LaTeX 渲染：去掉 $ 包裹符号，公式以纯文本形式显示
    const contentHtml = renderMarkdownToHtmlForPaste(markdown, { stripMath: true });
    return {
      title: post.title,
      contentMarkdown: markdown,
      contentHtml,
      tags: post.tags,
      summary: post.summary,
      meta: { assets: post.assets || [] },
    };
  },

  async publish() {
    throw new Error('baijiahao: use DOM automation');
  },

  dom: {
    matchers: [
      'https://baijiahao.baidu.com/builder/rc/edit*',
      'https://baijiahao.baidu.com/builder/rc/create*',
      'https://author.baidu.com/builder/rc/edit*',
    ],
    fillAndPublish: async function (payload) {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const waitFor = async <T>(getter: () => T | null, timeoutMs = 45000): Promise<T> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const v = getter();
          if (v) return v;
          await sleep(200);
        }
        throw new Error('等待元素超时');
      };
      const scoreTitleCandidateLocal = (meta: BaijiahaoTitleCandidateMeta): number => {
        const haystack = [
          meta.className,
          meta.parentClassName,
          meta.id,
          meta.placeholder,
          meta.tagName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const width = meta.width || 0;
        const height = meta.height || 0;
        const tagName = String(meta.tagName || '').toLowerCase();
        let score = 0;

        if (tagName === 'input' || tagName === 'textarea') score += 180;
        if (/titleinput|title-input|title_input|title/.test(haystack)) score += 220;
        if (/placeholder|请输入标题|标题/.test(haystack)) score += 120;
        if (/client_components_titleinput|client_pages_edit_components_titleinput/.test(haystack)) score += 180;
        if (/editor|ueditor|content|paragraph|draft/.test(haystack)) score -= 260;
        if (width > 300) score += 20;
        if (height > 120) score -= 60;
        if ((meta.textLength || 0) > 120) score -= 90;

        return score;
      };
      const scoreBodyCandidateLocal = (meta: BaijiahaoBodyCandidateMeta): number => {
        const haystack = [
          meta.className,
          meta.parentClassName,
          meta.id,
          meta.tagName,
          meta.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const width = meta.width || 0;
        const height = meta.height || 0;
        const area = width * height;
        const tagName = String(meta.tagName || '').toLowerCase();
        let score = 0;

        if (/ueditor|editor|content|paragraph|draft|write|article|rich/.test(haystack)) score += 180;
        if (/textbox|data-block|public-drafteditor/.test(haystack)) score += 120;
        if (/title|headline|placeholder/.test(haystack)) score -= 340;
        if (tagName === 'input' || tagName === 'textarea') score -= 420;
        if (height < 120) score -= 140;
        score += Math.min(220, Math.round(area / 3000));
        score += Math.min(60, Math.round((meta.textLength || 0) / 40));

        return score;
      };
      const isLikelyBodyCandidateLocal = (el: HTMLElement): boolean => {
        const rect = el.getBoundingClientRect();
        return scoreBodyCandidateLocal({
          className: el.className || '',
          parentClassName: el.parentElement?.className || '',
          id: el.id || '',
          tagName: el.tagName,
          role: el.getAttribute('role') || '',
          width: rect.width,
          height: rect.height,
          textLength: (el.textContent || '').trim().length,
        }) >= 80;
      };
      const getNodeValue = (node: HTMLElement) =>
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
          ? node.value.trim()
          : (node.textContent || '').trim();

      const titleText = String((payload as any).title || '').trim();
      const html = String((payload as any).contentHtml || '');
      const markdown = String((payload as any).contentMarkdown || '');

      const isVisible = (el: Element) => {
        const he = el as HTMLElement;
        const style = window.getComputedStyle(he);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = he.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const buildTitleMeta = (el: HTMLElement): BaijiahaoTitleCandidateMeta => {
        const rect = el.getBoundingClientRect();
        return {
          className: el.className || '',
          parentClassName: el.parentElement?.className || '',
          id: el.id || '',
          placeholder: el.getAttribute('placeholder') || '',
          tagName: el.tagName,
          width: rect.width,
          height: rect.height,
          textLength: (el.textContent || '').trim().length,
        };
      };

      const buildBodyMeta = (el: HTMLElement): BaijiahaoBodyCandidateMeta => {
        const rect = el.getBoundingClientRect();
        return {
          className: el.className || '',
          parentClassName: el.parentElement?.className || '',
          id: el.id || '',
          tagName: el.tagName,
          role: el.getAttribute('role') || '',
          width: rect.width,
          height: rect.height,
          textLength: (el.textContent || '').trim().length,
        };
      };

      const getTitleCandidates = (): HTMLElement[] => {
        const selectors = [
          'textarea[placeholder*="标题"]',
          'input[placeholder*="标题"]',
          'textarea[class*="title"]',
          'input[class*="title"]',
          'textarea[name*="title"]',
          'input[name*="title"]',
          '.client_components_titleInput textarea',
          '.client_components_titleInput input',
          '.client_pages_edit_components_titleInput textarea',
          '.client_pages_edit_components_titleInput input',
          '.client_components_titleInput [contenteditable="true"]',
          '.client_pages_edit_components_titleInput [contenteditable="true"]',
          '[class*="titleInput"] [contenteditable="true"]',
          '[class*="title-input"] [contenteditable="true"]',
          '[class*="title_input"] [contenteditable="true"]',
          '[data-testid="title"] [contenteditable="true"]',
          '[placeholder*="标题"][contenteditable="true"]',
          '[placeholder*="请输入标题"][contenteditable="true"]',
          '[data-testid="title"] textarea',
          '[data-testid="title"] input',
        ];
        const seen = new Set<HTMLElement>();
        const candidates: HTMLElement[] = [];
        for (const selector of selectors) {
          for (const node of Array.from(document.querySelectorAll(selector)) as HTMLElement[]) {
            if (!node || seen.has(node) || !isVisible(node)) continue;
            seen.add(node);
            candidates.push(node);
          }
        }
        return candidates;
      };

      let titleEditor: HTMLElement | null = null;

        const setTitleValue = (node: HTMLElement, value: string) => {
          if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
            const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(node, value);
            else (node as any).value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('blur', { bubbles: true }));
            return;
          }
          node.focus();
          document.execCommand('selectAll', false);
          document.execCommand('delete', false);
          const inserted = document.execCommand('insertText', false, value);
          if (!inserted) node.textContent = value;
          node.dispatchEvent(new Event('input', { bubbles: true }));
          node.dispatchEvent(new Event('change', { bubbles: true }));
          node.dispatchEvent(new Event('blur', { bubbles: true }));
        };

        // 1) 填充标题 - 百家号标题可能是 input/textarea 或 contenteditable 容器
        if (titleText) {
          await sleep(300); // 等待页面加载（优化：从 1000ms 减少到 300ms）

        titleEditor = await waitFor(() => {
          const candidates = getTitleCandidates()
            .map((el) => ({ el, score: scoreTitleCandidateLocal(buildTitleMeta(el)) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);
          return candidates[0]?.el || null;
        }, 10000);

        if (titleEditor) {
          console.log('[baijiahao] 找到标题编辑器，开始填充标题');

          setTitleValue(titleEditor, titleText);
          await sleep(100);

          // 验证填充结果
          const actualTitle =
            getNodeValue(titleEditor);
          if (actualTitle === titleText || actualTitle.includes(titleText)) {
            console.log('[baijiahao] 标题填充成功:', titleText.substring(0, 20) + '...');
          } else {
            console.warn('[baijiahao] 标题填充可能不完整，期望:', titleText.substring(0, 20), '实际:', actualTitle.substring(0, 20));
          }
        } else {
          console.log('[baijiahao] 未找到标题输入框');
        }
      }

      // 2) 等待编辑器加载（优化：从 2500ms 减少到 500ms）
      await sleep(500);

      // 2.5) 处理本地图片上传
      // 检查是否有需要上传的本地图片
      const downloadedImages = (payload as any).__downloadedImages as Array<{ url: string; base64: string; mimeType: string }> | undefined;
      let processedHtml = html;

      if (downloadedImages && downloadedImages.length > 0) {
        console.log('[baijiahao] 发现', downloadedImages.length, '张本地图片需要上传');

        // 图片上传函数
        const uploadImageToBaijiahao = async (base64: string, mimeType: string): Promise<string | null> => {
          try {
            // 将 base64 转换为 Blob
            const response = await fetch(base64);
            const blob = await response.blob();

            // 构建 FormData
            const formData = new FormData();
            const ext = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpg';
            const filename = `image_${Date.now()}.${ext}`;
            formData.append('media', blob, filename);

            // 尝试多个可能的上传 API
            const uploadUrls = [
              'https://baijiahao.baidu.com/builderinner/api/content/file/upload',
              'https://baijiahao.baidu.com/pcui/picture/uploadproxy',
              'https://baijiahao.baidu.com/builder/api/content/file/upload',
            ];

            for (const uploadUrl of uploadUrls) {
              try {
                const uploadResp = await fetch(uploadUrl, {
                  method: 'POST',
                  body: formData,
                  credentials: 'include',
                });

                if (!uploadResp.ok) continue;

                const data = await uploadResp.json();
                console.log('[baijiahao] 上传响应:', data);

                // 尝试从响应中提取图片 URL
                const imgUrl =
                  data?.ret?.https_url ||
                  data?.ret?.url ||
                  data?.data?.url ||
                  data?.data?.https_url ||
                  data?.url ||
                  data?.https_url ||
                  data?.ret?.boss_url;

                if (imgUrl) {
                  console.log('[baijiahao] 图片上传成功:', imgUrl);
                  return imgUrl.startsWith('//') ? 'https:' + imgUrl : imgUrl;
                }
              } catch (e) {
                console.log('[baijiahao] 上传 API 失败:', uploadUrl, e);
              }
            }

            return null;
          } catch (e) {
            console.error('[baijiahao] 图片上传失败:', e);
            return null;
          }
        };

        // 上传每张图片并替换 URL
        for (const img of downloadedImages) {
          if (!img.url.startsWith('local://')) continue;

          console.log('[baijiahao] 上传图片:', img.url);
          const newUrl = await uploadImageToBaijiahao(img.base64, img.mimeType);

          if (newUrl) {
            // 替换 HTML 中的 local:// URL
            // 匹配 src="local://..." 或 src='local://...'
            const escapedUrl = img.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processedHtml = processedHtml.replace(
              new RegExp(`src=["']${escapedUrl}["']`, 'g'),
              `src="${newUrl}"`
            );
            // 也替换 Markdown 格式的图片链接（如果有）
            processedHtml = processedHtml.replace(
              new RegExp(`\\]\\(${escapedUrl}\\)`, 'g'),
              `](${newUrl})`
            );
            console.log('[baijiahao] 图片 URL 替换成功:', img.url, '->', newUrl);
          } else {
            console.warn('[baijiahao] 图片上传失败，保留原链接:', img.url);
          }
        }
      }

      // 3) 填充正文内容 - 百家号使用 UEditor，内容在 iframe 中
      // 将 markdown 转换为 HTML 段落格式
      const htmlContent = processedHtml || markdown.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      
      console.log('[baijiahao] 开始填充正文内容，长度:', htmlContent.length);

      let filled = false;

      // 方法1：通过 iframe 的 window 对象访问 UEditor API（最可靠）
      // 百家号的 UEditor 实例在 iframe 的 window 中，不在主 window 中
      const iframes = Array.from(document.querySelectorAll('iframe')) as HTMLIFrameElement[];
      console.log('[baijiahao] 找到 iframe 数量:', iframes.length);
      
      for (const iframe of iframes) {
        if (filled) break;
        try {
          const iframeWin = iframe.contentWindow as any;
          const iframeDoc = iframe.contentDocument || iframeWin?.document;
          if (!iframeWin || !iframeDoc) continue;
          
          console.log('[baijiahao] 检查 iframe:', iframe.id || iframe.className || 'unnamed');
          
          // 尝试通过 iframe window 访问 UEditor
          // 方式1: UE.getEditor 或 UE.instants
          if (!filled && iframeWin.UE) {
            console.log('[baijiahao] 在 iframe 中找到 UE 对象');
            // 尝试 getEditor
            if (typeof iframeWin.UE.getEditor === 'function') {
              try {
                const editor = iframeWin.UE.getEditor('ueditor');
                if (editor && typeof editor.setContent === 'function') {
                  editor.setContent(htmlContent);
                  console.log('[baijiahao] 通过 iframe UE.getEditor 填充成功');
                  filled = true;
                  continue;
                }
              } catch (e) {
                console.log('[baijiahao] UE.getEditor 失败:', e);
              }
            }
            // 尝试 instants
            if (!filled && iframeWin.UE.instants) {
              const keys = Object.keys(iframeWin.UE.instants);
              console.log('[baijiahao] UE.instants keys:', keys);
              for (const key of keys) {
                try {
                  const editor = iframeWin.UE.instants[key];
                  if (editor && typeof editor.setContent === 'function') {
                    editor.setContent(htmlContent);
                    console.log('[baijiahao] 通过 iframe UE.instants 填充成功, key:', key);
                    filled = true;
                    break;
                  }
                } catch (e) {
                  console.log('[baijiahao] UE.instants 调用失败:', e);
                }
              }
            }
          }
          
          // 方式2: 全局 ue 变量
          if (!filled && iframeWin.ue && typeof iframeWin.ue.setContent === 'function') {
            try {
              iframeWin.ue.setContent(htmlContent);
              console.log('[baijiahao] 通过 iframe 全局 ue 变量填充成功');
              filled = true;
              continue;
            } catch (e) {
              console.log('[baijiahao] iframe ue 变量调用失败:', e);
            }
          }
          
          // 方式3: 直接操作 iframe body（UEditor 的编辑区域是 body contenteditable）
          if (!filled) {
            const iframeBody = iframeDoc.body;
            if (iframeBody && (iframeBody.contentEditable === 'true' || iframeBody.getAttribute('contenteditable') === 'true')) {
              iframeBody.focus();
              iframeBody.innerHTML = htmlContent;
              iframeBody.dispatchEvent(new Event('input', { bubbles: true }));
              console.log('[baijiahao] 通过 iframe body innerHTML 填充成功');
              filled = true;
              continue;
            }
          }
        } catch (e) {
          console.log('[baijiahao] iframe 访问失败:', e);
        }
      }

      // 方法2：尝试主 window 的 UEditor（某些版本可能在主 window）
      if (!filled) {
        const win = window as any;
        
        // 尝试 UE_V2 (新版 UEditor)
        if (!filled && win.UE_V2 && win.UE_V2.instants) {
          const keys = Object.keys(win.UE_V2.instants);
          console.log('[baijiahao] 主 window UE_V2.instants keys:', keys);
          for (const key of keys) {
            try {
              const editor = win.UE_V2.instants[key];
              if (editor && typeof editor.setContent === 'function') {
                editor.setContent(htmlContent);
                console.log('[baijiahao] 通过主 window UE_V2 API 填充成功, key:', key);
                filled = true;
                break;
              }
            } catch (e) {
              console.log('[baijiahao] UE_V2 API 调用失败:', e);
            }
          }
        }
        
        // 尝试 UE (旧版 UEditor)
        if (!filled && win.UE && win.UE.instants) {
          const keys = Object.keys(win.UE.instants);
          console.log('[baijiahao] 主 window UE.instants keys:', keys);
          for (const key of keys) {
            try {
              const editor = win.UE.instants[key];
              if (editor && typeof editor.setContent === 'function') {
                editor.setContent(htmlContent);
                console.log('[baijiahao] 通过主 window UE API 填充成功, key:', key);
                filled = true;
                break;
              }
            } catch (e) {
              console.log('[baijiahao] UE API 调用失败:', e);
            }
          }
        }
        
        // 尝试全局 ue 变量
        if (!filled && win.ue && typeof win.ue.setContent === 'function') {
          try {
            win.ue.setContent(htmlContent);
            console.log('[baijiahao] 通过主 window 全局 ue 变量填充成功');
            filled = true;
          } catch (e) {
            console.log('[baijiahao] 全局 ue 变量调用失败:', e);
          }
        }
      }

      // 方法3：降级到主文档中的正文编辑区
        if (!filled) {
        const selectors = [
          '[contenteditable="true"][data-testid*="editor"]',
          '[contenteditable="true"][role="textbox"]',
          '[contenteditable="true"][class*="paragraph"]',
          '[contenteditable="true"][class*="editor"]',
          '[contenteditable="true"][class*="content"]',
          '[contenteditable="true"][class*="article"]',
          '[contenteditable="true"]',
        ];
        const seen = new Set<HTMLElement>();
        const candidates: HTMLElement[] = [];
        for (const selector of selectors) {
          for (const node of Array.from(document.querySelectorAll(selector)) as HTMLElement[]) {
            if (
              !node ||
              seen.has(node) ||
              !isVisible(node) ||
              !isLikelyBodyCandidateLocal(node) ||
              (titleEditor && (node === titleEditor || node.contains(titleEditor) || titleEditor.contains(node)))
            ) {
              continue;
            }
            seen.add(node);
            candidates.push(node);
          }
        }
        const filtered = candidates.sort(
          (a, b) => scoreBodyCandidateLocal(buildBodyMeta(b)) - scoreBodyCandidateLocal(buildBodyMeta(a))
        );
        
        if (filtered.length > 0) {
          const contentEditor = filtered[0];
          contentEditor.focus();
          contentEditor.innerHTML = htmlContent;
          contentEditor.dispatchEvent(new Event('input', { bubbles: true }));
          contentEditor.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[baijiahao] 通过 contenteditable 降级填充成功');
          filled = true;
        }
      }

      if (!filled) {
        console.log('[baijiahao] 未找到编辑器元素，内容填充失败');
      }

      await sleep(200); // 优化：从 500ms 减少到 200ms
      return { editUrl: window.location.href, url: window.location.href } as any;
    },
  },
};
