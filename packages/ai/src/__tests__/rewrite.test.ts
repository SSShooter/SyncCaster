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
        rewritePrompt: {
          id: 'general',
          name: '通用改写',
          prompt: '保持原意，重组表达。',
        },
        candidateCount: 2,
      },
      fetchImpl
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.raw).toContain('Candidate');
  });

  it('passes abort signals to the provider request', async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const request = generateRewriteCandidates(
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
        },
        candidateCount: 1,
        signal: controller.signal,
      },
      fetchImpl as any
    );

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(requestSignal?.aborted).toBe(false);
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: 'canceled' });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('passes the requested humanize level to the provider prompt', async () => {
    let body: any;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Promise.resolve({
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
    });

    await generateRewriteCandidates(
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
        },
        humanizeLevel: 'strong',
        candidateCount: 1,
      },
      fetchImpl as any
    );

    expect(JSON.stringify(body.messages)).toContain('Humanize level: strong');
  });

  it('reports accumulated streaming text before parsing the final candidate', async () => {
    const chunks: string[] = [];
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"{\\"candidates\\":["}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"{\\"title\\":\\"Candidate\\",\\"bodyMd\\":\\"Body\\"}]}"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
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
        },
        candidateCount: 1,
        onStreamChunk: (value) => chunks.push(value),
      },
      fetchImpl as any
    );

    expect(chunks).toEqual([
      '{"candidates":[',
      '{"candidates":[{"title":"Candidate","bodyMd":"Body"}]}',
    ]);
    expect(result.candidates[0]).toMatchObject({ title: 'Candidate', bodyMd: 'Body' });
  });

  it('reports when streaming falls back to a normal provider request', async () => {
    const onStreamFallback = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        body: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"candidates":[{"title":"Fallback","bodyMd":"Body","style":"balanced"}]}',
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
        },
        candidateCount: 1,
        onStreamChunk: vi.fn(),
        onStreamFallback,
      },
      fetchImpl as any
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onStreamFallback).toHaveBeenCalledWith('AI provider did not support streaming. Falling back to normal mode.');
    expect(result.candidates[0]).toMatchObject({ title: 'Fallback', bodyMd: 'Body' });
  });
});
