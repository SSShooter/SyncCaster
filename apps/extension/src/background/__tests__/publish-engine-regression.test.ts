import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyImagePlaceholderMapping,
  applyUrlMappingToRichEditorHtml,
  shouldDownloadImagesBeforeDomFill,
} from '../publish-engine';

describe('publish-engine regressions', () => {
  it('replaces uploaded image urls without dropping surrounding rich text html', () => {
    const original = '<p>Alpha</p><p><img src="https://raw.githubusercontent.com/example/a.png" alt="a"></p><p>Omega</p>';
    const mapped = applyUrlMappingToRichEditorHtml(original, [
      ['https://raw.githubusercontent.com/example/a.png', 'https://i0.hdslb.com/bfs/article/converted.png'],
    ]);

    expect(mapped).toContain('<p>Alpha</p>');
    expect(mapped).toContain('<p>Omega</p>');
    expect(mapped).toContain('https://i0.hdslb.com/bfs/article/converted.png');
    expect(mapped).not.toContain('https://raw.githubusercontent.com/example/a.png');
  });

  it('replaces image placeholders with uploaded platform urls in text content', () => {
    const original = '前文\n[[SC_BILI_IMG_1]]\n后文';
    const mapped = applyImagePlaceholderMapping(original, [
      ['[[SC_BILI_IMG_1]]', 'https://i0.hdslb.com/bfs/article/converted.png'],
    ]);

    expect(mapped).toContain('https://i0.hdslb.com/bfs/article/converted.png');
    expect(mapped).not.toContain('[[SC_BILI_IMG_1]]');
  });

  it('keeps bilibili failures in placeholder mode instead of forcing destructive dom paste fallback', async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(testDir, '../publish-engine.ts'), 'utf8');
    expect(source).toContain('不再回退到站内粘贴上传');
  });

  it('pre-downloads bilibili images before DOM fill so the editor never sees external img tags', () => {
    expect(shouldDownloadImagesBeforeDomFill('dom', 'bilibili', 'domPasteUpload', true)).toBe(true);
    expect(shouldDownloadImagesBeforeDomFill('dom', 'bilibili', 'externalUrlOnly', true)).toBe(true);
    expect(shouldDownloadImagesBeforeDomFill('api', 'bilibili', 'domPasteUpload', true)).toBe(false);
  });
});
