---
phase: 01-add-batch-multi-image-parallel-processing-to-virtual-try-on-and-clothing-transfer
plan: 01
status: completed
completed_at: 2026-03-22T12:05:00+07:00
requirements-completed: [VTO-BATCH-01, VTO-BATCH-02, CTR-BATCH-01, CTR-BATCH-02, UX-BATCH-01]
---

# Plan 01-01 Summary: Batch Multi-Image Parallel Processing for Virtual Try-On and Clothing Transfer

## What was built

Added bounded-parallel batch processing to both Virtual Try-On and Clothing Transfer so users can upload multiple subject/concept images, reuse one shared outfit/reference set, and review per-item progress and outputs inside each feature screen.

## Files created/modified

| File | Action | Purpose |
|------|--------|---------|
| `types.ts` | Modified | Added shared batch item contracts for Virtual Try-On and Clothing Transfer |
| `hooks/useVirtualTryOn.ts` | Rewritten | Batch session source of truth, bounded worker pool, per-item results/errors |
| `components/VirtualTryOn.tsx` | Rewritten | Multi-subject intake, batch rail, per-subject result panel |
| `hooks/useClothingTransfer.ts` | Rewritten | Multi-concept orchestration, concept-first request assembly, per-item states |
| `components/ClothingTransfer.tsx` | Rewritten | Multi-concept intake, batch rail, per-concept result panel |
| `components/shared/ImageBatchSessionRail.tsx` | Created | Shared thumbnail rail for batch item selection and status badges |
| `utils/batch-image-session.ts` | Created | Session remapping helper to preserve existing items when uploader arrays change |
| `utils/run-bounded-workers.ts` | Created | Shared bounded-concurrency helper for hook-level batch execution |
| `utils/virtual-try-on-prompt-builder.ts` | Created | Extracted Virtual Try-On prompt construction from component logic |
| `utils/clothing-transfer-prompt-builder.ts` | Created | Extracted Clothing Transfer interleaved-parts builder from hook logic |
| `locales/en.ts` | Modified | Added batch upload, progress, and per-item status strings |
| `locales/vi.ts` | Modified | Added Vietnamese batch upload, progress, and per-item status strings |
| `__tests__/hooks/useVirtualTryOn.test.tsx` | Rewritten | Covers multi-subject batching, shared outfits, partial failures, upscale |
| `__tests__/hooks/useClothingTransfer.test.tsx` | Rewritten | Covers multi-concept batching, concept-first ordering, partial failures, upscale |
| `__tests__/components/VirtualTryOn.test.tsx` | Created | Locks multi-uploader and batch result rendering |
| `__tests__/components/ClothingTransfer.test.tsx` | Created | Locks multi-uploader and batch result rendering |

## Requirements covered

- **VTO-BATCH-01**: Virtual Try-On accepts multiple subject images with one shared outfit set
- **VTO-BATCH-02**: One request is issued per subject image with no outfit cross-product expansion
- **CTR-BATCH-01**: Clothing Transfer accepts multiple concept images with one shared reference set
- **CTR-BATCH-02**: Every Clothing Transfer request preserves `images: [concept, ...references]`
- **UX-BATCH-01**: Users can track per-item status, partial failures, and completed outputs in-place

## Verification results

- [x] `npm run test -- useVirtualTryOn useClothingTransfer VirtualTryOn ClothingTransfer` → **12 passed**
- [x] `npm run lint` → passed
- [x] `npm run build` → passed
- [x] `npm run test` → **454 passed** across 22 files

## Architecture decisions

1. **Hook-owned batch orchestration** — batching stays in feature hooks, preserving `Component → Hook → Service`.
2. **Shared input sets capped at 2 images** — UI and state enforce the product requirement instead of allowing unsupported extra references.
3. **Batch item rails instead of flat output dumps** — users inspect one subject/concept item at a time while still seeing overall batch progress.
4. **Worker-pool fan-out, not unbounded `Promise.all`** — keeps requests parallel but bounded.
5. **Single-image path preserved without fake batch refinement** — branch state had no active VTO refinement UI, so the feature keeps the old single-image path clean rather than inventing a partial refinement model.
