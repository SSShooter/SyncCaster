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

  it('cleans bot leftovers, decorative symbols, and mechanical markdown marks', () => {
    const result = preCleanAiCliches([
      '当然！以下是我为你整理的内容：',
      '✅ **值得一提的是**，这个工具起到了至关重要的作用。',
      '希望这内容对你有帮助。',
    ].join('\n'));

    expect(result).not.toContain('当然');
    expect(result).not.toContain('以下是');
    expect(result).not.toContain('✅');
    expect(result).not.toContain('**');
    expect(result).not.toContain('值得一提的是');
    expect(result).not.toContain('起到了至关重要的作用');
    expect(result).not.toContain('希望这内容对你有帮助');
  });

  it('normalizes Chinese punctuation without touching URLs or decimal numbers', () => {
    const result = preCleanAiCliches('版本 1.2 已发布, 详情见 https://example.com/a,b. 好吗? 可以!');

    expect(result).toContain('版本 1.2 已发布，');
    expect(result).toContain('https://example.com/a,b.');
    expect(result).toContain('好吗？ 可以！');
  });

  it('keeps markdown tables and fenced code blocks stable', () => {
    const result = preCleanAiCliches([
      '| 字段 | 说明 |',
      '| --- | --- |',
      '| url | https://example.com/a,b |',
      '```ts',
      'const text = "值得注意的是, do not touch";',
      '```',
    ].join('\n'));

    expect(result).toContain('| url | https://example.com/a,b |');
    expect(result).toContain('const text = "值得注意的是, do not touch";');
  });
});
