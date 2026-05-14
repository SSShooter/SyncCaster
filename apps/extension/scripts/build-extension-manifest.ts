import { existsSync } from 'fs';
import { resolve } from 'path';

export interface ContentScriptBundle {
  manifestEntry: string;
  outputFile: string;
  globalName: string;
}

const CONTENT_SCRIPT_BUNDLES: ContentScriptBundle[] = [
  {
    manifestEntry: 'src/content-scripts/index.ts',
    outputFile: 'content-scripts.js',
    globalName: 'ContentScript',
  },
  {
    manifestEntry: 'src/content-scripts/juejin-image-paste.ts',
    outputFile: 'juejin-image-paste.js',
    globalName: 'JuejinImagePasteContentScript',
  },
];

type ManifestLike = Record<string, any>;

export function createDistManifest(sourceManifest: ManifestLike): ManifestLike {
  const next = JSON.parse(JSON.stringify(sourceManifest || {}));

  if (next.background?.service_worker) {
    next.background.service_worker = 'background.js';
  }

  if (Array.isArray(next.content_scripts)) {
    const outputByEntry = new Map(
      CONTENT_SCRIPT_BUNDLES.map((bundle) => [bundle.manifestEntry, bundle.outputFile] as const)
    );

    next.content_scripts = next.content_scripts.map((contentScript: any) => ({
      ...contentScript,
      js: Array.isArray(contentScript?.js)
        ? contentScript.js.map((entry: string) => outputByEntry.get(entry) || entry)
        : contentScript?.js,
    }));
  }

  return next;
}

export function getContentScriptBuildEntries(rootDir: string) {
  return CONTENT_SCRIPT_BUNDLES.map((bundle) => ({
    ...bundle,
    entryPoint: resolve(rootDir, bundle.manifestEntry),
    outfile: resolve(rootDir, 'dist', bundle.outputFile),
  })).filter((bundle) => existsSync(bundle.entryPoint));
}

