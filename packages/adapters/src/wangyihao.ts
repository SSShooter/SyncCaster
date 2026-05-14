import type { PlatformAdapter } from './base';
import {
  renderMarkdownToHtmlForPaste,
  replaceLinkedMarkdownImagesWithPlainImages,
  replaceHtmlImagesWithPlaceholders,
} from '@synccaster/core';

export interface WangyihaoEditableCandidateMeta {
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

const wangyihaoMetaHaystack = (meta: WangyihaoEditableCandidateMeta) =>
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

export function scoreWangyihaoTitleCandidate(meta: WangyihaoEditableCandidateMeta): number {
  const haystack = wangyihaoMetaHaystack(meta);
  const tagName = String(meta.tagName || '').toLowerCase();
  const height = meta.height || 0;
  let score = 0;

  if (tagName === 'input' || tagName === 'textarea') score += 90;
  if (/标题|title|headline/.test(haystack)) score += 170;
  if (/article-title|title-input|netease-textarea|headline/.test(haystack)) score += 120;
  if (/drafteditor|public-drafteditor|editor|content/.test(haystack)) score -= 200;
  if (height > 140) score -= 50;
  if ((meta.textLength || 0) > 140) score -= 70;

  return score;
}

export function scoreWangyihaoEditorCandidate(meta: WangyihaoEditableCandidateMeta): number {
  const haystack = wangyihaoMetaHaystack(meta);
  const tagName = String(meta.tagName || '').toLowerCase();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const area = width * height;
  let score = 0;

  if (/drafteditor|public-drafteditor/.test(haystack)) score += 220;
  if (/drafteditor-root|editorcontainer|article-editor|rich-editor/.test(haystack)) score += 160;
  if (/editor|content|textbox|article|write/.test(haystack)) score += 80;
  if (/title|标题|headline/.test(haystack)) score -= 240;
  if (tagName === 'input' || tagName === 'textarea') score -= 260;
  score += Math.min(180, Math.round(area / 2500));
  score += Math.min(40, Math.round((meta.textLength || 0) / 50));

  return score;
}

export function replaceWangyihaoPlaceholderText(
  html: string,
  placeholder: string,
  replacementHtml: string
): string {
  if (!html || !placeholder) return html || '';
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(html)
    .replace(new RegExp(`<(?:p|div)[^>]*>\\s*(?:<span[^>]*>\\s*)*${escaped}(?:\\s*<\\/span>)*\\s*<\\/(?:p|div)>`, 'gi'), replacementHtml)
    .replace(new RegExp(escaped, 'g'), replacementHtml)
    .replace(/<(?:p|div)[^>]*>\s*<\/(?:p|div)>/gi, '');
}

/**
 * 网易号适配器
 *
 * 平台特点：
 * - 入口：https://mp.163.com/
 * - 编辑器：Draft.js 富文本编辑器
 * - 不支持：Markdown 识别、表格、数学公式、超链接、代码块
 *
 * 发布策略：
 * - 将 Markdown 转换为简化的 HTML 格式
 * - 使用模拟粘贴事件注入内容（Draft.js 需要通过粘贴事件来正确处理内容）
 * - 不执行最终发布操作，由用户手动完成
 *
 * 已知限制：
 * - 网易号 Draft.js 编辑器对 HTML 粘贴支持有限
 * - 不支持超链接（<a> 标签会被忽略）
 * - 不支持代码块（会被转为普通文本）
 */

export const wangyihaoAdapter: PlatformAdapter = {
  id: 'wangyihao',
  name: '网易号',
  kind: 'dom',
  icon: 'wangyihao',
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
    // 网易号不支持 LaTeX/表格/代码块/超链接等复杂结构
    // 这里做降级处理，转换为网易号能识别的简单格式
    let markdown = replaceLinkedMarkdownImagesWithPlainImages(post.body_md || '');

    // 公式降级：转为纯文本
    markdown = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => `\n${String(expr).trim()}\n`);
    markdown = markdown.replace(/\$([^$\n]+)\$/g, (_m, expr) => String(expr).trim());

    // 代码块降级：转为纯文本（网易号不支持代码块）
    markdown = markdown.replace(/```[\w]*\n([\s\S]*?)```/g, (_m, code) => {
      return '\n' + String(code).trim() + '\n';
    });

    // 行内代码降级：去掉反引号
    markdown = markdown.replace(/`([^`]+)`/g, '$1');

    // 超链接降级：只保留链接文本（网易号不支持超链接）
    // [text](url) -> text
    // 使用负向后行断言 (?<!!) 排除 Markdown 图片语法 ![alt](url)
    markdown = markdown.replace(/(?<!!)\[([^\]]+)\]\([^)]+\)/g, '$1');

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
    throw new Error('wangyihao: use DOM automation');
  },

  dom: {
    matchers: [
      'https://mp.163.com/*',
    ],
    getEditorUrl: () => 'https://mp.163.com/#/article-publish',
    fillAndPublish: async function (payload) {
      // 注意：此函数会被 `chrome.scripting.executeScript({ func })` 注入到目标页面执行。
      // 因此必须"完全自包含"，不能依赖模块作用域的函数/变量，否则会在页面里变成 undefined。
      try {
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const scoreTitleCandidateLocal = (meta: WangyihaoEditableCandidateMeta): number => {
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
          if (/article-title|title-input|netease-textarea|headline/.test(haystack)) score += 120;
          if (/drafteditor|public-drafteditor|editor|content/.test(haystack)) score -= 200;
          if (height > 140) score -= 50;
          if ((meta.textLength || 0) > 140) score -= 70;

          return score;
        };
        const scoreEditorCandidateLocal = (meta: WangyihaoEditableCandidateMeta): number => {
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

          if (/drafteditor|public-drafteditor/.test(haystack)) score += 220;
          if (/drafteditor-root|editorcontainer|article-editor|rich-editor/.test(haystack)) score += 160;
          if (/editor|content|textbox|article|write/.test(haystack)) score += 80;
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

        const normalizeEditableCandidate = (el: HTMLElement) => {
          if (el.getAttribute('contenteditable') === 'true' || (el as any).isContentEditable) {
            return el;
          }
          return (el.querySelector('[contenteditable="true"]') as HTMLElement | null) || el;
        };

        const collectCandidates = (selectors: string[]) => {
          const seen = new Set<HTMLElement>();
          const results: HTMLElement[] = [];
          for (const selector of selectors) {
            const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
            for (const node of nodes) {
              const candidate = normalizeEditableCandidate(node);
              if (!candidate || seen.has(candidate) || !isVisible(candidate)) continue;
              seen.add(candidate);
              results.push(candidate);
            }
          }
          return results;
        };

        const buildMeta = (el: HTMLElement): WangyihaoEditableCandidateMeta => {
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
          scorer: (el: HTMLElement, meta: WangyihaoEditableCandidateMeta) => number,
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

        /**
         * 将 HTML 转换为网易号 Draft.js 编辑器能识别的简化格式
         * 
         * 关键处理：
         * 1. 移除 <li> 内的 <p> 标签（避免多余换行）
         * 2. 移除 <a> 超链接标签（网易号不支持）
         * 3. 移除 <pre><code> 代码块（网易号不支持）
         */
        const normalizeHtmlForWangyihao = (rawHtml: string): string => {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml || '', 'text/html');
            const body = doc.body;

            // 1) 处理列表项：移除 <li> 内的 <p> 标签，直接保留内容
            // 这是导致多余换行的主要原因
            body.querySelectorAll('li').forEach((li) => {
              // 获取 li 内的所有 p 标签
              const paragraphs = li.querySelectorAll('p');
              paragraphs.forEach((p) => {
                // 将 p 的内容移动到 li 中，替换 p
                while (p.firstChild) {
                  p.parentNode?.insertBefore(p.firstChild, p);
                }
                p.remove();
              });
            });

            // 2) 超链接降级：只保留链接文本
            body.querySelectorAll('a').forEach((a) => {
              const text = a.textContent || '';
              const textNode = doc.createTextNode(text);
              a.replaceWith(textNode);
            });

            // 3) 代码块降级：转为普通段落
            body.querySelectorAll('pre').forEach((pre) => {
              const text = (pre.textContent || '').trim();
              const p = doc.createElement('p');
              p.textContent = text;
              pre.replaceWith(p);
            });

            // 4) 行内代码降级：去掉 code 标签，保留文本
            body.querySelectorAll('code').forEach((code) => {
              const text = code.textContent || '';
              const textNode = doc.createTextNode(text);
              code.replaceWith(textNode);
            });

            // 5) 标题降级：转换为粗体段落
            body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
              const text = (h.textContent || '').trim();
              if (!text) {
                h.remove();
                return;
              }
              const p = doc.createElement('p');
              const strong = doc.createElement('strong');
              strong.textContent = text;
              p.appendChild(strong);
              h.replaceWith(p);
            });

            // 6) 表格降级：转为纯文本格式
            body.querySelectorAll('table').forEach((table) => {
              const rows = Array.from(table.querySelectorAll('tr'))
                .map((tr) =>
                  Array.from(tr.children)
                    .map((cell) => (cell.textContent || '').trim())
                    .join(' | ')
                )
                .filter((line) => line.trim().length > 0);
              const p = doc.createElement('p');
              p.textContent = rows.join('\n');
              table.replaceWith(p);
            });

            // 7) 图片处理：
            // - 若图片已在 background 中下载（__downloadedImages），用占位符替换，后续在编辑器中逐个上传并插入
            // - data: URL 仍保留提示，避免 Draft.js 因 base64 过大而崩溃
            body.querySelectorAll('img').forEach((img) => {
              const src = img.getAttribute('src') || '';

              const hit = downloadedByUrl.get(src);
              if (hit) {
                imagePlaceholderCounter += 1;
                const placeholder = `[[SC_IMG_${imagePlaceholderCounter}]]`;
                imagePlaceholders.set(placeholder, {
                  url: src,
                  base64: hit.base64,
                  mimeType: hit.mimeType,
                });
                img.replaceWith(doc.createTextNode(placeholder));
                return;
              }

              if (src.startsWith('local://') || src.startsWith('data:')) {
                const alt = img.getAttribute('alt') || '';
                if (alt) {
                  img.replaceWith(doc.createTextNode(`[图片: ${alt}]`));
                } else {
                  img.remove();
                }
              }
            });

            // 8) 清理空的 p 标签
            body.querySelectorAll('p').forEach((p) => {
              if (!(p.textContent || '').trim() && !p.querySelector('img')) {
                p.remove();
              }
            });

            return body.innerHTML || '';
          } catch (e) {
            console.log('[wangyihao] normalizeHtmlForWangyihao 失败，使用原始 HTML:', e);
            return rawHtml || '';
          }
        };

        /**
         * 将 HTML 转为纯文本
         */
        const htmlToPlainText = (html: string): string => {
          const div = document.createElement('div');
          div.innerHTML = html;
          return (div.innerText || div.textContent || '').trim();
        };

        const getEditorState = (editor: HTMLElement) => ({
          textLength: ((editor.innerText || editor.textContent || '').replace(/\s+/g, ' ').trim() || '').length,
          imageCount: editor.querySelectorAll('img').length,
        });

        const isEditorFilledEnough = (editor: HTMLElement, expectedTextLength: number) => {
          const state = getEditorState(editor);
          const requiredText =
            expectedTextLength <= 0
              ? 0
              : expectedTextLength < 16
                ? Math.max(1, expectedTextLength - 2)
                : Math.floor(expectedTextLength * 0.68);
          const textOk = expectedTextLength === 0 || state.textLength >= requiredText;
          return textOk;
        };

        /**
         * 模拟粘贴 HTML 内容到编辑器
         * 只触发一次粘贴事件，避免重复填充
         */
        const simulatePasteHtml = (target: HTMLElement, html: string, plain: string): boolean => {
          try {
            // 创建 DataTransfer 对象
            const dt: any =
              typeof (window as any).DataTransfer === 'function'
                ? new DataTransfer()
                : {
                    types: ['text/html', 'text/plain'],
                    getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : ''),
                  };

            try {
              dt.setData?.('text/html', html);
              dt.setData?.('text/plain', plain);
            } catch {}

            // 创建粘贴事件
            let evt: Event;
            try {
              evt = new ClipboardEvent('paste', { bubbles: true, cancelable: true } as any);
            } catch {
              evt = new Event('paste', { bubbles: true, cancelable: true });
            }
            
            // 注入 clipboardData
            try {
              Object.defineProperty(evt, 'clipboardData', { get: () => dt });
            } catch {}

            // 只在目标元素上触发一次粘贴事件
            return target.dispatchEvent(evt);
          } catch (e) {
            console.log('[wangyihao] simulatePasteHtml 失败:', e);
            return false;
          }
        };

        const titleText = String((payload as any).title || '').trim();
        let html = String((payload as any).contentHtml || '');
        const markdown = String((payload as any).contentMarkdown || '');

        // 图片数据（base64）由 background 预下载注入（__downloadedImages），
        // 通过“占位符 → 逐张上传插入”避免把大段 base64 直接粘贴进 Draft.js 导致崩溃。
        const downloadedImages = (payload as any).__downloadedImages as Array<{ url: string; base64: string; mimeType: string }> | undefined;
        const downloadedByUrl = new Map<string, { base64: string; mimeType: string }>();
        const imagePlaceholders = new Map<string, { url: string; base64: string; mimeType: string }>();
        const htmlReplacements: Array<{ url: string; placeholder: string }> = [];
        let preassignedIndex = 0;
        for (const img of downloadedImages || []) {
          if (!img?.url || !img?.base64) continue;
          downloadedByUrl.set(img.url, { base64: img.base64, mimeType: img.mimeType || 'image/png' });
          preassignedIndex += 1;
          const placeholder = `[[SC_IMG_${preassignedIndex}]]`;
          htmlReplacements.push({ url: img.url, placeholder });
          imagePlaceholders.set(placeholder, {
            url: img.url,
            base64: img.base64,
            mimeType: img.mimeType || 'image/png',
          });
        }
        let imagePlaceholderCounter = preassignedIndex;
        html = replaceHtmlImagesWithPlaceholdersLocal(html, htmlReplacements);

        console.log('[wangyihao] 开始填充内容，标题:', titleText?.substring(0, 20));

        // 等待页面加载完成
        await sleep(2000);

        // 1) 填充标题
        if (titleText) {
          const titleInput = await waitForBestCandidate(
            [
              '.article-title textarea',
              '.article-title input',
              '.title-input textarea',
              '.title-input input',
              'textarea.netease-textarea',
              'textarea[placeholder*="标题"]',
              'input[placeholder*="标题"]',
              '[aria-label*="标题"]',
              '[name*="title"]',
              'textarea',
              'input',
            ],
            (_el, meta) => scoreTitleCandidateLocal(meta),
            '网易号标题输入框',
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
            throw new Error('网易号标题未能成功填充');
          }
          console.log('[wangyihao] 标题填充成功');
          await sleep(500);
        }

        // 2) 等待编辑器加载
        await sleep(1000);

        // 3) 填充正文 - 网易号使用 Draft.js 编辑器
        const rawContentHtml = html || markdown.replace(/\n/g, '<br>');
        const contentHtml = normalizeHtmlForWangyihao(rawContentHtml);
        const plainText = htmlToPlainText(contentHtml);
        console.log('[wangyihao] 准备填充内容，HTML 长度:', contentHtml.length);
        console.log('[wangyihao] 处理后的 HTML:', contentHtml.substring(0, 500));

        // 查找 Draft.js 编辑器
        const editor = await waitForBestCandidate(
          [
            '.article-editor .public-DraftEditor-content [contenteditable="true"]',
            '.article-editor .DraftEditor-root [contenteditable="true"]',
            '.DraftEditor-root [contenteditable="true"]',
            '.DraftEditor-editorContainer [contenteditable="true"]',
            '.public-DraftEditor-content [contenteditable="true"]',
            '.public-DraftEditor-content',
            '[data-contents="true"]',
            '[role="textbox"][contenteditable="true"]',
          ],
            (_el, meta) => scoreEditorCandidateLocal(meta),
          '网易号正文编辑器',
          30000,
          60
        );

        if (editor) {
          // 聚焦编辑器
          editor.focus();
          await sleep(200);

          // 点击编辑器以确保激活
          try {
            const rect = editor.getBoundingClientRect();
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + 30,
            });
            editor.dispatchEvent(clickEvent);
          } catch {}
          await sleep(200);

          // 确保光标在编辑器内
          try {
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              const range = document.createRange();
              range.selectNodeContents(editor);
              range.collapse(false);
              selection.addRange(range);
            }
          } catch {}
          await sleep(100);

          console.log('[wangyihao] 编辑器已聚焦，开始填充内容');

          const expectedTextLength = plainText.trim().length;
          let filled = false;

          const fillStrategies = [
            async () => {
              clearEditable(editor);
              simulatePasteHtml(editor, contentHtml, plainText);
              await sleep(500);
            },
            async () => {
              clearEditable(editor);
              editor.focus();
              const inserted = document.execCommand('insertHTML', false, contentHtml);
              if (!inserted) {
                editor.innerHTML = contentHtml;
              }
              try {
                editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
              } catch {
                editor.dispatchEvent(new Event('input', { bubbles: true }));
              }
              editor.dispatchEvent(new Event('change', { bubbles: true }));
              await sleep(350);
            },
            async () => {
              clearEditable(editor);
              editor.innerHTML = contentHtml;
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
              await sleep(300);
            },
          ];

          for (const strategy of fillStrategies) {
            try {
              await strategy();
              if (isEditorFilledEnough(editor, expectedTextLength)) {
                const state = getEditorState(editor);
                console.log('[wangyihao] 正文填充成功，内容长度:', state.textLength);
                filled = true;
                break;
              }
            } catch (e) {
              console.log('[wangyihao] 正文填充策略失败:', e);
            }
          }

          // 4) 图片：在占位符位置逐张上传并插入
          if (filled && imagePlaceholders.size > 0) {
            console.log('[wangyihao] 检测到图片占位符，开始上传替换', { count: imagePlaceholders.size });

            const mimeToExt = (mime: string) => {
              const m = (mime || '').toLowerCase();
              if (m.includes('png')) return 'png';
              if (m.includes('gif')) return 'gif';
              if (m.includes('webp')) return 'webp';
              return 'jpg';
            };

            const collectImageUrls = (root: HTMLElement): string[] => {
              const urls: string[] = [];
              root.querySelectorAll('img').forEach((img) => {
                const src = (img as HTMLImageElement).src || img.getAttribute('src') || '';
                if (src) urls.push(src);
              });
              return urls;
            };

            const waitForNewImageUrl = async (
              root: HTMLElement,
              beforeUrls: Set<string>,
              timeoutMs = 25000
            ): Promise<{ url: string | null; isBlob: boolean }> => {
              const checkOnce = (): { url: string | null; isBlob: boolean } => {
                const urls = collectImageUrls(root);
                for (const u of urls) {
                  if (!beforeUrls.has(u)) return { url: u, isBlob: u.startsWith('blob:') || u.startsWith('data:') };
                }
                return { url: null, isBlob: false };
              };

              const first = checkOnce();
              if (first.url) return first;

              return await new Promise((resolve) => {
                let timer: any;
                const observer = new MutationObserver(() => {
                  const r = checkOnce();
                  if (r.url) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(r);
                  }
                });

                observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
                timer = setTimeout(() => {
                  observer.disconnect();
                  resolve({ url: null, isBlob: false });
                }, timeoutMs);
              });
            };

            const uploadImageAtCursor = async (base64: string, mimeType: string) => {
              try {
                const blobResp = await fetch(base64);
                const blob = await blobResp.blob();
                const ext = mimeToExt(blob.type || mimeType || 'image/png');
                const file = new File([blob], `image_${Date.now()}.${ext}`, { type: blob.type || mimeType || 'image/png' });

                const beforeUrls = new Set(collectImageUrls(editor));
                const dt = new DataTransfer();
                dt.items.add(file);

                const rect = editor.getBoundingClientRect();
                const clientX = rect.left + rect.width / 2;
                const clientY = rect.top + Math.min(80, rect.height / 2);

                const tryDrop = () => {
                  try {
                    const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY } as any);
                    Object.defineProperty(dragOver, 'dataTransfer', { get: () => dt });
                    editor.dispatchEvent(dragOver);

                    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY } as any);
                    Object.defineProperty(dropEvent, 'dataTransfer', { get: () => dt });
                    editor.dispatchEvent(dropEvent);
                    return true;
                  } catch {
                    return false;
                  }
                };

                const tryPaste = () => {
                  try {
                    const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true } as any);
                    Object.defineProperty(pasteEvent, 'clipboardData', { get: () => dt });
                    editor.dispatchEvent(pasteEvent);
                    return true;
                  } catch {
                    return false;
                  }
                };

                editor.focus();
                await sleep(80);

                // 优先 paste，尽量复用与头条/知乎一致的上传路径；不行再退回 drop
                tryPaste();
                let result = await waitForNewImageUrl(editor, beforeUrls, 20000);

                if (!result.url) {
                  tryDrop();
                  result = await waitForNewImageUrl(editor, beforeUrls, 20000);
                }

                return result;
              } catch (e) {
                console.log('[wangyihao] uploadImageAtCursor 失败:', e);
                return { url: null, isBlob: false };
              }
            };

            const removePlaceholderFromEditor = (root: HTMLElement, placeholder: string) => {
              let changed = false;
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
              let textNode: Text | null;
              while ((textNode = walker.nextNode() as Text | null)) {
                if (!textNode?.textContent?.includes(placeholder)) continue;
                textNode.textContent = textNode.textContent.split(placeholder).join('');
                changed = true;
              }

              if (changed) {
                root.normalize();
                root.dispatchEvent(new Event('input', { bubbles: true }));
                root.dispatchEvent(new Event('change', { bubbles: true }));
              }

              return changed;
            };

            const placeCaretForPlaceholder = async (placeholder: string) => {
              const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
              let node: Text | null;
              while ((node = walker.nextNode() as Text)) {
                const text = node.textContent || '';
                const idx = text.indexOf(placeholder);
                if (idx === -1) continue;

                editor.focus();
                await sleep(80);

                const range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, idx + placeholder.length);

                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                await sleep(80);

                try {
                  document.execCommand('delete', false);
                } catch {}
                await sleep(120);
                return true;
              }

              return false;
            };

            const replacePlaceholderWithImage = async (
              placeholder: string,
              image: { url: string; base64: string; mimeType: string }
            ) => {
              const placed = await placeCaretForPlaceholder(placeholder);
              if (!placed) return false;

              const result = await uploadImageAtCursor(image.base64, image.mimeType);
              if (result.url) {
                try {
                  removePlaceholderFromEditor(editor, placeholder);
                } catch {}
                return true;
              }

              // 失败时恢复占位符，避免内容丢失
              try {
                document.execCommand('insertText', false, placeholder);
              } catch {}
              return false;
            };

            let success = 0;
            let failed = 0;
            for (const [placeholder, image] of imagePlaceholders) {
              console.log('[wangyihao] 处理占位符:', placeholder, image.url);
              const ok = await replacePlaceholderWithImage(placeholder, image);
              if (ok) success += 1;
              else failed += 1;
              await sleep(500);
            }

            console.log('[wangyihao] 图片替换完成', { success, failed });
            if (failed > 0) {
              const toast = document.createElement('div');
              toast.style.cssText =
                'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;z-index:999999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
              toast.textContent = `网易号图片自动上传部分失败（成功 ${success} / 失败 ${failed}），请检查网络或手动上传替换`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 6500);
            }
          }

          if (!filled) {
            const toast = document.createElement('div');
            toast.style.cssText =
              'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;z-index:999999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
            toast.textContent = '网易号正文自动填充失败：请刷新页面后重试，或从 SyncCaster 复制正文并粘贴到编辑器';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 6500);
            console.log('[wangyihao] 正文自动填充失败');
            throw new Error('网易号正文自动填充失败');
          }

          await sleep(300);
        } else {
          console.log('[wangyihao] 未找到编辑器元素');
        }

        await sleep(300);
        return { editUrl: window.location.href, url: window.location.href } as any;
      } catch (e: any) {
        // 将错误结构化返回给 background
        const err = e instanceof Error ? e : new Error(String(e));
        console.error('[wangyihao] fillAndPublish failed', err);
        return {
          __synccasterError: {
            message: err.message || String(e),
            stack: err.stack || '',
          },
        } as any;
      }
    },
  },
};
