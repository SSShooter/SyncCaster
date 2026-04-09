---
name: synccaster-mcp
description: Multi-platform content publishing via SyncCaster MCP. Use when users need to (1) Configure SyncCaster MCP bridge for AI agents (OpenClaw, Claude Code, etc.), (2) Publish content to 17+ platforms (Juejin, CSDN, Zhihu, WeChat, etc.) from Markdown, (3) Query platform support and account status, (4) Manage publish jobs and track progress, (5) Render WeChat-compatible HTML from Markdown. Triggers: "发布到掘金/CSDN/知乎", "多平台发布文章", "配置 SyncCaster MCP", "同步文章到多个博客", "微信排版渲染", "检查发布任务状态".
---

# SyncCaster MCP

Multi-platform content publishing bridge for AI agents. Configure once, publish to 17+ platforms automatically.

## Quick Start

### For Users

1. **Install Chrome Extension**
   - Clone from [SyncCaster](https://github.com/RyanYipeng/SyncCaster)
   - Extract to local folder (e.g., `~/SyncCaster`)
   - Open Chrome → `chrome://extensions/` → Enable Developer Mode → Load unpacked extension

2. **Configure MCP in your AI agent**
   - See [MCP-CONFIG.md](references/MCP-CONFIG.md) for detailed setup
   - Requires native host installation (Linux) or HTTP bridge setup

3. **Bind platform accounts**
   - Open SyncCaster extension → Accounts tab
   - Click platform icons to login and bind accounts

4. **Start publishing**
   - Use MCP tools to create posts from Markdown
   - Trigger publish jobs to target platforms
   - Manual confirmation in browser required for final publish

### For Agents

Use these MCP tools:

- `health` - Check bridge connectivity
- `list_platforms` - Query supported platforms and capabilities
- `list_accounts` - Check bound accounts and default settings
- `create_post` - Create article from Markdown
- `update_post` - Modify existing post
- `publish_post` - Start publish job (targets array required)
- `get_job_status` - Query job progress and per-platform results
- `cancel_job` - Cancel in-flight job
- `render_wechat_html` - Convert Markdown to WeChat HTML/CSS

## Configuration

Full setup instructions for different environments:

- **OpenClaw**: See [MCP-CONFIG.md](references/MCP-CONFIG.md) → OpenClaw Setup
- **Claude Code**: See [MCP-CONFIG.md](references/MCP-CONFIG.md) → Claude Code Setup
- **Cline (VS Code)**: See [MCP-CONFIG.md](references/MCP-CONFIG.md) → Cline Setup
- **Custom Integration**: See [MCP-CONFIG.md](references/MCP-CONFIG.md) → Direct HTTP API

## API Reference

Detailed documentation for MCP tools:

- [MCP-TOOLS.md](references/mcp-tools.md) - Complete tool reference with request/response examples
- [PLATFORM-LIST.md](references/platform-list.md) - All 17+ platforms and their capabilities
- [ERROR-CODES.md](references/error-codes.md) - Error handling and troubleshooting

## Common Workflows

### Publish to Single Platform

```
1. list_accounts → verify account exists
2. create_post(title, body_md) → get postId
3. publish_post(postId, [{platform}]) → get jobId
4. get_job_status(jobId) → track until done
```

### Publish to Multiple Platforms

```
1. list_platforms → check capabilities
2. list_accounts → verify all target accounts
3. create_post(title, body_md) → get postId
4. publish_post(postId, [
    {platform: 'juejin'},
    {platform: 'csdn'},
    {platform: 'zhihu'}
  ]) → get jobId
5. get_job_status(jobId) → monitor progress
```

### WeChat Article Formatting

```
render_wechat_html(markdown, {theme: 'default'}) → get html + css
```

Copy output to WeChat editor manually or via browser automation.

## Platform-Specific Notes

- **Juejin, CSDN, 51CTO**: Support Markdown + LaTeX
- **Zhihu, Toutiao, Baijiahao**: Rich text editors (HTML)
- **WeChat**: Special formatter with theme support (see [WECHAT-FORMATTING.md](references/WECHAT-FORMATTING.md))
- **Medium**: English platform, full Markdown support

See [PLATFORM-LIST.md](references/PLATFORM-LIST.md) for complete platform details.

## Troubleshooting

- Bridge not responding → Check [MCP-CONFIG.md](references/MCP-CONFIG.md) → Troubleshooting
- Account expired → Re-login in extension → Accounts tab
- Publish failed → Check job status error details → Platform-specific issues in [ERROR-CODES.md](references/ERROR-CODES.md)

## Security

- All data remains local; no external collection
- Final publish button requires manual browser confirmation
- Native host communicates only with extension via localhost

## References

For detailed information, consult:

- [MCP-CONFIG.md](references/MCP-CONFIG.md) - Complete MCP setup guide
- [MCP-TOOLS.md](references/MCP-TOOLS.md) - Tool reference with examples
- [PLATFORM-LIST.md](references/PLATFORM-LIST.md) - Platform capabilities matrix
- [ERROR-CODES.md](references/ERROR-CODES.md) - Error codes and solutions
- [WECHAT-FORMATTING.md](references/wechat-formatting.md) - WeChat rendering guide
- [ARCHITECTURE.md](references/architecture.md) - System architecture details
