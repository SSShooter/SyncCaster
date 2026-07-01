import { describe, expect, it } from 'vitest';
import { resolveOptionsRoute } from '../options-route';

describe('resolveOptionsRoute', () => {
  it('shows the AI rewrite page without highlighting AI settings', () => {
    expect(resolveOptionsRoute('ai-rewrite/post-1')).toEqual({
      view: 'ai-rewrite',
      navPath: '',
    });
  });

  it('keeps AI settings highlighted on the AI settings page', () => {
    expect(resolveOptionsRoute('ai-settings')).toEqual({
      view: 'ai-settings',
      navPath: 'ai-settings',
    });
  });
});
