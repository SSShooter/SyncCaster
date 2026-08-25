export interface OptionsRoute {
  view: string;
  navPath: string;
}

export function resolveOptionsRoute(rawHash: string): OptionsRoute {
  const withoutHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const hash = withoutHash.startsWith('/') ? withoutHash.slice(1) : withoutHash;

  if (!hash) {
    return { view: 'dashboard', navPath: 'dashboard' };
  }
  if (hash.startsWith('ai-rewrite/')) {
    return { view: 'ai-rewrite', navPath: '' };
  }
  if (hash.startsWith('editor/')) {
    return { view: 'editor', navPath: 'editor' };
  }
  return { view: hash, navPath: hash };
}
