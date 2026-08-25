# AI Streaming Rewrite Design

## Goal

Make AI rewrite generation feel faster by showing provider output while a candidate is still being generated.

This phase improves perceived speed and visibility. It does not add long-article segmentation or multi-step generation.

## Current State

The AI rewrite page already generates candidates one by one in the foreground. Each candidate is saved when the provider returns a complete JSON response. The user sees stage diagnostics, elapsed time, partial saved candidates, cancellation, and persisted latest candidates.

The slow part is that one candidate appears only after the full provider request completes.

## Approach

Add streaming support for OpenAI-compatible chat completions.

### 1. Stream Provider Text

Add a streaming path in `packages/ai` that sends `stream: true` and reads Server-Sent Events from the response body.

The stream parser should:

- Accept `data: {...}` chunks.
- Stop on `data: [DONE]`.
- Read `choices[0].delta.content`.
- Accumulate text into the same raw JSON string used by the non-streaming parser.
- Call an optional callback with the accumulated text after each content delta.

If streaming is unavailable or the response body is missing, the caller can use the existing non-streaming request path.

### 2. Keep Candidate Semantics Stable

The model still returns the same JSON shape:

```json
{"candidates":[{"title":"string","bodyMd":"markdown string","summary":"string","rationale":"string","style":"string"}]}
```

The final candidate is still parsed only after the JSON is complete. This avoids trying to parse partial JSON into unstable drafts.

### 3. Foreground UI Preview

While a candidate is generating, the AI rewrite page shows a lightweight streaming preview panel containing the raw accumulating text.

When the final candidate parses successfully:

- Save the candidate using the existing persistence path.
- Clear the streaming preview for that candidate.
- Continue with the next candidate if configured.

If streaming fails before a final candidate is parsed:

- Fall back to the existing non-streaming request for that candidate.
- Show a diagnostic message that the provider did not support streaming and normal mode is being used.

### 4. Preserve Existing Controls

Cancellation, "再生成一个", candidate persistence, selection, timeout, prompt templates, and humanize level continue to work.

The extension keeps one request per candidate. No background queue is introduced.

## UI Changes

Add one small preview area below the generation status when `streamingPreview` has content.

The preview:

- Uses the existing card/page style.
- Scrolls vertically.
- Is labeled `实时返回预览`.
- Shows raw provider text because the provider is returning JSON.

No major layout redesign.

## Error Handling

Streaming errors map to the existing AI error types where possible.

Fallback behavior:

- If streaming is enabled but unsupported, run the existing non-streaming request.
- If both streaming and fallback fail, show the existing candidate error.

Cancellation should abort the active stream and should not start fallback.

## Testing

Add focused tests for:

- SSE chunk parsing and accumulation.
- `[DONE]` handling.
- Streaming request body includes `stream: true`.
- Rewrite generation calls the preview callback with accumulating text.
- Foreground generation forwards preview events to the UI.
- Existing non-streaming tests continue passing.

## Non-Goals

- No segmented generation.
- No partial JSON parsing into final candidates.
- No multi-candidate parallelism.
- No background queue.
- No new provider-specific UI.
