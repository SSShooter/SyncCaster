# SyncCaster MCP Configuration Guide

Complete setup instructions for integrating SyncCaster MCP with various AI agents.

## Prerequisites

1. **Chrome Extension Installed**
   - Download from [SyncCaster releases](https://github.com/RyanYipeng/SyncCaster/releases)
   - Extract to local folder
   - Load in Chrome: `chrome://extensions/` → Developer Mode → Load unpacked

2. **Extension ID Required**
   - After loading, note the extension ID (32-character string in extension card)
   - Example: `abcdefghijklmnopabcdefghijklmnop`

3. **Accounts Bound**
   - Open SyncCaster extension → Accounts tab
   - Log in to desired platforms
   - Verify accounts show as "active"

## OpenClaw Setup

### Step 1: Build the MCP Server

```bash
cd SyncCaster-mcp
pnpm install
pnpm --filter @synccaster/agent-bridge build
```

This creates the MCP server at: `apps/agent-bridge/dist/mcp.js`

### Step 2: Configure OpenClaw

Edit OpenClaw config file (typically `~/.openclaw/config.yaml` or similar):

```yaml
mcpServers:
  synccaster:
    command: node
    args:
      - /absolute/path/to/SyncCaster-mcp/apps/agent-bridge/dist/mcp.js
    env: {}
```

Replace `/absolute/path/to/SyncCaster-mcp` with your actual path.

### Step 3: Native Host (Linux Only)

If you're on Linux, install the native messaging host:

```bash
pnpm --filter @synccaster/agent-bridge install:native:linux --extension-id <EXTENSION_ID>
```

Replace `<EXTENSION_ID>` with your actual Chrome extension ID.

This installs:
- Launcher script: `apps/agent-bridge/.native-host/synccaster-agent-bridge-native`
- Manifest: `~/.config/google-chrome/NativeMessagingHosts/org.synccaster.bridge.json`

### Step 4: Restart OpenClaw

```bash
openclaw gateway restart
```

### Step 5: Verify

Test MCP connection:

```bash
# In OpenClaw chat
> Use synccaster health tool
```

Expected response: `{ status: 'ok', version: '2.0.0', connected: true }`

## Claude Code Setup

### Step 1: Build MCP Server

Same as OpenClaw:

```bash
cd SyncCaster-mcp
pnpm install
pnpm --filter @synccaster/agent-bridge build
```

### Step 2: Configure Claude Code

Edit Claude Code's MCP config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "synccaster": {
      "command": "node",
      "args": [
        "/absolute/path/to/SyncCaster-mcp/apps/agent-bridge/dist/mcp.js"
      ]
    }
  }
}
```

### Step 3: Native Host (Linux Only)

Same as OpenClaw:

```bash
pnpm --filter @synccaster/agent-bridge install:native:linux --extension-id <EXTENSION_ID>
```

### Step 4: Restart Claude Code

Quit and restart Claude Code application.

### Step 5: Verify

In Claude Code chat:

```
> Use synccaster health
```

Expected: Success response with status and version.

## Cline (VS Code) Setup

### Step 1: Install Cline Extension

Install [Cline extension](https://marketplace.visualstudio.com/items?itemName=Cline.cline) in VS Code.

### Step 2: Build MCP Server

Same as above:

```bash
cd SyncCaster-mcp
pnpm install
pnpm --filter @synccaster/agent-bridge build
```

### Step 3: Configure MCP

Cline uses Claude's MCP config. Edit the same config file as Claude Code:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "synccaster": {
      "command": "node",
      "args": [
        "/absolute/path/to/SyncCaster-mcp/apps/agent-bridge/dist/mcp.js"
      ]
    }
  }
}
```

### Step 4: Native Host (Linux Only)

Same as OpenClaw:

```bash
pnpm --filter @synccaster/agent-bridge install:native:linux --extension-id <EXTENSION_ID>
```

### Step 5: Restart

Reload VS Code window after config change.

### Step 6: Verify

In Cline chat:

```
> Use synccaster health
```

## Direct HTTP API Usage

If you prefer not to use MCP, the bridge also exposes HTTP endpoints.

### Architecture

```
Your Application
  ↓ HTTP
  http://127.0.0.1:39123
  ↓
  SyncCaster HTTP Server
  ↓ Native Messaging
  SyncCaster Extension
```

### Starting the HTTP Bridge

```bash
# Build first
pnpm --filter @synccaster/agent-bridge build

# Start native host (this starts HTTP server automatically)
node apps/agent-bridge/dist/native-host.js
```

The HTTP server listens on `127.0.0.1:39123`.

### HTTP Endpoints

All endpoints accept JSON and return JSON:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Health check |
| GET | `/v1/platforms` | List supported platforms |
| GET | `/v1/accounts` | List bound accounts |
| POST | `/v1/posts` | Create post |
| PATCH | `/v1/posts/:postId` | Update post |
| POST | `/v1/posts/:postId/publish` | Publish post |
| GET | `/v1/jobs/:jobId` | Get job status |
| POST | `/v1/jobs/:jobId/cancel` | Cancel job |
| POST | `/v1/render/wechat` | Render WeChat HTML |

### Example Requests

```bash
# Health check
curl http://127.0.0.1:39123/v1/health

# List platforms
curl http://127.0.0.1:39123/v1/platforms

# Create post
curl -X POST http://127.0.0.1:39123/v1/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World",
    "body_md": "# Hello\n\nThis is a test post.",
    "tags": ["test", "hello"]
  }'

# Publish post
curl -X POST http://127.0.0.1:39123/v1/posts/{postId}/publish \
  -H "Content-Type: application/json" \
  -d '{
    "targets": [
      {"platform": "juejin"},
      {"platform": "csdn"}
    ]
  }'
```

## Native Host Installation

### Linux

Already covered above. For manual installation:

1. Create launcher script at `~/.local/bin/synccaster-agent-bridge-native`:

```bash
#!/bin/bash
exec node /path/to/apps/agent-bridge/dist/native-host.js
```

2. Make executable:

```bash
chmod +x ~/.local/bin/synccaster-agent-bridge-native
```

3. Create manifest at `~/.config/google-chrome/NativeMessagingHosts/org.synccaster.bridge.json`:

```json
{
  "name": "org.synccaster.bridge",
  "description": "SyncCaster Agent Bridge",
  "path": "/home/username/.local/bin/synccaster-agent-bridge-native",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://<EXTENSION_ID>/"
  ]
}
```

Replace `/home/username` with your home directory and `<EXTENSION_ID>` with your extension ID.

### macOS / Windows

Native host is **not required** on macOS and Windows. The MCP server communicates directly with the HTTP bridge, which doesn't need native messaging.

On these platforms, simply:
1. Build the MCP server: `pnpm --filter @synccaster/agent-bridge build`
2. Configure MCP client to use `apps/agent-bridge/dist/mcp.js`
3. Start MCP client

The native host is only needed on Linux where Chrome Native Messaging is used.

## Troubleshooting

### MCP Tools Not Available

**Symptom**: Agent says "I don't have access to synccaster tools"

**Solutions**:
1. Verify MCP config file path is correct
2. Check config file syntax (valid JSON/YAML)
3. Restart the agent application
4. Check agent logs for MCP connection errors

### Bridge Not Responding

**Symptom**: `health` tool returns error or timeout

**Solutions**:
1. Verify Chrome extension is loaded and enabled
2. Check MCP server path is correct
3. On Linux: Verify native host manifest is installed correctly
4. Check Chrome console for extension errors
5. Restart Chrome and re-load extension

### Account Not Found

**Symptom**: `publish_post` returns "default_account_not_configured"

**Solutions**:
1. Open SyncCaster extension → Accounts tab
2. Log in to the platform
3. Verify account shows as "active"
4. Set as default if multiple accounts per platform

### Native Host Connection Failed (Linux Only)

**Symptom**: Extension shows "Native host disconnected" in logs

**Solutions**:
1. Verify native host script is executable: `chmod +x script-path`
2. Check manifest JSON syntax is valid
3. Verify extension ID in manifest matches actual extension ID
4. Test native host manually: `node apps/agent-bridge/dist/native-host.js`
5. Check Chrome native messaging logs

### Extension ID Location

Chrome extension ID is a 32-character string visible at:
- `chrome://extensions/` page (top of extension card)
- Extension folder name in Chrome profile: `Default/Extensions/<ID>/...`

## Verification Checklist

- [ ] Chrome extension loaded and enabled
- [ ] Extension ID noted
- [ ] Accounts logged in and active
- [ ] MCP server built (`pnpm --filter @synccaster/agent-bridge build`)
- [ ] MCP config file created/updated
- [ ] Native host installed (Linux only)
- [ ] Agent application restarted
- [ ] `health` tool returns success
- [ ] `list_platforms` returns platform list
- [ ] `list_accounts` returns account list

If all checked, SyncCaster MCP is ready to use!
