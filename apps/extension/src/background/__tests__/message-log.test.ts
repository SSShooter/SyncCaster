import { describe, expect, it } from 'vitest';
import { sanitizeMessageForLog } from '../message-log';

describe('sanitizeMessageForLog', () => {
  it('redacts API keys from AI save config messages', () => {
    const message = {
      type: 'AI_SAVE_CONFIG',
      data: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-secret',
        nested: {
          apiKey: 'sk-nested',
        },
      },
    };

    expect(sanitizeMessageForLog(message)).toEqual({
      type: 'AI_SAVE_CONFIG',
      data: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '[REDACTED]',
        nested: {
          apiKey: '[REDACTED]',
        },
      },
    });
    expect(message.data.apiKey).toBe('sk-secret');
  });

  it('keeps non-secret message fields for diagnostics', () => {
    expect(sanitizeMessageForLog({
      type: 'SAVE_POST',
      data: { title: 'Hello' },
    })).toEqual({
      type: 'SAVE_POST',
      data: { title: 'Hello' },
    });
  });
});
