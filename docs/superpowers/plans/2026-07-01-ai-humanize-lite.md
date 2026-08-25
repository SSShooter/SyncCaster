# AI Humanize Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen SyncCaster's current "rewrite + remove AI flavor" output with expanded local cleanup rules and a configurable humanize level.

**Architecture:** Keep the feature isolated in `packages/ai` plus the existing extension AI settings/calling path. Rule cleanup runs before each provider request, prompt construction uses the selected humanize level, and persistence remains unchanged.

**Tech Stack:** TypeScript, Vue 3, Naive UI, Vitest, Vite, Chrome extension messaging/storage.

---

## File Structure

- Modify `packages/ai/src/types.ts`
  - Add `AiHumanizeLevel = 'light' | 'standard' | 'strong'`.
  - Add optional `humanizeLevel` to rewrite prompt/request input types.
- Modify `packages/ai/src/humanize-rules.ts`
  - Expand rule groups for cliches, bot leftovers, punctuation, decorations, markdown bold cleanup, and safe code-fence preservation.
  - Export `normalizeHumanizeLevel` if useful for shared validation.
- Modify `packages/ai/src/prompts.ts`
  - Add level-specific humanize requirements.
  - Keep the output JSON shape unchanged.
- Modify `packages/ai/src/rewrite.ts`
  - Wrap pre-cleaning in a safe fallback.
  - Pass `humanizeLevel` into prompt building.
- Modify `apps/extension/src/background/ai-service.ts`
  - Persist and normalize `humanizeLevel` in AI config.
  - Pass it into background candidate generation.
- Modify `apps/extension/src/ui/options/ai/foreground-rewrite.ts`
  - Include `humanizeLevel` in foreground generation config and provider calls.
- Modify `apps/extension/src/ui/options/views/AiSettings.vue`
  - Add compact `去 AI 味强度` radio group near candidate count.
- Modify tests:
  - `packages/ai/src/__tests__/humanize-rules.test.ts`
  - `packages/ai/src/__tests__/prompts.test.ts`
  - `packages/ai/src/__tests__/rewrite.test.ts`
  - `apps/extension/src/background/__tests__/ai-service.test.ts`
  - `apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts`

## Task 1: Expand Humanize Rule Tests

**Files:**
- Modify: `packages/ai/src/__tests__/humanize-rules.test.ts`

- [ ] **Step 1: Add failing tests for copied lightweight rules**

Add these tests after the existing tests:

```ts
  it('cleans bot leftovers, decorative symbols, and mechanical markdown marks', () => {
    const result = preCleanAiCliches([
      '当然！以下是我为你整理的内容：',
      '✅ **值得一提的是**，这个工具起到了至关重要的作用。',
      '希望这内容对你有帮助。',
    ].join('\n'));

    expect(result).not.toContain('当然');
    expect(result).not.toContain('以下是');
    expect(result).not.toContain('✅');
    expect(result).not.toContain('**');
    expect(result).not.toContain('值得一提的是');
    expect(result).not.toContain('起到了至关重要的作用');
    expect(result).not.toContain('希望这内容对你有帮助');
  });

  it('normalizes Chinese punctuation without touching URLs or decimal numbers', () => {
    const result = preCleanAiCliches('版本 1.2 已发布, 详情见 https://example.com/a,b. 好吗? 可以!');

    expect(result).toContain('版本 1.2 已发布，');
    expect(result).toContain('https://example.com/a,b.');
    expect(result).toContain('好吗？ 可以！');
  });

  it('keeps markdown tables and fenced code blocks stable', () => {
    const result = preCleanAiCliches([
      '| 字段 | 说明 |',
      '| --- | --- |',
      '| url | https://example.com/a,b |',
      '```ts',
      'const text = "值得注意的是, do not touch";',
      '```',
    ].join('\n'));

    expect(result).toContain('| url | https://example.com/a,b |');
    expect(result).toContain('const text = "值得注意的是, do not touch";');
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/humanize-rules.test.ts --run
```

Expected: at least the new bot/decorative/punctuation tests fail because the rules are not implemented yet.

## Task 2: Implement Expanded Rule Cleaning

**Files:**
- Modify: `packages/ai/src/humanize-rules.ts`

- [ ] **Step 1: Replace the current rule implementation with grouped safe cleaners**

Implement these helpers:

```ts
type TextRule = {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: string[]) => string);
};

const clicheRules: TextRule[] = [
  { pattern: /值得注意的是[，,：:]?/g, replacement: '' },
  { pattern: /值得一提的是[，,：:]?/g, replacement: '' },
  { pattern: /需要注意的是[，,：:]?/g, replacement: '' },
  { pattern: /综上所述[，,。.:：]?/g, replacement: '' },
  { pattern: /综上[，,：:]?/g, replacement: '' },
  { pattern: /总而言之[，,。.:：]?/g, replacement: '' },
  { pattern: /总的来说[，,。.:：]?/g, replacement: '' },
  { pattern: /总体而言[，,。.:：]?/g, replacement: '' },
  { pattern: /概括来说[，,：:]?/g, replacement: '' },
  { pattern: /归根结底[，,：:]?/g, replacement: '' },
  { pattern: /简而言之[，,：:]?/g, replacement: '' },
  { pattern: /一言以蔽之[，,：:]?/g, replacement: '' },
  { pattern: /我们可以看到[，,：:]?/g, replacement: '' },
  { pattern: /我们不难发现[，,：:]?/g, replacement: '' },
  { pattern: /我们不难看出[，,：:]?/g, replacement: '' },
  { pattern: /不难发现[，,：:]?/g, replacement: '' },
  { pattern: /不难看出[，,：:]?/g, replacement: '' },
  { pattern: /由此可见[，,：:]?/g, replacement: '' },
  { pattern: /由此可知[，,：:]?/g, replacement: '' },
  { pattern: /毋庸置疑[，,：:]?/g, replacement: '' },
  { pattern: /不言而喻[，,：:]?/g, replacement: '' },
  { pattern: /显而易见[，,：:]?/g, replacement: '' },
  { pattern: /显然[，,]/g, replacement: '' },
  { pattern: /众所周知[，,：:]?/g, replacement: '' },
  { pattern: /不可否认[，,：:]?/g, replacement: '' },
  { pattern: /无可否认[，,：:]?/g, replacement: '' },
  { pattern: /可以(?:毫不夸张地)?说[，,]/g, replacement: '' },
  { pattern: /某种程度上(?:来说|来讲|说)?[，,]?/g, replacement: '' },
  { pattern: /换句话说[，,：:]?/g, replacement: '' },
  { pattern: /换言之[，,：:]?/g, replacement: '' },
  { pattern: /更重要的是[，,：:]?/g, replacement: '' },
  { pattern: /与此同时[，,：:]?/g, replacement: '' },
  { pattern: /在此基础上[，,：:]?/g, replacement: '' },
  { pattern: /从这个角度(?:来看|来说|出发)?[，,：:]?/g, replacement: '' },
  { pattern: /从某种意义上(?:来说|讲)?[，,：:]?/g, replacement: '' },
  { pattern: /在当今[^，,。.！!？?]{0,12}的(?:时代|社会|世界|背景|大背景|形势)(?:背景)?下?[，,]?/g, replacement: '' },
  { pattern: /随着[^，,。.！!？?]{0,16}的(?:发展|到来|普及|推进|不断深入|日益成熟)[，,]?/g, replacement: '' },
  { pattern: /展望未来[，,：:]?/g, replacement: '' },
  { pattern: /让我们(?:一起|共同)?(?:期待|拭目以待|携手)[^。.！!？?]*[。.！!？?]/g, replacement: '' },
  { pattern: /是显而易见的/g, replacement: '很明显' },
  { pattern: /是毋庸置疑的/g, replacement: '没有疑问' },
  { pattern: /是不言而喻的/g, replacement: '不用多说' },
  { pattern: /是不可否认的/g, replacement: '确实如此' },
  { pattern: /(?:具有|有着)(?:重要|深远|不可忽视)的(?:意义|价值|影响)[。.]/g, replacement: '。' },
  { pattern: /起着(?:至关重要|举足轻重|不可替代)的作用[。.]?/g, replacement: '' },
  { pattern: /起到了(?:至关重要|举足轻重|不可替代)的作用[。.]?/g, replacement: '' },
];

const botLeftoverRules: TextRule[] = [
  { pattern: /(?:希望|期待)(?:这|以上)?(?:内容|回答|信息)?(?:对(?:您|你))?(?:有(?:所)?帮助)[。.！!]*/g, replacement: '' },
  { pattern: /(?:如果你|如有)(?:还有)?(?:其他|任何)?(?:问题|疑问)[，,]?(?:(?:欢迎|请)?(?:随时)?(?:提问|告诉我|联系我))[。.！!]*/g, replacement: '' },
  { pattern: /(?:以下|下面)(?:是|为)(?:我为(?:您|你)?(?:整理|准备)的)?[^。.：:\n]{0,18}[：:]/g, replacement: '' },
  { pattern: /(?:当然|没问题)[！!。.]*/g, replacement: '' },
  { pattern: /(?:您|你)说得(?:完全)?(?:对|正确)[！!。.]*/g, replacement: '' },
  { pattern: /截至(?:我最后(?:一次)?(?:训练|更新)的)?[^，。.,]{0,10}[，,]/g, replacement: '' },
];

const conciseRules: TextRule[] = [
  { pattern: /为了实现这一目标/g, replacement: '为此' },
  { pattern: /由于(.{1,20}?)的事实/g, replacement: '因为$1' },
  { pattern: /在这个时间点(?:上)?/g, replacement: '现在' },
  { pattern: /具有(.{1,12}?)的能力/g, replacement: '能$1' },
  { pattern: /起到了(.{1,12}?)的作用/g, replacement: '$1' },
];

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu;
const decorationPattern = /[★☆✦✧❖◆◇▶►➤➢»«•·]/g;

function applyRules(value: string, rules: TextRule[]): string {
  return rules.reduce((current, rule) => current.replace(rule.pattern, rule.replacement as string), value);
}

function normalizeChinesePunctuation(value: string): string {
  return value
    .replace(/([一-龥])([,?!:;])(?!\d)/g, (_match, char: string, punct: string) => {
      const map: Record<string, string> = { ',': '，', '?': '？', '!': '！', ':': '：', ';': '；' };
      return `${char}${map[punct] || punct}`;
    })
    .replace(/([一-龥])\(/g, '$1（')
    .replace(/\)([一-龥])/g, '）$1')
    .replace(/。{2,}/g, '……')
    .replace(/！{2,}/g, '！')
    .replace(/？{2,}/g, '？')
    .replace(/，{2,}/g, '，')
    .replace(/\s*[—–]{1,2}\s*/g, '，')
    .replace(/([一-龥])[ \t]+([一-龥])/g, '$1$2');
}

function cleanLine(line: string): string {
  if (/^\s*\|.*\|\s*$/.test(line)) {
    return line.trimEnd();
  }
  return normalizeChinesePunctuation(
    applyRules(applyRules(applyRules(line, botLeftoverRules), clicheRules), conciseRules)
      .replace(emojiPattern, '')
      .replace(decorationPattern, '')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
  )
    .replace(/[ \t]+([，。；：,.!?！？])/g, '$1')
    .replace(/^[，,、；;：:\s]+/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd();
}

export function preCleanAiCliches(markdown: string): string {
  const lines = String(markdown || '').split('\n');
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    return inFence ? line : cleanLine(line);
  }).join('\n');
}
```

- [ ] **Step 2: Run the focused rule test**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/humanize-rules.test.ts --run
```

Expected: all tests in `humanize-rules.test.ts` pass.

- [ ] **Step 3: Commit rule expansion**

```powershell
git add packages/ai/src/humanize-rules.ts packages/ai/src/__tests__/humanize-rules.test.ts
git commit -m "feat: expand AI humanize pre-cleaning rules"
```

## Task 3: Add Humanize Level Types And Prompt Tests

**Files:**
- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/__tests__/prompts.test.ts`

- [ ] **Step 1: Add failing prompt tests**

Add imports and tests in `packages/ai/src/__tests__/prompts.test.ts`:

```ts
import { buildRewriteMessages } from '../prompts';

it('uses standard humanize instructions by default', () => {
  const messages = buildRewriteMessages({
    source: { postId: 'p1', title: '标题', bodyMd: '正文' },
    candidateCount: 1,
  });

  expect(messages.map((item) => item.content).join('\n')).toContain('Humanize level: standard');
  expect(messages.map((item) => item.content).join('\n')).toContain('sentence rhythm');
});

it('adds stronger humanize instructions when requested', () => {
  const messages = buildRewriteMessages({
    source: { postId: 'p1', title: '标题', bodyMd: '正文' },
    candidateCount: 1,
    humanizeLevel: 'strong',
  });

  const content = messages.map((item) => item.content).join('\n');
  expect(content).toContain('Humanize level: strong');
  expect(content).toContain('more aggressive');
});
```

If `buildRewriteMessages` is already imported in that file, merge the import instead of duplicating it.

- [ ] **Step 2: Run prompt tests and verify failure**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/prompts.test.ts --run
```

Expected: the new tests fail because `humanizeLevel` is not implemented.

- [ ] **Step 3: Add the type field**

In `packages/ai/src/types.ts`, add:

```ts
export type AiHumanizeLevel = 'light' | 'standard' | 'strong';
```

Then add this optional property to `AiRewritePromptInput`:

```ts
  humanizeLevel?: AiHumanizeLevel;
```

`AiRewriteRequest` extends `AiRewritePromptInput`, so it inherits the field.

## Task 4: Implement Humanize Level Prompting

**Files:**
- Modify: `packages/ai/src/prompts.ts`
- Modify: `packages/ai/src/rewrite.ts`
- Modify: `packages/ai/src/__tests__/rewrite.test.ts`

- [ ] **Step 1: Implement level-specific prompt requirements**

In `packages/ai/src/prompts.ts`, add:

```ts
import type { AiHumanizeLevel, AiRewritePromptInput, ChatMessage } from './types';
```

Replace the current `HUMANIZE_REQUIREMENT` constant with:

```ts
export const DEFAULT_HUMANIZE_LEVEL: AiHumanizeLevel = 'standard';

export const HUMANIZE_REQUIREMENTS: Record<AiHumanizeLevel, string[]> = {
  light: [
    'Humanize level: light.',
    'Remove obvious AI-written flavor without changing the article voice too much.',
    'Avoid formulaic transitions, generic conclusions, hollow praise, and over-neat parallel phrasing.',
  ],
  standard: [
    'Humanize level: standard.',
    'Rewrite and remove AI-written flavor in the same pass.',
    'Vary sentence rhythm and sentence structure. Break overly even pacing.',
    'Detemplate stiff transitions such as firstly, secondly, in summary, meanwhile, and more importantly.',
    'Trim hollow summaries, repeated paraphrases, and correct-but-low-information filler.',
    'Prefer concrete, natural, practical wording.',
  ],
  strong: [
    'Humanize level: strong.',
    'Use more aggressive naturalization while still preserving facts and structure.',
    'Break mechanical sentence rhythm, reduce list-like symmetry, and avoid polished AI-style slogans.',
    'Rewrite stiff transitions into natural thought flow or remove them when context is already clear.',
    'Remove hollow wrap-up paragraphs and generic calls to action unless they carry real information.',
    'Use a more human editorial voice, but do not invent personal experience, facts, data, or references.',
  ],
};

export function normalizeHumanizeLevel(value: unknown): AiHumanizeLevel {
  return value === 'light' || value === 'standard' || value === 'strong'
    ? value
    : DEFAULT_HUMANIZE_LEVEL;
}

function getHumanizeRequirement(level: unknown): string {
  return HUMANIZE_REQUIREMENTS[normalizeHumanizeLevel(level)].join(' ');
}
```

In `buildRewriteMessages`, compute:

```ts
const humanizeRequirement = getHumanizeRequirement(input.humanizeLevel);
```

Then use `humanizeRequirement` in the system message instead of the old `HUMANIZE_REQUIREMENT`.

Add this line to the user message near the rewrite template:

```ts
`Humanize level: ${normalizeHumanizeLevel(input.humanizeLevel)}`,
```

- [ ] **Step 2: Pass level through rewrite generation**

In `packages/ai/src/rewrite.ts`, wrap pre-cleaning:

```ts
function safelyPreCleanAiCliches(markdown: string): string {
  try {
    return preCleanAiCliches(markdown);
  } catch {
    return markdown;
  }
}
```

Use it in `generateRewriteCandidates`:

```ts
bodyMd: safelyPreCleanAiCliches(request.source.bodyMd),
```

Pass `humanizeLevel` to `buildRewriteMessages`:

```ts
humanizeLevel: request.humanizeLevel,
```

- [ ] **Step 3: Add a rewrite test for level passthrough**

In `packages/ai/src/__tests__/rewrite.test.ts`, add a test that stubs fetch and asserts the request body includes `Humanize level: strong`.

Use the existing fetch-stub style in that file. The key assertion should be:

```ts
expect(JSON.stringify(body.messages)).toContain('Humanize level: strong');
```

- [ ] **Step 4: Run AI package tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/humanize-rules.test.ts packages/ai/src/__tests__/prompts.test.ts packages/ai/src/__tests__/rewrite.test.ts --run
```

Expected: all selected AI package tests pass.

- [ ] **Step 5: Commit type and prompt work**

```powershell
git add packages/ai/src/types.ts packages/ai/src/prompts.ts packages/ai/src/rewrite.ts packages/ai/src/__tests__/prompts.test.ts packages/ai/src/__tests__/rewrite.test.ts
git commit -m "feat: add configurable AI humanize levels"
```

## Task 5: Persist Humanize Level In AI Config

**Files:**
- Modify: `apps/extension/src/background/ai-service.ts`
- Modify: `apps/extension/src/background/__tests__/ai-service.test.ts`

- [ ] **Step 1: Add failing service tests**

In `apps/extension/src/background/__tests__/ai-service.test.ts`, add tests that verify:

```ts
expect(DEFAULT_AI_REWRITE_CONFIG.humanizeLevel).toBe('standard');
```

Add a save/load test that saves `{ humanizeLevel: 'strong' }` and expects loaded config to include `humanizeLevel: 'strong'`.

Add a normalization test that saves `{ humanizeLevel: 'surprise' }` and expects `humanizeLevel: 'standard'`.

- [ ] **Step 2: Run the service test and verify failure**

Run:

```powershell
.\node_modules\.bin\vitest.cmd apps/extension/src/background/__tests__/ai-service.test.ts --run
```

Expected: new tests fail because config does not include `humanizeLevel`.

- [ ] **Step 3: Implement config persistence**

In `apps/extension/src/background/ai-service.ts`:

Add imports:

```ts
  normalizeHumanizeLevel,
  type AiHumanizeLevel,
```

Add to `DEFAULT_AI_REWRITE_CONFIG`:

```ts
  humanizeLevel: 'standard' as AiHumanizeLevel,
```

Add to `normalizeConfig` return:

```ts
    humanizeLevel: normalizeHumanizeLevel(input?.humanizeLevel),
```

In the `AI_GENERATE_CANDIDATES` path, pass:

```ts
          humanizeLevel: settings.config.humanizeLevel,
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd apps/extension/src/background/__tests__/ai-service.test.ts --run
```

Expected: service tests pass.

- [ ] **Step 5: Commit config persistence**

```powershell
git add apps/extension/src/background/ai-service.ts apps/extension/src/background/__tests__/ai-service.test.ts
git commit -m "feat: persist AI humanize level setting"
```

## Task 6: Wire Humanize Level Through Foreground Generation

**Files:**
- Modify: `apps/extension/src/ui/options/ai/foreground-rewrite.ts`
- Modify: `apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts`

- [ ] **Step 1: Add failing foreground passthrough test**

In `foreground-rewrite.test.ts`, add a test that calls `runForegroundRewriteCandidates` with:

```ts
config: {
  baseUrl: 'https://api.example.com/v1',
  model: 'test-model',
  temperature: 0.4,
  timeoutMs: 180000,
  candidateCount: 1,
  humanizeLevel: 'strong',
}
```

Use a `generateOneCandidate` spy and assert:

```ts
expect(generateOneCandidate).toHaveBeenCalledWith(expect.objectContaining({
  humanizeLevel: 'strong',
}));
```

- [ ] **Step 2: Run foreground test and verify failure**

Run:

```powershell
.\node_modules\.bin\vitest.cmd apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts --run
```

Expected: new test fails because `humanizeLevel` is not passed to the generator.

- [ ] **Step 3: Implement foreground passthrough**

In `foreground-rewrite.ts`:

Import:

```ts
  normalizeHumanizeLevel,
  type AiHumanizeLevel,
```

Add to `ForegroundRewriteConfig`:

```ts
  humanizeLevel?: AiHumanizeLevel;
```

Add to `GenerateOneCandidateInput`:

```ts
  humanizeLevel?: AiHumanizeLevel;
```

In `defaultGenerateOneCandidate`, pass:

```ts
    humanizeLevel: input.humanizeLevel,
```

Before the loop in `runForegroundRewriteCandidates`, compute:

```ts
const humanizeLevel = normalizeHumanizeLevel(input.config.humanizeLevel);
```

Pass it into `generateOneCandidate`:

```ts
        humanizeLevel,
```

- [ ] **Step 4: Run foreground tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts --run
```

Expected: foreground tests pass.

- [ ] **Step 5: Commit foreground wiring**

```powershell
git add apps/extension/src/ui/options/ai/foreground-rewrite.ts apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts
git commit -m "feat: pass AI humanize level through foreground generation"
```

## Task 7: Add Humanize Level Setting To UI

**Files:**
- Modify: `apps/extension/src/ui/options/views/AiSettings.vue`

- [ ] **Step 1: Add the form field**

In the `form` reactive object, add:

```ts
  humanizeLevel: 'standard',
```

In the template, add this form item after `生成数量`:

```vue
        <n-form-item label="去 AI 味强度">
          <n-radio-group v-model:value="form.humanizeLevel">
            <n-radio-button value="light">轻度</n-radio-button>
            <n-radio-button value="standard">标准</n-radio-button>
            <n-radio-button value="strong">强力</n-radio-button>
          </n-radio-group>
        </n-form-item>
```

Keep the existing note under prompt actions:

```text
去 AI 味要求会固定叠加，无需写进每个模板。
```

- [ ] **Step 2: Run a TypeScript/build check**

Run:

```powershell
.\node_modules\.bin\vite.cmd build
```

from `apps/extension`.

Expected: build completes successfully. Existing chunk-size warnings are acceptable.

- [ ] **Step 3: Commit UI setting**

```powershell
git add apps/extension/src/ui/options/views/AiSettings.vue
git commit -m "feat: add AI humanize level setting"
```

## Task 8: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused AI tests**

Run from repo root:

```powershell
.\node_modules\.bin\vitest.cmd packages/ai/src/__tests__/openai-compatible.test.ts packages/ai/src/__tests__/rewrite.test.ts packages/ai/src/__tests__/prompts.test.ts packages/ai/src/__tests__/humanize-rules.test.ts apps/extension/src/background/__tests__/ai-service.test.ts apps/extension/src/ui/options/ai/__tests__/client.test.ts apps/extension/src/ui/options/ai/__tests__/cloneable.test.ts apps/extension/src/ui/options/ai/__tests__/foreground-rewrite.test.ts apps/extension/src/ui/options/ai/__tests__/host-permissions.test.ts apps/extension/src/ui/options/ai/__tests__/post-routing.test.ts apps/extension/src/ui/options/ai/__tests__/rewrite-draft.test.ts --run
```

Expected: all selected tests pass.

- [ ] **Step 2: Run extension build**

Run from `apps/extension`:

```powershell
.\node_modules\.bin\vite.cmd build
```

Expected: production build succeeds. Existing Vite chunk-size/dynamic-import warnings are acceptable.

- [ ] **Step 3: Run git diff check**

Run:

```powershell
git diff --check
```

Expected: exit code 0.

- [ ] **Step 4: Inspect status**

Run:

```powershell
git status --short
```

Expected: clean working tree if every task committed.

## Self-Review

- Spec coverage: rule expansion, humanize level, one request per candidate, stable persistence, compact UI, and tests are covered.
- Non-goals respected: no streaming, no segmented generation, no queue, no detector score, no multi-round LLM pipeline, no UI redesign.
- Type consistency: `humanizeLevel` and `AiHumanizeLevel` are used consistently across `packages/ai`, background config, foreground generation, and UI.
- Placeholder scan: no TODO/TBD placeholders remain.
