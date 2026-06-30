import { describe, expect, it, vi } from 'vitest';
import { runForegroundRewriteCandidates } from '../foreground-rewrite';

const source = {
  postId: 'post-1',
  title: 'Original',
  bodyMd: 'Original body',
  sourceUrl: 'https://example.com/post',
};

const config = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  timeoutMs: 120000,
  candidateCount: 2,
  rewritePrompts: [
    { id: 'general', name: 'General', prompt: 'Rewrite clearly.' },
  ],
  defaultRewritePromptId: 'general',
};

describe('runForegroundRewriteCandidates', () => {
  it('generates candidates one at a time and reports each finished candidate', async () => {
    const generateOneCandidate = vi.fn()
      .mockResolvedValueOnce({
        raw: '{"candidates":[{"title":"One","bodyMd":"Body one","style":"general"}]}',
        candidates: [{ id: 'candidate-1', title: 'One', bodyMd: 'Body one', style: 'general' }],
      })
      .mockResolvedValueOnce({
        raw: '{"candidates":[{"title":"Two","bodyMd":"Body two","style":"general"}]}',
        candidates: [{ id: 'candidate-1', title: 'Two', bodyMd: 'Body two', style: 'general' }],
      });
    const onCandidate = vi.fn();

    const result = await runForegroundRewriteCandidates({
      config,
      apiKey: 'sk-local',
      source,
      rewritePromptId: 'general',
      candidateCount: 2,
      generateOneCandidate,
      onCandidate,
    });

    expect(generateOneCandidate).toHaveBeenCalledTimes(2);
    expect(generateOneCandidate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      candidateIndex: 0,
      provider: expect.objectContaining({ apiKey: 'sk-local' }),
    }));
    expect(onCandidate).toHaveBeenCalledTimes(2);
    expect(onCandidate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      id: 'candidate-1',
      title: 'One',
      bodyMd: 'Body one',
    }));
    expect(onCandidate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      id: 'candidate-2',
      title: 'Two',
      bodyMd: 'Body two',
    }));
    expect(result.candidates.map((item) => item.title)).toEqual(['One', 'Two']);
    expect(result.diagnostics.finishedCount).toBe(2);
  });

  it('uses the configured foreground timeout and emits stage events for the visible UI', async () => {
    const generateOneCandidate = vi.fn().mockResolvedValue({
      raw: '{"candidates":[{"title":"One","bodyMd":"Body one","style":"general"}]}',
      candidates: [{ id: 'candidate-1', title: 'One', bodyMd: 'Body one', style: 'general' }],
    });
    const onEvent = vi.fn();

    await runForegroundRewriteCandidates({
      config,
      apiKey: 'sk-local',
      source,
      rewritePromptId: 'general',
      candidateCount: 1,
      generateOneCandidate,
      onEvent,
    });

    expect(generateOneCandidate).toHaveBeenCalledWith(expect.objectContaining({
      provider: expect.objectContaining({ timeoutMs: 120_000 }),
    }));
    expect(onEvent.mock.calls.map(([event]) => event.stage)).toEqual([
      'started',
      'candidate_started',
      'request_started',
      'response_received',
      'candidate_saved',
      'finished',
    ]);
  });

  it('returns partial candidates and diagnostics when a later candidate fails', async () => {
    const generateOneCandidate = vi.fn()
      .mockResolvedValueOnce({
        raw: '{"candidates":[{"title":"One","bodyMd":"Body one","style":"general"}]}',
        candidates: [{ id: 'candidate-1', title: 'One', bodyMd: 'Body one', style: 'general' }],
      })
      .mockRejectedValueOnce(new Error('provider timeout'));

    const result = await runForegroundRewriteCandidates({
      config,
      apiKey: 'sk-local',
      source,
      rewritePromptId: 'general',
      candidateCount: 2,
      generateOneCandidate,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ candidateIndex: 1, message: 'provider timeout' }),
    ]);
    expect(result.diagnostics.finishedCount).toBe(1);
    expect(result.diagnostics.failedCount).toBe(1);
  });

  it('stops after a failed first candidate instead of waiting through every configured candidate', async () => {
    const generateOneCandidate = vi.fn().mockRejectedValue(new Error('provider timeout'));
    const onEvent = vi.fn();

    const result = await runForegroundRewriteCandidates({
      config,
      apiKey: 'sk-local',
      source,
      rewritePromptId: 'general',
      candidateCount: 3,
      generateOneCandidate,
      onEvent,
    });

    expect(generateOneCandidate).toHaveBeenCalledTimes(1);
    expect(result.candidates).toHaveLength(0);
    expect(result.errors).toEqual([
      expect.objectContaining({ candidateIndex: 0, message: 'provider timeout' }),
    ]);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'candidate_error',
      candidateIndex: 0,
      message: 'provider timeout',
    }));
  });

  it('stops generating later candidates after cancellation', async () => {
    const controller = new AbortController();
    const generateOneCandidate = vi.fn().mockImplementation(async () => {
      controller.abort();
      return {
        raw: '{"candidates":[{"title":"One","bodyMd":"Body one","style":"general"}]}',
        candidates: [{ id: 'candidate-1', title: 'One', bodyMd: 'Body one', style: 'general' }],
      };
    });

    const result = await runForegroundRewriteCandidates({
      config,
      apiKey: 'sk-local',
      source,
      rewritePromptId: 'general',
      candidateCount: 3,
      signal: controller.signal,
      generateOneCandidate,
    });

    expect(generateOneCandidate).toHaveBeenCalledTimes(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ candidateIndex: 1, message: 'AI generation was canceled.' }),
    ]);
  });
});
