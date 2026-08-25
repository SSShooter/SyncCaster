# AI Humanize Lite Design

## Goal

Improve the current AI rewrite output quality by strengthening "rewrite + remove AI flavor" while keeping the feature lightweight, isolated, and close to the existing SyncCaster architecture.

This iteration focuses on output quality, not generation speed. Segmented generation, faster partial return, and streaming display stay out of scope for this phase.

## Current State

SyncCaster already has:

- An AI settings page with OpenAI-compatible provider settings.
- Rewrite prompt templates.
- Candidate count of 1, 2, or 3.
- A separate AI rewrite page with persisted latest candidates.
- A small pre-cleaning rule set in `packages/ai/src/humanize-rules.ts`.
- A fixed humanize instruction in `packages/ai/src/prompts.ts`.

The current humanize behavior is useful but basic. It removes a small number of cliches and relies mostly on one prompt instruction.

## Approach

Add a lightweight humanize layer inspired by the local noai package, without copying its full multi-step pipeline.

### 1. Expand Rule-Based Pre-Cleaning

Keep rule handling inside `packages/ai`.

Add rule groups for:

- High-frequency AI cliches and filler transitions.
- Bot-like leftovers such as "以下是..." and "希望对你有帮助".
- Punctuation normalization for Chinese writing.
- Decorative emoji/symbol cleanup.
- Mechanical formatting cleanup such as excessive inline bold.
- Detection notes for overly neat parallelism and three-item lists.

Rules must preserve fenced code blocks. They should not alter URLs, code, paths, numbers, dates, or markdown tables more than necessary.

### 2. Add Humanize Intensity

Introduce a `humanizeLevel` option:

- `light`: rule cleaning plus the existing general humanize prompt.
- `standard`: stronger prompt instructions for sentence rhythm, transition detemplating, and hollow-summary trimming.
- `strong`: more aggressive naturalization and de-template guidance, with a visible warning that style may change more.

Default: `standard`.

This option should live in the AI config, alongside candidate count and timeout.

### 3. Keep One AI Request Per Candidate

Do not add multi-step LLM pipelines yet. Each candidate remains one provider request so the current foreground generation flow stays simple.

The selected rewrite template and the humanize level are combined into the same prompt:

1. Apply the user's rewrite template.
2. Apply the selected humanize level.
3. Preserve facts, numbers, links, code blocks, tables, dates, and markdown structure.
4. Return only the existing candidate JSON shape.

### 4. Keep Persistence Shape Stable

The existing `post.meta.aiRewriteDraft` persistence should continue to work. Add humanize level metadata only if useful for display or diagnostics. Do not introduce a new storage table or queue.

## UI Changes

Add one compact setting to the existing AI settings page:

- Label: `去 AI 味强度`
- Options: `轻度`, `标准`, `强力`
- Default: `标准`

Keep the existing UI style. Do not add a new page, wizard, or large explanation panel.

In the AI rewrite page, show the selected level only as small metadata or omit it if the layout feels crowded.

## Error Handling

Rule cleaning should never block generation. If a rule throws unexpectedly, fall back to the original markdown and continue.

Prompt building should validate unknown levels by falling back to `standard`.

## Testing

Add focused tests for:

- Expanded cliche removal.
- Punctuation and decoration cleanup.
- Fenced code block preservation.
- Humanize level prompt differences.
- Config default and validation behavior.
- Existing rewrite candidate parsing remains unchanged.

## Non-Goals

- No streaming output.
- No segmented generation.
- No background job queue.
- No AI detector score.
- No multi-round LLM pipeline.
- No large UI redesign.
