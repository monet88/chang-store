# Phase 01a: ImageUploader Memoization

**Agent Type:** fullstack-developer
**Priority:** P0 Critical
**Estimated Time:** 2h
**Issue Reference:** ISSUE 1 from performance-260104-1415-analysis.md

---

## Objective

Optimize ImageUploader component to eliminate 1000+ unnecessary re-renders per session by implementing React.memo, useMemo, and useCallback.

**Performance Impact:**
- Current: Re-renders on every parent state change (2-5ms per re-render)
- Target: Re-render only when props actually change
- Benefit: -100ms cumulative interaction lag per session

---

## Current Problem

```typescript
// components/ImageUploader.tsx:19-168
const ImageUploader: React.FC<ImageUploaderProps> = ({ image, onImageUpload, title, id }) => {
  const [isDragging, setIsDragging] = useState(false);

  // ❌ ISSUE 1: Recalculated on every render
  const preview = image ? `data:${image.mimeType};base64,${image.base64}` : null;

  // ❌ ISSUE 2: Function recreated on every render
  const processFile = async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      try {
        const compressedImage = await compressImage(file);
        onImageUpload(compressedImage);
      } catch (error) {
        console.error('Compression failed:', error);
        // Fallback logic
      }
    }
  };

  // ❌ ISSUE 3: Drag handlers recreated on every render
  const handleDragOver = (e: React.DragEvent) => { /* ... */ };
  const handleDrop = (e: React.DragEvent) => { /* ... */ };
  // ... more handlers
}
```

**Impact:** Used in 14 feature components → massive re-render multiplication

---

## Implementation Tasks

### Task 1: Wrap Component with React.memo

```typescript
import React, { useState, useCallback, useMemo } from 'react';

const ImageUploader: React.FC<ImageUploaderProps> = React.memo(({ image, onImageUpload, title, id }) => {
  // Component implementation
});

// Optional: Custom comparison function if needed
ImageUploader.displayName = 'ImageUploader';
```

**Why:** Prevents re-renders when props haven't changed

---

### Task 2: Memoize Preview Data URL

```typescript
const preview = useMemo(
  () => image ? `data:${image.mimeType};base64,${image.base64}` : null,
  [image?.base64, image?.mimeType]
);
```

**Why:** Base64 string concatenation is expensive, only recalculate when image changes

**Important:** Use optional chaining `image?.base64` to avoid dependency array issues when image is null

---

### Task 3: Memoize processFile Function

```typescript
const processFile = useCallback(async (file: File) => {
  if (file && file.type.startsWith('image/')) {
    try {
      const compressedImage = await compressImage(file);
      onImageUpload(compressedImage);
    } catch (error) {
      console.error('Image compression failed:', error);
      // Fallback: try uploading without compression
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          const base64Data = base64.split(',')[1];
          onImageUpload({
            base64: base64Data,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      } catch (fallbackError) {
        console.error('Fallback upload also failed:', fallbackError);
      }
    }
  }
}, [onImageUpload]);
```

**Dependencies:** Only `onImageUpload` (passed from parent, should be stable)

---

### Task 4: Memoize Drag Handlers

```typescript
const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!isDragging) {
    setIsDragging(true);
  }
}, [isDragging]);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
}, []);

const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    processFile(files[0]);
  }
}, [processFile]);
```

**Dependencies:** Use functional state updates where possible to minimize dependencies

---

### Task 5: Memoize File Input Handler

```typescript
const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
}, [processFile]);
```

---

## Files to Modify

**Primary File:**
- `components/ImageUploader.tsx` (lines 19-168)

**No new files created**

---

## Implementation Checklist

- [ ] Import React.memo, useCallback, useMemo from 'react'
- [ ] Wrap component function with React.memo
- [ ] Convert `preview` to useMemo with correct dependencies
- [ ] Convert `processFile` to useCallback
- [ ] Convert all drag handlers to useCallback
- [ ] Convert file input handler to useCallback
- [ ] Verify no prop drilling anti-patterns introduced
- [ ] Remove any unused imports
- [ ] Add displayName for better debugging

---

## Testing Requirements

### Manual Testing
1. Open all 14 features and upload images
2. Verify drag-and-drop still works
3. Verify file input click still works
4. Verify image preview displays correctly
5. Verify compression fallback works (test with corrupted image)

### React DevTools Profiling
1. Open React DevTools Profiler
2. Record interaction: switch features 5 times
3. Verify ImageUploader only re-renders when image prop changes
4. Before fix: ~50+ re-renders per feature switch
5. After fix: ~0-2 re-renders per feature switch

### Console Checks
- [ ] No console warnings about missing dependencies
- [ ] No console errors about undefined props
- [ ] Compression errors still logged (expected behavior)

---

## Acceptance Criteria

✅ **Component wrapped with React.memo**
✅ **All computed values use useMemo**
✅ **All callbacks use useCallback**
✅ **Drag-and-drop functional in all 14 features**
✅ **File input functional in all 14 features**
✅ **Image preview displays correctly**
✅ **No console warnings or errors**
✅ **Re-render count reduced by >90%**
✅ **No prop drilling anti-patterns**

---

## Performance Verification

**Before (Baseline):**
```bash
# React DevTools Profiler
# Feature switch (TryOn → Lookbook → Background)
# ImageUploader re-renders: 3 × 15 = 45 re-renders
```

**After (Target):**
```bash
# React DevTools Profiler
# Feature switch (TryOn → Lookbook → Background)
# ImageUploader re-renders: 0-3 total (only if image prop changes)
```

---

## Rollback Plan

If issues arise:
```bash
git checkout components/ImageUploader.tsx
```

---

## Notes

- Keep fallback compression logic intact (critical for UX)
- Don't optimize `isDragging` state (local state is fine)
- Parent components should pass stable `onImageUpload` callback
- Test with large images (5MB+) to verify compression still works

---

**Status:** Ready for implementation
**Agent:** fullstack-developer-1a
