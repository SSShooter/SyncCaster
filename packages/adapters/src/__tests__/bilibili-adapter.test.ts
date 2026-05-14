import { describe, expect, it } from 'vitest';
import {
  bilibiliAdapter,
  buildBilibiliImagePlaceholders,
  scoreBilibiliEditorCandidate,
  scoreBilibiliTitleCandidate,
} from '../bilibili';

describe('bilibili adapter candidate scoring', () => {
  it('prefers real title inputs over the body editor when filling title', () => {
    const titleScore = scoreBilibiliTitleCandidate({
      tagName: 'INPUT',
      placeholder: '请输入标题',
      className: 'title-input',
      width: 640,
      height: 48,
      textLength: 0,
    });
    const editorScore = scoreBilibiliTitleCandidate({
      tagName: 'DIV',
      className: 'ql-editor rich-text-editor',
      width: 920,
      height: 640,
      textLength: 320,
    });

    expect(titleScore).toBeGreaterThan(editorScore);
  });

  it('prefers the Quill body editor over contenteditable title nodes for正文', () => {
    const bodyScore = scoreBilibiliEditorCandidate({
      tagName: 'DIV',
      className: 'ql-editor',
      role: 'textbox',
      width: 920,
      height: 640,
      textLength: 260,
    });
    const titleScore = scoreBilibiliEditorCandidate({
      tagName: 'H1',
      className: 'article-title',
      width: 680,
      height: 72,
      textLength: 18,
    });

    expect(bodyScore).toBeGreaterThan(titleScore);
  });

  it('prefers eva3 title inputs over tiptap editor containers', () => {
    const titleScore = scoreBilibiliTitleCandidate({
      tagName: 'TEXTAREA',
      className: 'opus-module-title title-input',
      placeholder: '请输入标题',
      width: 720,
      height: 52,
    });
    const editorScore = scoreBilibiliTitleCandidate({
      tagName: 'DIV',
      className: 'editor-container eva3-web-editor tiptap ProseMirror',
      width: 980,
      height: 720,
      textLength: 420,
    });

    expect(titleScore).toBeGreaterThan(editorScore);
  });

  it('keeps fillAndPublish self-contained without module-scope scorer references', () => {
    const source = String(bilibiliAdapter.dom?.fillAndPublish || '');
    expect(source).toContain('scoreTitleCandidateLocal');
    expect(source).toContain('scoreEditorCandidateLocal');
    expect(source).toContain('replaceHtmlImagesWithPlaceholdersLocal');
    expect(source).toContain('sanitizeHtmlForPasteLocal');
    expect(source).not.toContain('scoreBilibiliTitleCandidate(meta)');
    expect(source).not.toContain('scoreBilibiliEditorCandidate(meta)');
    expect(source).not.toContain('sanitizeBilibiliHtmlForPaste(');
  });

  it('replaces remote images with text placeholders before injecting html', () => {
    const html = '<p>Intro</p><p><img src="https://example.com/a.png" alt="a"></p><p>Outro</p>';
    const result = buildBilibiliImagePlaceholders(html, [{ url: 'https://example.com/a.png' }]);

    expect(result.placeholders).toEqual([{ url: 'https://example.com/a.png', placeholder: '[[SC_BILI_IMG_1]]' }]);
    expect(result.html).toContain('[[SC_BILI_IMG_1]]');
    expect(result.html).not.toContain('https://example.com/a.png');
  });
});
