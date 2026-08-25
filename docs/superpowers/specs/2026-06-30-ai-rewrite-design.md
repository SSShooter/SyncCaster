# AI Rewrite Candidates Design

## Goal

Add an optional AI rewrite workflow for collected articles while keeping SyncCaster's existing UI structure and publish pipeline intact.

When AI rewrite is enabled, a collected draft opens in a dedicated AI generation page before the existing editor. The user can generate two or three rewritten versions, choose one, and then continue in the original editor/publish flow. When AI rewrite is disabled, drafts continue to open exactly as they do today.

## Non-Goals

- Do not redesign the overall options page, dashboard, article editor, account page, or publish dialog.
- Do not change platform adapters or the publish engine.
- Do not introduce a hosted backend.
- Do not require MCP or native bridge installation for the first version.
- Do not support every AI provider in the first version; implement an OpenAI-compatible chat completions provider first.

## Design Principles

- Keep our additions isolated from upstream code to reduce merge conflicts.
- Put provider and prompt logic in a new workspace package instead of embedding it in Vue pages.
- Make the original path the fallback path. If AI is disabled or misconfigured, editing and publishing must still work.
- Store secrets locally only. The API key is sent only to the configured AI base URL when making model requests.
- Prefer existing UI conventions: Naive UI controls, current sidebar navigation, existing card/list density, and current dark-mode props.

## User Flow

1. User enables AI rewrite in the AI settings page and configures an OpenAI-compatible endpoint.
2. User collects an article using the existing collection flow.
3. The article appears in article management as a draft.
4. If AI rewrite is enabled and the draft is collected content, clicking the draft opens `ai-rewrite/<postId>`.
5. The AI rewrite page loads the draft, shows source metadata, and lets the user generate candidates.
6. The user chooses a candidate and clicks "Use selected version".
7. The selected title/body are saved back to the existing post record.
8. The app navigates to `editor/<postId>`.
9. The existing editor and publish flow continue unchanged.

If AI rewrite is disabled, step 4 navigates directly to `editor/<postId>` as it does today.

## Architecture

### New Package

Create `packages/ai`.

Responsibilities:

- Define AI config and rewrite request/result types.
- Implement an OpenAI-compatible chat completions client.
- Build rewrite prompts from a post and user-selected rewrite style.
- Normalize provider errors into UI-friendly codes/messages.
- Avoid any dependency on Vue, Chrome extension APIs, or IndexedDB.

Suggested files:

- `packages/ai/package.json`
- `packages/ai/src/index.ts`
- `packages/ai/src/types.ts`
- `packages/ai/src/openai-compatible.ts`
- `packages/ai/src/prompts.ts`
- `packages/ai/src/rewrite.ts`

### Extension Background Layer

Add `apps/extension/src/background/ai-service.ts`.

Responsibilities:

- Read AI config and API key from local storage/IndexedDB.
- Call `@synccaster/ai`.
- Expose background message handlers:
  - `AI_GET_CONFIG`
  - `AI_SAVE_CONFIG`
  - `AI_CLEAR_API_KEY`
  - `AI_TEST_CONNECTION`
  - `AI_GENERATE_CANDIDATES`

Update `apps/extension/src/background/index.ts` only to route these message types to `ai-service.ts`.

### Extension UI

Add two views:

- `apps/extension/src/ui/options/views/AiSettings.vue`
- `apps/extension/src/ui/options/views/AiRewrite.vue`

Update `apps/extension/src/ui/options/App.vue` only to register navigation and route components:

- Sidebar item: `AI 设置`
- Route: `ai-settings`
- Route: `ai-rewrite/<postId>` without necessarily adding it as a primary sidebar item.

Update `apps/extension/src/ui/options/views/Posts.vue` only at the edit entry point:

- If AI is enabled and the post is collected, navigate to `ai-rewrite/<postId>`.
- Otherwise navigate to `editor/<postId>`.

The AI rewrite page must also provide a direct "Skip AI and edit" action.

## Storage

Use existing local data stores where possible.

Non-secret config stored in `db.config`:

```ts
{
  key: "ai.rewrite.config",
  value: {
    enabled: boolean,
    baseUrl: string,
    model: string,
    temperature: number,
    candidateCount: 2 | 3,
    defaultStyle: "balanced" | "less_ai" | "platform_ready"
  }
}
```

API key stored in `db.secrets`:

```ts
{
  id: "ai.openai.apiKey",
  accountId: "ai",
  encrypted: string,
  iv: string
}
```

For the first version, `encrypted` may be a locally stored value protected by a lightweight local helper. If strong local encryption is not available without introducing fragile key management, the UI must label this as "stored locally in extension storage" rather than "securely encrypted". A future version can add a session-only key mode.

Post metadata:

- Do not require schema migration for AI outputs.
- Store optional AI metadata in `post.meta.aiRewrite`, such as selected candidate style, generatedAt, and provider model.

## AI Request Shape

Use OpenAI-compatible chat completions first because many providers support the same shape:

- `POST {baseUrl}/chat/completions`
- Header: `Authorization: Bearer <apiKey>`
- Body includes `model`, `messages`, `temperature`, and JSON-oriented instructions.

The AI package should accept base URLs with or without trailing `/v1`. It should normalize the final endpoint conservatively.

Expected output:

```ts
interface AiRewriteCandidate {
  id: string;
  title: string;
  bodyMd: string;
  summary?: string;
  rationale?: string;
  style: string;
}
```

The model prompt should ask for valid JSON. The parser should tolerate common Markdown-fenced JSON responses.

## UI Behavior

### AI Settings Page

Fields:

- Enable AI rewrite switch.
- API base URL.
- API key input with masking.
- Model name.
- Temperature.
- Candidate count, 2 or 3.
- Default rewrite style.
- Test connection button.
- Save button.
- Clear key button.

Copy:

- Explain that the key is stored locally.
- Explain that requests are sent to the configured AI service address.

### AI Rewrite Page

Page contents:

- Article title and source URL.
- Original text preview with collapsed/expanded state.
- Rewrite style selector.
- Generate button.
- Candidate cards.
- Use selected version button.
- Regenerate button.
- Skip AI and edit button.

Candidate cards should show title, excerpt, word count, and a diff-lite cue such as "more structured", "more human", or "more platform ready" from the candidate rationale.

## Error Handling

- AI disabled: skip to editor.
- Missing API key/base URL/model: show a settings prompt and link to AI settings.
- Network failure: show error and keep original draft untouched.
- Provider returns invalid JSON: show a parse error and let the user retry.
- Rate limit/auth error: show provider message if safe, otherwise show a normalized message.
- Candidate save failure: keep generated candidates in memory and show retry.

## Testing

Unit tests:

- `packages/ai` endpoint normalization.
- JSON candidate parsing, including fenced JSON.
- Prompt request construction.
- Error normalization.

Extension tests:

- AI config storage helpers.
- Posts navigation decision: AI enabled/disabled and collected/original posts.
- Background message handlers with a mocked AI package call.

Manual verification:

- AI disabled path opens the existing editor.
- AI enabled path opens the AI rewrite page for collected posts.
- Test connection works with a configured endpoint.
- Generated candidate can be saved and opened in the existing editor.
- Publish flow still starts from the existing editor.

## Implementation Boundaries

Allowed touch points:

- Add `packages/ai`.
- Add AI settings and rewrite views.
- Add thin background `ai-service.ts`.
- Add minimal route/nav entries in `App.vue`.
- Add minimal navigation decision in `Posts.vue`.
- Add workspace/package dependencies.

Avoid:

- Editing platform adapters.
- Editing `publish-engine.ts`.
- Embedding AI logic directly in `Editor.vue`.
- Adding broad permissions unrelated to the configured AI endpoint.
- Reworking the existing layout or sidebar style.
