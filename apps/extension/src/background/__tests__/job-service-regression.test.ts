import { describe, expect, it } from 'vitest';
import { normalizePublishResultError } from '../job-service';

describe('job-service regressions', () => {
  it('normalizes unknown target publish exceptions into a string result', () => {
    expect(normalizePublishResultError(new Error('boom'))).toBe('boom');
    expect(normalizePublishResultError('plain')).toBe('plain');
    expect(normalizePublishResultError({ code: 500, msg: 'explode' })).toContain('"code":500');
  });
});
