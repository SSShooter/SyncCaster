import { describe, expect, it, vi } from 'vitest';
import { generateRewriteCandidates, parseRewriteCandidates } from '../rewrite';

describe('parseRewriteCandidates', () => {
  it('parses plain JSON candidate arrays', () => {
    const result = parseRewriteCandidates(JSON.stringify({
      candidates: [
        { title: 'New title', bodyMd: '# Body', summary: 'Short', rationale: 'Clearer', style: 'balanced' },
      ],
    }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'New title', bodyMd: '# Body', style: 'balanced' });
    expect(result[0].id).toBeTruthy();
  });

  it('parses fenced JSON candidate arrays', () => {
    const content = [
      '```json',
      '{"candidates":[{"title":"T","bodyMd":"B","style":"less_ai"}]}',
      '```',
    ].join('\n');

    expect(parseRewriteCandidates(content)[0]).toMatchObject({ title: 'T', bodyMd: 'B', style: 'less_ai' });
  });

  it('throws a parse error for invalid model output', () => {
    expect(() => parseRewriteCandidates('not json')).toThrow('AI response was not valid candidate JSON');
  });
});

describe('generateRewriteCandidates', () => {
  it('returns parsed candidates from the provider response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"candidates":[{"title":"Candidate","bodyMd":"Body","style":"balanced"}]}',
            },
          },
        ],
      }),
    });

    const result = await generateRewriteCandidates(
      {
        provider: {
          baseUrl: 'https://api.openai.com',
          apiKey: 'sk-local',
          model: 'gpt-4o-mini',
          temperature: 0.4,
        },
        source: {
          postId: 'post-1',
          title: 'Original',
          bodyMd: 'Original body',
          sourceUrl: 'https://example.com/post',
        },
        style: 'balanced',
        candidateCount: 2,
      },
      fetchImpl
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.raw).toContain('Candidate');
  });
});
