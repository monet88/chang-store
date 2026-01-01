# Code Review: Test Files

**Date:** 2025-12-24
**Reviewer:** code-reviewer (abe8050)
**Files:** `__tests__/__mocks__/contexts.tsx`, `__tests__/services/imageEditingService.test.ts`

## Summary

Two test files reviewed for code quality. Overall quality is good with one critical coverage gap.

## Critical Issues

### 1. Missing Test Coverage: `recreateImageWithFace`

**File:** `imageEditingService.test.ts`
**Severity:** Critical

`recreateImageWithFace` function in `services/imageEditingService.ts` (lines 118-169) has NO test coverage. This function:
- Has complex aspect ratio calculation logic
- Calls `getImageDimensions` utility
- Routes to both backends
- Contains error handling for failed recreation

**Impact:** Untested business logic with edge cases in ratio calculation.

## Medium Issues

### 2. Unused Import

**File:** `imageEditingService.test.ts`, line 15
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```
`afterEach` imported but never used. Minor code smell.

### 3. Type Drift Risk

**File:** `__tests__/__mocks__/contexts.tsx`
Context interfaces defined locally (lines 28-69) instead of importing from actual context files. Types could drift out of sync.

**Mitigation:** Consider importing types from source contexts.

## Low Priority

### 4. Unused Parameter in Mock

**File:** `contexts.tsx`, line 168
```typescript
getModelsForFeature: vi.fn((feature: Feature) => ({
```
`feature` parameter declared but unused. Acceptable for mock but slightly violates YAGNI.

## Positive Observations

- Clean factory pattern in context mocks with override support
- Comprehensive JSDoc documentation with examples
- Proper AAA (Arrange-Act-Assert) test structure
- Good error propagation testing (safety blocks, auth errors)
- Correct mock setup order (mocks before imports)
- Tests both Gemini and AIVideoAuto routing paths
- Tests edge cases: missing tokens, invalid model IDs, multiple images

## Metrics

| Metric | Value |
|--------|-------|
| Functions tested | 6/7 (86%) |
| Missing coverage | `recreateImageWithFace` |
| Security issues | 0 |
| Performance issues | 0 |
| Architecture violations | 0 |

## Recommended Actions

1. **[Critical]** Add test suite for `recreateImageWithFace`:
   - Test Gemini routing
   - Test AIVideoAuto routing
   - Test aspect ratio auto-detection logic
   - Test explicit aspect ratio override
   - Test error when result is undefined

2. **[Low]** Remove unused `afterEach` import

## Unresolved Questions

None.
