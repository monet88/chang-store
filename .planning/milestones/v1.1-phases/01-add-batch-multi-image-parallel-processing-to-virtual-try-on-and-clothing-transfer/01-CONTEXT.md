# Phase 1: Add Batch Multi-Image Parallel Processing To Virtual Try-On And Clothing Transfer - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 adds batch processing to two existing fashion-edit features without changing the app architecture.

- Virtual Try-On: user uploads many subject images plus one shared outfit set of 1-2 clothing images. The app runs one try-on request per subject image in parallel and shows per-subject progress + results.
- Clothing Transfer: user uploads many concept images plus one shared reference outfit set of 1-2 outfit images. The app runs one transfer request per concept image in parallel and shows per-concept progress + results.

Out of scope for this phase:
- outfit/reference cross-product generation
- backend queue or persistence
- user-configurable concurrency settings
- ZIP export, retry queue management, or batch refinement workflows
- changing provider-routing architecture

</domain>

<decisions>
## Implementation Decisions

### Batch semantics
- Batch dimension is only the uploaded subject/concept list.
- Outfit/reference inputs remain a shared set applied to every batch item in the same run.
- Keep existing `numberOfImages` behavior per request. Each batch item can still return 1-N generated variants based on the current slider.
- Use internal bounded parallelism in the hook layer instead of firing an unbounded `Promise.all` against every uploaded source image at once.
- Failed items should not fail the whole run. Track status per batch item: pending, processing, completed, error.

### UI shape
- Reuse `components/MultiImageUploader.tsx` for subject image batch input and concept image batch input.
- Keep existing single-slot clothing/reference uploaders because 1-2 outfit images already match current feature semantics.
- Replace the single-result right panel with a batch-results panel showing original source image, status, error, and generated outputs per batch item.
- Show a compact progress summary so users can see batch completion without leaving the feature screen.

### Architecture and modularization
- `components/VirtualTryOn.tsx` should stop owning business logic. Make `hooks/useVirtualTryOn.ts` the real source of truth and keep the component thin.
- `hooks/useClothingTransfer.ts` stays the source of truth for Clothing Transfer, but evolves from one concept image to many concept images.
- Keep batching orchestration in hooks. Do not move it into services or context.
- Reuse the worker-pool pattern from `hooks/useWatermarkRemover.ts` and the multi-image session pattern from `hooks/useUpscale.ts`.
- If edited feature files would stay above ~200 LOC, extract feature-local presentational pieces instead of stuffing more UI into the main component files.

### Compatibility and risk control
- Preserve current single-item quality path. If user uploads exactly one subject or one concept image, the feature should still feel like the old flow.
- Preserve Virtual Try-On refinement only for the single-subject path. Do not invent a new multi-item refinement model in this phase.
- Preserve per-result upscale actions where they already exist.
- Keep current provider routing as-is. Batch orchestration should repeat existing request construction rather than redefining provider contracts.

### Agent's Discretion
- Exact batch card layout, as long as status + source + outputs stay readable on desktop and mobile.
- Exact fixed concurrency value, as long as it is bounded and truly parallel.
- Exact wording for partial-failure summaries and single-item refinement hints.

</decisions>

<code_context>
## Existing Code Insights

### Reusable assets
- `components/MultiImageUploader.tsx`: already handles multi-file intake, compression, preview grid, and removal.
- `hooks/useWatermarkRemover.ts`: already shows a practical worker-pool pattern with bounded concurrency and per-item statuses.
- `hooks/useUpscale.ts`: already shows a good multi-image session model and item identity pattern.
- `services/imageEditingService.ts` and `services/gemini/image.ts`: already support parallel multi-output generation inside one request via `Promise.all`.
- `utils/virtual-try-on-prompt-builder.ts`: already centralizes Virtual Try-On prompt building for Gemini vs local/anti request assembly.

### Current friction points
- `components/VirtualTryOn.tsx` is stateful, large, and diverges from repo architecture.
- `hooks/useVirtualTryOn.ts` is stale and does not match the real Virtual Try-On implementation.
- `components/ClothingTransfer.tsx` already uses a hook, but only supports one concept image.
- Existing tests assume single subject / single concept flows and will need targeted rewrites, not just additive assertions.

### Integration points
- `types.ts`: good place for shared batch item types if they cross hook/component boundaries.
- `locales/en.ts` and `locales/vi.ts`: must receive all new batch strings.
- `__tests__/hooks/useVirtualTryOn.test.tsx` and `__tests__/hooks/useClothingTransfer.test.tsx`: primary regression coverage for batch state and request assembly.
- `__tests__/components/VirtualTryOn.test.tsx` and `__tests__/components/ClothingTransfer.test.tsx`: primary UI coverage for new upload/results layout.

</code_context>

<specifics>
## Specific Ideas

- A batch item should carry: `id`, `source`, `status`, `results`, `error`, and lightweight timestamps or counters if needed.
- Virtual Try-On should add a derived `canRefineSingleResult` gate rather than attempting cross-item chat sessions.
- Clothing Transfer should keep the concept-first image ordering contract for every per-item request.
- Batch results should favor progressive completion: show completed cards immediately while other cards are still processing.

</specifics>

<deferred>
## Deferred Ideas

- Retry failed items individually
- Download all results as ZIP
- Batch refinement across multiple completed items
- User-facing concurrency slider
- Cross-product generation between multiple outfit/reference sets

</deferred>

---

*Phase: 01-add-batch-multi-image-parallel-processing-to-virtual-try-on-and-clothing-transfer*
*Context gathered: 2026-03-22*