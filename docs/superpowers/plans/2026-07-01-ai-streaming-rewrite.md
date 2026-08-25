# AI Streaming Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show AI provider output while each rewrite candidate is still generating, with automatic fallback to the existing non-streaming request path.

**Architecture:** Add OpenAI-compatible SSE streaming in `packages/ai`, expose an optional preview callback through rewrite generation and foreground generation, then render the accumulated raw JSON preview in `AiRewrite.vue`. The final candidate parsing and persistence stay unchanged.

**Tech Stack:** TypeScript, Fetch API streams, Vue 3, Naive UI, Vitest, Vite.

---

## File Structure

- Modify `packages/ai/src/types.ts`
  - Add callback type `AiStreamChunkHandler`.
  - Add optional `onStreamChunk` to `AiRewriteRequest`.
- Modify `packages/ai/src/openai-compatible.ts`
  - Add `createStreamingChatCompletion`.
  - Parse SSE chunks and accumulate `choices[0].delta.content`.
- Modify `packages/ai/src/rewrite.ts`
  - Use streaming when `request.onStreamChunk` is provided.
  - Fall back to `createChatCompletion` only when streaming is unsupported and not canceled.
- Modify `apps/extension/src/ui/options/ai/foreground-rewrite.ts`
  - Add `onStreamChunk` to foreground input and generation function input.
  - Emit a new `stream_chunk` event.
- Modify `apps/extension/src/ui/options/views/AiRewrite.vue`
  - Add `streamingPreview` state.
  - Render a compact scrollable preview while streaming text exists.
- Modify tests:
  - `packages/ai/src/__tests__/openai-compatible.test.ts`
  - `packages/ai/src/__tests__/rewrite.test.ts`
  - `apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts`

## Task 1: OpenAI-Compatible Streaming

**Files:**
- Modify: `packages/ai/src/openai-compatible.ts`
- Modify: `packages/ai/src/__tests__/openai-compatible.test.ts`

- [ ] **Step 1: Add failing SSE streaming tests**

Add this helper and test in `openai-compatible.test.ts`:

```ts
function streamFromText(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

it('streams chat completion content from SSE chunks', async () => {
  const chunks: string[] = [];
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    body: streamFromText([
      'data: {"choices":[{"delta":{"content":"{\\"candidates\\":["}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"T\\",\\"bodyMd\\":\\"B\\"}]}"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')),
  });

  const result = await createStreamingChatCompletion(
    {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-local',
      model: 'gpt-4o-mini',
      temperature: 0.2,
    },
    [{ role: 'user', content: 'Return JSON.' }],
    (value) => chunks.push(value),
    fetchImpl as any
  );

  expect(result).toBe('{"candidates":[{"title":"T","bodyMd":"B"}]}');
  expect(chunks).toEqual([
    '{"candidates":[',
    '{"candidates":[{"title":"T","bodyMd":"B"}]}',
  ]);
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toMatchObject({ stream: true });
});
```

Add `createStreamingChatCompletion` to the import list.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/openai-compatible.test.ts --run
```

Expected: TypeScript/test failure because `createStreamingChatCompletion` is not implemented.

- [ ] **Step 3: Implement streaming completion**

In `openai-compatible.ts`, add:

```ts
export type AiStreamChunkHandler = (content: string) => void;
```

Then add helper functions:

```ts
function createAbortController(config: AiProviderConfig, signal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const abortRequest = () => controller.abort();
  if (signal?.aborted) {
    throw new AiProviderError('canceled', 'AI request was canceled.');
  }
  signal?.addEventListener('abort', abortRequest, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, getTimeoutMs(config));
  return {
    controller,
    isTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortRequest);
    },
  };
}

function mapCaughtProviderError(error: any, timedOut: boolean, signal?: AbortSignal): AiProviderError {
  if (timedOut || isAbortError(error)) {
    if (!timedOut && signal?.aborted) {
      return new AiProviderError('canceled', 'AI request was canceled.');
    }
    return new AiProviderError('timeout', 'AI provider request timed out.');
  }
  if (error instanceof AiProviderError) {
    return error;
  }
  return new AiProviderError('network_error', error?.message || 'AI provider request failed.');
}

function extractSseContent(line: string): string | null {
  if (!line.startsWith('data:')) {
    return null;
  }
  const payload = line.slice('data:'.length).trim();
  if (!payload || payload === '[DONE]') {
    return null;
  }
  const data = JSON.parse(payload);
  const content = data?.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : null;
}
```

Add:

```ts
export async function createStreamingChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  onChunk: AiStreamChunkHandler,
  fetchImpl: AiFetch = fetch,
  signal?: AbortSignal
): Promise<string> {
  const abort = createAbortController(config, signal);
  try {
    const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: abort.controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        response_format: { type: 'json_object' },
        stream: true,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || data?.message || response.statusText;
      throw mapOpenAiError(response.status, message);
    }
    if (!response.body) {
      throw new AiProviderError('invalid_response', 'AI provider did not return a streaming response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      buffer += decoder.decode(result.value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const delta = extractSseContent(line);
        if (delta) {
          content += delta;
          onChunk(content);
        }
      }
    }

    if (content.trim().length === 0) {
      throw new AiProviderError('invalid_response', 'AI provider returned an empty streaming response.');
    }
    return content;
  } catch (error: any) {
    throw mapCaughtProviderError(error, abort.isTimedOut(), signal);
  } finally {
    abort.cleanup();
  }
}
```

Refactor `createChatCompletion` to reuse `createAbortController` and `mapCaughtProviderError`, preserving existing behavior.

- [ ] **Step 4: Run the streaming tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/openai-compatible.test.ts --run
```

Expected: all openai-compatible tests pass.

- [ ] **Step 5: Commit streaming provider support**

```powershell
git add packages/ai/src/openai-compatible.ts packages/ai/src/__tests__/openai-compatible.test.ts
git commit -m "feat: add OpenAI-compatible streaming completion"
```

## Task 2: Rewrite Streaming Passthrough And Fallback

**Files:**
- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/rewrite.ts`
- Modify: `packages/ai/src/__tests__/rewrite.test.ts`

- [ ] **Step 1: Add failing rewrite streaming test**

In `rewrite.test.ts`, add:

```ts
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
```

- [ ] **Step 2: Run rewrite test and verify failure**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/rewrite.test.ts --run
```

Expected: failure because `onStreamChunk` is not supported by the request type or implementation.

- [ ] **Step 3: Add type and implementation**

In `types.ts`, add:

```ts
export type AiStreamChunkHandler = (content: string) => void;
```

Add to `AiRewriteRequest`:

```ts
  onStreamChunk?: AiStreamChunkHandler;
```

In `rewrite.ts`, import `createStreamingChatCompletion`.

Build messages once:

```ts
const messages = buildRewriteMessages({ ... });
```

Add a fallback helper:

```ts
function shouldFallbackFromStreaming(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return false;
  }
  const code = (error as { code?: string } | null)?.code;
  return code === 'invalid_response' || code === 'provider_error' || code === 'network_error';
}
```

Then choose raw response:

```ts
let raw: string;
if (request.onStreamChunk) {
  try {
    raw = await createStreamingChatCompletion(request.provider, messages, request.onStreamChunk, fetchImpl, request.signal);
  } catch (error) {
    if (!shouldFallbackFromStreaming(error, request.signal)) {
      throw error;
    }
    raw = await createChatCompletion(request.provider, messages, fetchImpl, request.signal);
  }
} else {
  raw = await createChatCompletion(request.provider, messages, fetchImpl, request.signal);
}
```

This gives providers that reject streaming one normal JSON request retry, while cancellation and timeout still stop immediately.

- [ ] **Step 4: Run rewrite tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/rewrite.test.ts --run
```

Expected: rewrite tests pass.

- [ ] **Step 5: Commit rewrite passthrough**

```powershell
git add packages/ai/src/types.ts packages/ai/src/rewrite.ts packages/ai/src/__tests__/rewrite.test.ts
git commit -m "feat: stream AI rewrite candidate text"
```

## Task 3: Foreground Stream Events

**Files:**
- Modify: `apps/extension/src/ui/options/ai/foreground-rewrite.ts`
- Modify: `apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts`

- [ ] **Step 1: Add foreground stream event test**

Add this test:

```ts
  it('emits stream preview events for the visible UI', async () => {
    const onEvent = vi.fn();
    const generateOneCandidate = vi.fn(async (input) => {
      input.onStreamChunk?.('{"candidates":[');
      return {
        raw: '{"candidates":[{"title":"One","bodyMd":"Body one","style":"general"}]}',
        candidates: [{ id: 'candidate-1', title: 'One', bodyMd: 'Body one', style: 'general' }],
      };
    });

    await runForegroundRewriteCandidates({
      config,
      apiKey: 'sk-local',
      source,
      rewritePromptId: 'general',
      candidateCount: 1,
      generateOneCandidate,
      onEvent,
    });

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'stream_chunk',
      message: '{"candidates":[',
    }));
  });
```

- [ ] **Step 2: Run foreground test and verify failure**

Run:

```powershell
.\node_modules\.bin\vitest.cmd apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts --run
```

Expected: failure because `stream_chunk` is not in the stage union and `onStreamChunk` is not passed.

- [ ] **Step 3: Implement foreground stream event**

In `foreground-rewrite.ts`:

Add stage:

```ts
  | 'stream_chunk'
```

Add to `GenerateOneCandidateInput`:

```ts
  onStreamChunk?: (content: string) => void;
```

Add to `RunForegroundRewriteInput`:

```ts
  preferStreaming?: boolean;
```

In `defaultGenerateOneCandidate`, pass:

```ts
    onStreamChunk: input.onStreamChunk,
```

When calling `generateOneCandidate`, pass:

```ts
        onStreamChunk: (content) => emit('stream_chunk', { candidateIndex: index, message: content }),
```

Only pass `onStreamChunk` when `input.preferStreaming !== false`.

- [ ] **Step 4: Run foreground tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts --run
```

Expected: foreground tests pass.

- [ ] **Step 5: Commit foreground stream events**

```powershell
git add apps/extension/src/ui/options/ai/foreground-rewrite.ts apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts
git commit -m "feat: surface AI rewrite streaming preview events"
```

## Task 4: AI Rewrite Page Streaming Preview

**Files:**
- Modify: `apps/extension/src/ui/options/views/AiRewrite.vue`

- [ ] **Step 1: Add preview state**

In script setup, add:

```ts
const streamingPreview = ref('');
```

Reset it at the start of `generate()` and `generateOneMore()`:

```ts
streamingPreview.value = '';
```

In `handleGenerationEvent`, add:

```ts
  if (event.stage === 'stream_chunk') {
    streamingPreview.value = event.message || '';
  }
  if (event.stage === 'candidate_saved') {
    streamingPreview.value = '';
  }
```

In `generationStageText` stage map, add:

```ts
stream_chunk: 'AI 正在返回内容',
```

- [ ] **Step 2: Render preview panel**

Below `generationStageText`, add:

```vue
        <div v-if="streamingPreview" class="stream-preview mt-3" :class="isDark ? 'bg-gray-900/70 text-gray-200' : 'bg-gray-50 text-gray-700'">
          <div class="text-xs mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">实时返回预览</div>
          <pre>{{ streamingPreview }}</pre>
        </div>
```

Add CSS:

```css
.stream-preview {
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
}

.stream-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
```

- [ ] **Step 3: Build extension**

Run from `apps/extension`:

```powershell
.\node_modules\.bin\vite.cmd build
```

Expected: build succeeds; existing chunk warnings are acceptable.

- [ ] **Step 4: Commit preview UI**

```powershell
git add apps/extension/src/ui/options/views/AiRewrite.vue
git commit -m "feat: show AI rewrite streaming preview"
```

## Task 5: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused AI tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/openai-compatible.test.ts packages/ai/src/__tests__/rewrite.test.ts packages/ai/src/__tests__/prompts.test.ts packages/ai/src/__tests__/humanize-rules.test.ts apps/extension/src/background/__tests__/ai-service.test.ts apps/extension/src/ui/options/ai/__tests__/client.test.ts apps/extension/src/ui/options/ai/__tests__/cloneable.test.ts apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts apps/extension/src/ui/options/ai/__tests__/rewrite-draft.test.ts --run
```

Expected: all selected tests pass.

- [ ] **Step 2: Run extension build**

Run from `apps/extension`:

```powershell
.\node_modules\.bin\vite.cmd build
```

Expected: production build succeeds.

- [ ] **Step 3: Run diff check and inspect status**

Run:

```powershell
git diff --check
git status --short
```

Expected: diff check passes and working tree is clean after commits.

## Self-Review

- Spec coverage: streaming provider, stable final parsing, foreground preview, controls preservation, and tests are covered.
- Non-goals respected: no segmentation, no partial JSON final candidates, no parallelism, no queue, no provider-specific UI.
- Type consistency: `onStreamChunk`, `stream_chunk`, and preview `message` are used consistently.
- Placeholder scan: no TODO/TBD placeholders remain.
