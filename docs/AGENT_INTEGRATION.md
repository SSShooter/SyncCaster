# SyncCaster Agent Integration

SyncCaster now exposes a local agent bridge while keeping the browser extension as the only publish executor. The final publish button still requires manual confirmation inside the browser.

## Architecture

```text
Agent / MCP Client
  -> synccaster-agent-bridge-mcp (stdio MCP)
  -> http://127.0.0.1:39123
  -> synccaster-agent-bridge-native (Chrome Native Messaging host)
  -> SyncCaster extension background
  -> Existing publish engine and platform adapters
```

## Public Local APIs

The bridge exposes the same capability set over HTTP and MCP:

- `health`
- `list_platforms`
- `list_accounts`
- `create_post`
- `update_post`
- `publish_post`
- `get_job_status`
- `cancel_job`
- `render_wechat_html`

HTTP endpoints:

- `GET /v1/health`
- `GET /v1/platforms`
- `GET /v1/accounts`
- `POST /v1/posts`
- `PATCH /v1/posts/:postId`
- `POST /v1/posts/:postId/publish`
- `GET /v1/jobs/:jobId`
- `POST /v1/jobs/:jobId/cancel`
- `POST /v1/render/wechat`

## Native Host Installation on Linux

1. Build the bridge:

```bash
pnpm --filter @synccaster/agent-bridge build
```

2. Find the unpacked extension ID in Chrome.

3. Install the native host manifest:

```bash
pnpm --filter @synccaster/agent-bridge install:native:linux --extension-id <EXTENSION_ID>
```

Optional:

- `--browser chrome`
- `--browser chromium`
- `--browser both`

The installer writes:

- a launcher script under `apps/agent-bridge/.native-host/`
- a native messaging manifest under `~/.config/google-chrome/NativeMessagingHosts/` and/or `~/.config/chromium/NativeMessagingHosts/`

## MCP Usage

Point your MCP client at the built stdio server:

```json
{
  "mcpServers": {
    "synccaster": {
      "command": "node",
      "args": ["/absolute/path/to/apps/agent-bridge/dist/mcp.js"]
    }
  }
}
```

The MCP server forwards every tool call to the local HTTP bridge at `127.0.0.1:39123`.
