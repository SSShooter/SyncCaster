export async function sendAiMessage<T = any>(type: string, data?: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, data });
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
};
