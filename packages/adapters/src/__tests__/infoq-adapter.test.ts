import { describe, expect, it } from 'vitest';
import { buildInfoqDraftUrl, isInfoqDraftEditorUrl } from '../infoq';

describe('infoq adapter draft routing', () => {
  it('builds and validates concrete draft editor urls', () => {
    expect(buildInfoqDraftUrl('12345')).toBe('https://xie.infoq.cn/draft/12345');
    expect(isInfoqDraftEditorUrl('https://xie.infoq.cn/draft/12345')).toBe(true);
    expect(isInfoqDraftEditorUrl('https://xie.infoq.cn/')).toBe(false);
    expect(buildInfoqDraftUrl('')).toBeNull();
  });
});
