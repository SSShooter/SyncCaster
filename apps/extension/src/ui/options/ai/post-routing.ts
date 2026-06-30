export function isCollectedPost(post: any): boolean {
  if (post?.meta?.importedFrom) {
    return false;
  }
  const sourceUrl = post?.meta?.source_url || post?.canonicalUrl || post?.source_url || post?.url || '';
  return typeof sourceUrl === 'string' && sourceUrl.trim().length > 0;
}

export function shouldOpenAiRewrite(config: { enabled?: boolean }, post: any): boolean {
  return Boolean(config?.enabled) && isCollectedPost(post);
}
