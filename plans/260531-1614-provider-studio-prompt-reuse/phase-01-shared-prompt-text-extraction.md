---
phase: 1
title: "Shared Prompt Text Extraction"
status: complete
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Shared Prompt Text Extraction

## Overview

Create a single shared adapter that turns `(Feature, userPrompt, images[])` into a
composed prompt string by reusing the existing Gemini prompt builders. The adapter
extracts the text segments from each builder's `Part[]` output (dropping the inline image
parts, since provider services take images separately) while preserving the role-label
text in upload order.

## Requirements

- Functional: For each provider-supported feature, return a prompt string that includes
  the builder's instruction text. Images are NOT embedded — they flow to the service
  separately, so only `part.text` segments are joined.
- Functional: AI Editor returns the raw user prompt unchanged (Gemini has no builder for it).
- Functional: Empty/missing images must not throw — return raw prompt as a safe fallback
  when a builder's preconditions are not met (the hook already gates `requiresImages`).
- Non-functional: Pure function, no side effects, no React imports. Mirrors the existing
  `*-prompt-builder.ts` style. Keep file < 200 lines.

## Architecture

```
useGrokStudio / useGptImageStudio
        │  (Feature, userPrompt, images[])
        ▼
buildProviderStudioPrompt(feature, prompt, images)   ← NEW adapter
        │  switch(feature)
        ├─ TryOn            → buildVirtualTryOnParts({subjectImage: images[0],
        │                        sourceItems: images[1..].map(clothing), extraPrompt: userPrompt,
        │                        backgroundPrompt: ''}) → extractText()
        ├─ ClothingTransfer → buildClothingTransferParts(images[0], images[1..]→refs, userPrompt) → extractText()
        ├─ PatternGenerator → buildPatternGeneratorParts(images, TASK_PROMPT + userPrompt) → extractText()
        ├─ Lookbook         → buildLookbookPrompt(DEFAULT_PROVIDER_LOOKBOOK_STATE+{clothingDescription:userPrompt}, images, null)
        └─ default/AIEditor → userPrompt (unchanged)
        ▼
   composed prompt string  →  editGrokImage / editGptImage (images passed separately)
```

`extractText(parts: Part[]): string` joins all `part.text` values with `\n\n`, skipping
`inlineData` parts. This keeps the role labels ("SUBJECT:", "SOURCE ITEM #1 (clothing):")
in the prompt so the model still understands image ordering.

## Related Code Files

- Create: `src/utils/provider-studio-prompt-adapter.ts`
- Read for context (reuse, do NOT modify):
  - `src/utils/virtual-try-on-prompt-builder.ts` (`buildVirtualTryOnParts`, input shape)
  - `src/utils/clothing-transfer-prompt-builder.ts` (`buildClothingTransferParts`)
  - `src/utils/pattern-generator-prompt-builder.ts` (`buildPatternGeneratorParts`, `TASK_PROMPT`)
  - `src/utils/lookbookPromptBuilder.ts` (`buildLookbookPrompt`, `LookbookFormState`)
  - `src/components/LookbookGenerator.prompts.ts` (`LookbookStyle`, `GarmentType`, default keys)
  - `src/types.ts` (`Feature`, `ImageFile`, `VirtualTryOnSourceItemType`)

## Implementation Steps

1. Create `src/utils/provider-studio-prompt-adapter.ts`.
2. Add private `extractText(parts: Part[]): string` — `parts.filter(p => 'text' in p).map(p => p.text).join('\n\n')`.
3. Define `DEFAULT_PROVIDER_LOOKBOOK_STATE: LookbookFormState` — the **initial** Lookbook
   form value (Phase 6 adds a user-facing picker that overrides it; until then this is the
   default). Use `lookbookStyle: 'flat lay'` (clothing-only presentation — the provider Lookbook
   workflow uploads CLOTHING reference images, NOT a person photo, so a person-based style
   like 'studio background' would be incoherent). Fill all required `LookbookFormState`
   fields with safe values (empty strings, `garmentType: 'one-piece'`,
   `foldedPresentationType: 'boxed'`, first mannequin key, no accessories/footwear).
4. Export `buildProviderStudioPrompt(feature: Feature, userPrompt: string, images: ImageFile[]): string`.
5. Implement the per-feature `switch` per the Architecture diagram. For Try-On, map
   `images[0]`→subject and `images[1..]`→`{ image, sourceItemType: 'clothing' }` source items.
   For Clothing Transfer, map `images[0]`→concept and `images[1..]`→`{ image, label: '' }` refs.
6. Wrap each builder call in a guard: if required images are missing (e.g. Try-On with <2
   images, Clothing Transfer with <2), fall back to returning `userPrompt` so the adapter
   never throws (builders throw on empty input).
7. Trim/normalize: if `userPrompt` is empty, still return the builder text (rules alone are
   valuable). If builder text is empty (AI Editor), return `userPrompt`.
8. Pattern Generator text-only normalization: when `images.length === 0`, pass a
   reference-agnostic task string (drop the "based on the reference image(s) above" wording)
   so the prompt stays coherent without uploads.

## Success Criteria

- [ ] `buildProviderStudioPrompt(Feature.TryOn, 'wear it', [subj, cloth])` returns a string
      containing `"never tucked in"` and the user note `"wear it"`.
- [ ] `buildProviderStudioPrompt(Feature.ClothingTransfer, p, [a,b])` contains `"DESTINATION SCENE"`.
- [ ] `buildProviderStudioPrompt(Feature.PatternGenerator, p, [a])` contains `"tile seamlessly"`.
- [ ] `buildProviderStudioPrompt(Feature.Lookbook, p, [a])` contains the chosen style's rule text.
- [ ] `buildProviderStudioPrompt(Feature.AIEditor, 'x', [a])` returns exactly `'x'`.
- [ ] Missing-image calls return the raw prompt instead of throwing.
- [ ] `npx tsc --noEmit` clean.

## Risk Assessment

- **Builder input drift**: builders may change signatures later. Mitigation: adapter is the
  single consumer mapping point; a type error surfaces immediately at compile time.
- **`Part` type import**: import `type { Part } from '@google/genai'` (same as builders) — no
  runtime dependency added.
