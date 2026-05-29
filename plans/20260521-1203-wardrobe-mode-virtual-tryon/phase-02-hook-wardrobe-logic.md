# Phase 2: Hook Logic — Wardrobe Sub-Hook

<!-- Updated: Validation Session 1 - Extract to useWardrobeMode.ts, preserve state on switch, single-person only -->

## Context

- Plan: `plans/20260521-1203-wardrobe-mode-virtual-tryon/plan.md`
- New file: `src/hooks/useWardrobeMode.ts`
- Modify: `src/hooks/useVirtualTryOn.ts` (527 LOC) — add mode state + integrate sub-hook
- Depends on: Phase 1 (types)

## Overview

- Priority: High
- Status: completed
- Create dedicated `useWardrobeMode` sub-hook for wardrobe state + generation. Parent hook adds mode toggle and merges return values.

## Key Insights

- Existing hook uses `runBoundedWorkers()` for concurrent batch jobs — reuse same pattern
- Each wardrobe set = 1 API call (same as 1 subject in multi-model mode)
- `buildVirtualTryOnParts()` accepts 1 subject + N sourceItems — no changes needed
- Multi-person mode NOT supported in wardrobe (always `isMultiPersonMode: false`)
- State preserved across mode switches — both modes keep their data independently

## Requirements

### Functional
- Mode toggle state in parent hook: `multi-model` | `wardrobe`
- Sub-hook manages: wardrobeSets CRUD, subject, results, generation
- Max 4 sets, each max 4 items (type: `VirtualTryOnClothingItem`)
- Default: 1 empty set on first entry
- Generate: iterate sets, each = 1 job with same subject
- Results stored per-set for grouped display
- Download all as ZIP

### Non-functional
- `useWardrobeMode.ts` target: ~200-300 LOC
- `useVirtualTryOn.ts` grows by ~40-60 LOC (mode state + integration + wiring)
- No breaking changes to multi-model flow

## Architecture

```
useVirtualTryOn()
├── mode: VirtualTryOnMode state
├── isAnyGenerating: derived (isLoading || wardrobe.isGenerating)
├── [multi-model] existing logic (unchanged)
│   ├── extraPrompt, backgroundPrompt (owned here)
│   └── numImages, aspectRatio, resolution (owned here)
└── wardrobe: useWardrobeMode({ imageEditModel, numImages, aspectRatio, resolution }) ← sub-hook
    ├── wardrobeSets[] (max 4 WardrobeSet, default: [1 empty])
    ├── wardrobeSubject: ImageFile | null
    ├── wardrobeExtraPrompt: string (independent from multi-model)
    ├── wardrobeBackgroundPrompt: string (independent from multi-model)
    ├── wardrobeResults: WardrobeResultSet[]
    ├── isWardrobeGenerating: boolean
    ├── addWardrobeSet() / removeWardrobeSet()
    ├── addItemToSet() / removeItemFromSet() / updateItemInSet()
    ├── setWardrobeSubject() / clearWardrobeSubject()
    ├── generateWardrobe()
    └── downloadWardrobeResults()

Return shape: parent returns { mode, setMode, isAnyGenerating, wardrobe: {...} }
```

## Related Code Files

- Create: `src/hooks/useWardrobeMode.ts`
- Modify: `src/hooks/useVirtualTryOn.ts` (add mode + call sub-hook)
- Read: `src/utils/virtual-try-on-prompt-builder.ts` (interface reference)
- Read: `src/utils/run-bounded-workers.ts` (concurrency pattern)
- Read: `src/utils/zipDownload.ts` (download helper)

## Implementation Steps

1. Create `src/hooks/useWardrobeMode.ts`:
   - Import types: `VirtualTryOnMode`, `WardrobeSet`, `WardrobeResultSet`, `VirtualTryOnClothingItem`, `ImageFile`
   - Import utils: `buildVirtualTryOnParts`, `runBoundedWorkers`, `downloadImagesAsZip`
   - Import service: `editImage` from imageEditingService
   - Import `VirtualTryOnPromptSourceItem` from prompt builder
   - Constants: `MAX_WARDROBE_SETS = 4`, `MAX_ITEMS_PER_SET = 4` (import from prompt builder's MAX_SOURCE_ITEMS if exported, else keep coupled)
   - Hook params interface: `{ imageEditModel, numImages, aspectRatio, resolution }`
2. Add state:
   - `wardrobeSets: WardrobeSet[]` (default: `[{ id: 'ws-1', items: [] }]`)
   - `wardrobeSubject: ImageFile | null`
   - `wardrobeExtraPrompt: string` (independent from multi-model)
   - `wardrobeBackgroundPrompt: string` (independent from multi-model)
   - `wardrobeResults: WardrobeResultSet[]`
   - `isWardrobeGenerating: boolean`
   - `wardrobeError: string | null`
   - `wardrobeLoadingMessage: string`
   - `wardrobeSetIdCounter: useRef(1)` (monotonic, never resets)
3. Add CRUD callbacks:
   - `addWardrobeSet()` — push new set with `id: 'ws-${++counter}'` (guard MAX_WARDROBE_SETS)
   - `removeWardrobeSet(setId)` — filter out, ensure at least 1 remains
   - `addItemToWardrobeSet(setId, item)` — push item (guard MAX_ITEMS_PER_SET)
   - `removeItemFromWardrobeSet(setId, itemId)` — filter item
   - `updateItemInWardrobeSet(setId, itemId, updates)` — update sourceItemType/sourcePrompt
   - `setWardrobeSubject(image)` / `clearWardrobeSubject()`
4. Add `generateWardrobe()`:
   - Guard: if parent `isLoading` is true, return early (prevent cross-mode concurrent generation)
   - Validate: wardrobeSubject exists, at least 1 set with valid items
   - **Snapshot subject**: `const subject = wardrobeSubject` (capture before async, prevent stale closure)
   - Filter valid items per set: `items.filter(i => i.image !== null)`
   - **Map to prompt type**: `validItems.map(item => ({ image: item.image as ImageFile, sourceItemType: item.sourceItemType, sourcePrompt: item.sourcePrompt }))` → `VirtualTryOnPromptSourceItem[]`
   - Build jobs array: each job carries `{ setId, parts }` where parts = `buildVirtualTryOnParts({ subjectImage: subject, sourceItems: mappedItems, extraPrompt: wardrobeExtraPrompt, backgroundPrompt: wardrobeBackgroundPrompt, isMultiPersonMode: false })`
   - Run via `runBoundedWorkers()` with concurrency = 2 (rate-limit safe)
   - Worker callback: call `editImage({ interleavedParts: job.parts, numberOfImages: numImages, aspectRatio, resolution }, imageEditModel, config)`
   - **Update results with functional updater**: `setWardrobeResults(prev => prev.map(r => r.setId === job.setId ? { ...r, status: 'completed', results } : r))`
   - On error: `setWardrobeResults(prev => prev.map(r => r.setId === job.setId ? { ...r, status: 'error', error: message } : r))`
5. Add `downloadWardrobeResults()` — collect results with per-set prefix naming (e.g., `Set1-001.jpg`)
6. Return namespaced object (not flat spread):
   ```typescript
   return {
     sets: wardrobeSets, subject: wardrobeSubject,
     extraPrompt: wardrobeExtraPrompt, setExtraPrompt: setWardrobeExtraPrompt,
     backgroundPrompt: wardrobeBackgroundPrompt, setBackgroundPrompt: setWardrobeBackgroundPrompt,
     results: wardrobeResults, isGenerating: isWardrobeGenerating,
     error: wardrobeError, loadingMessage: wardrobeLoadingMessage,
     addSet, removeSet, addItem, removeItem, updateItem,
     setSubject, clearSubject, generate, download,
   }
   ```
7. In `useVirtualTryOn.ts`:
   - Add `mode` state: `useState<VirtualTryOnMode>('multi-model')`
   - Call `const wardrobe = useWardrobeMode({ imageEditModel, numImages, aspectRatio, resolution })`
   - Add `setMode` callback
   - Add derived `isAnyGenerating = isLoading || wardrobe.isGenerating`
   - Return: `{ ...existingReturns, mode, setMode, isAnyGenerating, wardrobe }`

## Todo

- [x] Create `src/hooks/useWardrobeMode.ts` with hook params interface
- [x] Add wardrobe-specific prompt state (independent from multi-model)
- [x] Implement CRUD with monotonic ID counter
- [x] Implement `generateWardrobe()` with subject snapshot + type mapping + functional updaters
- [x] Implement `downloadWardrobeResults()` with per-set prefix naming
- [x] Return namespaced object (not flat spread)
- [x] Add mode state + `isAnyGenerating` to `useVirtualTryOn.ts`
- [x] Integrate sub-hook via params from parent
- [x] Verify `npx tsc --noEmit` passes
- [x] Verify existing multi-model tests still pass

## Success Criteria

- Mode toggle switches between flows without data loss
- Wardrobe generate produces 1 image per set
- Concurrent execution via runBoundedWorkers (concurrency: 2)
- Cross-mode concurrent generation blocked by `isAnyGenerating`
- Prompts independent per mode (changing wardrobe prompt doesn't affect multi-model)
- Subject snapshot prevents stale-closure bugs
- Type mapping from `VirtualTryOnClothingItem` → `VirtualTryOnPromptSourceItem` explicit
- Existing multi-model flow completely unaffected
- `useWardrobeMode.ts` stays under 300 LOC
- `useVirtualTryOn.ts` grows by <60 LOC

## Risk Assessment

- Low-medium risk — logic is isolated in new file, minimal changes to existing hook
- Mitigated: subject snapshot, functional updaters, concurrency cap at 2, namespaced return
