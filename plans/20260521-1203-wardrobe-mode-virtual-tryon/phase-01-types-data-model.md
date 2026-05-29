# Phase 1: Types & Data Model

## Context

- Brainstorm: `plans/reports/brainstorm-20260521-wardrobe-mode.md`
- File: `src/types.ts` (225 LOC)

## Overview

- Priority: High
- Status: completed
- Add types for wardrobe mode without breaking existing Multi-Model flow

## Requirements

- `VirtualTryOnMode` type: `'multi-model' | 'wardrobe'`
- `WardrobeSet` interface: id + items array (reuse `VirtualTryOnClothingItem`)
- `WardrobeResultSet` interface for grouped results display

## Related Code Files

- Modify: `src/types.ts`
- Read for context: existing `VirtualTryOnBatchItem`, `VirtualTryOnClothingItem` (line 126), `BatchImageStatus`

## Implementation Steps

1. Add `VirtualTryOnMode` type alias after existing try-on types (~line 133)
2. Add `WardrobeSet` interface:
   ```typescript
   interface WardrobeSet {
     id: string;
     items: VirtualTryOnClothingItem[];
   }
   ```
3. Add `WardrobeResultSet` interface:
   ```typescript
   interface WardrobeResultSet {
     setId: string;
     status: BatchImageStatus;
     results: ImageFile[];
     error?: string;
   }
   ```
4. Export all new types

## Todo

- [x] Add `VirtualTryOnMode` type
- [x] Add `WardrobeSet` interface
- [x] Add `WardrobeResultSet` interface
- [x] Verify `npx tsc --noEmit` passes

## Success Criteria

- Types compile without errors
- No breaking changes to existing code
- Types are sufficient for Phase 2 hook implementation

## Risk Assessment

- Low risk — additive types only, no modifications to existing interfaces
