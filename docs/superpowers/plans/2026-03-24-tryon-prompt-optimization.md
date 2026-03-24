# Virtual Try-On Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Virtual Try-On prompt builder from text-only `string` return to interleaved `Part[]`, restructure prompt content for better Gemini compliance (narrative rules, recency recap, semantic negatives, pose preservation).

**Architecture:** The prompt builder will accept `ImageFile` objects directly and return `Part[]` with interleaved text labels + image data, following the proven pattern in `clothing-transfer-prompt-builder.ts`. The hook will call the builder per-job inside the batch loop (since subject image is now embedded in `Part[]`). The Gemini infrastructure (`gemini/image.ts` `interleavedParts` path + `imageEditingService.ts` spread passthrough) requires zero changes.

**Tech Stack:** TypeScript, `@google/genai` (Part type), Vitest

**Review Status:** CEO Review PASSED (HOLD SCOPE, 0 critical gaps). Eng Review PASSED.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/virtual-try-on-prompt-builder.ts` | **Rewrite** | New interface `VirtualTryOnPromptInput`, returns `Part[]` with interleaved images + optimized prompt text |
| `src/hooks/useVirtualTryOn.ts` | **Modify** (~15 lines) | Move builder call inside batch loop, Gemini-only guard, pass `interleavedParts` to `editImage` |
| `__tests__/utils/virtual-try-on-prompt-builder.test.ts` | **Rewrite** | New tests for `Part[]` output, section content, conditional dual-garment logic, input validation |
| `src/locales/en.ts` | **Modify** (1 line) | Add `geminiOnlyError` key under `virtualTryOn` |
| `src/locales/vi.ts` | **Modify** (1 line) | Add `geminiOnlyError` Vietnamese translation |
| `src/services/imageEditingService.ts` | **Modify** (~5 lines) | Log interleaved prompt text in debug logging |
| `__tests__/hooks/useVirtualTryOn.test.tsx` | **New** | Integration test for Gemini-only guard and interleavedParts flow |

**No changes needed:**
- `src/services/gemini/image.ts` — `interleavedParts` path already exists (line 24-25)

---

## Chunk 1: Prompt Builder Refactor

### Task 1: Update interface and function signature

**Files:**
- Modify: `src/utils/virtual-try-on-prompt-builder.ts`

- [ ] **Step 1: Write the new interface and function skeleton**

**Delete entirely:** Remove the old `VirtualTryOnFormState` interface and `buildVirtualTryOnPrompt` function. They are fully replaced — no backward compatibility needed.

Replace with the new signature. The old interface had `subjectImageCount`, `clothingImageCount`, `numImages` — all derivable or unused. The new one takes actual `ImageFile` objects.

```typescript
import type { Part } from '@google/genai';
import { ImageFile } from '../types';

export interface VirtualTryOnPromptInput {
  subjectImage: ImageFile;
  clothingImages: ImageFile[];
  extraPrompt: string;
  backgroundPrompt: string;
}

export const buildVirtualTryOnParts = (
  input: VirtualTryOnPromptInput
): Part[] => {
  // implementation in next steps
  return [];
};
```

Key decisions:
- Function renamed to `buildVirtualTryOnParts` (returns `Part[]`, not `string`)
- `subjectImage: ImageFile` (single) — the hook processes one subject per job
- `clothingImages: ImageFile[]` — 1 or 2 items
- No `subjectImageCount`/`clothingImageCount`/`numImages` — derived from arrays or unused
- Old `VirtualTryOnFormState` and `buildVirtualTryOnPrompt` deleted entirely — no dual exports

- [ ] **Step 2: Implement interleaved image parts**

Build the image labeling section. Reference pattern: `clothing-transfer-prompt-builder.ts` lines 21-28.

```typescript
export const buildVirtualTryOnParts = (
  input: VirtualTryOnPromptInput
): Part[] => {
  const { subjectImage, clothingImages, extraPrompt, backgroundPrompt } = input;

  // Input validation — defensive guards for contract honesty
  if (!subjectImage) {
    throw new Error('subjectImage is required');
  }
  if (clothingImages.length === 0) {
    throw new Error('clothingImages must contain at least one item');
  }
  if (clothingImages.length > 2) {
    throw new Error('clothingImages must contain 1 or 2 items');
  }

  const isDualGarment = clothingImages.length === 2;
  const parts: Part[] = [];

  // Interleaved image parts with labels
  parts.push({ text: 'SUBJECT: The person/model to dress.' });
  parts.push({ inlineData: { data: subjectImage.base64, mimeType: subjectImage.mimeType } });

  if (isDualGarment) {
    parts.push({ text: 'TOP GARMENT: Apply this garment exactly.' });
    parts.push({ inlineData: { data: clothingImages[0].base64, mimeType: clothingImages[0].mimeType } });
    parts.push({ text: 'BOTTOM GARMENT: Apply this garment exactly.' });
    parts.push({ inlineData: { data: clothingImages[1].base64, mimeType: clothingImages[1].mimeType } });
  } else {
    parts.push({ text: 'CLOTHING SOURCE: Apply this garment exactly.' });
    parts.push({ inlineData: { data: clothingImages[0].base64, mimeType: clothingImages[0].mimeType } });
  }

  // Task text appended after all images
  parts.push({ text: buildTaskText(input, isDualGarment) });

  return parts;
};
```

- [ ] **Step 3: Implement the task text builder**

This is the optimized prompt content — narrative GARMENT RULES, condensed POSE, semantic negatives, CRITICAL RECAP at end.

```typescript
function buildTaskText(
  input: VirtualTryOnPromptInput,
  isDualGarment: boolean,
): string {
  const { extraPrompt, backgroundPrompt } = input;
  const dualGarmentRule = isDualGarment
    ? ' The top garment drapes outside the bottom\'s waistband, preserving source hem length exactly.'
    : '';

  const backgroundSection = backgroundPrompt.trim()
    ? `Keep the original background from the Subject Image but modify it with this description: "${backgroundPrompt.trim()}". The background must complement both the person and the new outfit.`
    : 'Keep the original background from the Subject Image exactly as is.';

  const extraSection = extraPrompt.trim()
    ? `\n${extraPrompt.trim()}`
    : '';

  return `## TASK
Replace the subject's entire outfit with the provided garments while preserving their face, hair, skin tone, and body proportions exactly.

## GARMENT RULES
[CRITICAL] The output clothing must be 100% from the Source images — zero original outfit elements may remain. All tops hang freely outside the waistband with natural hem drape; never tucked in.${dualGarmentRule}

Clothing fits naturally to the subject's body, aligned with pose and proportions. Replicate exact garment construction: neckline, sleeve style, hem length, silhouette, fabric drape, and decorative details. Maintain correct pattern scale and orientation — no mirroring, shrinking, or distortion. Match lighting, shadows, and color grading from the subject image. Preserve occlusions: hands, hair, and accessories stay in front of the outfit.${extraSection}

## POSE
Maintain the subject's original pose. Allow only minor, natural adjustments to complement the new outfit's silhouette and fit — never change the overall posture or stance.

## BACKGROUND
${backgroundSection}

## PROHIBITIONS
- Zero original outfit elements in output.
- No tucking tops into pants or skirts.
- No text, logos, watermarks, extra people.
- No body/face/hair distortion.
- No pattern mirroring, shrinking, or duplication.

## CRITICAL RECAP
Clothing 100% from Source — zero blending with original. Tops ALWAYS outside waistband. Face/hair/skin preserved exactly. Photorealistic, professional-grade.`;
}
```

- [ ] **Step 4: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors in prompt builder)

- [ ] **Step 5: Commit**

```bash
git add src/utils/virtual-try-on-prompt-builder.ts
git commit -m "refactor(try-on): rewrite prompt builder to interleaved Part[] with optimized content"
```

---

### Task 2: Update the hook to use new builder

**Files:**
- Modify: `src/hooks/useVirtualTryOn.ts:16,148-206`

- [ ] **Step 1: Update import**

Change:
```typescript
// Before
import { buildVirtualTryOnPrompt } from '../utils/virtual-try-on-prompt-builder';

// After
import { buildVirtualTryOnParts } from '../utils/virtual-try-on-prompt-builder';
```

- [ ] **Step 2: Add Gemini-only guard**

Before the batch loop, add a guard that throws a clear error if a non-Gemini model is selected:

```typescript
// Add before the batch processing block
const isNonGeminiModel = imageEditModel.startsWith('local--') || imageEditModel.startsWith('anti--');
if (isNonGeminiModel) {
  setError(t('virtualTryOn.geminiOnlyError') ?? 'Virtual Try-On requires a Gemini model');
  return;
}
```

- [ ] **Step 3: Move builder call inside batch loop**

The builder must be called per-job because subject image is now embedded in `Part[]`.

Current code (`useVirtualTryOn.ts` lines 154-206):
```typescript
// BEFORE: builder called ONCE outside loop
const prompt = buildVirtualTryOnPrompt({ ... });
// ...
await runBoundedWorkers(jobs, 3, async (job) => {
  const results = await editImage({
    images: [job.subjectImage, ...outfitImages],
    prompt,
    // ...
  }, ...);
});
```

New code:
```typescript
// AFTER: builder called PER-JOB inside loop
await runBoundedWorkers(jobs, BATCH_CONCURRENCY, async (job) => {
  updateSubjectItem(job.id, { status: 'processing', error: undefined, results: [] });
  try {
    const interleavedParts = buildVirtualTryOnParts({
      subjectImage: job.subjectImage,
      clothingImages: outfitImages,
      extraPrompt,
      backgroundPrompt,
    });
    const results = await editImage(
      {
        images: [],
        prompt: '',
        numberOfImages: numImages,
        aspectRatio,
        resolution,
        interleavedParts,
      },
      imageEditModel,
      buildImageServiceConfig(setLoadingMessage),
    );
    // ... rest unchanged
  }
});
```

Key changes:
- Gemini-only guard before batch loop — clear error for non-Gemini models
- `buildVirtualTryOnParts()` called inside `async (job) =>` with `job.subjectImage`
- `images: []` and `prompt: ''` — Gemini path uses `interleavedParts` exclusively
- `outfitImages` stays outside loop (shared across jobs) — same as before
- `useCallback` dependency array remains unchanged — `buildVirtualTryOnParts` is a module-level pure function import, not a reactive dependency

- [ ] **Step 4: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useVirtualTryOn.ts
git commit -m "refactor(try-on): call builder per-job with interleavedParts"
```

---

### Task 3: Add i18n key and debug logging improvements

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Modify: `src/services/imageEditingService.ts`

- [ ] **Step 1: Add Gemini-only error i18n key**

In `src/locales/en.ts`, add inside the `virtualTryOn` section (around line 130):
```typescript
geminiOnlyError: 'Virtual Try-On requires a Gemini model. Please select a Gemini model in settings.',
```

In `src/locales/vi.ts`, add the matching translation:
```typescript
geminiOnlyError: 'Virtual Try-On yeu cau model Gemini. Vui long chon model Gemini trong cai dat.',
```

- [ ] **Step 2: Add interleavedParts text to debug logging**

In `src/services/imageEditingService.ts`, update the `logApiCall` block (around line 111-118) to extract text content from interleavedParts when prompt is empty:

```typescript
// Extract prompt text for logging: use params.prompt, or concatenate text parts from interleavedParts
const logPrompt = params.prompt
  || (params.interleavedParts
    ?.filter((p) => p.text)
    .map((p) => p.text)
    .join(' | ')
  ) || '';

logApiCall({
    provider,
    model,
    feature: 'Image Edit',
    prompt: logPrompt,
    duration: Date.now() - startTime,
    status: 'success',
    responseSize: result.reduce((sum, img) => sum + img.base64.length * 0.75, 0),
});
```

Note: This also needs to be done for the error logging path lower in the file if it also logs `params.prompt`.

- [ ] **Step 3: Run type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/locales/en.ts src/locales/vi.ts src/services/imageEditingService.ts
git commit -m "fix(try-on): add Gemini-only i18n key and improve interleavedParts debug logging"
```

---

## Chunk 2: Tests

### Task 4: Rewrite builder test suite

**Files:**
- Rewrite: `__tests__/utils/virtual-try-on-prompt-builder.test.ts`

The old tests (363 lines) assert the old string-based structure (section headers like `## 1. IMAGE ROLES`, exact phrases like `"MUST always be worn UNTUCKED"`). The new builder returns `Part[]` with different structure.

**Test strategy:**
- Helper to extract text parts from `Part[]`
- Test interleaved image structure (labels + inlineData alternation)
- Test input validation guards (empty, >2, null subject)
- Test prompt content (sections, rules, conditional logic)
- Test form state integration (extraPrompt, backgroundPrompt, dual vs single garment)
- Test determinism

- [ ] **Step 1: Write test helpers and mock data**

```typescript
import { describe, it, expect, test } from 'vitest';
import { buildVirtualTryOnParts, VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-builder';
import type { Part } from '@google/genai';

const mockImage = (id: string) => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png' as const,
});

const defaultInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage('subject'),
  clothingImages: [mockImage('clothing-1')],
  extraPrompt: '',
  backgroundPrompt: '',
};

const dualGarmentInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage('subject'),
  clothingImages: [mockImage('top'), mockImage('bottom')],
  extraPrompt: '',
  backgroundPrompt: '',
};

/** Extract all text content from Part[] into a single string */
const getFullText = (parts: Part[]): string =>
  parts.filter((p) => p.text).map((p) => p.text).join('\n');

/** Get only the task text (last text part, after all images) */
const getTaskText = (parts: Part[]): string => {
  const textParts = parts.filter((p) => p.text);
  return textParts[textParts.length - 1]?.text ?? '';
};
```

**Assembly note:** Steps 2-8 below are all **sibling `describe` blocks** nested inside one top-level `describe('buildVirtualTryOnParts', () => { ... })`. Step 2 opens the outer `describe`; Step 8 closes it with `});`. Assemble into a single file.

- [ ] **Step 2: Write interleaved structure and validation tests**

```typescript
describe('buildVirtualTryOnParts', () => {
  describe('interleaved structure', () => {
    it('single garment: produces [text, img, text, img, text] = 5 parts', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts).toHaveLength(5);
    });

    it('dual garment: produces [text, img, text, img, text, img, text] = 7 parts', () => {
      const parts = buildVirtualTryOnParts(dualGarmentInput);
      expect(parts).toHaveLength(7);
    });

    it('first part is SUBJECT label', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[0].text).toContain('SUBJECT');
    });

    it('second part is subject image inlineData', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[1].inlineData?.data).toBe('mock-base64-subject');
    });

    it('single garment: third part is CLOTHING SOURCE label', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[2].text).toContain('CLOTHING SOURCE');
    });

    it('dual garment: labels are TOP GARMENT and BOTTOM GARMENT', () => {
      const parts = buildVirtualTryOnParts(dualGarmentInput);
      expect(parts[2].text).toContain('TOP GARMENT');
      expect(parts[4].text).toContain('BOTTOM GARMENT');
    });

    it('dual garment: image data matches input order (top first, bottom second)', () => {
      const parts = buildVirtualTryOnParts(dualGarmentInput);
      expect(parts[3].inlineData?.data).toBe('mock-base64-top');
      expect(parts[5].inlineData?.data).toBe('mock-base64-bottom');
    });

    it('last part is task text (no inlineData)', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      const lastPart = parts[parts.length - 1];
      expect(lastPart.text).toBeDefined();
      expect(lastPart.inlineData).toBeUndefined();
    });
  });

  describe('input validation', () => {
    it('throws when clothingImages is empty', () => {
      const input = { ...defaultInput, clothingImages: [] };
      expect(() => buildVirtualTryOnParts(input)).toThrow('clothingImages must contain at least one item');
    });

    it('throws when clothingImages has more than 2 items', () => {
      const input = { ...defaultInput, clothingImages: [mockImage('a'), mockImage('b'), mockImage('c')] };
      expect(() => buildVirtualTryOnParts(input)).toThrow('clothingImages must contain 1 or 2 items');
    });

    it('throws when subjectImage is null/undefined', () => {
      const input = { ...defaultInput, subjectImage: null as unknown as typeof defaultInput.subjectImage };
      expect(() => buildVirtualTryOnParts(input)).toThrow('subjectImage is required');
    });
  });
```

- [ ] **Step 3: Write prompt content tests**

```typescript
  describe('task text - required sections', () => {
    it('contains TASK section', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## TASK');
    });

    it('contains GARMENT RULES section', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## GARMENT RULES');
    });

    it('contains POSE section', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## POSE');
    });

    it('contains BACKGROUND section', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## BACKGROUND');
    });

    it('contains PROHIBITIONS section', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## PROHIBITIONS');
    });

    it('contains CRITICAL RECAP section at the end', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## CRITICAL RECAP');
      // RECAP should be the last section
      const recapIndex = text.lastIndexOf('## CRITICAL RECAP');
      const lastHashIndex = text.lastIndexOf('## ');
      expect(recapIndex).toBe(lastHashIndex);
    });

    it('sections appear in correct order', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      const sections = ['## TASK', '## GARMENT RULES', '## POSE', '## BACKGROUND', '## PROHIBITIONS', '## CRITICAL RECAP'];
      let lastIndex = -1;
      sections.forEach((section) => {
        const idx = text.indexOf(section);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      });
    });
  });
```

- [ ] **Step 4: Write garment rules and critical styling tests**

```typescript
  describe('garment rules - critical styling', () => {
    it('contains [CRITICAL] marker', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('[CRITICAL]');
    });

    it('contains untucked rule (semantic positive framing)', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('tops hang freely outside the waistband');
    });

    it('contains zero original outfit rule', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('100% from the Source images');
      expect(text).toContain('zero original outfit elements');
    });

    it('contains fits naturally to body rule', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('fits naturally to the subject\'s body');
    });

    it('contains occlusion preservation', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('occlusions');
      expect(text).toContain('hands, hair');
    });

    it('contains lighting/shadow matching', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('lighting, shadows, and color grading');
    });
  });
```

- [ ] **Step 5: Write pose, prohibitions, recap tests**

```typescript
  describe('pose - preserve original', () => {
    it('instructs to maintain original pose', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Maintain the subject\'s original pose');
    });

    it('does NOT generate new dynamic pose', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).not.toContain('new dynamic fashion pose');
      expect(text).not.toContain('magazine-cover ready');
    });
  });

  describe('prohibitions', () => {
    it('contains no-tucking prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('No tucking tops into pants or skirts');
    });

    it('contains no-distortion prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('No body/face/hair distortion');
    });

    it('contains no-watermarks prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('No text, logos, watermarks');
    });
  });

  describe('critical recap (recency bias)', () => {
    it('contains clothing source recap', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Clothing 100% from Source');
    });

    it('contains waistband recap', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Tops ALWAYS outside waistband');
    });

    it('contains face preservation recap', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Face/hair/skin preserved exactly');
    });

    it('recap is the very last section in task text', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      const recapIdx = text.indexOf('## CRITICAL RECAP');
      const afterRecap = text.slice(recapIdx);
      // No other ## section after RECAP
      expect(afterRecap.match(/## /g)).toHaveLength(1);
    });
  });
```

- [ ] **Step 6: Write dual-garment conditional tests**

```typescript
  describe('dual-garment rules', () => {
    it('dual garment adds waistband-overlap rule in GARMENT RULES', () => {
      const text = getTaskText(buildVirtualTryOnParts(dualGarmentInput));
      expect(text).toContain('drapes outside the bottom\'s waistband');
    });

    it('dual garment preserves source hem length', () => {
      const text = getTaskText(buildVirtualTryOnParts(dualGarmentInput));
      expect(text).toContain('preserving source hem length exactly');
    });

    it('single garment does NOT add waistband-overlap rule', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).not.toContain('drapes outside the bottom\'s waistband');
    });
  });
```

- [ ] **Step 7: Write form state integration tests**

```typescript
  describe('form state - extraPrompt', () => {
    it('appends extraPrompt when provided', () => {
      const input = { ...defaultInput, extraPrompt: 'Make it vintage style' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Make it vintage style');
    });

    it('does not append extraPrompt when empty', () => {
      const withEmpty = getTaskText(buildVirtualTryOnParts({ ...defaultInput, extraPrompt: '' }));
      const withWhitespace = getTaskText(buildVirtualTryOnParts({ ...defaultInput, extraPrompt: '   ' }));
      expect(withEmpty).toBe(withWhitespace);
    });

    it('trims whitespace from extraPrompt', () => {
      const input = { ...defaultInput, extraPrompt: '   Trimmed   ' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Trimmed');
      expect(text).not.toContain('   Trimmed   ');
    });
  });

  describe('form state - backgroundPrompt', () => {
    it('uses backgroundPrompt when provided', () => {
      const input = { ...defaultInput, backgroundPrompt: 'Urban street' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Urban street');
      expect(text).toContain('modify it with this description');
    });

    it('keeps original background when empty', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Keep the original background from the Subject Image exactly as is');
    });

    it('keeps original background when whitespace only', () => {
      const input = { ...defaultInput, backgroundPrompt: '   ' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Keep the original background from the Subject Image exactly as is');
    });

    it('trims whitespace from backgroundPrompt', () => {
      const input = { ...defaultInput, backgroundPrompt: '   Park   ' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Park');
      expect(text).not.toContain('   Park   ');
    });
  });
```

- [ ] **Step 8: Write determinism test**

```typescript
  describe('determinism', () => {
    it('produces identical output for identical inputs', () => {
      const input = { ...defaultInput, extraPrompt: 'Test', backgroundPrompt: 'BG' };
      const parts1 = buildVirtualTryOnParts(input);
      const parts2 = buildVirtualTryOnParts(input);
      expect(getFullText(parts1)).toBe(getFullText(parts2));
    });
  });
});
```

- [ ] **Step 9: Run tests**

Run: `npm run test -- __tests__/utils/virtual-try-on-prompt-builder.test.ts`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add __tests__/utils/virtual-try-on-prompt-builder.test.ts
git commit -m "test(try-on): rewrite prompt builder tests for interleaved Part[] output"
```

---

### Task 5: Hook integration tests

**Files:**
- New: `__tests__/hooks/useVirtualTryOn.test.tsx`

Test the Gemini-only guard and the interleavedParts flow in the hook.

- [ ] **Step 1: Write hook integration tests**

Mock `editImage` and verify:
1. Non-Gemini model (prefixed `local--` or `anti--`) → `setError` is called, `editImage` is NOT called
2. Gemini model → `editImage` is called with `interleavedParts` populated and `images: []`
3. Multiple subjects → builder called per-job with correct subject image

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualTryOn } from '@/hooks/useVirtualTryOn';

// Mock dependencies
vi.mock('@/services/imageEditingService', () => ({
  editImage: vi.fn().mockResolvedValue([{ base64: 'result', mimeType: 'image/png' }]),
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    localApiBaseUrl: null,
    localApiKey: null,
    antiApiBaseUrl: null,
    antiApiKey: null,
    getModelsForFeature: () => ({ imageEditModel: 'gemini-2.5-flash-image' }),
  }),
}));
```

Implementation details will depend on the exact mock setup for the Api context — the hook reads `imageEditModel` from `getModelsForFeature()`. The test should override this to test both Gemini and non-Gemini paths.

**Key test cases:**
- Gemini-only guard blocks `local--model` and `anti--model`
- Gemini path passes `interleavedParts` with correct Part[] structure
- `images` array is empty when `interleavedParts` is provided

- [ ] **Step 2: Run tests**

Run: `npm run test -- __tests__/hooks/useVirtualTryOn.test.tsx`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add __tests__/hooks/useVirtualTryOn.test.tsx
git commit -m "test(try-on): add hook integration tests for Gemini guard and interleavedParts"
```

---

## Chunk 3: Verification

### Task 6: Final quality gates

- [ ] **Step 1: Type-check entire project**

Run: `npx tsc --noEmit`
Expected: PASS — zero type errors

- [ ] **Step 2: Lint entire project**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: ALL PASS — no regressions

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: PASS — no build errors

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore(try-on): fix any lint/type issues from prompt refactor"
```

---

## Summary of prompt changes

| Aspect | Before | After |
|--------|--------|-------|
| Return type | `string` | `Part[]` |
| Image delivery | `[img, img, img, "text"]` | `["SUBJECT:", img, "TOP:", img, "text"]` |
| Interface | `VirtualTryOnFormState` (5 fields, 3 unused) | `VirtualTryOnPromptInput` (4 fields, all used) |
| Builder call site | Once outside batch loop | Per-job inside batch loop |
| Input validation | None | Validates subject, clothing count (0 and >2) |
| GARMENT RULES format | Numbered bullet list | Narrative paragraphs with `[CRITICAL]` markers |
| Pose section | 6 bullets, 148 words, generate new pose | 2 sentences, 28 words, preserve original pose |
| Negative framing | "Do NOT tuck" (primes tucking) | Semantic positive in rules + explicit in PROHIBITIONS |
| Redundancy | Untucked x2, remove outfit x3 | Each rule once per section, recap summarizes |
| Recency bias | Critical rules in middle | CRITICAL RECAP as final section |
| "2K resolution" in prompt | Present (wastes tokens, API param controls this) | Removed |
| Debug logging | Empty prompt logged for interleavedParts | Text content extracted and logged |
| Non-Gemini guard | None (silent failure) | Explicit error with i18n message |
| Section count | 7 | 6 + CRITICAL RECAP |

## CEO Review Amendments Applied

| # | Amendment | Where |
|---|-----------|-------|
| 1 | `subjectImage` null validation guard | Task 1, Step 2 |
| 2 | `clothingImages.length > 2` validation guard | Task 1, Step 2 |
| 3 | `virtualTryOn.geminiOnlyError` i18n key in en.ts + vi.ts | Task 3, Step 1 |
| 4 | Test for >2 clothing images throwing | Task 4, Step 2 |
| 5 | Test for null subjectImage throwing | Task 4, Step 2 |
| 6 | Fixed Task 2 step numbering (was: duplicate Step 3) | Task 2 |
| 7 | interleavedParts text in debug logging | Task 3, Step 2 |
| 8 | Hook integration tests for Gemini guard + interleavedParts | Task 5 |
