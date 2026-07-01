export const AI_MESSAGE_TIMEOUT_MS = 130_000;

export async function sendAiMessage<T = any>(
  type: string,
  data?: unknown,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? AI_MESSAGE_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('AI request timed out waiting for the extension background response.'));
    }, timeoutMs);
  });

  const response = await Promise.race([
    chrome.runtime.sendMessage({ type, data }),
    timeoutPromise,
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
  if (!response?.success) {
    throw new Error(response?.error || 'AI request failed');
  }
  return response as T;
}

export const aiClient = {
  getConfig: () => sendAiMessage<{ success: true; config: any }>('AI_GET_CONFIG'),
  saveConfig: (data: any) => sendAiMessage<{ success: true; config: any }>('AI_SAVE_CONFIG', data),
  clearApiKey: () => sendAiMessage<{ success: true; config: any }>('AI_CLEAR_API_KEY'),
  testConnection: () => sendAiMessage<{ success: true }>('AI_TEST_CONNECTION'),
  generateCandidates: (data: any) => sendAiMessage<{ success: true; result: any }>('AI_GENERATE_CANDIDATES', data),
  startRewriteJob: (data: any) => sendAiMessage<{ success: true; requestId: string }>('AI_START_REWRITE_JOB', data),
};
