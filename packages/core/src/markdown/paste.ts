/**
 * Markdown 渲染入口（用于平台发布）
 *
 * 此模块是旧 API 的兼容层，内部调用新的 MDH Core 渲染器。
 * 保持原有函数签名不变，调用方无需修改。
 */

import { renderMarkdown, type RenderResult } from '../renderer';

export type RenderMarkdownToHtmlForPasteOptions = {
  /**
   * Strip `$...$` and `$$...$$` wrappers.
   * Useful for platforms that don't support LaTeX rendering.
   */
  stripMath?: boolean;
  /**
   * 强制使用旧渲染器（用于回退）
   */
  forceLegacy?: boolean;
};

const LINKED_IMAGE_RE = /\[\s*!\[([^\]]*)\]\(([^)]+)\)\s*\]\(([^)]+)\)/g;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUrlVariants(url: string): string[] {
  const raw = String(url || '').trim();
  if (!raw) return [];
  const variants = new Set<string>([raw]);
  variants.add(raw.replace(/^https?:\/\//i, '//'));
  variants.add(raw.replace(/^https:\/\//i, 'http://'));
  variants.add(raw.replace(/^http:\/\//i, 'https://'));
  return Array.from(variants).filter(Boolean);
}

export function replaceLinkedMarkdownImagesWithPlainImages(markdown: string): string {
  if (!markdown) return markdown;
  return markdown.replace(LINKED_IMAGE_RE, (_match, alt: string, imageInner: string) => {
    return `![${alt}](${String(imageInner || '').trim()})`;
  });
}

export function replaceHtmlImagesWithPlaceholders(
  html: string,
  replacements: Array<{ url: string; placeholder: string }>
): string {
  let next = html || '';
  if (!next || replacements.length === 0) return next;

  for (const { url, placeholder } of replacements) {
    if (!url || !placeholder) continue;
    for (const variant of buildUrlVariants(url)) {
      const escaped = escapeRegExp(variant);
      const anchorWrappedImage = new RegExp(
        `<a\\b[^>]*>\\s*(?:<span\\b[^>]*>\\s*)?<img\\b[^>]*src=["']${escaped}["'][^>]*>(?:\\s*<\\/span>)?\\s*<\\/a>`,
        'gi'
      );
      const imageOnly = new RegExp(`<img\\b[^>]*src=["']${escaped}["'][^>]*>`, 'gi');
      next = next.replace(anchorWrappedImage, placeholder);
      next = next.replace(imageOnly, placeholder);
    }
  }

  return next;
}

export function stripEmptyHtmlParagraphs(html: string): string {
  if (!html) return html;
  return html
    .replace(/<(p|div)>\s*(?:&nbsp;|\u00A0|<br\s*\/?>|\s)*<\/\1>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 渲染 Markdown 为 HTML（用于平台发布）
 *
 * @param markdown - Markdown 源文本
 * @param options - 渲染选项
 * @returns 渲染后的 HTML 字符串
 */
export function renderMarkdownToHtmlForPaste(
  markdown: string,
  options: RenderMarkdownToHtmlForPasteOptions = {}
): string {
  let md = replaceLinkedMarkdownImagesWithPlainImages(markdown || '');
  md = md.replace(/\r\n/g, '\n');

  // 处理数学公式
  if (options.stripMath) {
    md = md.replace(/\$([^$\n]+)\$/g, '$1');
    md = md.replace(/\$\$([\s\S]+?)\$\$/g, '\n$1\n');
  }

  // 调用新渲染器
  const result = renderMarkdown(md, {
    gfmLineBreaks: false,
    smartypants: true,
    sanitize: true,
    forceLegacy: options.forceLegacy,
  });

  return result.html;
}

/**
 * 渲染 Markdown 为 HTML（带资源信息）
 *
 * @param markdown - Markdown 源文本
 * @param options - 渲染选项
 * @returns 渲染结果，包含 HTML 和资源信息
 */
export function renderMarkdownToHtmlWithAssets(
  markdown: string,
  options: RenderMarkdownToHtmlForPasteOptions = {}
): RenderResult {
  let md = replaceLinkedMarkdownImagesWithPlainImages(markdown || '');
  md = md.replace(/\r\n/g, '\n');

  if (options.stripMath) {
    md = md.replace(/\$([^$\n]+)\$/g, '$1');
    md = md.replace(/\$\$([\s\S]+?)\$\$/g, '\n$1\n');
  }

  return renderMarkdown(md, {
    gfmLineBreaks: false,
    smartypants: true,
    sanitize: true,
    forceLegacy: options.forceLegacy,
  });
}

