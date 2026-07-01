# AI Long Article Segmentation Design

## Goal

Reduce timeout risk for long AI rewrite jobs by automatically splitting long source articles into smaller rewrite requests, then merging the rewritten segments into one candidate.

This phase keeps the current SyncCaster UI and persistence model. It improves the existing foreground AI rewrite workflow without adding a background queue or a new page.

## Current State

The AI rewrite workflow already supports:

- OpenAI-compatible provider configuration.
- One to three rewrite candidates.
- Prompt templates and humanize levels.
- Foreground generation with cancellation.
- Streaming preview and visible streaming fallback status.
- Candidate persistence in the latest draft for each article.

For long source articles, a single provider request can still be slow or time out. Streaming makes progress visible, but it does not reduce the size of the provider request.

## Approach

Add automatic segmentation inside `packages/ai`.

Short articles keep the existing single-request path. Long articles use a segmented path:

1. Split the source Markdown on safe block boundaries.
2. Rewrite each segment with the same rewrite prompt and humanize level.
3. Ask the provider to rewrite only the current segment and avoid full-article introductions or endings.
4. Merge segment bodies in original order.
5. Return one normal `AiRewriteCandidate` with the existing candidate shape.

The foreground flow still generates candidates one by one. If the user asks for two candidates, the app still produces two selectable candidates; each candidate may internally use multiple segment requests when the article is long.

## Segmentation Rules

The splitter should be simple and predictable:

- Default threshold: segment only when source Markdown is longer than 7000 characters.
- Default segment size: target around 3500 characters.
- Split mainly on blank-line paragraph boundaries.
- Treat fenced code blocks as indivisible blocks.
- Avoid dropping or reordering source content.
- If a single block is larger than the target size, keep it as one oversized segment instead of cutting through code or dense Markdown.

No UI setting is added in this phase. Thresholds stay in AI package defaults and can be overridden by tests/internal callers.

## Prompting

Segment prompts reuse the existing rewrite prompt and humanize level, with extra instructions:

- This is segment `N` of `M`.
- Rewrite this segment only.
- Preserve Markdown, facts, links, tables, code blocks, dates, and numbers.
- Do not add a full article introduction, conclusion, or call to action unless it exists in this segment.
- Keep continuity with neighboring segments.

The provider still returns the existing JSON shape:

```json
{"candidates":[{"title":"string","bodyMd":"markdown string","summary":"string","rationale":"string","style":"string"}]}
```

## Foreground Progress

Add lightweight events so the existing generation status can show segment progress:

- `segment_started`
- `segment_finished`

The AI rewrite page maps these events to small status text. It does not add a new panel or change candidate cards.

Streaming preview remains best-effort raw JSON from the active provider request. For segmented jobs, it naturally shows the current segment response.

## Error Handling

If any segment fails, the current candidate fails and the existing foreground loop stops, preserving partial candidates already saved from previous candidates.

Cancellation aborts the active provider request and does not continue remaining segments.

Streaming fallback still applies per segment.

## Non-Goals

- No background queue.
- No parallel segment requests.
- No user-facing segmentation settings.
- No separate merge/refinement LLM pass.
- No partial segment drafts saved as final candidates.
- No changes to article collection, article list, editor, or existing draft persistence shape.

