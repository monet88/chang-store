# Brainstorm: Wardrobe Mode for Virtual Try-On

**Date:** 2026-05-21
**Status:** Approved → Plan

## Problem Statement

Virtual Try-On currently supports "Multi-Model" mode: N subjects × 1 shared outfit → N images. User wants the inverse: 1 model × N outfit sets → N images showing the same model wearing different complete outfits.

## Requirements

- Mode toggle at top: "Multi-Model" (existing) vs "Tủ Đồ / Wardrobe" (new)
- Wardrobe mode: 1 model photo + up to 4 outfit sets
- Each set: up to 4 items (reuse existing sourceItemType system)
- Sets auto-numbered: Set 1, Set 2, Set 3, Set 4
- Shared extra prompt + background prompt across all sets
- Results: grid grouped by set number
- Reuse existing prompt builder + service layer (no changes needed)

## Design Decision

**Batch axis inversion:**
- Multi-Model: `N subjects × 1 outfit[] → N jobs`
- Wardrobe: `1 subject × N outfit_sets[] → N jobs`

Each job still calls `buildVirtualTryOnParts()` with same signature: 1 subject + 1 sourceItems[].

## Data Model

```typescript
type VirtualTryOnMode = 'multi-model' | 'wardrobe';

interface WardrobeSet {
  id: string;
  items: ClothingItemState[]; // max 4
}
```

## Touchpoints

| File | Change |
|------|--------|
| `src/types.ts` | Add `VirtualTryOnMode`, `WardrobeSet` |
| `src/hooks/useVirtualTryOn.ts` | Add wardrobe state + generate logic |
| `src/components/VirtualTryOn.tsx` | Mode toggle + wardrobe UI |
| `src/locales/en.ts` | Add wardrobe keys |
| `src/locales/vi.ts` | Add wardrobe translations |
| `src/utils/virtual-try-on-prompt-builder.ts` | No change |
| `src/services/imageEditingService.ts` | No change |

## Risks

- VirtualTryOn.tsx (543 LOC) may grow to ~650-700 → extract WardrobeSetCard component
- useVirtualTryOn.ts (527 LOC) → extract wardrobe logic to sub-hook or helper

## Constraints

- Max 4 sets × 4 items = max 4 concurrent API calls
- Reuse `runBoundedWorkers()` for concurrency control
- No changes to prompt builder or service layer
