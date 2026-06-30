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
      style: 'less_ai',
      candidateCount: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('Return exactly 3 candidates');
    expect(messages[1].content).toContain('Original title');
    expect(messages[1].content).toContain('Original body');
    expect(messages[1].content).toContain('valid JSON');
  });
});
