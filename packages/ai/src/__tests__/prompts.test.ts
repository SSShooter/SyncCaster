import { describe, expect, it } from 'vitest';
import { buildRewriteMessages, buildRewritePromptPreview } from '../prompts';

describe('buildRewriteMessages', () => {
  it('requests JSON with the configured candidate count and source content', () => {
    const messages = buildRewriteMessages({
      source: {
        postId: 'post-1',
        title: 'Original title',
        bodyMd: 'Original body',
        sourceUrl: 'https://example.com/post',
      },
      rewritePrompt: {
        id: 'general',
        name: '通用改写',
        prompt: '请把文章改写得更适合公众号发布。',
      },
      candidateCount: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('remove AI-written flavor');
    expect(messages[1].content).toContain('Return exactly 3 candidates');
    expect(messages[1].content).toContain('Rewrite template: 通用改写');
    expect(messages[1].content).toContain('请把文章改写得更适合公众号发布。');
    expect(messages[1].content).toContain('Original title');
    expect(messages[1].content).toContain('Original body');
    expect(messages[1].content).toContain('valid JSON');
    expect(messages[1].content).toContain('Preserve all numbers, dates, names, links, code blocks, and concrete claims');
    expect(messages[1].content).toContain('Do not summarize the article into a short abstract');
    expect(messages[1].content).toContain('The rewrite prompt controls style and structure only');
    expect(messages[1].content).toContain('Do not add new frameworks, tools, code examples, configuration snippets');
    expect(messages[1].content).toContain('Preserve uncertainty and scope qualifiers');
    expect(messages[0].content).toContain('Do not preserve the source article heading order');
    expect(messages[0].content).not.toContain('Markdown structure');
    expect(messages[1].content).toContain('single online article as reference material');
    expect(messages[1].content).toContain('Avoid copying any non-technical phrase longer than 20 Chinese characters');
  });

  it('can request a single candidate', () => {
    const messages = buildRewriteMessages({
      source: {
        postId: 'post-1',
        title: 'Original title',
        bodyMd: 'Original body',
      },
      candidateCount: 1,
    });

    expect(messages[1].content).toContain('Return exactly 1 candidates');
  });

  it('uses standard humanize instructions by default', () => {
    const messages = buildRewriteMessages({
      source: { postId: 'p1', title: '标题', bodyMd: '正文' },
      candidateCount: 1,
    });

    const content = messages.map((item) => item.content).join('\n');
    expect(content).toContain('Humanize level: standard');
    expect(content).toContain('sentence rhythm');
  });

  it('adds stronger humanize instructions when requested', () => {
    const messages = buildRewriteMessages({
      source: { postId: 'p1', title: '标题', bodyMd: '正文' },
      candidateCount: 1,
      humanizeLevel: 'strong',
    });

    const content = messages.map((item) => item.content).join('\n');
    expect(content).toContain('Humanize level: strong');
    expect(content).toContain('more aggressive');
  });

  it('adds segment-only instructions when segment metadata is provided', () => {
    const messages = buildRewriteMessages({
      source: { postId: 'p1', title: '标题', bodyMd: '第二段正文' },
      candidateCount: 1,
      segment: {
        index: 1,
        total: 3,
      },
    });

    const content = messages.map((item) => item.content).join('\n');
    expect(content).toContain('Segment 2 of 3');
    expect(content).toContain('Rewrite only this segment');
    expect(content).toContain('Do not add a full-article introduction or conclusion');
  });

  it('formats the full readonly prompt preview from the final messages', () => {
    const preview = buildRewritePromptPreview({
      source: {
        postId: 'preview',
        title: '示例标题',
        bodyMd: '示例正文',
        sourceUrl: 'https://example.com/source',
      },
      rewritePrompt: {
        id: 'wechat',
        name: '公众号',
        prompt: '面向公众号读者重写，开头更自然。',
      },
      humanizeLevel: 'strong',
      candidateCount: 2,
    });

    expect(preview).toContain('### system');
    expect(preview).toContain('You are an editorial rewriting assistant.');
    expect(preview).toContain('### user');
    expect(preview).toContain('Rewrite template: 公众号');
    expect(preview).toContain('Humanize level: strong');
    expect(preview).toContain('Return exactly 2 candidates.');
    expect(preview).toContain('Original Markdown:');
  });
});
