import { describe, expect, it } from 'vitest';
import { getManifest } from '../manifest';

describe('extension manifest', () => {
  it('allows optional AI provider permissions for local HTTP hosts', () => {
    const manifest = getManifest('production');

    expect(manifest.optional_host_permissions).toEqual(expect.arrayContaining([
      'https://*/*',
      'http://*/*',
    ]));
  });
});
