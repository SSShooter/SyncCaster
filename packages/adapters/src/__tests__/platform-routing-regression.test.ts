import { describe, expect, it } from 'vitest';
import { oschinaAdapter } from '../oschina';
import { baijiahaoAdapter } from '../baijiahao';
import { scoreBaijiahaoBodyCandidate, scoreBaijiahaoTitleCandidate } from '../baijiahao';
import { getImageStrategy } from '@synccaster/core';

describe('platform routing regressions', () => {
  it('uses the ai-write editor route for OSChina', () => {
    expect(oschinaAdapter.dom?.getEditorUrl?.('oschina-9580420')).toBe(
      'https://my.oschina.net/u/9580420/blog/ai-write'
    );
    expect(oschinaAdapter.dom?.getEditorUrl?.('oschina_9580420')).toBe(
      'https://my.oschina.net/u/9580420/blog/ai-write'
    );
    expect(oschinaAdapter.dom?.getEditorUrl?.()).toBe('https://my.oschina.net/blog/ai-write');
    expect(getImageStrategy('oschina')?.domPasteConfig?.editorUrl).toBe('https://my.oschina.net/blog/ai-write');
  });

  it('scores explicit Baijiahao title containers above body editors', () => {
    const titleScore = scoreBaijiahaoTitleCandidate({
      className: 'client_components_titleInput',
      parentClassName: 'title-wrap',
      placeholder: '请输入标题（5-30个字）',
      tagName: 'DIV',
      width: 760,
      height: 56,
      textLength: 0,
    });
    const bodyScore = scoreBaijiahaoTitleCandidate({
      className: 'public-DraftEditor-content content-editor',
      parentClassName: 'editor-shell',
      tagName: 'DIV',
      width: 980,
      height: 680,
      textLength: 220,
    });

    expect(titleScore).toBeGreaterThan(bodyScore);
  });

  it('scores real Baijiahao body editors above title-only contenteditable nodes', () => {
    const bodyScore = scoreBaijiahaoBodyCandidate({
      className: 'article-editor rich-editor content-editor',
      parentClassName: 'editor-shell',
      tagName: 'DIV',
      role: 'textbox',
      width: 980,
      height: 680,
      textLength: 240,
    });
    const titleScore = scoreBaijiahaoBodyCandidate({
      className: 'client_components_titleInput title-wrap',
      parentClassName: 'title-container',
      tagName: 'DIV',
      width: 760,
      height: 56,
      textLength: 18,
    });

    expect(bodyScore).toBeGreaterThan(titleScore);
  });

  it('keeps baijiahao fillAndPublish self-contained for injected execution', () => {
    const source = String(baijiahaoAdapter.dom?.fillAndPublish || '');
    expect(source).toContain('scoreTitleCandidateLocal');
    expect(source).toContain('scoreBodyCandidateLocal');
    expect(source).toContain('isLikelyBodyCandidateLocal');
    expect(source).not.toContain('scoreBaijiahaoTitleCandidate(');
    expect(source).not.toContain('scoreBaijiahaoBodyCandidate(');
    expect(source).not.toContain('isLikelyBaijiahaoBodyCandidate(');
  });
});
