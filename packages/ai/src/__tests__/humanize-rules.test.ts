import { describe, expect, it } from 'vitest';
import { preCleanAiCliches } from '../humanize-rules';

describe('preCleanAiCliches', () => {
  it('removes common AI-style filler outside fenced code blocks', () => {
    const result = preCleanAiCliches([
      '值得注意的是，这个方案是显而易见的。',
      '',
      '综上所述，我们可以看到它更适合轻量发布。',
    ].join('\n'));

    expect(result).not.toContain('值得注意的是');
    expect(result).not.toContain('综上所述');
    expect(result).not.toContain('我们可以看到');
    expect(result).toContain('很明显');
  });

  it('does not rewrite text inside fenced code blocks', () => {
    const result = preCleanAiCliches([
      '需要注意的是，这里先说明结论。',
      '```md',
      '值得注意的是，这行是示例内容。',
      '```',
    ].join('\n'));

    expect(result).not.toContain('需要注意的是');
    expect(result).toContain('值得注意的是，这行是示例内容。');
  });
});
