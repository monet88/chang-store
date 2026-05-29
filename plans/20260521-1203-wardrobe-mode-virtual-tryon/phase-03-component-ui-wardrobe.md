# Phase 3: Component UI — Mode Toggle & Wardrobe Cards

<!-- Updated: Validation Session 1 - WardrobeSetCard mandatory extraction, state preserved on switch, single-person only in wardrobe -->

## Context

- Plan: `plans/20260521-1203-wardrobe-mode-virtual-tryon/plan.md`
- File: `src/components/VirtualTryOn.tsx` (543 LOC)
- Depends on: Phase 2 (hook exports)

## Overview

- Priority: High
- Status: completed
- Add mode toggle UI and wardrobe set cards to VirtualTryOn component

## Key Insights

- Component is thin UI wrapper — all logic lives in hook
- Existing component already handles batch results display (grid with labels)
- Wardrobe results display is structurally similar to multi-model batch results
- Component at 543 LOC → extract `WardrobeSetCard` to keep under 700 LOC

## Requirements

### Functional
- Segmented control / radio toggle at top: "Multi-Model" | "Tủ Đồ"
- Generate buttons disabled when `isAnyGenerating` is true (cross-mode lock)
- Wardrobe mode UI:
  - Single image uploader for model photo
  - Collapsible set cards (Set 1, Set 2...) each with item uploaders
  - Each item has sourceItemType selector (reuse existing pattern)
  - "Add Set" button (disabled at 4)
  - "Remove Set" button per card
- Wardrobe-specific extra prompt + background prompt inputs (from `wardrobe.extraPrompt`, `wardrobe.backgroundPrompt`)
- "Generate All" button (disabled when `isAnyGenerating`)
- Results: grid grouped by set number with labels + error messages per set

### Non-functional
- Responsive layout matching existing design patterns
- Tailwind-only styling
- Smooth transition between modes (no data loss within same session)
- Component destructures `{ mode, setMode, isAnyGenerating, wardrobe }` from hook (namespaced)

## Architecture

```
VirtualTryOn.tsx
├── Mode toggle (segmented control)
├── [multi-model] existing UI (unchanged)
└── [wardrobe] new UI:
    ├── Single model uploader (ImageUploader)
    ├── WardrobeSetCard × N (extracted component)
    │   ├── Header: "Set {n}" + delete button
    │   └── Item slots (MultiImageUploader or individual uploaders)
    ├── "Add Set" button
    ├── Shared prompts (extraPrompt + backgroundPrompt)
    ├── "Generate All" button
    └── Results grid (grouped by set)
```

## Related Code Files

- Modify: `src/components/VirtualTryOn.tsx`
- Create: `src/components/WardrobeSetCard.tsx` (extracted component)
- Read: `src/components/ImageUploader.tsx` (reuse pattern)
- Read: `src/components/MultiImageUploader.tsx` (reuse for items)

## Implementation Steps

1. Add mode toggle UI at top of component (before subject/clothing sections)
2. Wrap existing multi-model UI in conditional `{mode === 'multi-model' && (...)}`
3. Create wardrobe mode section `{mode === 'wardrobe' && (...)}`:
   - Single ImageUploader for `wardrobe.subject`
   - Map over `wardrobe.sets` → render WardrobeSetCard for each
   - "Add Set" button with max 4 guard
   - Wardrobe-specific prompt inputs (`wardrobe.extraPrompt`, `wardrobe.backgroundPrompt`)
   - Generate button calling `wardrobe.generate()` (disabled when `isAnyGenerating`)
4. Extract `WardrobeSetCard` component:
   - Props: set data, onAddItem, onRemoveItem, onRemoveSet, sourceItemTypes
   - Header with set number + delete icon
   - Item grid with upload slots + type selectors
5. Add wardrobe results section:
   - Group results by set
   - Each group: label "Set {n}" + image grid
   - Download all button
6. Wire up loading states and progress indicators

## Todo

- [x] Add mode toggle segmented control
- [x] Conditionally render multi-model vs wardrobe UI
- [x] Implement wardrobe model uploader section
- [x] Create `WardrobeSetCard` component
- [x] Implement set management UI (add/remove sets)
- [x] Wire shared prompts to wardrobe generate
- [x] Implement wardrobe results grid (grouped by set)
- [x] Add loading/progress states for wardrobe generation
- [x] Verify component stays under 700 LOC (with extraction)
- [x] Visual QA in browser

## Success Criteria

- Mode toggle switches cleanly between Multi-Model and Wardrobe
- Wardrobe UI allows creating up to 4 sets with up to 4 items each
- Generate produces results grouped by set
- Existing Multi-Model UI completely unchanged
- Responsive on mobile (320px+)
- VirtualTryOn.tsx stays under 700 LOC after extraction

## Risk Assessment

- Medium risk — largest UI change, but well-contained by mode toggle
- Mitigation: extract WardrobeSetCard early to control file size
- Mitigation: reuse existing ImageUploader/MultiImageUploader patterns
