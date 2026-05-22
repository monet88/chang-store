---
phase: 4
title: "Fix Google Drive Sync Queue Race"
status: completed
priority: P1
effort: "3-5h"
dependencies: [1]
---

# Phase 4: Fix Google Drive Sync Queue Race

## Context Links

- Source report: `vbsec-reports/scan-2026-05-22-113905.md`
- Related files: `src/hooks/useGoogleDriveSync.ts`, `src/contexts/ImageGalleryContext.tsx`
- Finding: medium #8

## Overview

Ensure queued Google Drive uploads are not silently lost when upload requests happen before `folderId` is ready. Queue processing must resume automatically once the Drive folder becomes available.

## Key Insights

- The sync hook has queue-based upload/delete logic with retry state and processing refs.
- The reported race is a readiness bug: work can enter the queue while Drive folder initialization is incomplete, then return early without a later drain.
- The fix should be minimal and centered in the hook, not in UI components.

## Requirements

- Functional: queue upload/delete operations remain pending until prerequisites are ready.
- Functional: when `folderId` transitions from null to non-null, pending upload queue drains automatically.
- Non-functional: no duplicate uploads, no infinite queue loop, no silent queue loss.
- Out of scope: preserving an in-memory queue across full page reloads unless existing persistence already supports it.

## Architecture

Keep Google Drive sync ownership in `src/hooks/useGoogleDriveSync.ts`. Add a readiness-driven effect or guarded queue processor that reacts to `folderId`, authentication state, and queue length. `ImageGalleryContext.tsx` should keep calling the hook API; avoid duplicating sync control logic there unless the context currently drops events before queueing.

## Related Code Files

- Modify: `src/hooks/useGoogleDriveSync.ts`
- Modify if needed: `src/contexts/ImageGalleryContext.tsx`
- Modify or create tests under `__tests__/hooks/` or matching project test structure.

## Implementation Steps

1. Run GitNexus impact analysis for `useGoogleDriveSync`, `queueUpload`, `queueDelete`, and context call sites.
2. Identify exact early-return path when `folderId` is missing.
3. Preserve queued operations when prerequisites are not ready.
4. Add an effect that triggers queue processing when `folderId` becomes available and the queue has items.
5. Ensure `isProcessingRef` still prevents concurrent processing.
6. Add tests for: upload before folder ready, folder becomes ready, queue drains once, retry behavior still works.
7. Run `npm run test`, `npx tsc --noEmit`, `npm run lint`, and manual Google Drive connect/upload smoke test.

## Todo List

- [ ] Map current queue state transitions.
- [ ] Fix readiness gating in sync hook.
- [ ] Adjust context only if it drops upload requests before queueing.
- [ ] Add race regression tests.
- [ ] Smoke-test Google Drive sync.

## Success Criteria

- [ ] Upload queued before `folderId` is ready is uploaded after `folderId` becomes available.
- [ ] No duplicate Drive files are created for one queued operation.
- [ ] Retry limit and error reporting still work.
- [ ] Full page reload queue persistence is explicitly documented as out of scope unless existing persistence is found.
- [ ] Tests, lint, and type-check pass.

## Risk Assessment

Risk is medium because async queue logic can regress retries or duplicate uploads. Mitigate with focused regression tests and by keeping state transitions simple.

## Security Considerations

This finding is data integrity rather than classic security. Silent sync loss can affect user trust and auditability, so failures should be visible via existing sync error state.

## Next Steps

Proceed to Phase 6 verification after queue regression tests pass.
