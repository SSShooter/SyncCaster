# AI Rewrite Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional AI rewrite workflow that generates two or three article rewrite candidates before the existing editor, while leaving the current non-AI path unchanged.

**Architecture:** Put provider, prompt, parsing, and error logic in a new `@synccaster/ai` package. Keep extension-specific storage, host permission, and message routing in a thin AI layer under `apps/extension/src/background` and `apps/extension/src/ui/options/ai`. Add only route/nav registration and one edit-entry decision to the existing options UI.

**Tech Stack:** TypeScript, Vue 3, Naive UI, Chrome extension MV3 APIs, Dexie, Vitest, existing pnpm workspace.

---

## Success Criteria

- AI disabled opens drafts through the existing `editor/<postId>` path.
- AI enabled opens collected drafts through `ai-rewrite/<postId>`.
- API key is stored only in local extension storage and is never stored in `db.config`.
- API key is sent only as an `Authorization: Bearer` header to the configured AI base URL.
- AI rewrite candidate selection writes `title`, `body_md`, `summary`, `updatedAt`, and `meta.aiRewrite` to the existing post record.
- Existing editor and publish flow remain unchanged after a candidate is selected.
- Unit tests cover AI package parsing, endpoint normalization, prompt construction, error normalization, AI config storage, and AI routing decisions.

## File Structure

Create:

- `packages/ai/package.json`: workspace package metadata and build script.
- `packages/ai/tsconfig.json`: package TypeScript config matching existing package style.
- `packages/ai/src/types.ts`: provider config, rewrite request, candidate, and error types.
- `packages/ai/src/openai-compatible.ts`: OpenAI-compatible chat completions client, URL normalization, test connection, and provider error mapping.
- `packages/ai/src/prompts.ts`: rewrite prompt construction for the three supported styles.
- `packages/ai/src/rewrite.ts`: response parsing and candidate generation orchestration.
- `packages/ai/src/index.ts`: public exports.
- `packages/ai/src/__tests__/openai-compatible.test.ts`: endpoint, fetch, and error behavior.
- `packages/ai/src/__tests__/rewrite.test.ts`: parser and generation behavior.
- `packages/ai/src/__tests__/prompts.test.ts`: prompt shape.
- `apps/extension/src/background/ai-service.ts`: AI config/key storage and background message handlers.
- `apps/extension/src/background/__tests__/ai-service.test.ts`: storage and message-handler tests with in-memory tables.
- `apps/extension/src/ui/options/ai/client.ts`: typed UI wrapper around `chrome.runtime.sendMessage`.
- `apps/extension/src/ui/options/ai/host-permissions.ts`: optional host permission helper for configured AI origins.
- `apps/extension/src/ui/options/ai/post-routing.ts`: collected-post and AI-entry decision helpers.
- `apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts`: origin pattern tests.
- `apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts`: AI routing decision tests.
- `apps/extension/src/ui/options/views/AiSettings.vue`: settings page.
- `apps/extension/src/ui/options/views/AiRewrite.vue`: candidate generation and selection page.

Modify:

- `tsconfig.json`: add path alias for `@synccaster/ai`.
- `apps/extension/package.json`: add workspace dependency on `@synccaster/ai`.
- `apps/extension/vite.config.ts`: add Vite alias for `@synccaster/ai`.
- `apps/extension/src/manifest.ts`: add `optional_host_permissions` for configured AI service origins.
- `apps/extension/src/background/index.ts`: route AI messages to `ai-service.ts`.
- `apps/extension/src/ui/options/App.vue`: register AI settings and AI rewrite views.
- `apps/extension/src/ui/options/views/Posts.vue`: make `editPost` check the AI routing decision.

Avoid:

- Do not edit platform adapters.
- Do not edit `publish-engine.ts`.
- Do not embed AI provider calls inside Vue pages.
- Do not change the current editor or publish behavior except by opening it after selected AI output is saved.

---

## Task 1: Add `@synccaster/ai` Package

**Files:**

- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/openai-compatible.ts`
- Create: `packages/ai/src/prompts.ts`
- Create: `packages/ai/src/rewrite.ts`
- Create: `packages/ai/src/index.ts`
- Create: `packages/ai/src/__tests__/openai-compatible.test.ts`
- Create: `packages/ai/src/__tests__/rewrite.test.ts`
- Create: `packages/ai/src/__tests__/prompts.test.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing endpoint and error tests**

Create `packages/ai/src/__tests__/openai-compatible.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  buildChatCompletionsUrl,
  mapOpenAiError,
  testOpenAiConnection,
} from '../openai-compatible';

describe('buildChatCompletionsUrl', () => {
  it('accepts base URLs with and without /v1', () => {
    expect(buildChatCompletionsUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/chat/completions');
    expect(buildChatCompletionsUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
    expect(buildChatCompletionsUrl('https://example.com/openai/v1/')).toBe('https://example.com/openai/v1/chat/completions');
  });

  it('rejects non-http base URLs', () => {
    expect(() => buildChatCompletionsUrl('file:///tmp/model')).toThrow('AI base URL must start with http:// or https://');
  });
});

describe('mapOpenAiError', () => {
  it('maps auth and rate-limit status codes to stable error codes', () => {
    expect(mapOpenAiError(401, 'bad key')).toMatchObject({ code: 'auth_error', status: 401 });
    expect(mapOpenAiError(429, 'slow down')).toMatchObject({ code: 'rate_limited', status: 429 });
  });
});

describe('testOpenAiConnection', () => {
  it('sends a minimal chat completion request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const result = await testOpenAiConnection(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.2,
      },
      fetchImpl
    );

    expect(result.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-local' }),
      })
    );
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
pnpm vitest packages/ai/src/__tests__/openai-compatible.test.ts --run
```

Expected: FAIL because `../openai-compatible` does not exist.

- [ ] **Step 3: Write failing rewrite parser and prompt tests**

Create `packages/ai/src/__tests__/rewrite.test.ts`:

```ts
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
```

Create `packages/ai/src/__tests__/prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRewriteMessages } from '../prompts';

describe('buildRewriteMessages', () => {
  it('requests JSON with the configured candidate count and source content', () => {
    const messages = buildRewriteMessages({
      source: {
        postId: 'post-1',
        title: 'Original title',
        bodyMd: 'Original body',
        sourceUrl: 'https://example.com/post',
      },
      style: 'less_ai',
      candidateCount: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('Return exactly 3 candidates');
    expect(messages[1].content).toContain('Original title');
    expect(messages[1].content).toContain('Original body');
    expect(messages[1].content).toContain('valid JSON');
  });
});
```

- [ ] **Step 4: Run tests and verify red**

Run:

```bash
pnpm vitest packages/ai/src/__tests__/rewrite.test.ts packages/ai/src/__tests__/prompts.test.ts --run
```

Expected: FAIL because `../rewrite` and `../prompts` do not exist.

- [ ] **Step 5: Add package metadata**

Create `packages/ai/package.json`:

```json
{
  "name": "@synccaster/ai",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

Create `packages/ai/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2020", "DOM"],
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false,
    "allowImportingTsExtensions": false
  },
  "include": ["src/**/*"]
}
```

Modify root `tsconfig.json` paths:

```json
"@synccaster/ai": ["./packages/ai/src"]
```

- [ ] **Step 6: Add AI types**

Create `packages/ai/src/types.ts`:

```ts
export type AiRewriteStyle = 'balanced' | 'less_ai' | 'platform_ready';

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface AiRewriteSource {
  postId: string;
  title: string;
  bodyMd: string;
  sourceUrl?: string;
}

export interface AiRewritePromptInput {
  source: AiRewriteSource;
  style: AiRewriteStyle;
  candidateCount: 2 | 3;
}

export interface AiRewriteRequest extends AiRewritePromptInput {
  provider: AiProviderConfig;
}

export interface AiRewriteCandidate {
  id: string;
  title: string;
  bodyMd: string;
  summary?: string;
  rationale?: string;
  style: string;
}

export interface AiRewriteResult {
  candidates: AiRewriteCandidate[];
  raw: string;
}

export type AiErrorCode =
  | 'invalid_config'
  | 'auth_error'
  | 'rate_limited'
  | 'network_error'
  | 'invalid_response'
  | 'provider_error';

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.status = status;
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

- [ ] **Step 7: Add prompt construction**

Create `packages/ai/src/prompts.ts`:

```ts
import type { AiRewritePromptInput, ChatMessage } from './types';

const styleDescriptions = {
  balanced: 'Rewrite for clarity, structure, and readability while preserving meaning.',
  less_ai: 'Rewrite with natural human phrasing, varied sentence rhythm, and fewer generic AI patterns.',
  platform_ready: 'Rewrite into a polished article suitable for multi-platform publishing.',
} as const;

export function buildRewriteMessages(input: AiRewritePromptInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are an editorial rewriting assistant.',
        'Preserve facts, technical meaning, links, code blocks, and Markdown structure.',
        'Do not invent claims, dates, data, or references.',
        'Return only valid JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Style: ${input.style}`,
        styleDescriptions[input.style],
        `Return exactly ${input.candidateCount} candidates.`,
        'JSON shape: {"candidates":[{"title":"string","bodyMd":"markdown string","summary":"string","rationale":"string","style":"string"}]}',
        `Source URL: ${input.source.sourceUrl || ''}`,
        `Original title: ${input.source.title}`,
        'Original Markdown:',
        input.source.bodyMd,
      ].join('\n\n'),
    },
  ];
}
```

- [ ] **Step 8: Add OpenAI-compatible client**

Create `packages/ai/src/openai-compatible.ts` with these public functions:

```ts
import { AiProviderError, type AiProviderConfig, type ChatMessage } from './types';

export type AiFetch = typeof fetch;

export function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new AiProviderError('invalid_config', 'AI base URL must start with http:// or https://');
  }
  const root = trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  return `${root}/chat/completions`;
}

export function mapOpenAiError(status: number, message: string): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError('auth_error', message || 'AI provider rejected the API key.', status);
  }
  if (status === 429) {
    return new AiProviderError('rate_limited', message || 'AI provider rate limit reached.', status);
  }
  return new AiProviderError('provider_error', message || 'AI provider request failed.', status);
}

export async function createChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  fetchImpl: AiFetch = fetch
): Promise<string> {
  const response = await fetchImpl(buildChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText;
    throw mapOpenAiError(response.status, message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new AiProviderError('invalid_response', 'AI provider returned an empty response.');
  }
  return content;
}

export async function testOpenAiConnection(config: AiProviderConfig, fetchImpl: AiFetch = fetch) {
  await createChatCompletion(
    config,
    [
      { role: 'system', content: 'Return valid JSON only.' },
      { role: 'user', content: '{"ping":"ok"}' },
    ],
    fetchImpl
  );
  return { success: true };
}
```

- [ ] **Step 9: Add rewrite orchestration**

Create `packages/ai/src/rewrite.ts`:

```ts
import { createChatCompletion, type AiFetch } from './openai-compatible';
import { buildRewriteMessages } from './prompts';
import { AiProviderError, type AiRewriteCandidate, type AiRewriteRequest, type AiRewriteResult } from './types';

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function createCandidateId(index: number): string {
  return `candidate-${index + 1}`;
}

export function parseRewriteCandidates(content: string): AiRewriteCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(content));
  } catch {
    throw new AiProviderError('invalid_response', 'AI response was not valid candidate JSON.');
  }

  const candidates = (parsed as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    throw new AiProviderError('invalid_response', 'AI response did not include candidates.');
  }

  return candidates.map((candidate, index) => {
    const item = candidate as Partial<AiRewriteCandidate>;
    if (typeof item.title !== 'string' || typeof item.bodyMd !== 'string') {
      throw new AiProviderError('invalid_response', 'AI candidate was missing title or bodyMd.');
    }
    return {
      id: item.id || createCandidateId(index),
      title: item.title,
      bodyMd: item.bodyMd,
      summary: item.summary,
      rationale: item.rationale,
      style: item.style || 'balanced',
    };
  });
}

export async function generateRewriteCandidates(
  request: AiRewriteRequest,
  fetchImpl: AiFetch = fetch
): Promise<AiRewriteResult> {
  const raw = await createChatCompletion(
    request.provider,
    buildRewriteMessages({
      source: request.source,
      style: request.style,
      candidateCount: request.candidateCount,
    }),
    fetchImpl
  );

  return {
    raw,
    candidates: parseRewriteCandidates(raw),
  };
}
```

Create `packages/ai/src/index.ts`:

```ts
export * from './types';
export * from './prompts';
export * from './openai-compatible';
export * from './rewrite';
```

- [ ] **Step 10: Run package tests and commit**

Run:

```bash
pnpm vitest packages/ai/src/__tests__/openai-compatible.test.ts packages/ai/src/__tests__/rewrite.test.ts packages/ai/src/__tests__/prompts.test.ts --run
```

Expected: PASS.

Commit:

```bash
git add tsconfig.json packages/ai
git commit -m "feat: add ai rewrite package"
```

---

## Task 2: Add Background AI Service

**Files:**

- Create: `apps/extension/src/background/ai-service.ts`
- Create: `apps/extension/src/background/__tests__/ai-service.test.ts`
- Modify: `apps/extension/package.json`
- Modify: `apps/extension/vite.config.ts`
- Modify: `apps/extension/src/background/index.ts`

- [ ] **Step 1: Write failing storage and message tests**

Create `apps/extension/src/background/__tests__/ai-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  AI_CONFIG_ID,
  AI_SECRET_ID,
  DEFAULT_AI_REWRITE_CONFIG,
  handleAiMessage,
  isAiMessageType,
  loadAiRewriteSettings,
  saveAiRewriteSettings,
} from '../ai-service';

function createTable<T extends { id: string }>() {
  const rows = new Map<string, T>();
  return {
    rows,
    async get(id: string) {
      return rows.get(id);
    },
    async put(value: T) {
      rows.set(value.id, value);
    },
    async delete(id: string) {
      rows.delete(id);
    },
  };
}

function createDeps() {
  return {
    configTable: createTable<any>(),
    secretsTable: createTable<any>(),
    now: () => 123,
    generateRewriteCandidates: vi.fn(),
    testOpenAiConnection: vi.fn(),
  };
}

describe('ai-service settings storage', () => {
  it('stores API keys in secrets and excludes them from config', async () => {
    const deps = createDeps();

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 2,
        defaultStyle: 'balanced',
      },
      deps
    );

    expect(deps.configTable.rows.get(AI_CONFIG_ID).value.apiKey).toBeUndefined();
    expect(deps.secretsTable.rows.get(AI_SECRET_ID).encrypted).toBe('sk-local');

    const loaded = await loadAiRewriteSettings(deps);
    expect(loaded.config).toMatchObject({ enabled: true, hasApiKey: true });
  });

  it('returns defaults when no config is stored', async () => {
    const loaded = await loadAiRewriteSettings(createDeps());
    expect(loaded.config).toMatchObject({ ...DEFAULT_AI_REWRITE_CONFIG, hasApiKey: false });
  });
});

describe('ai-service messages', () => {
  it('identifies AI message types', () => {
    expect(isAiMessageType('AI_GET_CONFIG')).toBe(true);
    expect(isAiMessageType('SAVE_POST')).toBe(false);
  });

  it('generates candidates with the locally stored API key', async () => {
    const deps = createDeps();
    deps.generateRewriteCandidates.mockResolvedValue({
      raw: '{"candidates":[]}',
      candidates: [],
    });

    await saveAiRewriteSettings(
      {
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        candidateCount: 2,
        defaultStyle: 'less_ai',
      },
      deps
    );

    const response = await handleAiMessage(
      {
        type: 'AI_GENERATE_CANDIDATES',
        data: {
          source: { postId: 'post-1', title: 'T', bodyMd: 'B' },
          style: 'platform_ready',
        },
      },
      deps
    );

    expect(response.success).toBe(true);
    expect(deps.generateRewriteCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({ apiKey: 'sk-local' }),
        style: 'platform_ready',
        candidateCount: 2,
      })
    );
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
pnpm vitest apps/extension/src/background/__tests__/ai-service.test.ts --run
```

Expected: FAIL because `../ai-service` does not exist.

- [ ] **Step 3: Add extension dependency and Vite alias**

Modify `apps/extension/package.json` dependencies:

```json
"@synccaster/ai": "workspace:*"
```

Modify `apps/extension/vite.config.ts` aliases:

```ts
'@synccaster/ai': resolve(__dirname, '../../packages/ai/src'),
```

- [ ] **Step 4: Add background AI service**

Create `apps/extension/src/background/ai-service.ts`:

```ts
import {
  generateRewriteCandidates,
  testOpenAiConnection,
  type AiRewriteStyle,
} from '@synccaster/ai';
import { db, type AppConfig, type Secret } from '@synccaster/core';

export const AI_CONFIG_ID = 'ai.rewrite.config';
export const AI_SECRET_ID = 'ai.openai.apiKey';

export const DEFAULT_AI_REWRITE_CONFIG = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  candidateCount: 2 as 2 | 3,
  defaultStyle: 'balanced' as AiRewriteStyle,
};

type ConfigTable = Pick<typeof db.config, 'get' | 'put'>;
type SecretsTable = Pick<typeof db.secrets, 'get' | 'put' | 'delete'>;

export interface AiServiceDeps {
  configTable: ConfigTable;
  secretsTable: SecretsTable;
  now: () => number;
  generateRewriteCandidates: typeof generateRewriteCandidates;
  testOpenAiConnection: typeof testOpenAiConnection;
}

function createDefaultDeps(): AiServiceDeps {
  return {
    configTable: db.config,
    secretsTable: db.secrets,
    now: () => Date.now(),
    generateRewriteCandidates,
    testOpenAiConnection,
  };
}

export function isAiMessageType(type: string): boolean {
  return [
    'AI_GET_CONFIG',
    'AI_SAVE_CONFIG',
    'AI_CLEAR_API_KEY',
    'AI_TEST_CONNECTION',
    'AI_GENERATE_CANDIDATES',
  ].includes(type);
}

function normalizeConfig(input: any) {
  return {
    enabled: Boolean(input?.enabled),
    baseUrl: String(input?.baseUrl || DEFAULT_AI_REWRITE_CONFIG.baseUrl).trim(),
    model: String(input?.model || DEFAULT_AI_REWRITE_CONFIG.model).trim(),
    temperature: Number.isFinite(Number(input?.temperature)) ? Number(input.temperature) : DEFAULT_AI_REWRITE_CONFIG.temperature,
    candidateCount: Number(input?.candidateCount) === 3 ? 3 as const : 2 as const,
    defaultStyle: ['balanced', 'less_ai', 'platform_ready'].includes(input?.defaultStyle)
      ? input.defaultStyle as AiRewriteStyle
      : DEFAULT_AI_REWRITE_CONFIG.defaultStyle,
  };
}

export async function loadAiRewriteSettings(deps: AiServiceDeps = createDefaultDeps()) {
  const stored = await deps.configTable.get(AI_CONFIG_ID) as AppConfig | undefined;
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as Secret | undefined;
  return {
    config: {
      ...DEFAULT_AI_REWRITE_CONFIG,
      ...(stored?.value || {}),
      hasApiKey: Boolean(secret?.encrypted),
    },
  };
}

export async function saveAiRewriteSettings(input: any, deps: AiServiceDeps = createDefaultDeps()) {
  const now = deps.now();
  const config = normalizeConfig(input);
  await deps.configTable.put({
    id: AI_CONFIG_ID,
    key: AI_CONFIG_ID,
    value: config,
    updatedAt: now,
  } as AppConfig);

  if (typeof input?.apiKey === 'string' && input.apiKey.trim()) {
    await deps.secretsTable.put({
      id: AI_SECRET_ID,
      accountId: 'ai',
      encrypted: input.apiKey.trim(),
      iv: 'local-extension-storage',
      createdAt: now,
      updatedAt: now,
    } as Secret);
  }

  return loadAiRewriteSettings(deps);
}

async function requireProviderConfig(deps: AiServiceDeps) {
  const settings = await loadAiRewriteSettings(deps);
  const secret = await deps.secretsTable.get(AI_SECRET_ID) as Secret | undefined;
  if (!settings.config.baseUrl || !settings.config.model || !secret?.encrypted) {
    throw new Error('AI base URL, model, and API key are required.');
  }
  return {
    settings,
    provider: {
      baseUrl: settings.config.baseUrl,
      apiKey: secret.encrypted,
      model: settings.config.model,
      temperature: settings.config.temperature,
    },
  };
}

export async function handleAiMessage(message: any, deps: AiServiceDeps = createDefaultDeps()) {
  try {
    switch (message.type) {
      case 'AI_GET_CONFIG':
        return { success: true, ...(await loadAiRewriteSettings(deps)) };
      case 'AI_SAVE_CONFIG':
        return { success: true, ...(await saveAiRewriteSettings(message.data, deps)) };
      case 'AI_CLEAR_API_KEY':
        await deps.secretsTable.delete(AI_SECRET_ID);
        return { success: true, ...(await loadAiRewriteSettings(deps)) };
      case 'AI_TEST_CONNECTION': {
        const { provider } = await requireProviderConfig(deps);
        await deps.testOpenAiConnection(provider);
        return { success: true };
      }
      case 'AI_GENERATE_CANDIDATES': {
        const { settings, provider } = await requireProviderConfig(deps);
        const result = await deps.generateRewriteCandidates({
          provider,
          source: message.data.source,
          style: message.data.style || settings.config.defaultStyle,
          candidateCount: settings.config.candidateCount,
        });
        return { success: true, result };
      }
      default:
        return { success: false, error: `Unknown AI message type: ${message.type}` };
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'AI request failed' };
  }
}
```

- [ ] **Step 5: Route AI messages from the existing background switch**

Modify `apps/extension/src/background/index.ts`:

```ts
import { handleAiMessage, isAiMessageType } from './ai-service';
```

At the start of `handleMessage` before the `switch`:

```ts
if (isAiMessageType(message.type)) {
  return await handleAiMessage(message);
}
```

- [ ] **Step 6: Run background tests and commit**

Run:

```bash
pnpm vitest apps/extension/src/background/__tests__/ai-service.test.ts --run
```

Expected: PASS.

Commit:

```bash
git add apps/extension/package.json apps/extension/vite.config.ts apps/extension/src/background/index.ts apps/extension/src/background/ai-service.ts apps/extension/src/background/__tests__/ai-service.test.ts
git commit -m "feat: add ai background service"
```

---

## Task 3: Add UI AI Helpers and Optional Host Permission Support

**Files:**

- Create: `apps/extension/src/ui/options/ai/client.ts`
- Create: `apps/extension/src/ui/options/ai/host-permissions.ts`
- Create: `apps/extension/src/ui/options/ai/post-routing.ts`
- Create: `apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts`
- Create: `apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts`
- Modify: `apps/extension/src/manifest.ts`

- [ ] **Step 1: Write failing helper tests**

Create `apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getAiOriginPattern } from '../host-permissions';

describe('getAiOriginPattern', () => {
  it('turns configured base URLs into extension origin patterns', () => {
    expect(getAiOriginPattern('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
    expect(getAiOriginPattern('https://example.com/openai/v1')).toBe('https://example.com/*');
    expect(getAiOriginPattern('http://localhost:11434/v1')).toBe('http://localhost/*');
    expect(getAiOriginPattern('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1/*');
  });

  it('rejects non-http URLs', () => {
    expect(() => getAiOriginPattern('file:///tmp/model')).toThrow('AI base URL must start with http:// or https://');
  });
});
```

Create `apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCollectedPost, shouldOpenAiRewrite } from '../post-routing';

describe('isCollectedPost', () => {
  it('detects collected posts from source metadata', () => {
    expect(isCollectedPost({ meta: { source_url: 'https://example.com/post' } })).toBe(true);
    expect(isCollectedPost({ canonicalUrl: 'https://example.com/post' })).toBe(true);
  });

  it('does not treat imported or original posts as collected', () => {
    expect(isCollectedPost({ meta: { importedFrom: 'local.md' }, canonicalUrl: '' })).toBe(false);
    expect(isCollectedPost({ title: 'Original', body_md: 'Body' })).toBe(false);
  });
});

describe('shouldOpenAiRewrite', () => {
  it('opens AI rewrite only when enabled and the post is collected', () => {
    expect(shouldOpenAiRewrite({ enabled: true }, { canonicalUrl: 'https://example.com' })).toBe(true);
    expect(shouldOpenAiRewrite({ enabled: false }, { canonicalUrl: 'https://example.com' })).toBe(false);
    expect(shouldOpenAiRewrite({ enabled: true }, { title: 'Original' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run helper tests and verify red**

Run:

```bash
pnpm vitest apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts --run
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Add helpers**

Create `apps/extension/src/ui/options/ai/client.ts`:

```ts
export async function sendAiMessage<T = any>(type: string, data?: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, data });
  if (!response?.success) {
    throw new Error(response?.error || 'AI request failed');
  }
  return response as T;
}

export const aiClient = {
  getConfig: () => sendAiMessage<{ success: true; config: any }>('AI_GET_CONFIG'),
  saveConfig: (data: any) => sendAiMessage<{ success: true; config: any }>('AI_SAVE_CONFIG', data),
  clearApiKey: () => sendAiMessage<{ success: true; config: any }>('AI_CLEAR_API_KEY'),
  testConnection: () => sendAiMessage<{ success: true }>('AI_TEST_CONNECTION'),
  generateCandidates: (data: any) => sendAiMessage<{ success: true; result: any }>('AI_GENERATE_CANDIDATES', data),
};
```

Create `apps/extension/src/ui/options/ai/host-permissions.ts`:

```ts
export function getAiOriginPattern(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('AI base URL must start with http:// or https://');
  }
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

export async function requestAiHostPermission(baseUrl: string): Promise<boolean> {
  const origin = getAiOriginPattern(baseUrl);
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    return true;
  }
  const hasPermission = await chrome.permissions.contains({ origins: [origin] });
  if (hasPermission) {
    return true;
  }
  return chrome.permissions.request({ origins: [origin] });
}
```

Create `apps/extension/src/ui/options/ai/post-routing.ts`:

```ts
export function isCollectedPost(post: any): boolean {
  if (post?.meta?.importedFrom) {
    return false;
  }
  const sourceUrl = post?.meta?.source_url || post?.canonicalUrl || post?.source_url || post?.url || '';
  return typeof sourceUrl === 'string' && sourceUrl.trim().length > 0;
}

export function shouldOpenAiRewrite(config: { enabled?: boolean }, post: any): boolean {
  return Boolean(config?.enabled) && isCollectedPost(post);
}
```

- [ ] **Step 4: Add optional host permissions**

Modify `apps/extension/src/manifest.ts` near `host_permissions`:

```ts
optional_host_permissions: [
  'https://*/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
],
```

Do not add `<all_urls>` to permanent `host_permissions`.

- [ ] **Step 5: Run helper tests and commit**

Run:

```bash
pnpm vitest apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts --run
```

Expected: PASS.

Commit:

```bash
git add apps/extension/src/manifest.ts apps/extension/src/ui/options/ai
git commit -m "feat: add ai ui helpers"
```

---

## Task 4: Add AI Settings Page

**Files:**

- Create: `apps/extension/src/ui/options/views/AiSettings.vue`

- [ ] **Step 1: Create settings page using existing UI conventions**

Create `AiSettings.vue` with:

- A top heading matching the density of `Posts.vue`.
- One `n-card`.
- `n-switch` for `enabled`.
- `n-input` for `baseUrl`.
- `n-input type="password"` for `apiKey`.
- `n-input` for `model`.
- `n-input-number` for `temperature`.
- `n-radio-group` or `n-select` for `candidateCount`.
- `n-select` for `defaultStyle`.
- Buttons: save, test connection, clear key.

Required script behavior:

```ts
import { onMounted, reactive, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { aiClient } from '../ai/client';
import { requestAiHostPermission } from '../ai/host-permissions';

const message = useMessage();
const saving = ref(false);
const testing = ref(false);
const hasApiKey = ref(false);
const form = reactive({
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  candidateCount: 2,
  defaultStyle: 'balanced',
});

async function loadConfig() {
  const response = await aiClient.getConfig();
  Object.assign(form, response.config);
  hasApiKey.value = Boolean(response.config.hasApiKey);
  form.apiKey = '';
}

async function saveConfig() {
  saving.value = true;
  try {
    const granted = await requestAiHostPermission(form.baseUrl);
    if (!granted) {
      message.error('未授权 AI 服务域名，无法保存该地址');
      return;
    }
    const response = await aiClient.saveConfig({ ...form });
    hasApiKey.value = Boolean(response.config.hasApiKey);
    form.apiKey = '';
    message.success('AI 设置已保存');
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  try {
    await requestAiHostPermission(form.baseUrl);
    await aiClient.saveConfig({ ...form });
    await aiClient.testConnection();
    message.success('AI 连接测试成功');
  } catch (error: any) {
    message.error(error?.message || 'AI 连接测试失败');
  } finally {
    testing.value = false;
  }
}

async function clearApiKey() {
  const response = await aiClient.clearApiKey();
  hasApiKey.value = Boolean(response.config.hasApiKey);
  form.apiKey = '';
  message.success('API Key 已清除');
}

onMounted(loadConfig);
```

Visible copy must state:

- `API Key 仅保存在本机扩展存储中。`
- `生成文案时会把 API Key 发送到你配置的 AI 服务地址。`

- [ ] **Step 2: Manually inspect local UI structure**

No automated test is required for the Vue form in this task. Verify by opening the options page after Task 6 wiring.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/src/ui/options/views/AiSettings.vue
git commit -m "feat: add ai settings page"
```

---

## Task 5: Add AI Rewrite Page

**Files:**

- Create: `apps/extension/src/ui/options/views/AiRewrite.vue`

- [ ] **Step 1: Create rewrite page using existing options layout**

Create `AiRewrite.vue` with:

- Heading `AI 文案生成`.
- Original post title, source URL, and a collapsible original preview.
- Style selector with values `balanced`, `less_ai`, `platform_ready`.
- Generate and regenerate buttons.
- Candidate list using `n-card` for each candidate.
- Radio selection per candidate.
- Primary button `使用选中文案`.
- Secondary button `跳过 AI，直接编辑`.

Required script behavior:

```ts
import { computed, onMounted, ref } from 'vue';
import { db } from '@synccaster/core';
import { useMessage } from 'naive-ui';
import { aiClient } from '../ai/client';

const message = useMessage();
const loading = ref(false);
const generating = ref(false);
const saving = ref(false);
const post = ref<any>(null);
const candidates = ref<any[]>([]);
const selectedId = ref('');
const style = ref('balanced');
const expanded = ref(false);

const postId = computed(() => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash.startsWith('ai-rewrite/') ? hash.slice('ai-rewrite/'.length) : '';
});

const selectedCandidate = computed(() => candidates.value.find((item) => item.id === selectedId.value));

async function loadPost() {
  loading.value = true;
  try {
    post.value = await db.posts.get(postId.value);
    if (!post.value) {
      message.error('文章不存在');
      window.location.hash = 'posts';
      return;
    }
    const configResponse = await aiClient.getConfig();
    style.value = configResponse.config.defaultStyle || 'balanced';
  } finally {
    loading.value = false;
  }
}

async function generate() {
  if (!post.value) {
    return;
  }
  generating.value = true;
  try {
    const response = await aiClient.generateCandidates({
      source: {
        postId: post.value.id,
        title: post.value.title || '',
        bodyMd: post.value.body_md || '',
        sourceUrl: post.value.meta?.source_url || post.value.canonicalUrl || '',
      },
      style: style.value,
    });
    candidates.value = response.result.candidates;
    selectedId.value = candidates.value[0]?.id || '';
  } catch (error: any) {
    message.error(error?.message || 'AI 生成失败');
  } finally {
    generating.value = false;
  }
}

async function useSelected() {
  if (!post.value || !selectedCandidate.value) {
    message.warning('请选择一个文案版本');
    return;
  }
  saving.value = true;
  try {
    const now = Date.now();
    await db.posts.update(post.value.id, {
      title: selectedCandidate.value.title,
      body_md: selectedCandidate.value.bodyMd,
      summary: selectedCandidate.value.summary || selectedCandidate.value.bodyMd.slice(0, 200),
      updatedAt: now,
      meta: {
        ...(post.value.meta || {}),
        aiRewrite: {
          selectedCandidateId: selectedCandidate.value.id,
          style: selectedCandidate.value.style,
          modelGeneratedAt: new Date(now).toISOString(),
        },
      },
    } as any);
    window.location.hash = `editor/${post.value.id}`;
  } catch (error: any) {
    message.error(error?.message || '保存 AI 文案失败');
  } finally {
    saving.value = false;
  }
}

function skipAi() {
  if (post.value?.id) {
    window.location.hash = `editor/${post.value.id}`;
  } else {
    window.location.hash = 'posts';
  }
}

onMounted(loadPost);
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/src/ui/options/views/AiRewrite.vue
git commit -m "feat: add ai rewrite page"
```

---

## Task 6: Wire Routes, Navigation, and Article Entry

**Files:**

- Modify: `apps/extension/src/ui/options/App.vue`
- Modify: `apps/extension/src/ui/options/views/Posts.vue`

- [ ] **Step 1: Register AI views in `App.vue`**

Add imports:

```ts
import AiSettingsView from './views/AiSettings.vue';
import AiRewriteView from './views/AiRewrite.vue';
```

Add nav item:

```ts
{ path: 'ai-settings', label: 'AI 设置', icon: 'AI' },
```

Add component mapping:

```ts
'ai-settings': AiSettingsView,
```

Add route handling before the `editor/` route block:

```ts
if (hash.startsWith('ai-rewrite/')) {
  currentPath.value = 'ai-settings';
  currentComponent.value = AiRewriteView;
  return;
}
```

- [ ] **Step 2: Update article edit entry in `Posts.vue`**

Add imports:

```ts
import { aiClient } from '../ai/client';
import { shouldOpenAiRewrite } from '../ai/post-routing';
```

Replace `editPost` with:

```ts
async function editPost(id: string) {
  const post = posts.value.find((item) => item.id === id) || await db.posts.get(id);
  if (!post) {
    message.error('文章不存在');
    return;
  }

  try {
    const response = await aiClient.getConfig();
    if (shouldOpenAiRewrite(response.config, post)) {
      window.location.hash = `ai-rewrite/${id}`;
      return;
    }
  } catch (error) {
    console.warn('Failed to load AI config, opening editor directly:', error);
  }

  window.location.hash = `editor/${id}`;
}
```

This keeps the existing path as the fallback when AI config loading fails.

- [ ] **Step 3: Run helper and background tests**

Run:

```bash
pnpm vitest packages/ai/src/__tests__/openai-compatible.test.ts packages/ai/src/__tests__/rewrite.test.ts packages/ai/src/__tests__/prompts.test.ts apps/extension/src/background/__tests__/ai-service.test.ts apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts --run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/src/ui/options/App.vue apps/extension/src/ui/options/views/Posts.vue
git commit -m "feat: wire ai rewrite flow"
```

---

## Task 7: Build and Manual Verification

**Files:**

- No new files.

- [ ] **Step 1: Refresh dependencies**

Run:

```bash
pnpm install
```

Expected: dependencies install without errors.

- [ ] **Step 2: Run targeted tests**

Run:

```bash
pnpm vitest packages/ai/src/__tests__/openai-compatible.test.ts packages/ai/src/__tests__/rewrite.test.ts packages/ai/src/__tests__/prompts.test.ts apps/extension/src/background/__tests__/ai-service.test.ts apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts --run
```

Expected: PASS.

- [ ] **Step 3: Build extension**

Run:

```bash
pnpm --filter @synccaster/extension build:fast
```

Expected: build completes and produces `apps/extension/dist`.

- [ ] **Step 4: Manual AI-disabled path**

Use the extension options page:

1. Open `AI 设置`.
2. Turn AI rewrite off.
3. Open `文章管理`.
4. Click `编辑/发布` on a collected post.
5. Confirm the hash becomes `editor/<postId>`.

- [ ] **Step 5: Manual AI-enabled path without generating**

Use the extension options page:

1. Open `AI 设置`.
2. Turn AI rewrite on.
3. Save settings.
4. Open `文章管理`.
5. Click `编辑/发布` on a collected post.
6. Confirm the hash becomes `ai-rewrite/<postId>`.
7. Click `跳过 AI，直接编辑`.
8. Confirm the hash becomes `editor/<postId>`.

- [ ] **Step 6: Manual settings storage check**

Use DevTools for the extension page:

1. Save settings with an API key.
2. Inspect IndexedDB `synccaster.config`.
3. Confirm `ai.rewrite.config` does not contain `apiKey`.
4. Inspect IndexedDB `synccaster.secrets`.
5. Confirm `ai.openai.apiKey` exists.

- [ ] **Step 7: Manual generation check**

Use a configured OpenAI-compatible endpoint:

1. Open a collected post through `AI 文案生成`.
2. Click generate.
3. Confirm two or three candidate cards render.
4. Select one candidate.
5. Click `使用选中文案`.
6. Confirm the existing editor opens.
7. Confirm title and body match the selected candidate.

- [ ] **Step 8: Final status**

Run:

```bash
git status --short
```

Expected: clean working tree.
