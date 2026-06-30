import { describe, expect, it } from 'vitest';
import { getAiOriginPattern } from '../host-permissions';

describe('getAiOriginPattern', () => {
  it('turns configured base URLs into extension origin patterns', () => {
    expect(getAiOriginPattern('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
    expect(getAiOriginPattern('https://example.com/openai/v1')).toBe('https://example.com/*');
    expect(getAiOriginPattern('http://localhost:11434/v1')).toBe('http://localhost/*');
    expect(getAiOriginPattern('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1/*');
  });

  it('rejects non-http URLs', () => {
    expect(() => getAiOriginPattern('file:///tmp/model')).toThrow('AI base URL must start with http:// or https://');
  });
});
