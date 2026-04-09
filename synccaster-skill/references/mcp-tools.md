# SyncCaster MCP Tools Reference

Complete API reference for all SyncCaster MCP tools with request/response examples.

## Tool Summary

| Tool | Description | Input Required |
|------|-------------|---------------|
| `health` | Check bridge connectivity | None |
| `list_platforms` | Query supported platforms | None |
| `list_accounts` | Check bound accounts | None |
| `create_post` | Create article from Markdown | `title`, `body_md` |
| `update_post` | Modify existing post | `postId` |
| `publish_post` | Start publish job | `postId`, `targets[]` |
| `get_job_status` | Query job progress | `jobId` |
| `cancel_job` | Cancel in-flight job | `jobId` |
| `render_wechat_html` | Convert to WeChat HTML | `markdown` |

## 1. health

Check whether the local SyncCaster bridge is reachable and extension is connected.

### Request

```json
{
  "action": "health",
  "payload": {}
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "2.0.0",
    "connected": true
  }
}
```

### Fields

- `status` (string): Always `"ok"` if bridge is reachable
- `version` (string): Extension version
- `connected` (boolean): Whether extension is connected

### Example Usage

```
> Check if SyncCaster bridge is running
→ Use health tool
→ Returns: { status: 'ok', version: '2.0.0', connected: true }
→ Bridge is ready
```

---

## 2. list_platforms

List all supported publish platforms and their content capabilities.

### Request

```json
{
  "action": "list_platforms",
  "payload": {}
}
```

### Response

```json
{
  "ok": true,
  "data": [
    {
      "id": "juejin",
      "name": "掘金",
      "supportsMarkdown": true,
      "supportsHtml": false,
      "supportsLatex": true
    },
    {
      "id": "csdn",
      "name": "CSDN",
      "supportsMarkdown": true,
      "supportsHtml": false,
      "supportsLatex": true
    },
    {
      "id": "zhihu",
      "name": "知乎",
      "supportsMarkdown": false,
      "supportsHtml": true,
      "supportsLatex": true
    }
  ]
}
```

### Fields

- `id` (string): Platform identifier (use this in `publish_post`)
- `name` (string): Display name
- `supportsMarkdown` (boolean): Whether platform accepts Markdown
- `supportsHtml` (boolean): Whether platform accepts HTML
- `supportsLatex` (boolean): Whether platform supports LaTeX math

### Example Usage

```
> What platforms support LaTeX?
→ Use list_platforms
→ Filter: platforms where supportsLatex === true
→ Returns: juejin, csdn, zhihu, ...
```

---

## 3. list_accounts

List all bound accounts and their status, including default publish settings.

### Request

```json
{
  "action": "list_accounts",
  "payload": {}
}
```

### Response

```json
{
  "ok": true,
  "data": [
    {
      "platform": "juejin",
      "accountId": "acc_123",
      "nickname": "myusername",
      "enabled": true,
      "status": "active",
      "isDefaultPublish": true
    },
    {
      "platform": "csdn",
      "accountId": "acc_456",
      "nickname": "dev_user",
      "enabled": true,
      "status": "expired",
      "isDefaultPublish": false
    }
  ]
}
```

### Fields

- `platform` (string): Platform ID
- `accountId` (string): Internal account identifier
- `nickname` (string): Account display name
- `enabled` (boolean): Whether account is enabled
- `status` (string): Account status (`"active"` | `"expired"`)
- `isDefaultPublish` (boolean): Whether this is the default account for platform

### Example Usage

```
> Check if I have a Juejin account ready
→ Use list_accounts
→ Find: platform === 'juejin' && enabled === true && status === 'active'
→ Returns account details if found
```

---

## 4. create_post

Create a canonical post in SyncCaster from Markdown content.

### Request

```json
{
  "action": "create_post",
  "payload": {
    "title": "Hello World",
    "body_md": "# Hello\n\nThis is a test post.",
    "summary": "A brief introduction",
    "tags": ["test", "hello"],
    "categories": ["tech"],
    "canonicalUrl": "https://example.com/post",
    "source_url": "https://original-source.com",
    "meta": {
      "customField": "value"
    }
  }
}
```

### Required Fields

- `title` (string): Post title (non-empty)
- `body_md` (string): Markdown body (non-empty)

### Optional Fields

- `summary` (string): Short description
- `tags` (string[]): Array of tag strings
- `categories` (string[]): Array of category strings
- `canonicalUrl` (string): Canonical URL
- `source_url` (string): Original source URL
- `meta` (object): Custom metadata

### Response

```json
{
  "ok": true,
  "data": {
    "postId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Fields

- `postId` (string): Generated post ID (use for update/publish)

### Error Codes

- `validation_error`: Required fields missing or invalid

### Example Usage

```
> Create a post about TypeScript
→ Use create_post
→ Input: title="TypeScript Guide", body_md="# TypeScript\n\n..."
→ Returns: { postId: "uuid" }
→ Save postId for publishing
```

---

## 5. update_post

Update an existing post by postId. Only specified fields are updated.

### Request

```json
{
  "action": "update_post",
  "payload": {
    "postId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Updated Title",
    "body_md": "# New Content\n\n...",
    "tags": ["updated", "tags"]
  }
}
```

### Required Fields

- `postId` (string): Existing SyncCaster post ID

### Optional Fields

- Same as `create_post`: `title`, `body_md`, `summary`, `tags`, `categories`, `canonicalUrl`, `source_url`, `meta`

### Response

```json
{
  "ok": true,
  "data": {
    "postId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Fields

- `postId` (string): Updated post ID (same as input)

### Error Codes

- `post_not_found`: Post with given ID doesn't exist
- `validation_error`: Invalid field types

### Example Usage

```
> Add a tag to the existing post
→ Use update_post
→ Input: postId="uuid", tags={...existing, "new-tag"}
→ Returns: { postId: "uuid" }
→ Post updated successfully
```

---

## 6. publish_post

Create and start a publish job for one or more platforms. Final publish confirmation remains manual in the browser.

### Request

```json
{
  "action": "publish_post",
  "payload": {
    "postId": "550e8400-e29b-41d4-a716-446655440000",
    "targets": [
      {
        "platform": "juejin",
        "config": {}
      },
      {
        "platform": "csdn"
      }
    ]
  }
}
```

### Required Fields

- `postId` (string): Existing SyncCaster post ID
- `targets` (array): Array of target objects (at least one)

### Target Object Fields

- `platform` (string, required): Target platform ID
- `config` (object, optional): Platform-specific configuration

### Response

```json
{
  "ok": true,
  "data": {
    "jobId": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

### Fields

- `jobId` (string): Generated job ID (use for status queries)

### Error Codes

- `post_not_found`: Post doesn't exist
- `validation_error`: Invalid targets array
- `default_account_not_configured`: No account for target platform

### Example Usage

```
> Publish my post to Juejin and CSDN
→ Use publish_post
→ Input: postId="uuid", targets=[{platform:"juejin"}, {platform:"csdn"}]
→ Returns: { jobId: "job-uuid" }
→ Check job status with get_job_status
```

---

## 7. get_job_status

Fetch the normalized state and per-platform results of a publish job.

### Request

```json
{
  "action": "get_job_status",
  "payload": {
    "jobId": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

### Required Fields

- `jobId` (string): SyncCaster job ID

### Response

```json
{
  "ok": true,
  "data": {
    "jobId": "660e8400-e29b-41d4-a716-446655440001",
    "postId": "550e8400-e29b-41d4-a716-446655440000",
    "state": "running",
    "progress": 50,
    "error": null,
    "results": [
      {
        "platform": "juejin",
        "accountId": "acc_123",
        "status": "published",
        "url": "https://juejin.cn/post/123",
        "updatedAt": 1712345678901
      },
      {
        "platform": "csdn",
        "accountId": "acc_456",
        "status": "failed",
        "error": "Login required",
        "updatedAt": 1712345678902
      }
    ]
  }
}
```

### Fields

- `jobId` (string): Job ID
- `postId` (string): Associated post ID
- `state` (string): Job state (`"pending" | "running" | "done" | "failed" | "pending_manual_confirm"`)
- `progress` (number): Progress percentage (0-100)
- `error` (string | null): Job-level error (if any)
- `results` (array): Per-platform results

### Result Object Fields

- `platform` (string): Platform ID
- `accountId` (string): Account used
- `status` (string): Result status (`"published" | "failed" | "pending_manual_confirm"`)
- `url` (string | optional): Published URL (if successful)
- `error` (string | optional): Error message (if failed)
- `updatedAt` (number): Timestamp

### Error Codes

- `job_not_found`: Job doesn't exist

### Example Usage

```
> Check if my publish job finished
→ Use get_job_status
→ Input: jobId="job-uuid"
→ Returns job state and results
→ If state === 'done', check individual platform results
```

---

## 8. cancel_job

Cancel an in-flight publish job.

### Request

```json
{
  "action": "cancel_job",
  "payload": {
    "jobId": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

### Required Fields

- `jobId` (string): SyncCaster job ID

### Response

```json
{
  "ok": true,
  "data": {
    "jobId": "660e8400-e29b-41d4-a716-446655440001",
    "postId": "550e8400-e29b-41d4-a716-446655440000",
    "state": "failed",
    "progress": 45,
    "error": "Cancelled by agent",
    "results": []
  }
}
```

### Fields

Same as `get_job_status` response, but job will be in `"failed"` state.

### Error Codes

- `job_not_found`: Job doesn't exist

### Example Usage

```
> Cancel the long-running job
→ Use cancel_job
→ Input: jobId="job-uuid"
→ Returns: job in 'failed' state
→ Job cancelled successfully
```

---

## 9. render_wechat_html

Render Markdown into WeChat-compatible HTML and CSS without publishing it.

### Request

```json
{
  "action": "render_wechat_html",
  "payload": {
    "markdown": "# Hello WeChat\n\nThis is a formatted post.",
    "options": {
      "theme": "default",
      "highlightCode": true
    }
  }
}
```

### Required Fields

- `markdown` (string): Markdown content (non-empty)

### Optional Fields

- `options` (object): Render settings
  - `theme` (string): Theme name (`"default"` | `"dark"` | custom)
  - `highlightCode` (boolean): Enable code highlighting

### Response

```json
{
  "ok": true,
  "data": {
    "html": "<section class=\"wx-content\">...</section>",
    "css": ".wx-content { ... }",
    "meta": {
      "wordCount": 150,
      "readTime": "1 min"
    }
  }
}
```

### Fields

- `html` (string): WeChat-compatible HTML
- `css` (string): Inline CSS styles
- `meta` (object, optional): Metadata (word count, etc.)

### Error Codes

- `validation_error`: Invalid markdown

### Example Usage

```
> Format this article for WeChat
→ Use render_wechat_html
→ Input: markdown="# Title\n\n..."
→ Returns: html + css
→ Copy to WeChat editor
```

---

## Common Workflows

### Workflow 1: Quick Publish to Single Platform

```
1. health → verify bridge
2. list_accounts → verify account
3. create_post(title, body_md) → get postId
4. publish_post(postId, [{platform}]) → get jobId
5. get_job_status(jobId) → monitor until done
```

### Workflow 2: Batch Publish to Multiple Platforms

```
1. list_platforms → check capabilities
2. list_accounts → verify all accounts
3. create_post(title, body_md, tags) → get postId
4. publish_post(postId, [
    {platform: 'juejin'},
    {platform: 'csdn'},
    {platform: 'zhihu'}
  ]) → get jobId
5. get_job_status(jobId) → poll every 5s
6. When state === 'done', review results
```

### Workflow 3: WeChat Formatting

```
1. render_wechat_html(markdown, {theme: 'dark'}) → get html + css
2. Open WeChat editor
3. Paste HTML content
4. Adjust if needed
```

---

## Error Handling

All tool responses include:

```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "Human-readable error",
    "details": {}
  }
}
```

Common error codes:

- `extension_unavailable`: Extension not connected (check browser)
- `post_not_found`: Post ID invalid
- `job_not_found`: Job ID invalid
- `default_account_not_configured`: No default account for platform
- `validation_error`: Invalid input parameters
- `internal_error`: Unexpected error (check logs)

See [error-codes.md](error-codes.md) for detailed error handling.
