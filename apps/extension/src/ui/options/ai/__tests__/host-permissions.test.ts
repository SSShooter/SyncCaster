import { describe, expect, it, vi } from 'vitest';
import { getAiOriginPattern, requireAiHostPermission } from '../host-permissions';

describe('getAiOriginPattern', () => {
  it('turns configured base URLs into extension origin patterns', () => {
    expect(getAiOriginPattern('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
    expect(getAiOriginPattern('https://example.com/openai/v1')).toBe('https://example.com/*');
    expect(getAiOriginPattern('http://localhost:11434/v1')).toBe('http://localhost/*');
    expect(getAiOriginPattern('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1/*');
    expect(getAiOriginPattern('http://192.168.1.20:11434/v1')).toBe('http://192.168.1.20/*');
  });

  it('rejects non-http URLs', () => {
    expect(() => getAiOriginPattern('file:///tmp/model')).toThrow('AI base URL must start with http:// or https://');
  });
});

describe('requireAiHostPermission', () => {
  it('throws when the user declines AI host access', async () => {
    await expect(requireAiHostPermission('https://api.openai.com/v1', async () => false))
      .rejects
      .toThrow('AI host permission was not granted.');
  });

  it('does nothing when the permission is granted', async () => {
    const requestPermission = vi.fn(async () => true);

    await expect(requireAiHostPermission('https://api.openai.com/v1', requestPermission)).resolves.toBeUndefined();
    expect(requestPermission).toHaveBeenCalledWith('https://api.openai.com/v1');
  });
});
