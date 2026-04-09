# SyncCaster Architecture

System architecture and communication flow for SyncCaster MCP bridge.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent                          │
│                  (OpenClaw / Claude Code)               │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol (JSON-RPC)
                     │ stdio
┌────────────────────▼────────────────────────────────────┐
│              synccaster-agent-bridge-mcp               │
│                 (MCP Server)                         │
│  apps/agent-bridge/src/mcp.ts                      │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (localhost)
                     │ 127.0.0.1:39123
┌────────────────────▼────────────────────────────────────┐
│              synccaster-agent-bridge-http               │
│              (HTTP Bridge Server)                      │
│  apps/agent-bridge/src/http-server.ts                │
└────────────────────┬────────────────────────────────────┘
                     │ Native Messaging (stdio)
                     │
┌────────────────────▼────────────────────────────────────┐
│         synccaster-agent-bridge-native                │
│       (Chrome Native Messaging Host)                    │
│  apps/agent-bridge/src/native-host.ts                 │
└────────────────────┬────────────────────────────────────┘
                     │ Chrome Extension Messaging API
                     │
┌────────────────────▼────────────────────────────────────┐
│           SyncCaster Chrome Extension                │
│                  (Background Service Worker)            │
│  apps/extension/src/background/                      │
│  ├── agent-rpc.ts (RPC Handler)                     │
│  ├── publish-engine.ts (Publish Logic)               │
│  └── platform-api.ts (Platform Adapters)             │
└────────────────────┬────────────────────────────────────┘
                     │ Browser Automation / DOM APIs
                     │
┌────────────────────▼────────────────────────────────────┐
│              Target Platforms                         │
│        (Juejin, CSDN, Zhihu, WeChat, etc.)        │
└─────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. AI Agent Layer

**Role**: Initiates MCP tool calls

**Examples**:
- OpenClaw
- Claude Code
- Cline (VS Code)
- Custom MCP clients

**Capabilities**:
- List available tools
- Call tools with parameters
- Receive structured responses
- Handle errors

**Communication**:
- Protocol: MCP (Model Context Protocol)
- Transport: stdio (stdin/stdout)
- Format: JSON-RPC 2.0

---

### 2. MCP Server Layer

**Component**: `apps/agent-bridge/src/mcp.ts`

**Role**: Exposes SyncCaster capabilities as MCP tools

**Key Functions**:

1. **Tool Registration**
   ```typescript
   const TOOL_DEFINITIONS: ToolDefinition[] = [
     { name: 'health', ... },
     { name: 'list_platforms', ... },
     { name: 'create_post', ... },
     // ... 9 tools total
   ];
   ```

2. **Request Handling**
   ```typescript
   case 'tools/call': {
     const toolName = message.params?.name;
     const result = await callTool(toolName, message.params?.arguments);
     return { id, result };
   }
   ```

3. **Protocol Negotiation**
   ```typescript
   case 'initialize': {
     return {
       protocolVersion: negotiateProtocolVersion(clientVersion),
       capabilities: { tools: {} },
       serverInfo: { name, version }
     };
   }
   ```

**Tool List**:
- `health` - Check connectivity
- `list_platforms` - Query platforms
- `list_accounts` - Query accounts
- `create_post` - Create article
- `update_post` - Modify article
- `publish_post` - Publish article
- `get_job_status` - Query job status
- `cancel_job` - Cancel job
- `render_wechat_html` - WeChat rendering

---

### 3. HTTP Bridge Layer

**Component**: `apps/agent-bridge/src/http-server.ts`

**Role**: Converts HTTP requests to native messaging calls

**Endpoints**:

| Method | Path | Action |
|--------|------|--------|
| GET | `/v1/health` | health |
| GET | `/v1/platforms` | list_platforms |
| GET | `/v1/accounts` | list_accounts |
| POST | `/v1/posts` | create_post |
| PATCH | `/v1/posts/:postId` | update_post |
| POST | `/v1/posts/:postId/publish` | publish_post |
| GET | `/v1/jobs/:jobId` | get_job_status |
| POST | `/v1/jobs/:jobId/cancel` | cancel_job |
| POST | `/v1/render/wechat` | render_wechat_html |

**Request Flow**:
```typescript
// 1. HTTP request arrives
server.on('request', async (req, res) => {
  const body = await readJsonBody(req);
  const route = resolveRoute(req, body, baseUrl);

  // 2. Forward to native host
  const response = await transport.request(route.action, route.payload);

  // 3. Send HTTP response
  sendJson(res, 200, unwrapTransportResponse(response));
});
```

**Server Config**:
- Host: `127.0.0.1`
- Port: `39123`
- Protocol: HTTP

---

### 4. Native Host Layer

**Component**: `apps/agent-bridge/src/native-host.ts`

**Role**: Bridges HTTP bridge and Chrome extension

**Responsibilities**:

1. **Start HTTP Server**
   ```typescript
   const server = await startHttpServer({
     request: async (action, payload) => session.request(action, payload)
   });
   ```

2. **Native Messaging Session**
   ```typescript
   const session = new NativeMessagingSession();
   session.start();

   session.onDisconnect(() => {
     shutdown('extension disconnected');
   });
   ```

3. **Lifecycle Management**
   - Auto-reconnect on disconnect
   - Graceful shutdown on SIGINT/SIGTERM
   - Log errors to stderr

**Native Messaging (Linux Only)**:

Chrome Native Messaging allows native apps to communicate with extensions.

**Manifest**: `org.synccaster.bridge.json`
```json
{
  "name": "org.synccaster.bridge",
  "description": "SyncCaster Agent Bridge",
  "path": "/path/to/native-host",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://<EXTENSION_ID>/"]
}
```

---

### 5. Extension Layer

**Component**: `apps/extension/src/background/`

**Key Modules**:

#### 5.1 RPC Handler (`agent-rpc.ts`)

Processes MCP requests from native host.

```typescript
export async function handleAgentRpcRequest(request: AgentRpcRequest) {
  switch (request.action) {
    case 'health':
      return healthResponse;
    case 'create_post':
      return await createPost(request.payload);
    case 'publish_post':
      return await publishPost(request.payload);
    // ... handle all actions
  }
}
```

#### 5.2 Publish Engine (`publish-engine.ts`)

Core publishing logic.

**Pipeline**:
```typescript
async function publishJob(job: Job) {
  for (const target of job.targets) {
    // 1. Get adapter
    const adapter = getAdapter(target.platform);

    // 2. Check auth
    const session = await adapter.ensureAuth(ctx);

    // 3. Transform content
    const payload = await adapter.transform(post, ctx);

    // 4. Publish
    const result = await adapter.publish(payload, ctx);

    // 5. Record result
    job.results.push(result);
  }
}
```

#### 5.3 Platform Adapters (`packages/adapters/`)

Platform-specific implementations.

**Adapter Interface**:
```typescript
interface PlatformAdapter {
  id: PlatformId;
  name: string;
  kind: 'dom' | 'api';

  // Authentication
  ensureAuth(ctx): Promise<AuthSession>;

  // Content transformation
  transform(post, ctx): Promise<Payload>;

  // Publishing
  publish(payload, ctx): Promise<Result>;

  // DOM automation (if kind === 'dom')
  dom?: {
    matchers: string[];
    fillAndPublish(payload): Promise<Result>;
  };
}
```

**Examples**:
- `juejin.ts` - DOM automation for Juejin
- `csdn.ts` - DOM automation for CSDN
- `wechat.ts` - Special HTML rendering for WeChat

#### 5.4 In-page Runner (`inpage-runner.ts`)

Executes scripts in target platform pages.

**Process**:
```typescript
// 1. Open target URL
const tab = await chrome.tabs.create({ url: targetUrl });

// 2. Inject content script
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['inpage-runner.js']
});

// 3. Send instructions to script
chrome.tabs.sendMessage(tab.id, {
  action: 'fillAndPublish',
  payload
});

// 4. Wait for response
const result = await onMessage;
```

#### 5.5 Account Service (`account-service.ts`)

Manages platform accounts and authentication.

**Features**:
- Login state detection
- Cookie management
- Expiration handling
- Default account selection

---

### 6. Platform Layer

**Role**: Target platforms where content is published

**Communication Methods**:

#### DOM Automation
- Adapter opens platform editor page
- Content script injects into page
- Script fills form fields (title, content, tags)
- Script clicks publish button
- Result captured and returned

**Supported**: Most platforms (Juejin, CSDN, etc.)

#### API (Future)
- Direct API calls to platform backend
- No browser automation required
- More reliable but requires OAuth/API keys

**Supported**: Currently none, but architecture supports it

---

## Communication Flow

### Flow 1: Create Post

```
AI Agent: create_post({title, body_md})
  ↓ MCP (stdio)
MCP Server: Receive request
  ↓ HTTP (127.0.0.1:39123)
HTTP Bridge: Forward to native host
  ↓ Native Messaging (stdio)
Native Host: Send to extension
  ↓ Chrome Messaging API
Extension RPC Handler: handleAgentRpcRequest('create_post')
  ↓ IndexedDB
DB: Store post record
  ↓ Response chain
Extension → Native Host → HTTP Bridge → MCP Server → AI Agent
Response: { postId: "uuid" }
```

### Flow 2: Publish Post

```
AI Agent: publish_post({postId, targets})
  ↓ MCP
MCP Server: Receive request
  ↓ HTTP
HTTP Bridge: Forward to native host
  ↓ Native Messaging
Native Host: Send to extension
  ↓ Chrome Messaging API
Extension RPC Handler: handleAgentRpcRequest('publish_post')
  ↓
Job Service: Create job record
  ↓
Publish Engine: Iterate over targets

For each target:
  ├─ Get Platform Adapter
  ├─ Check Authentication
  ├─ Transform Content (MD→HTML/MD)
  ├─ Open Browser Tab
  ├─ Inject Content Script
  ├─ Fill Form Fields
  ├─ Click Publish
  └─ Wait for Result

  ↓
Update Job Status
  ↓ Response chain
AI Agent: { jobId: "uuid" }
```

### Flow 3: Query Job Status

```
AI Agent: get_job_status({jobId})
  ↓ MCP
MCP Server → HTTP Bridge → Native Host → Extension
  ↓
Extension RPC Handler: Query job from IndexedDB
  ↓
DB: Return job record
  ↓ Response chain
AI Agent: { jobState, progress, results[] }
```

---

## Data Models

### Post (IndexedDB)

```typescript
interface Post {
  id: string;              // UUID
  title: string;           // Article title
  body_md: string;        // Markdown content
  summary?: string;        // Short description
  tags?: string[];        // Article tags
  categories?: string[];   // Article categories
  canonicalUrl?: string;   // Canonical URL
  source_url?: string;    // Source URL
  meta?: Record<string, unknown>;  // Custom metadata
  createdAt: number;      // Timestamp
  updatedAt: number;      // Timestamp
}
```

### Account (IndexedDB)

```typescript
interface Account {
  id: string;             // Account ID
  platform: PlatformId;   // Platform ID
  nickname: string;       // Display name
  avatar?: string;        // Avatar URL
  enabled: boolean;       // Account enabled
  status: 'active' | 'expired';  // Login status
  cookieExpiresAt?: number;  // Cookie expiry
  lastError?: string;     // Last error message
}
```

### Job (IndexedDB)

```typescript
interface Job {
  id: string;             // Job ID
  postId: string;         // Target post ID
  targets: PublishTarget[];  // Publish targets
  state: JobState;        // pending | running | done | failed
  progress: number;       // 0-100
  logs: LogEntry[];      // Execution logs
  results: JobResult[];   // Per-platform results
  createdAt: number;
  updatedAt: number;
}
```

### PublishTarget

```typescript
interface PublishTarget {
  platform: PlatformId;
  accountId: string;
  config?: Record<string, unknown>;
}
```

### JobResult

```typescript
interface JobResult {
  platform: PlatformId;
  accountId: string;
  status: 'published' | 'failed' | 'pending_manual_confirm';
  url?: string;
  error?: string;
  updatedAt: number;
}
```

---

## Security Model

### Data Flow

1. **AI Agent** → Runs on user's machine
2. **MCP Server** → Local process, localhost only
3. **HTTP Bridge** → Local HTTP server, 127.0.0.1 only
4. **Native Host** → Local process
5. **Extension** → Runs in user's Chrome profile
6. **Platform** → Remote servers (HTTPS)

### Privacy Guarantees

- **No Cloud Sync**: All data remains local
- **No External Collection**: Extension does not send data elsewhere
- **Manual Confirmation**: Final publish button requires user action
- **Sandboxed**: Extension runs in Chrome sandbox
- **HTTPS Only**: Platform communications use HTTPS

### Attack Vectors

| Vector | Risk | Mitigation |
|---------|-------|------------|
| Malicious MCP client | Executes arbitrary publish commands | Manual confirmation required |
| Compromised extension | Exposes platform cookies | User must login, cookies stored locally |
| XSS in platform | Can steal cookies | Use HTTPS, follow platform security |
| Network interception | Data interception | HTTPS, localhost-only bridge |

---

## Performance Considerations

### Bottlenecks

1. **DOM Automation**: Slowest part (seconds per platform)
2. **Browser Overhead**: Opening/closing tabs
3. **IndexedDB Queries**: Generally fast (<100ms)
4. **HTTP Bridge**: Negligible latency (<10ms)

### Optimization Strategies

1. **Concurrent Publishing**: Publish to multiple platforms in parallel
2. **Tab Reuse**: Reuse tabs where possible
3. **Caching**: Cache account status, platform info
4. **Batch Operations**: Batch multiple posts (future feature)

### Limits

- **Max concurrent jobs**: Configurable (default: 3)
- **Job timeout**: Configurable (default: 5 minutes)
- **Max post size**: Platform-specific limits
- **Max images**: Platform-specific limits

---

## Error Handling

### Error Propagation

```
Platform Error → Adapter Result → Job Result → Job State
  ↓
Extension RPC Handler → AgentRpcError
  ↓
Native Host → HTTP Bridge → MCP Server
  ↓
AI Agent: { ok: false, error: {...} }
```

### Error Types

| Level | Error | Handling |
|--------|--------|----------|
| Platform | Publish failed | Record in job.result, continue |
| Account | Login required | Mark job as failed, notify user |
| Extension | Internal error | Mark job as failed, log error |
| Bridge | Connection lost | Auto-reconnect, retry or fail |
| MCP | Invalid request | Return validation error |

### Retry Strategy

- **Transient Errors**: Retry with exponential backoff (max 3 attempts)
- **Permanent Errors**: Fail immediately
- **User Action Required**: Pause job, prompt user

---

## Future Extensions

### Planned Features

1. **API Support**: Direct platform APIs (no DOM automation)
2. **Batch Publish**: Multiple posts in one job
3. **Scheduled Publish**: Publish at specific times
4. **Analytics**: Track views, engagement across platforms
5. **Content Sync**: Sync comments, stats back to local

### Extensibility Points

- **New Adapters**: Add `packages/adapters/src/<platform>.ts`
- **New Tools**: Add to `apps/agent-bridge/src/mcp.ts`
- **Custom Renderers**: Extend `packages/core/src/renderer/`
- **Custom Transforms**: Extend `packages/core/src/ast/`

---

## Summary

**Architecture Highlights**:
1. **Layered Design**: Clean separation of concerns
2. **Local-First**: All data stays on user's machine
3. **Protocol Standard**: MCP for AI agent integration
4. **Extensible**: Easy to add platforms and tools
5. **Secure**: Manual confirmation, HTTPS, sandboxing

**Key Flows**:
- Create: Agent → MCP → Bridge → Extension → DB
- Publish: Agent → MCP → Bridge → Extension → Platform
- Query: Agent → MCP → Bridge → Extension → DB

**For Implementation**:
- See [MCP-CONFIG.md](mcp-config.md) for setup
- See [MCP-TOOLS.md](mcp-tools.md) for API reference
- See [PLATFORM-LIST.md](platform-list.md) for platform details
