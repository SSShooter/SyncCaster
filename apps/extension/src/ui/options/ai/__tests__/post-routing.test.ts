import { describe, expect, it } from 'vitest';
import {
  getPostEditHash,
  getPostEditUrl,
  isAiRewriteEligiblePost,
  isCollectedPost,
  shouldOpenAiRewrite,
} from '../post-routing';

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
    expect(shouldOpenAiRewrite({ enabled: true }, { id: 'post-1', canonicalUrl: 'https://example.com' })).toBe(true);
    expect(shouldOpenAiRewrite({ enabled: false }, { id: 'post-1', canonicalUrl: 'https://example.com' })).toBe(false);
  });

  it('opens AI rewrite for saved manual posts when enabled', () => {
    expect(shouldOpenAiRewrite({ enabled: true }, { id: 'post-1', title: 'Original', body_md: 'Body' })).toBe(true);
  });

  it('does not open AI rewrite for imported posts', () => {
    expect(shouldOpenAiRewrite({ enabled: true }, { id: 'post-1', meta: { importedFrom: 'local.md' } })).toBe(false);
  });
});

describe('isAiRewriteEligiblePost', () => {
  it('allows collected and saved manual posts', () => {
    expect(isAiRewriteEligiblePost({ id: 'post-1', canonicalUrl: 'https://example.com' })).toBe(true);
    expect(isAiRewriteEligiblePost({ id: 'post-2', title: 'Original', body_md: 'Body' })).toBe(true);
  });

  it('requires a saved post id', () => {
    expect(isAiRewriteEligiblePost({ title: 'Draft' })).toBe(false);
  });
});

describe('post edit routing', () => {
  it('returns the AI rewrite hash for collected posts when AI is enabled', () => {
    expect(getPostEditHash({ enabled: true }, { id: 'post-1', canonicalUrl: 'https://example.com' })).toBe('ai-rewrite/post-1');
  });

  it('returns the AI rewrite hash for saved manual posts when AI is enabled', () => {
    expect(getPostEditHash({ enabled: true }, { id: 'post-1', title: 'Original', body_md: 'Body' })).toBe('ai-rewrite/post-1');
  });

  it('returns the editor hash when AI is disabled', () => {
    expect(getPostEditHash({ enabled: false }, { id: 'post-1', canonicalUrl: 'https://example.com' })).toBe('editor/post-1');
  });

  it('builds an options page URL for popup draft clicks', () => {
    const url = getPostEditUrl(
      { enabled: true },
      { id: 'post-1', canonicalUrl: 'https://example.com' },
      (path) => `chrome-extension://id/${path}`
    );

    expect(url).toBe('chrome-extension://id/src/ui/options/index.html#/ai-rewrite/post-1');
  });
});
