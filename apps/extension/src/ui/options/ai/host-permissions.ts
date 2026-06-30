export function getAiOriginPattern(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('AI base URL must start with http:// or https://');
  }
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

export async function requestAiHostPermission(baseUrl: string): Promise<boolean> {
  const origin = getAiOriginPattern(baseUrl);
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    return true;
  }
  const hasPermission = await chrome.permissions.contains({ origins: [origin] });
  if (hasPermission) {
    return true;
  }
  return chrome.permissions.request({ origins: [origin] });
}
