import { describe, expect, it } from 'vitest';
import {
  replaceLinkedMarkdownImagesWithPlainImages,
  replaceHtmlImagesWithPlaceholders,
} from '../paste';

describe('markdown paste regressions', () => {
  it('converts linked markdown images into plain markdown images', () => {
    const input = '[![alt text](https://github.com/example/raw.png)](https://github.com/example/blob.png)';
    expect(replaceLinkedMarkdownImagesWithPlainImages(input)).toBe('![alt text](https://github.com/example/raw.png)');
  });

  it('replaces linked html images with placeholders', () => {
    const html = '<p><a href="https://github.com/example/blob.png"><img src="https://github.com/example/raw.png" alt="img"></a></p>';
    const output = replaceHtmlImagesWithPlaceholders(html, [
      { url: 'https://github.com/example/raw.png', placeholder: '[[IMG_1]]' },
    ]);
    expect(output).toContain('[[IMG_1]]');
    expect(output).not.toContain('https://github.com/example/raw.png');
  });
});
