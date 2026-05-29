# Phase 5: Tests

<!-- Updated: Validation Session 1 - Test useWardrobeMode.ts sub-hook, not inline in useVirtualTryOn -->

## Context

- Plan: `plans/20260521-1203-wardrobe-mode-virtual-tryon/plan.md`
- Files: `__tests__/hooks/useWardrobeMode.test.tsx` (new), `__tests__/components/VirtualTryOn.test.tsx`
- Depends on: All previous phases

## Overview

- Priority: Medium
- Status: completed
- Add tests for wardrobe sub-hook and wardrobe UI in component

## Requirements

### Sub-Hook Tests (`__tests__/hooks/useWardrobeMode.test.tsx`) — NEW FILE
- Initial state: 1 empty set, no subject, no results
- CRUD: add set (max 4 guard), remove set (min 1 guard), add/remove/update items
- Max 4 items per set guard
- generateWardrobe() validates subject + non-empty sets
- generateWardrobe() creates correct number of jobs (1 per valid set)
- Results stored per-set with correct status transitions
- downloadWardrobeResults() collects all images
- Multi-person always false

### Component Tests (`__tests__/components/VirtualTryOn.test.tsx`) — EXTEND
- Mode toggle renders and switches UI
- Wardrobe mode shows single model uploader (not multi-subject)
- Set cards render with correct numbering
- Add/remove set buttons work
- Generate button disabled when no subject or empty sets
- Results grouped by set in output
- Existing multi-model tests still pass (regression)

## Implementation Steps

1. Add wardrobe hook test suite (new `describe('wardrobe mode', ...)` block)
2. Add wardrobe component test suite
3. Run full test suite: `npm run test`
4. Verify no regressions in existing tests

## Todo

- [x] Hook: mode toggle test
- [x] Hook: wardrobe CRUD tests
- [x] Hook: generate validation tests
- [x] Hook: results grouping tests
- [x] Component: mode toggle render test
- [x] Component: wardrobe UI interaction tests
- [x] Component: generate button state tests
- [x] Regression: all existing tests pass
- [x] Coverage check

## Success Criteria

- All new tests pass
- All existing tests pass (zero regressions)
- Wardrobe logic has >80% branch coverage

## Risk Assessment

- Low risk — tests are additive, existing test patterns well-established
