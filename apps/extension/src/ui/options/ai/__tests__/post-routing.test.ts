import { describe, expect, it } from 'vitest';
import { isCollectedPost, shouldOpenAiRewrite } from '../post-routing';

describe('isCollectedPost', () => {
  it('detects collected posts from source metadata', () => {
    expect(isCollectedPost({ meta: { source_url: 'https://example.com/post' } })).toBe(true);
    expect(isCollectedPost({ canonicalUrl: 'https://example.com/post' })).toBe(true);
  });

  it('does not treat imported or original posts as collected', () => {
    expect(isCollectedPost({ meta: { importedFrom: 'local.md' }, canonicalUrl: '' })).toBe(false);
    expect(isCollectedPost({ title: 'Original', body_md: 'Body' })).toBe(false);
  });
});

describe('shouldOpenAiRewrite', () => {
  it('opens AI rewrite only when enabled and the post is collected', () => {
    expect(shouldOpenAiRewrite({ enabled: true }, { canonicalUrl: 'https://example.com' })).toBe(true);
    expect(shouldOpenAiRewrite({ enabled: false }, { canonicalUrl: 'https://example.com' })).toBe(false);
    expect(shouldOpenAiRewrite({ enabled: true }, { title: 'Original' })).toBe(false);
  });
});
