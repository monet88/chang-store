# Plan: Fix TypeScript Errors

**Generated:** 2026-01-15
**Total Errors:** 22

## Error Summary

| File | Errors | Root Cause |
|------|--------|------------|
| `vite.config.ts` | 1 | `fs.cachedChecks` invalid property |
| `hooks/useCanvasDrawing.ts` | 2 | Missing `React` import for namespace |
| `components/AIEditor.tsx` | 1 | `Feature.Inpainting` doesn't exist |
| `__tests__/services/imageEditingService.test.ts` | 17 | Mock `AIVideoAutoModel` missing required fields |
| `__tests__/hooks/useLookbookGenerator.test.tsx` | 1 | Type mismatch `unknown[]` vs `ImageFile[]` |

## Tasks

### Task 1: Fix vite.config.ts (LOW risk)
**File:** `vite.config.ts:12-13`
**Issue:** `fs.cachedChecks` is not a valid Vite option
**Fix:** Remove `cachedChecks` property or use valid Vite fs options

### Task 2: Fix useCanvasDrawing.ts (LOW risk)
**File:** `hooks/useCanvasDrawing.ts:58,164`
**Issue:** Using `React.MouseEvent` without importing React namespace
**Fix:** Add `import React from 'react'` or use `import type { MouseEvent } from 'react'`

### Task 3: Fix AIEditor.tsx (LOW risk)
**File:** `components/AIEditor.tsx:35`
**Issue:** `Feature.Inpainting` doesn't exist in enum
**Fix:** Use `Feature.AIEditor` or add `Inpainting` to Feature enum

### Task 4: Fix imageEditingService.test.ts (MEDIUM risk)
**File:** `__tests__/services/imageEditingService.test.ts`
**Issue:** Mock `AIVIDEOAUTO_CONFIG` missing required `AIVideoAutoModel` fields
**Fix:** Update mock to include: `server`, `price`, `startText`, `startImage`

```typescript
const AIVIDEOAUTO_CONFIG = {
  aivideoautoAccessToken: 'test-token-123',
  onStatusUpdate: vi.fn(),
  aivideoautoVideoModels: [
    { 
      id_base: 'video-model-1', 
      model: 'video-model', 
      name: 'Video Model 1',
      server: 'test-server',
      price: 0,
      startText: true,
      startImage: true,
    },
  ],
  aivideoautoImageModels: [
    { 
      id_base: 'image-model-1', 
      model: 'image-model', 
      name: 'Image Model 1',
      server: 'test-server',
      price: 0,
      startText: true,
      startImage: true,
    },
  ],
};
```

### Task 5: Fix useLookbookGenerator.test.tsx (LOW risk)
**File:** `__tests__/hooks/useLookbookGenerator.test.tsx:461`
**Issue:** Type mismatch in Promise resolve callback
**Fix:** Add proper type assertion or fix the mock return type

## Execution Order

1. Task 1 (vite.config.ts) - Independent
2. Task 2 (useCanvasDrawing.ts) - Independent
3. Task 3 (AIEditor.tsx) - Independent
4. Task 4 (imageEditingService.test.ts) - Independent
5. Task 5 (useLookbookGenerator.test.tsx) - Independent

All tasks are independent - can be executed in parallel.

## Verification

```bash
npx tsc --noEmit
npm run test
```
