import { describe, expect, it } from 'vitest';
import {
  mergeSegmentCandidates,
  shouldSegmentMarkdown,
  splitMarkdownIntoSegments,
} from '../segmentation';

describe('splitMarkdownIntoSegments', () => {
  it('splits markdown on paragraph boundaries while preserving order', () => {
    const markdown = [
      '第一段内容'.repeat(20),
      '',
      '第二段内容'.repeat(20),
      '',
      '第三段内容'.repeat(20),
    ].join('\n');

    const segments = splitMarkdownIntoSegments(markdown, { targetChars: 90, thresholdChars: 100 });

    expect(segments).toHaveLength(3);
    expect(segments.map((item) => item.index)).toEqual([0, 1, 2]);
    expect(segments.map((item) => item.total)).toEqual([3, 3, 3]);
    expect(segments[0].bodyMd).toContain('第一段内容');
    expect(segments[1].bodyMd).toContain('第二段内容');
    expect(segments[2].bodyMd).toContain('第三段内容');
  });

  it('keeps fenced code blocks inside one segment', () => {
    const markdown = [
      '开头说明'.repeat(20),
      '',
      '```ts',
      'const value = "不要切开代码块";',
      'console.log(value);',
      '```',
      '',
      '结尾说明'.repeat(20),
    ].join('\n');

    const segments = splitMarkdownIntoSegments(markdown, { targetChars: 80, thresholdChars: 100 });

    const codeSegments = segments.filter((item) => item.bodyMd.includes('不要切开代码块'));
    expect(codeSegments).toHaveLength(1);
    expect(codeSegments[0].bodyMd).toContain('```ts');
    expect(codeSegments[0].bodyMd).toContain('```');
  });
});

describe('shouldSegmentMarkdown', () => {
  it('segments only when markdown is over the configured threshold', () => {
    expect(shouldSegmentMarkdown('短文', { thresholdChars: 10 })).toBe(false);
    expect(shouldSegmentMarkdown('长文内容'.repeat(10), { thresholdChars: 10 })).toBe(true);
  });
});

describe('mergeSegmentCandidates', () => {
  it('merges rewritten segment bodies into one candidate', () => {
    const candidate = mergeSegmentCandidates({
      title: '原始标题',
      style: 'balanced',
      segments: [
        { title: '第一段标题', bodyMd: '第一段改写', style: 'balanced', summary: '第一段摘要' },
        { title: '第二段标题', bodyMd: '第二段改写', style: 'balanced', rationale: '第二段说明' },
      ],
    });

    expect(candidate).toMatchObject({
      title: '第一段标题',
      bodyMd: ['第一段改写', '第二段改写'].join('\n\n'),
      style: 'balanced',
    });
    expect(candidate.summary).toBe('第一段摘要');
    expect(candidate.rationale).toContain('分段生成');
  });
});
