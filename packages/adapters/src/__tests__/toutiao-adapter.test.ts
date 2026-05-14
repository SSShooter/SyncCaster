import { describe, expect, it } from 'vitest';
import { scoreToutiaoEditorCandidate, scoreToutiaoTitleCandidate, toutiaoAdapter } from '../toutiao';

describe('toutiao adapter candidate scoring', () => {
  it('prefers title inputs over ProseMirror blocks when filling title', () => {
    const titleScore = scoreToutiaoTitleCandidate({
      tagName: 'TEXTAREA',
      placeholder: '输入标题',
      width: 720,
      height: 52,
    });
    const editorScore = scoreToutiaoTitleCandidate({
      tagName: 'DIV',
      className: 'ProseMirror editor-content',
      width: 980,
      height: 720,
      textLength: 420,
    });

    expect(titleScore).toBeGreaterThan(editorScore);
  });

  it('prefers the large ProseMirror area over title-like contenteditables for正文', () => {
    const bodyScore = scoreToutiaoEditorCandidate({
      tagName: 'DIV',
      className: 'ProseMirror',
      role: 'textbox',
      width: 980,
      height: 720,
      textLength: 320,
    });
    const titleScore = scoreToutiaoEditorCandidate({
      tagName: 'DIV',
      className: 'title-editor',
      width: 760,
      height: 64,
      textLength: 22,
    });

    expect(bodyScore).toBeGreaterThan(titleScore);
  });

  it('prefers current publish title inputs over generic editor wrappers', () => {
    const titleScore = scoreToutiaoTitleCandidate({
      tagName: 'TEXTAREA',
      className: 'publish-title',
      placeholder: '请输入标题',
      width: 700,
      height: 48,
    });
    const wrapperScore = scoreToutiaoTitleCandidate({
      tagName: 'DIV',
      className: 'article-editor publish-content ProseMirror',
      width: 980,
      height: 680,
      textLength: 360,
    });

    expect(titleScore).toBeGreaterThan(wrapperScore);
  });

  it('keeps fillAndPublish self-contained for injected execution', () => {
    const source = String(toutiaoAdapter.dom?.fillAndPublish || '');
    expect(source).toContain('replaceLinkedMarkdownImagesWithPlainImagesLocal');
    expect(source).toContain('scoreTitleCandidateLocal');
    expect(source).toContain('scoreEditorCandidateLocal');
    expect(source).toContain('replaceHtmlImagesWithPlaceholdersLocal');
    expect(source).not.toContain('replaceLinkedMarkdownImagesWithPlainImages(String');
    expect(source).not.toContain('scoreToutiaoTitleCandidate(meta)');
    expect(source).not.toContain('scoreToutiaoEditorCandidate(meta)');
    expect(source).not.toContain('replaceHtmlImagesWithPlaceholders(html');
  });
});
