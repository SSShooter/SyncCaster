import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AI rewrite mode UI', () => {
  it('shows the rewrite mode on the generation page without allowing local selection', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/extension/src/ui/options/views/AiRewrite.vue'),
      'utf8'
    );

    expect(source).not.toContain('v-model:value="selectedRewriteMode"');
    expect(source).toContain('{{ selectedRewriteModeLabel }}');
  });
});
