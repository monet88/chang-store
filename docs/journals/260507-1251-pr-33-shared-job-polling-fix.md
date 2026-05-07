---
title: PR #33 shared job polling review fix
date: 2026-05-07 12:51
severity: High
component: hooks/useJobPoll
status: Resolved
---

## Context
PR #33 review surfaced concurrency regressions in shared job polling where cancellation and failure paths could hide active jobs and drop error visibility for non-owner callers.

## What happened
`waitForJobCompletion` treated caller-owned `activeJobIds.size` as the source of truth during error/cancel branches. That diverged from global `activeSharedJobIds` under concurrent polling, so `scopeNonOwnerUpdate` could suppress non-owner errors while another job was still active. The practical failure mode: one polling path failed or canceled, and another caller stopped seeing an error it needed to handle.

## Decision
We fixed the flow by making polling shutdown owner-based false on error/cancel, explicitly cleaning up `activeJobIds` on cancel, and preserving non-empty non-owner errors instead of dropping them. Rejected alternative: broad reset of all shared polling state on any failure. That was simpler, but it would have broken parallel jobs and reintroduced cross-request interference.

## Verification
- Added `useJobPoll` regressions for stale active job IDs after failure.
- Added `useJobPoll` regressions for non-owner error surfacing while another job polls.
- `npm run test -- __tests__/hooks/useJobPoll.test.tsx` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- Full `npm run test` passed (52 files, 558 tests).

## Next
- Owner: hooks maintainers.
- Within next PR touching shared polling: add a focused checklist item for owner/non-owner error propagation and active ID lifecycle.
- Docs impact: none beyond this journal.

**Status:** DONE
**Summary:** Fixed PR #33 shared polling race/error handling by aligning shutdown and cleanup with shared ownership semantics, and locked behavior with regression tests.
**Concerns/Blockers:** None.
