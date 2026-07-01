# AI Long Article Segmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically split long AI rewrite jobs into smaller provider requests and merge rewritten segments back into normal selectable candidates.

**Architecture:** Keep segmentation isolated in `packages/ai`. `generateRewriteCandidates` chooses between the current single-request path and a new segmented path. The extension foreground layer only receives progress events and renders them through the existing status line.

**Tech Stack:** TypeScript, Vitest, Vue 3, Vite, Chrome extension storage/messaging.

---

## File Structure

- Create `packages/ai/src/segmentation.ts`
  - Markdown block splitting.
  - Segment threshold/size defaults.
  - Segment merge helper.
- Modify `packages/ai/src/types.ts`
  - Add segmentation option and progress callback types.
- Modify `packages/ai/src/prompts.ts`
  - Add optional segment metadata to rewrite prompts.
- Modify `packages/ai/src/rewrite.ts`
  - Route long articles through segmented generation.
- Modify `packages/ai/src/index.ts`
  - Export segmentation helpers.
- Modify `apps/extension/src/ui/options/ai/foreground-rewrite.ts`
  - Forward segment progress events.
- Modify `apps/extension/src/ui/options/views/AiRewrite.vue`
  - Add status labels for segment progress.
- Add or modify tests under `packages/ai/src/__tests__` and `apps/extension/src/ui/options/ai/__tests__`.

## Tasks

### Task 1: Segmentation Helpers

- [ ] Write failing tests for splitting Markdown into stable ordered segments.
- [ ] Implement `splitMarkdownIntoSegments`, `shouldSegmentMarkdown`, and `mergeSegmentCandidates`.
- [ ] Verify focused segmentation tests pass.

### Task 2: Segment Prompt Metadata

- [ ] Write a failing prompt test for segment instructions.
- [ ] Add optional segment metadata to `AiRewritePromptInput`.
- [ ] Include segment-only instructions in `buildRewriteMessages`.
- [ ] Verify prompt tests pass.

### Task 3: Segmented Rewrite Path

- [ ] Write a failing rewrite test showing one long source uses multiple provider calls and returns one merged candidate.
- [ ] Write a failing rewrite test for segment progress callbacks.
- [ ] Implement segmented generation in `generateRewriteCandidates`.
- [ ] Verify rewrite tests pass.

### Task 4: Foreground Progress

- [ ] Write a failing foreground test for `segment_started` and `segment_finished`.
- [ ] Forward `onSegmentProgress` from the foreground generator.
- [ ] Add page status labels for segment events.
- [ ] Verify foreground tests pass.

### Task 5: Final Verification

- [ ] Run focused AI and extension AI tests.
- [ ] Build the extension.
- [ ] Run `git diff --check`.
- [ ] Commit and push to `origin/feature/ai-rewrite-candidates`.

## Self-Review

- Spec coverage: automatic thresholding, safe Markdown segmentation, segmented prompts, candidate merging, foreground progress, cancellation/error behavior, and non-goals are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Scope check: one subsystem, isolated to AI generation and existing status text.

