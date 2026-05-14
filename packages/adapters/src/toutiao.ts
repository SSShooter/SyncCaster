import type { PlatformAdapter } from './base';
import {
  renderMarkdownToHtmlForPaste,
  replaceLinkedMarkdownImagesWithPlainImages,
  replaceHtmlImagesWithPlaceholders,
} from '@synccaster/core';

export interface ToutiaoEditableCandidateMeta {
  tagName?: string;
  className?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  role?: string;
  width?: number;
  height?: number;
  textLength?: number;
}

const toutiaoMetaHaystack = (meta: ToutiaoEditableCandidateMeta) =>
  [
    meta.tagName,
    meta.className,
    meta.id,
    meta.placeholder,
    meta.ariaLabel,
    meta.role,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function scoreToutiaoTitleCandidate(meta: ToutiaoEditableCandidateMeta): number {
  const haystack = toutiaoMetaHaystack(meta);
  const tagName = String(meta.tagName || '').toLowerCase();
  const height = meta.height || 0;
  let score = 0;

  if (tagName === 'input' || tagName === 'textarea') score += 90;
  if (/标题|title|headline/.test(haystack)) score += 170;
  if (/title-input|title-editor|article-title|headline/.test(haystack)) score += 120;
  if (/prosemirror|editor|rich|content|drafteditor/.test(haystack)) score -= 200;
  if (height > 140) score -= 50;
  if ((meta.textLength || 0) > 140) score -= 70;

  return score;
}

export function scoreToutiaoEditorCandidate(meta: ToutiaoEditableCandidateMeta): number {
  const haystack = toutiaoMetaHaystack(meta);
  const tagName = String(meta.tagName || '').toLowerCase();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const area = width * height;
  let score = 0;

  if (/prosemirror/.test(haystack)) score += 220;
  if (/editor-inner|article-editor|publish-content|rich-editor/.test(haystack)) score += 160;
  if (/editor|content|article|rich|write|textbox/.test(haystack)) score += 70;
  if (/title|标题|headline/.test(haystack)) score -= 240;
  if (tagName === 'input' || tagName === 'textarea') score -= 260;
  score += Math.min(180, Math.round(area / 2500));
  score += Math.min(40, Math.round((meta.textLength || 0) / 50));

  return score;
}

/**
 * 今日头条（头条号）适配器
 *
 * 平台特点：
 * - 入口：https://mp.toutiao.com/profile_v4/graphic/publish 或 /profile_v4/graphic/publish
 * - 编辑器：ProseMirror 富文本
 * - 标题：textarea
 * - 不支持：Markdown 识别
 *
 * 发布策略：
 * - 将 Markdown 转换为 HTML 后注入编辑器
 * - 不执行最终发布操作，由用户手动完成
 */
export const toutiaoAdapter: PlatformAdapter = {
  id: 'toutiao',
  name: '今日头条',
  kind: 'dom',
  icon: 'toutiao',
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
    const markdown = replaceLinkedMarkdownImagesWithPlainImages(post.body_md || '');
    // 头条不支持 LaTeX 渲染：去掉 $ 包裹符号，公式以纯文本形式显示
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
    throw new Error('toutiao: use DOM automation');
  },

  dom: {
    matchers: [
      'https://mp.toutiao.com/profile_v4/graphic/publish*',
      'https://mp.toutiao.com/profile_v4/graphic/article/publish*',
      'https://mp.toutiao.com/profile_v4/graphic/publish',
    ],
    fillAndPublish: async function (payload) {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const replaceLinkedMarkdownImagesWithPlainImagesLocal = (markdown: string): string =>
        String(markdown || '').replace(
          /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
          (_match, alt: string, imageUrl: string) => `![${alt}](${imageUrl})`,
        );
      const scoreTitleCandidateLocal = (meta: ToutiaoEditableCandidateMeta): number => {
        const haystack = [
          meta.tagName,
          meta.className,
          meta.id,
          meta.placeholder,
          meta.ariaLabel,
          meta.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const tagName = String(meta.tagName || '').toLowerCase();
        const height = meta.height || 0;
        let score = 0;

        if (tagName === 'input' || tagName === 'textarea') score += 90;
        if (/标题|title|headline/.test(haystack)) score += 170;
        if (/title-input|title-editor|article-title|headline/.test(haystack)) score += 120;
        if (/prosemirror|editor|rich|content|drafteditor/.test(haystack)) score -= 200;
        if (height > 140) score -= 50;
        if ((meta.textLength || 0) > 140) score -= 70;

        return score;
      };
      const scoreEditorCandidateLocal = (meta: ToutiaoEditableCandidateMeta): number => {
        const haystack = [
          meta.tagName,
          meta.className,
          meta.id,
          meta.placeholder,
          meta.ariaLabel,
          meta.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const tagName = String(meta.tagName || '').toLowerCase();
        const width = meta.width || 0;
        const height = meta.height || 0;
        const area = width * height;
        let score = 0;

        if (/prosemirror/.test(haystack)) score += 220;
        if (/editor-inner|article-editor|publish-content|rich-editor/.test(haystack)) score += 160;
        if (/editor|content|article|rich|write|textbox/.test(haystack)) score += 70;
        if (/title|标题|headline/.test(haystack)) score -= 240;
        if (tagName === 'input' || tagName === 'textarea') score -= 260;
        score += Math.min(180, Math.round(area / 2500));
        score += Math.min(40, Math.round((meta.textLength || 0) / 50));

        return score;
      };
      const replaceHtmlImagesWithPlaceholdersLocal = (
        rawHtml: string,
        replacements: Array<{ url: string; placeholder: string }>
      ): string => {
        if (!rawHtml || replacements.length === 0) return rawHtml || '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');
        const replacementMap = new Map(replacements.map((item) => [item.url, item.placeholder] as const));
        doc.querySelectorAll('img').forEach((img) => {
          const src = img.getAttribute('src') || '';
          const placeholder = replacementMap.get(src);
          if (placeholder) {
            img.replaceWith(doc.createTextNode(placeholder));
          }
        });
        return doc.body.innerHTML;
      };

      const isVisible = (el: Element) => {
        const he = el as HTMLElement;
        const style = window.getComputedStyle(he);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = he.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const collectCandidates = (selectors: string[]) => {
        const seen = new Set<HTMLElement>();
        const results: HTMLElement[] = [];
        for (const selector of selectors) {
          const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
          for (const node of nodes) {
            const normalized =
              node.matches('textarea, input, [contenteditable="true"]')
                ? node
                : ((node.querySelector('textarea, input, [contenteditable="true"]') as HTMLElement | null) || node);
            if (!normalized || seen.has(normalized) || !isVisible(normalized)) continue;
            seen.add(normalized);
            results.push(normalized);
          }
        }
        return results;
      };

      const buildMeta = (el: HTMLElement): ToutiaoEditableCandidateMeta => {
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName,
          className: el.className || '',
          id: el.id || '',
          placeholder:
            (el as HTMLInputElement).placeholder ||
            el.getAttribute('data-placeholder') ||
            '',
          ariaLabel: el.getAttribute('aria-label') || '',
          role: el.getAttribute('role') || '',
          width: rect.width,
          height: rect.height,
          textLength: (el.textContent || '').trim().length,
        };
      };

      const waitForBestCandidate = async (
        selectors: string[],
        scorer: (el: HTMLElement, meta: ToutiaoEditableCandidateMeta) => number,
        label: string,
        timeoutMs = 25000,
        minScore = 1
      ) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          let best: { el: HTMLElement; score: number } | null = null;
          for (const candidate of collectCandidates(selectors)) {
            const score = scorer(candidate, buildMeta(candidate));
            if (!best || score > best.score) {
              best = { el: candidate, score };
            }
          }
          if (best && best.score >= minScore) return best.el;
          await sleep(200);
        }
        throw new Error(`等待 ${label} 超时`);
      };

      const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
        const proto = el instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, value);
        else (el as any).value = value;
        try {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
        } catch {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      };

      const setContentEditableValue = (el: HTMLElement, value: string) => {
        try {
          el.focus();
          const selection = window.getSelection();
          selection?.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(el);
          selection?.addRange(range);
          document.execCommand('delete', false);
          const inserted = document.execCommand('insertText', false, value);
          if (!inserted) {
            el.textContent = value;
          }
        } catch {
          el.textContent = value;
        }
        try {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
        } catch {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      };

      const clearEditable = (editor: HTMLElement) => {
        try {
          editor.focus();
          const selection = window.getSelection();
          selection?.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(editor);
          selection?.addRange(range);
          document.execCommand('delete', false);
        } catch {}
        editor.innerHTML = '';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      };

      const extractPlainText = (html: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html || '', 'text/html');
        return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
      };

      const getEditorState = (editor: HTMLElement) => ({
        textLength: ((editor.innerText || editor.textContent || '').replace(/\s+/g, ' ').trim() || '').length,
        imageCount: editor.querySelectorAll('img').length,
      });

      const isEditorFilledEnough = (editor: HTMLElement, expectedTextLength: number, expectedImageCount: number) => {
        const state = getEditorState(editor);
        const requiredText =
          expectedTextLength <= 0
            ? 0
            : expectedTextLength < 16
              ? Math.max(1, expectedTextLength - 2)
              : Math.floor(expectedTextLength * 0.68);
        const textOk = expectedTextLength === 0 || state.textLength >= requiredText;
        const imageOk = expectedImageCount === 0 || state.imageCount >= Math.min(1, expectedImageCount);
        return textOk && imageOk;
      };

      const fillEditorHtml = async (editor: HTMLElement, html: string, plainText: string) => {
        const methods = [
          async () => {
            clearEditable(editor);
            const dt = new DataTransfer();
            dt.setData('text/html', html);
            dt.setData('text/plain', plainText);
            const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true } as any);
            Object.defineProperty(event, 'clipboardData', { get: () => dt });
            editor.focus();
            editor.dispatchEvent(event);
            await sleep(350);
          },
          async () => {
            clearEditable(editor);
            editor.focus();
            const inserted = document.execCommand('insertHTML', false, html);
            if (!inserted) {
              editor.innerHTML = html;
            }
            try {
              editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
            } catch {
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            editor.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(300);
          },
          async () => {
            clearEditable(editor);
            editor.innerHTML = html;
            try {
              editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
            } catch {
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            editor.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(300);
          },
          async () => {
            clearEditable(editor);
            editor.focus();
            document.execCommand('insertText', false, plainText);
            try {
              editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: plainText, inputType: 'insertText' }));
            } catch {
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await sleep(250);
          },
        ];

        const expectedTextLength = plainText.trim().length;
        const expectedImageCount = (html.match(/<img\b/gi) || []).length;

        for (const method of methods) {
          try {
            await method();
            if (isEditorFilledEnough(editor, expectedTextLength, expectedImageCount)) {
              return true;
            }
          } catch (error) {
            console.warn('[toutiao] fillEditorHtml strategy failed', error);
          }
        }

        return false;
      };

      // ========== 图片处理辅助函数 ==========

      // 将 base64 转换为 Blob
      const dataUrlToBlob = (dataUrl: string): Blob => {
        const parts = dataUrl.split(',');
        if (parts.length !== 2) {
          throw new Error('Invalid data URL format');
        }
        const meta = parts[0];
        const base64Data = parts[1];
        const mimeMatch = meta.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
      };

      // 收集编辑器中的所有图片 URL
      const collectImageUrls = (root: HTMLElement): string[] => {
        const urls: string[] = [];
        root.querySelectorAll('img').forEach(img => {
          if (img.src) urls.push(img.src);
        });
        return urls;
      };

      // 等待新图片 URL 出现
      const waitForNewImageUrl = (
        root: HTMLElement,
        beforeUrls: Set<string>,
        timeoutMs: number
      ): Promise<{ url: string | null }> => {
        return new Promise((resolve) => {
          let timer: ReturnType<typeof setTimeout>;

          const checkOnce = (): boolean => {
            const imgs = root.querySelectorAll('img');
            for (const img of imgs) {
              const url = img.src;
              if (!url || beforeUrls.has(url)) continue;
              // 找到新的图片 URL（头条图床 URL 或 blob URL）
              if (url.includes('toutiao') || url.includes('bytedance') || url.includes('byteimg') || url.startsWith('blob:')) {
                observer.disconnect();
                if (timer) clearTimeout(timer);
                console.log('[toutiao] Found new image URL:', url);
                resolve({ url });
                return true;
              }
            }
            return false;
          };

          const observer = new MutationObserver(() => checkOnce());
          observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
          });

          if (checkOnce()) return;

          timer = setTimeout(() => {
            observer.disconnect();
            console.log('[toutiao] waitForNewImageUrl timeout');
            resolve({ url: null });
          }, timeoutMs);
        });
      };

      // 在编辑器中查找并替换占位符
      const findAndReplacePlaceholder = async (
        editorRoot: HTMLElement,
        placeholder: string,
        imageData: { base64: string; mimeType: string }
      ): Promise<boolean> => {
        // 使用 TreeWalker 遍历所有文本节点
        const walker = document.createTreeWalker(
          editorRoot,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node: Text | null;
        while ((node = walker.nextNode() as Text)) {
          const text = node.textContent || '';
          const index = text.indexOf(placeholder);
          if (index !== -1) {
            console.log('[toutiao] Found placeholder:', placeholder, 'in text:', text.substring(0, 50));

            try {
              // 1. 选中占位符
              const range = document.createRange();
              range.setStart(node, index);
              range.setEnd(node, index + placeholder.length);

              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
              await sleep(100);

              // 2. 删除占位符
              document.execCommand('delete', false);
              await sleep(100);

              // 3. 在该位置粘贴图片
              const blob = dataUrlToBlob(imageData.base64);
              const ext = imageData.mimeType.includes('png') ? 'png' : imageData.mimeType.includes('gif') ? 'gif' : 'jpg';
              const file = new File([blob], `image_${Date.now()}.${ext}`, { type: imageData.mimeType });

              const dt = new DataTransfer();
              dt.items.add(file);

              // 记录粘贴前的图片 URL
              const beforeUrls = new Set(collectImageUrls(editorRoot));

              // 尝试 paste 事件
              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dt
              });
              Object.defineProperty(pasteEvent, 'clipboardData', { get: () => dt });
              editorRoot.dispatchEvent(pasteEvent);

              // 4. 等待图片上传
              console.log('[toutiao] Waiting for image upload...');
              const result = await waitForNewImageUrl(editorRoot, beforeUrls, 20000);

              if (result.url) {
                console.log('[toutiao] Image uploaded successfully:', result.url);
              } else {
                console.warn('[toutiao] Image upload may have failed for placeholder:', placeholder);
              }

              return true;
            } catch (e) {
              console.error('[toutiao] Error replacing placeholder:', placeholder, e);
              return false;
            }
          }
        }

        console.warn('[toutiao] Placeholder not found:', placeholder);
        return false;
      };

      try {
        const titleText = String((payload as any).title || '').trim();
        let html = String((payload as any).contentHtml || '');
        const markdown = replaceLinkedMarkdownImagesWithPlainImagesLocal(String((payload as any).contentMarkdown || ''));

        // ========== 图片占位符处理 ==========
        const downloadedImages = (payload as any).__downloadedImages as Array<{ url: string; base64: string; mimeType: string }> | undefined;
        const imagePlaceholders = new Map<string, { base64: string; mimeType: string }>();

        if (downloadedImages && downloadedImages.length > 0) {
          console.log('[toutiao] 处理图片 - 使用占位符替代所有预下载图片链接', { count: downloadedImages.length });

          let imageIndex = 0;
          const replacements: Array<{ url: string; placeholder: string }> = [];
          for (const img of downloadedImages) {
            if (img.url) {
              imageIndex++;
              const placeholder = `【图片${imageIndex}】`;
              imagePlaceholders.set(placeholder, { base64: img.base64, mimeType: img.mimeType });
              replacements.push({ url: img.url, placeholder });

              // 替换 HTML 中的图片为占位符
              const mdPattern = new RegExp(
                `!\\[[^\\]]*\\]\\(\\s*${img.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`,
                'g'
              );
              html = html.replace(mdPattern, placeholder);
              console.log('[toutiao] Replaced image with placeholder:', img.url, '->', placeholder);
            }
          }
          html = replaceHtmlImagesWithPlaceholdersLocal(html, replacements);

          console.log('[toutiao] Created', imagePlaceholders.size, 'image placeholders');
        }

        // 1) 填充标题 - 头条使用 textarea
        if (titleText) {
          const titleInput = await waitForBestCandidate(
            [
              '.publish-title textarea',
              '.publish-title input',
              '.article-title textarea',
              '.article-title input',
              'textarea[placeholder*="标题"]',
              'input[placeholder*="标题"]',
              '[aria-label*="标题"]',
              '[data-placeholder*="标题"]',
              '[name*="title"]',
              '.ProseMirror-title',
              'textarea',
              'input',
            ],
            (_el, meta) => scoreTitleCandidateLocal(meta),
            '头条标题输入框',
            15000,
            30
          );

          if (titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement) {
            setNativeValue(titleInput, titleText);
          } else {
            setContentEditableValue(titleInput, titleText);
          }

          const titleValue =
            titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement
              ? titleInput.value
              : titleInput.textContent || '';
          if (titleValue.trim().length < Math.max(1, Math.floor(titleText.length * 0.75))) {
            throw new Error('头条标题未能成功填充');
          }
          console.log('[toutiao] 标题填充成功:', titleText);
          await sleep(200);
        }

        // 2) 等待编辑器加载
        await sleep(500);

        // 3) 填充正文 - 头条使用 ProseMirror 富文本编辑器
        const editor = await waitForBestCandidate(
          [
            '.article-editor .ProseMirror',
            '.publish-content .ProseMirror',
            '.editor-inner .ProseMirror',
            '.ProseMirror',
            '.ProseMirror [contenteditable="true"]',
            '[role="textbox"][contenteditable="true"]',
          ],
          (_el, meta) => scoreEditorCandidateLocal(meta),
          '头条正文编辑器',
          20000,
          60
        );

        editor.focus();

        const contentToFill = html || markdown.replace(/\n/g, '<br>');
        const plainText = extractPlainText(contentToFill) || markdown;
        const bodyFilled = await fillEditorHtml(editor, contentToFill, plainText);

        if (!bodyFilled) {
          const state = getEditorState(editor);
          throw new Error(`头条正文未能成功填充，实际文本长度 ${state.textLength}`);
        }

        console.log('[toutiao] 内容填充成功');

        if (imagePlaceholders.size > 0) {
          console.log('[toutiao] 开始在占位符位置插入图片', { count: imagePlaceholders.size });
          await sleep(1000);

          for (const [placeholder, imageData] of imagePlaceholders) {
            console.log('[toutiao] Processing placeholder:', placeholder);
            await findAndReplacePlaceholder(editor, placeholder, imageData);
            await sleep(500);
          }

          console.log('[toutiao] All image placeholders processed');
        }

        await sleep(300);
        return { editUrl: window.location.href, url: window.location.href } as any;
      } catch (error: any) {
        console.error('[toutiao] Error:', error);
        return {
          url: window.location.href,
          __synccasterError: {
            message: error?.message || String(error),
            stack: error?.stack,
          },
        } as any;
      }
    },
  },
};
