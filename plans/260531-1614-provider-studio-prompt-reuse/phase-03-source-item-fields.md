---
phase: 3
title: "Source-Item Types, Notes, Background and Extra Instructions"
status: complete
priority: P1
effort: "5h"
dependencies: [2]
---

# Phase 3: Source-Item Types, Notes, Background and Extra Instructions

## Overview

Bring provider Try-On (and where relevant, the other edit workflows) to input parity with
Gemini: each uploaded source image can carry a **type** (clothing/shoes/bag/accessory) and a
short **note**, plus the studio gains a dedicated **background prompt** field and a separate
**extra-instructions** field (Q4=B). These feed the Phase 1 adapter so the composed builder
prompt is as rich as Gemini's.

## Requirements

- Functional: Per source image, user can pick `VirtualTryOnSourceItemType` and type a short
  note (cap 180 chars, mirroring Gemini's `MAX_SOURCE_PROMPT_LENGTH`).
- Functional: Studio shows a `background` field (Try-On) and an `extra instructions` field,
  distinct from the main prompt box. These map to the builder's `backgroundPrompt`/`extraPrompt`.
- Functional: Adapter `buildProviderStudioPrompt` signature extends to accept structured
  source items + background + extra instead of a flat image array, for feature parity.
- Non-functional: Provider components stay thin; new state lives in the hooks. No Gemini changes.

## Architecture

- Extend the provider hook image state from `ImageFile[]` to a per-item shape carrying
  `{ image, sourceItemType, note }` for Try-On (reuse the `VirtualTryOnClothingItem` shape /
  `VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES` from `types.ts`). Subject vs source split: image[0] is
  the subject; the rest are typed source items.
- Add `backgroundPrompt` and `extraInstructions` state to the hooks.
- Extend the adapter: `buildProviderStudioPrompt(feature, { subjectImage, sourceItems,
  backgroundPrompt, extraPrompt, userPrompt })` → composed string via the builders, passing
  these through to `buildVirtualTryOnParts` natively (it already accepts them).
- Drive UI field visibility from `providerWorkflows.ts` flags (e.g. `hasSourceItemTypes`,
  `hasBackgroundField`).

## Related Code Files

- Modify: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts`
- Modify: `src/utils/provider-studio-prompt-adapter.ts` (richer input contract)
- Modify: `src/components/studios/GrokStudio.tsx`, `GptImageStudio.tsx` (per-item type select,
  note input, background + extra-instruction textareas)
- Modify: `src/components/studios/provider-studio/providerWorkflows.ts` (field flags)
- Modify: `src/components/MultiImageUploader.tsx` only if per-item controls require it
  (prefer a sibling control row to avoid touching the shared uploader)
- Modify: `src/locales/en.ts`, `src/locales/vi.ts`
- Read: `src/hooks/useVirtualTryOn.ts` (reference for state shape + field semantics),
  `src/types.ts` (`VirtualTryOnClothingItem`, `VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES`)

## Implementation Steps

1. Extend adapter input contract to structured items + background + extra; keep a back-compat
   overload or migrate Phase 2 call sites in the same change.
2. In each hook, replace `images: ImageFile[]` workflow state with subject + typed source
   items (Try-On); keep simple `images[]` for features that don't use types.
3. Add `backgroundPrompt` / `extraInstructions` state + setters to the hooks.
4. Update `handleGenerate` to build the adapter input from the new state.
5. Add UI: per-source-item type `<select>` + note `<input>` (cap 180), background textarea,
   extra-instructions textarea. Gate via `providerWorkflows` flags so only relevant features
   show them.
6. Add i18n keys (EN + VI) for all new labels/placeholders.
7. `npx tsc --noEmit`, `npm run lint`.

## Success Criteria

- [ ] Try-On in both providers: each source image has a type + optional note; a background and
      an extra-instructions field exist separate from the main prompt.
- [ ] Composed prompt reflects item types (e.g. shoes vs clothing rule), note, background, extra.
- [ ] Features without these inputs are unchanged.
- [ ] `npx tsc --noEmit`, `npm run lint` clean; new unit tests for the adapter's structured path.

## Risk Assessment

- **Uploader coupling**: `MultiImageUploader` is shared with Gemini. Mitigation: add per-item
  controls as a sibling row keyed by image index, do not change the shared uploader's contract.
- **State migration**: changing hook image state may ripple to existing provider tests.
  Mitigation: update those tests in this phase; keep routing tests intact.
