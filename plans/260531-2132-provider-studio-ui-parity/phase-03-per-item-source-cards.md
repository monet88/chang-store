---
phase: 3
title: "Per-Item Source Cards"
status: pending
priority: P2
effort: "1.5d"
dependencies: [1, 2]
---

# Phase 3: Per-Item Source Cards

## Overview

Replace the providers' flat `MultiImageUploader` + separate `ProviderSourceFields` list
with Gemini-style per-item source cards: each source item gets its own uploader, type
`<select>`, and note input in one card, plus an "Add Another Item" button — mirroring
Gemini Try-On. Applies to Try-On and Clothing Transfer (the workflows with source items).

## Requirements

- Functional: subject (image[0]) uploads separately; each source item is a self-contained
  card (image + type + note); add/remove items up to the provider max; ordering preserved
  so `images[]` and the source-field arrays stay index-aligned for the prompt adapter.
- Non-functional: keep the existing `images: ImageFile[]` + `sourceItemTypes[]` +
  `sourceItemNotes[]` contract the prompt adapter already consumes — only the UI grouping
  changes, not the data shape.

## Architecture

Current model: one `MultiImageUploader` produces a flat `images[]` where image[0] = subject
and image[1..] = sources; `ProviderSourceFields` renders type/note keyed by source position.

Target model (mirror Gemini): a subject `ImageUploader` + a grid of source-item cards.
Because the studio hook stores a single `images[]` array, introduce a small UI-side
adapter that:
- treats `images[0]` as subject (own uploader),
- maps `images[1..]` to source cards,
- on add/remove/replace, recomputes `images[]` AND realigns `sourceItemTypes` /
  `sourceItemNotes` arrays via the existing setters.

Add a new presentational `ProviderSourceItemCard` (image preview/upload + type select +
note) and `ProviderSourceItemGrid` (maps cards + Add button). Reuse `ImageUploader` for the
per-card image and the existing `VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES`.

Keep `ProviderSourceFields` for the background + extra-instructions fields (or split those
out into a tiny `ProviderTextFields` so source UI is fully card-based). The hook needs a
helper to insert/remove a source image at index N while keeping type/note arrays aligned —
add `addSourceItem`, `removeSourceItem`, `updateSourceItem` to `useProviderStudioFields`
(operating on the parent `images` setter + its own arrays).

## Related Code Files

- Create: `src/components/studios/provider-studio/ProviderSourceItemCard.tsx`
- Create: `src/components/studios/provider-studio/ProviderSourceItemGrid.tsx`
- Modify: `src/hooks/useProviderStudioFields.ts` (add aligned add/remove/update source helpers)
- Modify: `src/components/studios/provider-studio/ProviderSourceFields.tsx` (reduce to text fields, or split)
- Modify: `src/components/studios/provider-studio/ProviderStudioShell.tsx` (use grid for source workflows)
- Read: `src/components/VirtualTryOn.tsx`, `src/components/WardrobeSetCard.tsx` (card UX reference)
- Read: `src/utils/provider-studio-prompt-adapter.ts` (confirm index alignment contract)

## Implementation Steps

1. Add `addSourceItem/removeSourceItem/updateSourceItem(image|type|note)` to
   `useProviderStudioFields`, operating on the parent `images` array + the type/note arrays
   so all three stay index-aligned (source index i ↔ images[i+1]).
2. Build `ProviderSourceItemCard` (subject excluded): per-card `ImageUploader`, type select,
   note input with `MAX_SOURCE_PROMPT_LENGTH`.
3. Build `ProviderSourceItemGrid`: subject uploader on top, then source cards, then
   "Add Another Item" (disabled at max), with remove per card.
4. Wire into `ProviderStudioShell` for `hasSourceItemTypes`/`hasSourceItemNotes` workflows
   (Try-On, Clothing Transfer). Keep Pattern Generator / AI Editor on the simple uploader.
5. Move background + extra-instruction fields into their own small block.
6. Verify prompt output unchanged for identical inputs (compare composed prompt before/after).
7. Run tsc, lint, boundary test, and the prompt-adapter unit tests.

## Success Criteria

- [ ] Try-On and Clothing Transfer use per-item source cards with add/remove.
- [ ] `images[]`, `sourceItemTypes[]`, `sourceItemNotes[]` stay index-aligned after any
      add/remove/reorder; composed prompt identical to the flat-UI output for same inputs.
- [ ] Pattern Generator / AI Editor unaffected.
- [ ] `npx tsc --noEmit` clean; lint clean; boundary + adapter tests pass.

## Risk Assessment

- Risk: index misalignment between images and type/note arrays after remove. Mitigation:
  centralize all mutations in the hook helpers; add a unit test for add/remove alignment.
- Risk: regressing the prompt builder. Mitigation: snapshot the composed prompt for a
  fixed input set before and after.
