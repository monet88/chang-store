# Testing Guide

**Last Updated:** 2026-01-04
**Test Suite Status:** 447/447 passing (100%)

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Common Test Failures](#common-test-failures)
3. [Testing Best Practices](#testing-best-practices)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Test Patterns](#test-patterns)

---

## Quick Reference

### Running Tests

```bash
# Run all tests
npm test

# Run specific file
npm test -- __tests__/contexts/ImageGalleryContext.test.tsx

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Key Testing Libraries

- **Vitest** - Test framework
- **@testing-library/react** - React component testing
- **@testing-library/react-hooks** - Hook testing (via `renderHook`)

---

## Common Test Failures

### 1. Metadata Field Mismatches

**Symptom:**
```typescript
Expected: { base64: 'data', mimeType: 'image/png' }
Received: { base64: 'data', mimeType: 'image/png', createdAt: Date, feature: 'unknown' }
```

**Cause:** Implementation adds metadata fields that tests don't expect.

**Fix:** Use `toMatchObject` instead of `toEqual`

```typescript
// ❌ BAD - Strict equality fails with metadata
expect(result.current.images[0]).toEqual(mockImage);

// ✅ GOOD - Partial match ignores metadata
expect(result.current.images[0]).toMatchObject(mockImage);
```

**Files Fixed:** `ImageGalleryContext.test.tsx` (4 assertions)

---

### 2. Singleton State Accumulation

**Symptom:**
```
Test 1: Adds 1 image → expects 1 → PASS
Test 2: Adds 1 image → expects 1 → FAIL (sees 2 total)
```

**Cause:** Module-level singletons persist across tests

```typescript
// contexts/ImageGalleryContext.tsx:75
const imageCache = new ImageLRUCache<GalleryImageFile>(); // ⚠️ Singleton
```

**Fix:** Clear singleton state in `beforeEach`

```typescript
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Clear singleton cache
  const { result } = renderHook(() => useImageGallery(), {
    wrapper: createWrapper(),
  });
  act(() => {
    result.current.clearImages();
  });
});
```

**Files Fixed:** `ImageGalleryContext.test.tsx`

---

### 3. Async Timeout Errors

**Symptom:**
```
Error: Timeout waiting for polling result
    at pollForVideo (__tests__/services/imageEditingService.test.ts:342)
```

**Cause:** Video polling tests exceed default timeout (5s)

**Fix:** Mock polling responses or increase timeout

```typescript
// ❌ BAD - Real polling causes timeout
const result = await pollForVideo(taskId, token);

// ✅ GOOD - Mock immediate response
vi.mocked(aivideoautoService.pollForVideo).mockResolvedValue({
  status: 'completed',
  output_urls: ['https://cdn.example.com/video.mp4'],
});
```

**Files Fixed:** `imageEditingService.test.ts` (30 tests)

---

### 4. localStorage Undefined Errors

**Symptom:**
```
TypeError: Cannot read property 'getItem' of undefined
    at useApi (__tests__/contexts/ApiProviderContext.test.tsx:152)
```

**Cause:** Tests run in Node environment without `window.localStorage`

**Fix:** Mock localStorage before tests

```typescript
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
});
```

**Files Fixed:** `ApiProviderContext.test.tsx`

---

### 5. Context Provider Missing

**Symptom:**
```
Error: useLanguage must be used within a LanguageProvider
    at useLanguage (contexts/LanguageContext.tsx:18)
```

**Cause:** Hook used outside provider in tests

**Fix:** Create wrapper with provider

```typescript
const createWrapper = () => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <GoogleDriveProvider>
        <ImageGalleryProvider>
          {children}
        </ImageGalleryProvider>
      </GoogleDriveProvider>
    );
  };
};

const { result } = renderHook(() => useMyHook(), {
  wrapper: createWrapper(),
});
```

**Files Fixed:** `ImageGalleryContext.test.tsx`, `ApiProviderContext.test.tsx`

---

### 6. Language-Specific Assertion Failures

**Symptom:**
```
Expected: 'Virtual Fashion Studio'
Received: 'Fashion Expert'
```

**Cause:** Tests expect English but context defaults to Vietnamese

**Fix:** Force language in wrapper

```typescript
const wrapper = ({ children }: { children: ReactNode }) => {
  const Wrapper = () => {
    const { setLanguage } = useLanguage();

    React.useEffect(() => {
      setLanguage('en'); // Force English for tests
    }, [setLanguage]);

    return <>{children}</>;
  };

  return (
    <LanguageProvider>
      <Wrapper />
    </LanguageProvider>
  );
};
```

**Files Fixed:** `LanguageContext.test.tsx` (14 tests)

---

## Testing Best Practices

### 1. Test Isolation

**Rule:** Each test must be independent and reproducible.

```typescript
// ✅ GOOD - Clean state per test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  // Clear any singletons
});
```

### 2. Mock Placement

**Rule:** Mocks must be declared BEFORE imports.

```typescript
// ✅ GOOD - Mock before import
vi.mock('../../services/apiClient', () => ({
  setGeminiApiKey: vi.fn(),
}));

import { useApi } from '@/contexts/ApiProviderContext';

// ❌ BAD - Import before mock
import { useApi } from '@/contexts/ApiProviderContext';
vi.mock('../../services/apiClient', () => ({ ... }));
```

### 3. Assertion Selection

| Matcher | Use When | Example |
|---------|----------|---------|
| `toEqual` | Exact match needed | Primitives, no metadata |
| `toMatchObject` | Partial match needed | Objects with metadata |
| `toBe` | Reference equality | Booleans, null, undefined |
| `toHaveLength` | Array/string length | `expect(arr).toHaveLength(5)` |

### 4. Console Error Suppression

When testing error paths, suppress console noise:

```typescript
it('throws error when used outside provider', () => {
  // Suppress React error boundary warnings
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => {
    renderHook(() => useMyHook());
  }).toThrow('useMyHook must be used within a Provider');

  consoleSpy.mockRestore(); // Clean up
});
```

### 5. Async Testing

Always use `act()` for state updates, `waitFor()` for async assertions:

```typescript
// ✅ GOOD - Wrapped in act
act(() => {
  result.current.addImage(mockImage);
});

// ✅ GOOD - Async wait
await waitFor(() => {
  expect(result.current.isLoading).toBe(false);
});

// ❌ BAD - No act wrapper
result.current.addImage(mockImage); // Warning: state update not wrapped
```

---

## Troubleshooting Guide

### Debugging Test Failures

#### Step 1: Read the Error Message

```
FAIL  __tests__/contexts/ImageGalleryContext.test.tsx > adds image
  Expected: 1
  Received: 3
```

**Key info:** File, test name, expected vs received

#### Step 2: Check for State Leakage

```bash
# Run single test
npm test -- __tests__/contexts/ImageGalleryContext.test.tsx -t "adds image"

# If passes alone but fails in suite → state leakage
```

**Fix:** Add `beforeEach` cleanup

#### Step 3: Verify Mock Setup

```typescript
// Check mock is called
expect(vi.mocked(myService.myMethod)).toHaveBeenCalled();

// Check call arguments
expect(vi.mocked(myService.myMethod)).toHaveBeenCalledWith(
  expectedArg1,
  expectedArg2
);
```

#### Step 4: Inspect Test Output

```typescript
// Add temporary logging
console.log('Current state:', result.current);
console.log('Mock calls:', vi.mocked(myService.myMethod).mock.calls);
```

---

### Common Error Messages

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| `Cannot read property 'X' of undefined` | Missing mock or context | Add mock/wrapper |
| `Timeout of 5000ms exceeded` | Async operation not mocked | Mock async calls |
| `Expected X but received Y` | Metadata mismatch | Use `toMatchObject` |
| `Warning: An update to X inside a test was not wrapped in act(...)` | State update outside `act()` | Wrap in `act()` |
| `useX must be used within XProvider` | Missing provider wrapper | Add wrapper |

---

## Test Patterns

### Pattern 1: Context Provider Testing

```typescript
// 1. Create wrapper
const createWrapper = () => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MyProvider>{children}</MyProvider>;
  };
};

// 2. Test hook
const { result } = renderHook(() => useMyContext(), {
  wrapper: createWrapper(),
});

// 3. Verify behavior
expect(result.current.value).toBe(expectedValue);
```

### Pattern 2: Async Service Testing

```typescript
// 1. Mock service
vi.mock('@/services/myService', () => ({
  fetchData: vi.fn(),
}));

// 2. Setup mock response
vi.mocked(myService.fetchData).mockResolvedValue({ data: 'test' });

// 3. Test and wait
await waitFor(() => {
  expect(result.current.data).toBe('test');
});
```

### Pattern 3: Error Handling Testing

```typescript
// 1. Mock error
vi.mocked(myService.fetchData).mockRejectedValue(
  new Error('Network error')
);

// 2. Test error state
await waitFor(() => {
  expect(result.current.error).toBe('Network error');
});
```

### Pattern 4: localStorage Testing

```typescript
// 1. Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 2. Verify persistence
act(() => {
  result.current.saveData('test-value');
});

expect(localStorageMock.setItem).toHaveBeenCalledWith('key', 'test-value');
```

---

## Maintenance Checklist

When adding new tests:

- [ ] Place mocks BEFORE imports
- [ ] Add `beforeEach` cleanup for shared state
- [ ] Use `toMatchObject` for objects with metadata
- [ ] Wrap state updates in `act()`
- [ ] Mock async operations to avoid timeouts
- [ ] Add JSDoc comments explaining test intent
- [ ] Verify test passes in isolation AND full suite
- [ ] Clean up console spies after error tests

When updating implementation:

- [ ] Check if tests expect specific object structure
- [ ] Update test mocks if service contracts change
- [ ] Verify no singleton state introduced
- [ ] Run full test suite before committing

---

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Recent Fixes Summary:**

| Date | Files Fixed | Tests Fixed | Key Issues |
|------|-------------|-------------|------------|
| 2026-01-04 | 5 files | 65 tests | Metadata mismatches, singleton state, async timeouts, localStorage mocking |

**Pass Rate History:**
- Before: 382/447 (85.5%)
- After: 447/447 (100%) ✅
