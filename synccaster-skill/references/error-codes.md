# SyncCaster Error Codes

Complete reference for all error codes returned by SyncCaster MCP tools, with solutions.

## Error Response Format

All errors follow this structure:

```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

## Error Codes

### 1. extension_unavailable

**Description**: SyncCaster extension is not connected or not running.

**When it occurs**:
- Bridge can't communicate with Chrome extension
- Extension not loaded in browser
- Native host disconnected (Linux only)

**Common Causes**:
- Chrome extension not loaded
- Extension disabled
- Native host process crashed (Linux)
- Chrome not running

**Solutions**:

1. **Verify Extension Loaded**
   ```
   1. Open Chrome
   2. Navigate to chrome://extensions/
   3. Check if SyncCaster is enabled
   4. If not, load from unpacked folder
   ```

2. **Restart Extension**
   ```
   1. In chrome://extensions/
   2. Click "Reload" on SyncCaster extension
   3. Retry the MCP tool call
   ```

3. **Check Native Host (Linux Only)**
   ```bash
   # Verify native host is running
   ps aux | grep synccaster

   # Restart if needed
   killall synccaster-agent-bridge-native
   node /path/to/apps/agent-bridge/dist/native-host.js &
   ```

4. **Restart Chrome**
   ```
   1. Close all Chrome windows
   2. Reopen Chrome
   3. Verify extension is loaded
   4. Retry tool call
   ```

**Verification**:
```
Use health tool → Should return { status: 'ok', connected: true }
```

---

### 2. default_account_not_configured

**Description**: No default account configured for target platform.

**When it occurs**:
- Publishing to platform without bound account
- Account bound but not set as default
- Account expired or disabled

**Common Causes**:
- User hasn't logged in to platform
- Multiple accounts, none set as default
- Account cookie expired

**Solutions**:

1. **Open Extension and Login**
   ```
   1. Open SyncCaster extension
   2. Go to "Accounts" tab
   3. Click target platform icon
   4. Login in opened browser tab
   5. Return to extension, verify account appears
   ```

2. **Set Default Account**
   ```
   1. In Accounts tab, find your platform
   2. If multiple accounts, click "Set Default"
   3. Verify "Default" badge appears
   ```

3. **Refresh Account Status**
   ```
   1. In Accounts tab, click "Refresh" button
   2. Wait for status update
   3. Verify account shows "active"
   ```

4. **Check Account Validity**
   ```
   1. Use list_accounts tool
   2. Find target platform
   3. Check status === 'active' && enabled === true
   4. If status === 'expired', re-login
   ```

**Example**:
```
Input: publish_post(postId, [{platform: 'juejin'}])
Error: default_account_not_configured

Check accounts:
→ list_accounts
→ Find: platform === 'juejin' && status === 'active'
→ If missing, login via extension
```

---

### 3. post_not_found

**Description**: Post with given ID doesn't exist in local database.

**When it occurs**:
- Incorrect or invalid postId
- Post was deleted
- Post ID format error

**Common Causes**:
- Typo in postId
- Using old/invalid postId
- Post deleted manually

**Solutions**:

1. **Verify PostId Format**
   ```
   Correct format: UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
   Check: Should be 36 chars, includes hyphens
   ```

2. **Check Recent Posts**
   ```
   1. Use create_post to create new post
   2. Save returned postId
   3. Use this postId for publish/update
   ```

3. **Recreate Post**
   ```
   If postId lost:
   1. Create post again with create_post
   2. Use new postId
   3. Discard old postId
   ```

**Example**:
```
Input: publish_post('invalid-id', targets)
Error: post_not_found

Fix:
→ Create post first
→ Save returned postId: "550e8400-e29b-41d4-a716-446655440000"
→ Use correct postId in publish_post
```

---

### 4. job_not_found

**Description**: Job with given ID doesn't exist or has expired.

**When it occurs**:
- Incorrect or invalid jobId
- Job completed and archived
- Job ID format error

**Common Causes**:
- Typo in jobId
- Using old/expired jobId
- Job already completed long ago

**Solutions**:

1. **Verify JobId Format**
   ```
   Correct format: UUID (e.g., "660e8400-e29b-41d4-a716-446655440001")
   Check: Should be 36 chars, includes hyphens
   ```

2. **Use Recent JobId**
   ```
   1. Use publish_post to get jobId
   2. Immediately use get_job_status
   3. Don't use stale jobIds
   ```

3. **Check Job Completion**
   ```
   If job was long ago:
   - It may be archived
   - Create new publish job
   - Use new jobId
   ```

**Example**:
```
Input: get_job_status('invalid-id')
Error: job_not_found

Fix:
→ Create new publish job
→ Save returned jobId
→ Use this jobId for status checks
```

---

### 5. unsupported_platform

**Description**: Platform ID is not supported or doesn't exist.

**When it occurs**:
- Typo in platform ID
- Using non-existent platform
- Platform ID case error

**Common Causes**:
- Misspelled platform name
- Wrong platform ID format
- Using platform name instead of ID

**Solutions**:

1. **List Supported Platforms**
   ```
   Use list_platforms tool
   Review returned platform IDs
   Use correct ID from list
   ```

2. **Check Platform ID**
   ```
   Correct IDs (examples):
   - 'juejin' (not '掘金' or 'juejin.com')
   - 'csdn' (not 'CSDN')
   - 'zhihu' (not '知乎')
   ```

3. **Verify Input**
   ```
   Check publish_post targets:
   [{platform: 'juejin'}]  ✅ Correct
   [{platform: 'Juejin'}]  ❌ Case error
   [{platform: '掘金'}]    ❌ Wrong language
   ```

**Example**:
```
Input: publish_post(postId, [{platform: 'Juejin'}])
Error: unsupported_platform

Fix:
→ list_platforms
→ Find: id === 'juejin'
→ Use lowercase ID: {platform: 'juejin'}
```

---

### 6. validation_error

**Description**: Input parameters are invalid or missing required fields.

**When it occurs**:
- Missing required fields
- Invalid field types
- Malformed input data

**Common Causes**:
- Empty title or body_md
- Wrong type for tags/categories (not array)
- Invalid JSON structure
- Null/undefined values

**Solutions**:

1. **Check Required Fields**
   ```
   create_post:
   - title: string (non-empty) ✅ Required
   - body_md: string (non-empty) ✅ Required

   publish_post:
   - postId: string ✅ Required
   - targets: array (non-empty) ✅ Required

   get_job_status:
   - jobId: string ✅ Required
   ```

2. **Validate Field Types**
   ```
   Correct:
   {
     "title": "Hello",
     "body_md": "# Hi\n\n...",
     "tags": ["tech", "tutorial"]
   }

   Wrong:
   {
     "title": "",           ❌ Empty
     "body_md": null,      ❌ Null
     "tags": "tech"        ❌ String, not array
   }
   ```

3. **Check JSON Structure**
   ```
   Verify:
   - Valid JSON syntax
   - No trailing commas
   - Quotes around string values
   - Proper array brackets []
   ```

**Example**:
```
Input: create_post({title: "", body_md: ""})
Error: validation_error

Fix:
→ Provide non-empty title and body_md
→ {title: "My Post", body_md: "# Content"}
```

---

### 7. internal_error

**Description**: Unexpected error occurred in the bridge or extension.

**When it occurs**:
- Unhandled exception
- Database error
- Network timeout
- Extension crash

**Common Causes**:
- Extension bug
- Database corruption
- Network issues
- Insufficient permissions

**Solutions**:

1. **Check Extension Logs**
   ```
   1. Open Chrome
   2. Navigate to chrome://extensions/
   3. Find SyncCaster extension
   4. Click "Service Worker" (background page)
   5. Check console for errors
   ```

2. **Restart Extension**
   ```
   1. In chrome://extensions/
   2. Click "Reload" on SyncCaster
   3. Retry the operation
   ```

4. **Check Available Memory**
   ```
   1. Open Chrome Task Manager (Shift+Esc)
   2. Check extension memory usage
   3. If high, restart Chrome
   ```

5. **Update Extension**
   ```
   1. Check for updates on GitHub
   2. Download latest version
   3. Reload unpacked extension
   4. Test again
   ```

6. **Report Bug**
   ```
   If issue persists:
   1. Collect error details (code, message, details)
   2. Check extension console logs
   3. Open GitHub issue
   4. Include steps to reproduce
   ```

**Example**:
```
Input: publish_post(postId, targets)
Error: internal_error, message: "Database write failed"

Fix:
→ Restart extension
→ Clear IndexedDB if corrupted
→ Retry publish
```

---

## Error Handling Best Practices

### 1. Always Check `ok` Field

```javascript
const response = await mcpCall('create_post', payload);

if (!response.ok) {
  console.error('Error:', response.error.code, response.error.message);
  // Handle error based on code
  return;
}

// Success
const { postId } = response.data;
```

### 2. Handle Specific Errors

```javascript
const errorHandlers = {
  'post_not_found': () => recreatePost(),
  'default_account_not_configured': () => promptLogin(),
  'extension_unavailable': () => checkExtension(),
  'validation_error': () => fixInput(),
  'internal_error': () => logAndRetry(),
};

const handler = errorHandlers[response.error.code] || logGenericError;
handler();
```

### 3. Exponential Backoff for Retryable Errors

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'internal_error' && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await sleep(delay);
        retryCount++;
      } else {
        throw error;
      }
    }
  }
}
```

### 4. Provide User-Friendly Messages

```javascript
function getUserMessage(error) {
  const messages = {
    'post_not_found': 'Post not found. Please create a new post first.',
    'default_account_not_configured': 'Please login to the platform first.',
    'extension_unavailable': 'Please open Chrome and ensure SyncCaster extension is loaded.',
    'validation_error': 'Invalid input. Please check your content and try again.',
    'internal_error': 'An unexpected error occurred. Please try again later.',
  };
  return messages[error.code] || 'An error occurred: ' + error.message;
}
```

---

## Common Error Scenarios

### Scenario 1: First-Time Publish

```
User: "Publish my article to Juejin"

Flow:
1. publish_post(postId, [{platform: 'juejin'}])
2. Error: post_not_found
3. Fix: create_post(title, body_md) first
4. Use returned postId in publish_post
```

### Scenario 2: Account Expired

```
User: "Publish to CSDN"

Flow:
1. publish_post(postId, [{platform: 'csdn'}])
2. Error: default_account_not_configured
3. Check: list_accounts → csdn status === 'expired'
4. Fix: Re-login via extension → Accounts tab
5. Retry publish_post
```

### Scenario 3: Platform Typo

```
User: "Publish to Juejin" (typo in platform ID)

Flow:
1. publish_post(postId, [{platform: 'juejin.com'}])
2. Error: unsupported_platform
3. Fix: list_platforms → find correct ID: 'juejin'
4. Retry: [{platform: 'juejin'}]
```

### Scenario 4: Extension Not Running

```
User: "Check health"

Flow:
1. health
2. Error: extension_unavailable
3. Fix: Open Chrome, load SyncCaster extension
4. Retry health
```

---

## Debugging Tips

### 1. Enable Verbose Logging

Check MCP client configuration for debug/logging options.

### 2. Check Extension Console

```
1. Chrome → chrome://extensions/
2. SyncCaster → Service Worker
3. Console logs show detailed errors
```

### 3. Test with Simple Requests

```
Test health first:
→ health → should return {status: 'ok'}

Test list_platforms:
→ list_platforms → should return platform array

If these fail, check extension connection
```

### 4. Verify Input Data

```
Before sending to MCP:
- Validate required fields present
- Check field types (string, array, etc.)
- Ensure no null/undefined values
- Validate JSON structure
```

---

## When to Seek Help

If you encounter:

1. **Repeated internal_errors**: Check extension logs, consider reporting bug
2. **Unknown error codes**: May indicate new error type, report issue
3. **Platform-specific issues**: Check platform status, may be outage
4. **Persistent validation errors**: Verify input format matches spec

**Report Issue**:
- GitHub: https://github.com/RyanYipeng/SyncCaster/issues
- Include: Error code, message, steps to reproduce, logs

---

## Quick Reference

| Error Code | When | Quick Fix |
|------------|------|-----------|
| `extension_unavailable` | Extension not connected | Load extension in Chrome |
| `default_account_not_configured` | No account for platform | Login via extension |
| `post_not_found` | Invalid post ID | Create post first |
| `job_not_found` | Invalid job ID | Use correct jobId |
| `unsupported_platform` | Wrong platform ID | Use list_platforms |
| `validation_error` | Invalid input | Check required fields |
| `internal_error` | Unexpected error | Restart extension, report bug |

See [MCP-TOOLS.md](mcp-tools.md) for tool specifications.
See [MCP-CONFIG.md](mcp-config.md) for setup help.
