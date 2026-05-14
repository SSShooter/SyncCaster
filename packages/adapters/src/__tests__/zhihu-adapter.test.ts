import { describe, expect, it } from 'vitest';
import { shouldPreferZhihuHtmlMode, zhihuAdapter } from '../zhihu';

describe('zhihu adapter content mode', () => {
  it('prefers html mode for fenced code blocks and downloaded images', () => {
    expect(shouldPreferZhihuHtmlMode('```ts\nconsole.log(1)\n```', 0)).toBe(true);
    expect(shouldPreferZhihuHtmlMode('plain text', 2)).toBe(true);
    expect(shouldPreferZhihuHtmlMode('# title\n\nplain text', 0)).toBe(false);
  });

  it('keeps fillAndPublish self-contained without imported markdown helpers', () => {
    const source = String(zhihuAdapter.dom?.fillAndPublish || '');
    expect(source).toContain('replaceLinkedMarkdownImagesWithPlainImagesLocal');
    expect(source).toContain('replaceHtmlImagesWithPlaceholdersLocal');
    expect(source).toContain('shouldPreferZhihuHtmlModeLocal');
    expect(source).toContain('stripEmptyHtmlParagraphsLocal');
    expect(source).not.toContain('replaceLinkedMarkdownImagesWithPlainImages(String');
    expect(source).not.toContain('replaceHtmlImagesWithPlaceholders(contentHtmlProcessed');
    expect(source).not.toContain('shouldPreferZhihuHtmlMode(contentMarkdown');
    expect(source).not.toContain('stripEmptyHtmlParagraphs(String');
  });
});
