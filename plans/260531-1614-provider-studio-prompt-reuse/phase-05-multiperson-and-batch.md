---
phase: 5
title: "Multi-Person Targeting and Batch Subjects"
status: pending
priority: P2
effort: "6h"
dependencies: [4]
---

# Phase 5: Multi-Person Targeting and Batch Subjects

## Overview

Add Gemini's two batch/targeting capabilities to provider Try-On: **multi-person targeting**
(paint a red-dot marker on the chosen person before sending) and **batch subjects** (run the
same outfit across multiple subject images with bounded concurrency). Both are client-side
orchestration and provider-agnostic.

## Requirements

- Functional: Multi-person mode lets the user click a subject to place a marker; the composited
  image (marker burned in) is sent, and the builder's multi-person prohibition text is enabled.
- Functional: Batch mode accepts N subject images, runs each as its own provider request via
  bounded workers, and shows per-subject status + results.
- Non-functional: Reuse `compositeMarkerOnImage` and `runBoundedWorkers` directly. Provider
  services unchanged. Respect provider reference-image caps per request.

## Architecture

- Multi-person: reuse `compositeMarkerOnImage(image, markerPosition)`; set the adapter's
  `isMultiPersonMode` flag so `buildVirtualTryOnParts` emits the red-dot targeting block.
  UI marker placement mirrors the Gemini Try-On marker interaction.
- Batch: model subject state as a list (like `useVirtualTryOn`'s `subjectItems`); run
  `runBoundedWorkers(jobs, concurrency, runOne)` where `runOne` is the Phase 4 refactored
  per-call function. Per-job status: pending/processing/completed/error.
- Concurrency = jobs.length (same as Gemini) but consider a smaller cap for provider rate limits.

## Related Code Files

- Modify: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts`
- Modify: `src/components/studios/GrokStudio.tsx`, `GptImageStudio.tsx` (marker UI, batch grid)
- Modify: `src/components/studios/provider-studio/ProviderResultsGrid.tsx` (per-subject grouping)
- Read/reuse: `src/utils/imageUtils.ts` (`compositeMarkerOnImage`),
  `src/utils/run-bounded-workers.ts`, `src/hooks/useVirtualTryOn.ts` (batch + marker patterns),
  `src/types.ts` (`MarkerPosition`, `VirtualTryOnBatchItem`)

## Implementation Steps

1. Add multi-person state (`isMultiPersonMode`, `markerPosition`) to the hooks; composite the
   marker before the provider call; pass `isMultiPersonMode` to the adapter.
2. Add marker placement UI to the subject image (reuse the Gemini marker component if shareable).
3. Convert subject state to a batch list; refactor generate to enqueue one job per subject via
   `runBoundedWorkers(runOne)` (from Phase 4).
4. Update results UI to group by subject with per-subject status.
5. Clamp concurrency / reference images to provider limits; surface a note if clamped.
6. i18n (EN + VI); `npx tsc --noEmit`, `npm run lint`.

## Success Criteria

- [ ] Multi-person: marker placed → only the marked person is edited (builder block active).
- [ ] Batch: multiple subjects each produce results with independent status.
- [ ] Concurrency/reference caps respected; no provider 4xx from over-limit requests.
- [ ] New tests cover marker compositing call + bounded-worker job fan-out (service mocked).
- [ ] `npx tsc --noEmit`, `npm run lint` clean.

## Risk Assessment

- **Highest effort / most UI** of the parity phases. Mitigation: reuse Gemini marker + batch
  components/utilities rather than reimplementing.
- **Rate limits under batch**: bursts of provider calls may 429. Mitigation: bounded concurrency
  + existing `withRetry`; consider a conservative default cap.
- **Marker component reuse**: if the Gemini marker UI is tightly coupled to its hook, extract a
  presentational sub-component rather than duplicating logic.
