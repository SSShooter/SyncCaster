import { describe, expect, it } from 'vitest';
import manifest from '../../src/manifest';
import { createDistManifest } from '../build-extension-manifest';

describe('build-extension-manifest', () => {
  it('rewrites source manifest paths to dist bundle paths', () => {
    const distManifest = createDistManifest(manifest as any);

    expect(distManifest.background.service_worker).toBe('background.js');
    expect(distManifest.content_scripts[0].js).toEqual(['content-scripts.js']);
    expect(distManifest.content_scripts[1].js).toEqual(['juejin-image-paste.js']);

    const allScriptPaths = [
      distManifest.background.service_worker,
      ...distManifest.content_scripts.flatMap((contentScript: any) => contentScript.js || []),
    ];
    expect(allScriptPaths.every((entry) => !String(entry).endsWith('.ts'))).toBe(true);
  });
});
