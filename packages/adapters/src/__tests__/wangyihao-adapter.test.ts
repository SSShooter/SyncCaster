import { describe, expect, it } from 'vitest';
import {
  replaceWangyihaoPlaceholderText,
  scoreWangyihaoEditorCandidate,
  scoreWangyihaoTitleCandidate,
  wangyihaoAdapter,
} from '../wangyihao';

describe('wangyihao adapter candidate scoring', () => {
  it('prefers explicit title fields over Draft.js content regions for标题', () => {
    const titleScore = scoreWangyihaoTitleCandidate({
      tagName: 'TEXTAREA',
      placeholder: '请输入标题',
      className: 'netease-textarea',
      width: 720,
      height: 52,
    });
    const editorScore = scoreWangyihaoTitleCandidate({
      tagName: 'DIV',
      className: 'public-DraftEditor-content',
      width: 980,
      height: 680,
      textLength: 360,
    });

    expect(titleScore).toBeGreaterThan(editorScore);
  });

  it('prefers Draft.js editable descendants over title-ish nodes for正文', () => {
    const bodyScore = scoreWangyihaoEditorCandidate({
      tagName: 'DIV',
      className: 'public-DraftEditor-content DraftEditor-editorContainer',
      role: 'textbox',
      width: 980,
      height: 680,
      textLength: 340,
    });
    const titleScore = scoreWangyihaoEditorCandidate({
      tagName: 'DIV',
      className: 'article-title',
      width: 760,
      height: 60,
      textLength: 24,
    });

    expect(bodyScore).toBeGreaterThan(titleScore);
  });

  it('prefers current article title inputs over generic editor wrappers', () => {
    const titleScore = scoreWangyihaoTitleCandidate({
      tagName: 'TEXTAREA',
      className: 'article-title netease-textarea',
      placeholder: '请输入标题',
      width: 720,
      height: 52,
    });
    const wrapperScore = scoreWangyihaoTitleCandidate({
      tagName: 'DIV',
      className: 'article-editor public-DraftEditor-content',
      width: 980,
      height: 680,
      textLength: 360,
    });

    expect(titleScore).toBeGreaterThan(wrapperScore);
  });

  it('keeps fillAndPublish self-contained for injected execution', () => {
    const source = String(wangyihaoAdapter.dom?.fillAndPublish || '');
    expect(source).toContain('scoreTitleCandidateLocal');
    expect(source).toContain('scoreEditorCandidateLocal');
    expect(source).toContain('replaceHtmlImagesWithPlaceholdersLocal');
    expect(source).toContain('placeCaretForPlaceholder');
    expect(source).not.toContain('scoreWangyihaoTitleCandidate(meta)');
    expect(source).not.toContain('scoreWangyihaoEditorCandidate(meta)');
    expect(source).not.toContain('replaceHtmlImagesWithPlaceholders(html');
    expect(source).not.toContain('replaceWangyihaoPlaceholderText(');
    expect(source).not.toContain('(imageInput as any).files = dt.files');
  });

  it('removes placeholder paragraphs after image replacement', () => {
    const html = '<p>before</p><p>[[SC_IMG_2]]</p><p>after</p>';
    expect(replaceWangyihaoPlaceholderText(html, '[[SC_IMG_2]]', '')).toBe('<p>before</p><p>after</p>');
  });

  it('removes placeholder blocks wrapped by span nodes after image replacement', () => {
    const html = '<div><span>[[SC_IMG_2]]</span></div><p>after</p>';
    expect(replaceWangyihaoPlaceholderText(html, '[[SC_IMG_2]]', '')).toBe('<p>after</p>');
  });
});
