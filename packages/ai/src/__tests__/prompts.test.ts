import { describe, expect, it } from 'vitest';
import { buildRewriteMessages } from '../prompts';

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
});
