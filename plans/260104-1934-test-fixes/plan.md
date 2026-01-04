---
title: "Fix Test Suite Failures"
description: "Remediate 65 test failures (37 original + 28 discovered) to achieve 100% pass rate"
status: completed
priority: P2
effort: 2h (actual: 1.5h)
branch: main
tags: [tests, maintenance, debt]
created: 2026-01-04
completed: 2026-01-04 20:33
---

**Final Status:** ✅ 447/447 tests passing (100%)
**Review Report:** `plans/reports/code-reviewer-260104-2031-test-fixes-validation.md`

# Implementation Plan: Fix Test Suite Failures

## Executive Summary

**Actual Failures (verified 2026-01-04 19:36):**
| Test File | Failures | Root Cause | Fix Effort |
|-----------|----------|------------|------------|
| `imageEditingService.test.ts` | 30 | Signature changes | 45min |
| `LanguageContext.test.tsx` | 14 | Default language `vi` not `en` | 15min |
| `useLookbookGenerator.test.tsx` | 1 | localStorage disabled by design | 5min |
| **Total** | **45** | | **~1h** |

**NOT Failing (corrected from tester report):**
- `aivideoautoService.test.ts` - ALL 31 tests PASS
- `storage.test.ts` - FILE DOESN'T EXIST (phantom)

---

## Phase 1: Quick Wins (45 minutes)

### 1.1 Fix imageEditingService.test.ts (30 failures)

**Root Cause:** Two signature changes in implementation not reflected in tests.

#### Change A: `editImage()` now adds `model` to params

```typescript
// services/imageEditingService.ts:55
return geminiImageService.editImage({ ...params, model });
//                                   ^^^^^^^^^^^^^^^^^
// Test expects: geminiImageService.editImage(params)
// Actual:       geminiImageService.editImage({ ...params, model })
```

**Fix Pattern:**
```typescript
// BEFORE (line 137):
expect(geminiImageService.editImage).toHaveBeenCalledWith(params);

// AFTER:
expect(geminiImageService.editImage).toHaveBeenCalledWith({
  ...params,
  model: 'gemini-2.5-flash-image'
});
```

**Affected Lines (estimate):**
- Line 137 (editImage Gemini routing)
- Lines 150+ (error propagation tests)
- All tests calling `geminiImageService.editImage`

#### Change B: `critiqueAndRedesignOutfit()` now has `resolution` param

```typescript
// services/imageEditingService.ts:124
return geminiImageService.critiqueAndRedesignOutfit(
  image, preset, numberOfImages, model, aspectRatio, resolution
);
//                                                   ^^^^^^^^^^
```

**Fix Pattern:**
```typescript
// BEFORE (line 501-507):
expect(geminiImageService.critiqueAndRedesignOutfit).toHaveBeenCalledWith(
  TEST_IMAGE, 'casual', 1, 'gemini-2.5-flash-image', 'Default'
);

// AFTER:
expect(geminiImageService.critiqueAndRedesignOutfit).toHaveBeenCalledWith(
  TEST_IMAGE, 'casual', 1, 'gemini-2.5-flash-image', 'Default', undefined
);
```

**Implementation Steps:**
1. Search for all `geminiImageService.editImage` assertions
2. Update to expect `{ ...params, model }` pattern
3. Search for `critiqueAndRedesignOutfit` assertions
4. Add `undefined` (or actual value) for resolution parameter

**Estimated Time:** 45 minutes

---

### 1.2 Fix LanguageContext.test.tsx (14 failures)

**Root Cause:** Default language changed from `'en'` to `'vi'`.

```typescript
// contexts/LanguageContext.tsx:28
const [language, setLanguage] = useState<Language>('vi');  // Was 'en'
```

**Two Fix Options:**

#### Option A: Update test expectations (FASTER - 5 min)
Change tests to expect `'vi'` as default:

```typescript
// BEFORE (line 38):
expect(result.current.language).toBe('en');

// AFTER:
expect(result.current.language).toBe('vi');
```

Update all hardcoded English strings to Vietnamese equivalents.

#### Option B: Set language to 'en' in test setup (RECOMMENDED - 15 min)
Explicitly set language in beforeEach or wrapper:

```typescript
// In test wrapper or beforeEach:
act(() => {
  result.current.setLanguage('en');
});

// Or update wrapper to provide explicit 'en' context
const wrapper = ({ children }: { children: ReactNode }) => (
  <TestLanguageProvider defaultLanguage="en">
    {children}
  </TestLanguageProvider>
);
```

**Affected Lines:**
- Line 38 (initial language check)
- Line 51 (header.title)
- Lines 56+ (translation assertions)
- Line 165 (camera options)
- Line 188, 197 (edge cases)
- Line 206, 237 (setLanguage, translations)

**Recommendation:** Option B - explicit test setup is more robust.

**Estimated Time:** 15 minutes

---

### 1.3 Fix useLookbookGenerator.test.tsx (1 failure)

**Root Cause:** localStorage persistence disabled by design.

```typescript
// utils/storage.ts - stubbed/disabled
// CLAUDE.md:92 - "Local storage persistence is disabled"
```

**Fix:** Delete or update the test at lines 223-237.

```typescript
// Option A: DELETE test entirely

// Option B: Update to verify NO localStorage calls
it('should NOT persist form changes to localStorage (disabled by design)', async () => {
  const { result } = renderHook(() => useLookbookGenerator());

  act(() => {
    result.current.updateForm({ clothingDescription: 'New desc' });
  });

  // Verify localStorage is NOT called (feature disabled)
  expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
});
```

**Estimated Time:** 5 minutes

---

## Phase 2: Verification (15 minutes)

### 2.1 Run Individual Test Files

```bash
# After fixes, verify each file passes:
npm test -- __tests__/services/imageEditingService.test.ts
npm test -- __tests__/contexts/LanguageContext.test.tsx
npm test -- __tests__/hooks/useLookbookGenerator.test.tsx
```

### 2.2 Run Full Test Suite

```bash
npm test
```

**Expected Outcome:**
- 447 tests total
- 447 passing (100%)
- 0 failing

---

## Phase 3: Documentation (5 minutes)

### 3.1 Update Test Comments

Add comments explaining:
1. Why `model` is included in editImage params
2. Why resolution is optional in critiqueAndRedesignOutfit
3. Why localStorage tests are disabled

### 3.2 Create Regression Guard

Add to CLAUDE.md or test README:

```markdown
## Test Maintenance Notes

- **Default language:** `'vi'` (Vietnamese). Tests should explicitly set 'en' if needed.
- **localStorage:** Disabled by design. Do not add localStorage persistence tests.
- **Service signatures:** When changing service params, update test mocks accordingly.
```

---

## Rollback Strategy

If fixes break other tests:

1. **Git stash/revert:** `git stash` or `git checkout -- <file>`
2. **Incremental approach:** Apply fixes one test file at a time
3. **Preserve originals:** Before editing, copy test files:
   ```bash
   cp __tests__/services/imageEditingService.test.ts __tests__/services/imageEditingService.test.ts.bak
   ```

---

## File Change Summary

| File | Action | Changes |
|------|--------|---------|
| `__tests__/services/imageEditingService.test.ts` | EDIT | Update ~30 mock call assertions |
| `__tests__/contexts/LanguageContext.test.tsx` | EDIT | Add explicit language setup OR update expectations |
| `__tests__/hooks/useLookbookGenerator.test.tsx` | EDIT | Delete/update localStorage test (lines 223-237) |

---

## Time Estimates

| Phase | Task | Time |
|-------|------|------|
| 1.1 | Fix imageEditingService (30) | 45 min |
| 1.2 | Fix LanguageContext (14) | 15 min |
| 1.3 | Fix useLookbookGenerator (1) | 5 min |
| 2 | Verification | 15 min |
| 3 | Documentation | 5 min |
| | **Total** | **~1h 25min** |

---

## Success Criteria

- [ ] All 45 failing tests pass
- [ ] No new test failures introduced
- [ ] Full test suite: 447 pass, 0 fail
- [ ] Coverage thresholds met (80% statements)

---

## Unresolved Questions

1. **Should default language revert to 'en'?**
   - Current: `'vi'` (Vietnamese)
   - Tests assume `'en'`
   - Decision: Keep `'vi'` as default (user preference) or revert?

2. **Why was `model` added to editImage params?**
   - Implementation at line 55: `{ ...params, model }`
   - Intent unclear - intentional feature or refactoring artifact?

3. **Should localStorage be re-enabled for drafts?**
   - Currently stubbed/disabled
   - Tests exist expecting it to work
   - Product decision needed before removing tests entirely

---

## Related Reports

- `plans/reports/tester-260104-1927-test-failure-analysis.md`
- `plans/reports/debugger-260104-1931-test-failures-diagnostic.md`

---

**Plan Author:** planner subagent
**Created:** 2026-01-04 19:34
