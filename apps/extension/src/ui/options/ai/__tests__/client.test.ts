import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendAiMessage } from '../client';

describe('sendAiMessage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects when the extension message channel does not respond', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(() => new Promise(() => {})),
      },
    });

    const request = expect(sendAiMessage('AI_GENERATE_CANDIDATES', {}, { timeoutMs: 5 }))
      .rejects
      .toThrow('AI request timed out waiting for the extension background response.');
    await vi.advanceTimersByTimeAsync(5);

    await request;
  });
});
