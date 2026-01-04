# Phase 02c: Image LRU Cache

**Agent Type:** fullstack-developer
**Priority:** P2 Medium
**Estimated Time:** 2-3h
**Issue Reference:** ISSUE 9 from performance report
**Dependencies:** Requires Phase 1 completion

---

## Objective

Implement LRU (Least Recently Used) cache for image gallery to prevent memory accumulation over long sessions.

**Performance Impact:**
- Memory usage (20 images): 40-60MB → 20-30MB (-50%)
- Prevents unbounded memory growth
- Maintains smooth UX with size limits

**Cache Limits:**
- **Max Items:** 50 images
- **Max Size:** 100MB total
- **Eviction:** Oldest images removed when limits exceeded

---

## Current Problem

```typescript
// Assumption: ImageGalleryContext stores all images in-memory
interface ImageGalleryContextType {
  images: ImageFile[]; // ❌ Array grows indefinitely
  addImage: (image: ImageFile) => void;
}

// Problem: No eviction strategy
const addImage = (image: ImageFile) => {
  setImages(prev => [image, ...prev]); // ❌ Just keeps adding
};
```

**Impact:**
- Average image: 500KB - 2MB base64
- 20 images = 10-40MB RAM
- 100 images = 50-200MB RAM
- No garbage collection (still referenced in context)

**User Scenario:**
```
Power user generates 100 images in session
→ 100-200MB RAM consumed
→ Browser tab slows down
→ Risk of tab crash on low-memory devices
```

---

## Implementation Plan

### Step 1: Create LRU Cache Class

**File:** `utils/imageCache.ts` (NEW, ~150 lines)

```typescript
import { ImageFile } from '../types';

/**
 * Configuration for ImageLRUCache
 */
interface CacheConfig {
  /** Maximum number of images to store */
  maxItems: number;
  /** Maximum total size in bytes */
  maxBytes: number;
}

/**
 * Default cache configuration
 * 50 images OR 100MB, whichever reached first
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxItems: 50,
  maxBytes: 100 * 1024 * 1024, // 100 MB
};

/**
 * LRU Cache for managing image gallery storage
 *
 * Features:
 * - Size-based eviction (tracks base64 byte size)
 * - Count-based eviction (max items)
 * - LRU eviction policy (oldest removed first)
 * - Metrics tracking
 *
 * @example
 * const cache = new ImageLRUCache();
 * cache.add(image);
 * const allImages = cache.getAll();
 * const metrics = cache.getMetrics(); // { itemCount, totalBytes, totalMB }
 */
export class ImageLRUCache {
  private items: ImageFile[] = [];
  private config: CacheConfig;
  private currentBytes: number = 0;

  /**
   * Create new ImageLRUCache instance
   * @param config - Optional custom configuration (overrides defaults)
   */
  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add image to cache
   * Automatically evicts oldest images if limits exceeded
   * @param image - Image to add
   */
  add(image: ImageFile): void {
    // Calculate image size (base64 → binary size = length * 0.75)
    const imageSize = this.calculateImageSize(image);

    // Add to front (most recent)
    this.items.unshift(image);
    this.currentBytes += imageSize;

    // Evict oldest items if limits exceeded
    this.evictIfNeeded();
  }

  /**
   * Get all images in cache (most recent first)
   * @returns Array of images
   */
  getAll(): ImageFile[] {
    return this.items;
  }

  /**
   * Clear all images from cache
   */
  clear(): void {
    this.items = [];
    this.currentBytes = 0;
  }

  /**
   * Get cache metrics for monitoring
   * @returns Metrics object with itemCount, totalBytes, totalMB
   */
  getMetrics() {
    return {
      itemCount: this.items.length,
      totalBytes: this.currentBytes,
      totalMB: (this.currentBytes / (1024 * 1024)).toFixed(2),
      maxItems: this.config.maxItems,
      maxMB: (this.config.maxBytes / (1024 * 1024)).toFixed(2),
      utilizationPercent: ((this.currentBytes / this.config.maxBytes) * 100).toFixed(1)
    };
  }

  /**
   * Calculate image size in bytes
   * Base64 encoding: 4 chars = 3 bytes → size = length * 0.75
   */
  private calculateImageSize(image: ImageFile): number {
    return Math.floor(image.base64.length * 0.75);
  }

  /**
   * Evict oldest images if limits exceeded
   * Checks both item count and byte size limits
   */
  private evictIfNeeded(): void {
    while (
      this.items.length > this.config.maxItems ||
      this.currentBytes > this.config.maxBytes
    ) {
      const evicted = this.items.pop(); // Remove oldest (last item)
      if (evicted) {
        const evictedSize = this.calculateImageSize(evicted);
        this.currentBytes -= evictedSize;

        // Log eviction for debugging (remove in production)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[ImageCache] Evicted oldest image (${(evictedSize / 1024).toFixed(0)}KB). Cache now: ${this.items.length} items, ${(this.currentBytes / 1024 / 1024).toFixed(2)}MB`);
        }
      }
    }
  }
}
```

---

### Step 2: Integrate Cache into ImageGalleryContext

**File:** `contexts/ImageGalleryContext.tsx` (MODIFY existing)

```typescript
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ImageFile } from '../types';
import { ImageLRUCache } from '../utils/imageCache';

/**
 * Context type definition
 */
interface ImageGalleryContextType {
  images: ImageFile[];
  addImage: (image: ImageFile) => void;
  clearImages: () => void;
  getCacheMetrics: () => ReturnType<ImageLRUCache['getMetrics']>; // NEW
}

const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(undefined);

/**
 * Create cache instance (singleton pattern)
 * Persists across component re-renders
 */
const imageCache = new ImageLRUCache();

/**
 * ImageGalleryProvider with LRU cache integration
 */
export const ImageGalleryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageFile[]>([]);

  /**
   * Add image to gallery with LRU caching
   */
  const addImage = useCallback((image: ImageFile) => {
    imageCache.add(image);
    setImages(imageCache.getAll());
  }, []);

  /**
   * Clear all images from gallery
   */
  const clearImages = useCallback(() => {
    imageCache.clear();
    setImages([]);
  }, []);

  /**
   * Get cache metrics for monitoring/debugging
   * NEW: Expose cache statistics
   */
  const getCacheMetrics = useCallback(() => {
    return imageCache.getMetrics();
  }, []);

  return (
    <ImageGalleryContext.Provider value={{ images, addImage, clearImages, getCacheMetrics }}>
      {children}
    </ImageGalleryContext.Provider>
  );
};

/**
 * Hook to access ImageGallery context
 */
export const useImageGallery = () => {
  const context = useContext(ImageGalleryContext);
  if (!context) {
    throw new Error('useImageGallery must be used within ImageGalleryProvider');
  }
  return context;
};
```

---

### Step 3: Add Cache Metrics Display (Optional Debug Component)

**File:** `components/CacheMetrics.tsx` (NEW, optional, ~50 lines)

```typescript
import React from 'react';
import { useImageGallery } from '../contexts/ImageGalleryContext';

/**
 * CacheMetrics - Debug component to display cache statistics
 * Only render in development mode
 */
export const CacheMetrics: React.FC = () => {
  const { getCacheMetrics } = useImageGallery();
  const metrics = getCacheMetrics();

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50">
      <h3 className="font-bold mb-2">Image Cache Metrics</h3>
      <div>Items: {metrics.itemCount} / {metrics.maxItems}</div>
      <div>Size: {metrics.totalMB}MB / {metrics.maxMB}MB</div>
      <div>Utilization: {metrics.utilizationPercent}%</div>
      <div className="mt-2 text-slate-400">
        Oldest images evicted when limits exceeded
      </div>
    </div>
  );
};
```

**Usage in App.tsx (development only):**
```typescript
import { CacheMetrics } from './components/CacheMetrics';

const AppContent: React.FC = () => {
  return (
    <>
      {/* Existing app content */}
      <CacheMetrics /> {/* Auto-hides in production */}
    </>
  );
};
```

---

## Files Modified/Created

**Created:**
- `utils/imageCache.ts` (NEW, ~150 lines)
- `components/CacheMetrics.tsx` (NEW, optional, ~50 lines)

**Modified:**
- `contexts/ImageGalleryContext.tsx` (integrate cache, add getCacheMetrics)
- `App.tsx` (optional: add CacheMetrics component for debugging)

---

## Implementation Checklist

- [ ] Create `utils/imageCache.ts`
  - [ ] Implement ImageLRUCache class
  - [ ] Add size calculation (base64 → bytes)
  - [ ] Implement eviction logic (count + size)
  - [ ] Add metrics tracking
  - [ ] Add JSDoc comments
- [ ] Update `contexts/ImageGalleryContext.tsx`
  - [ ] Import ImageLRUCache
  - [ ] Create cache instance
  - [ ] Update addImage to use cache
  - [ ] Update clearImages to use cache
  - [ ] Add getCacheMetrics method
- [ ] (Optional) Create `components/CacheMetrics.tsx`
  - [ ] Display metrics in dev mode
  - [ ] Hide in production
- [ ] (Optional) Add CacheMetrics to App.tsx
- [ ] Test cache eviction logic
- [ ] Test memory usage improvement

---

## Testing Requirements

### Unit Tests (Recommended)
```typescript
// tests/imageCache.test.ts
import { ImageLRUCache } from '../utils/imageCache';

describe('ImageLRUCache', () => {
  it('should evict oldest image when maxItems exceeded', () => {
    const cache = new ImageLRUCache({ maxItems: 3, maxBytes: 10 * 1024 * 1024 });
    const img1 = { base64: 'A'.repeat(1000), mimeType: 'image/png' };
    const img2 = { base64: 'B'.repeat(1000), mimeType: 'image/png' };
    const img3 = { base64: 'C'.repeat(1000), mimeType: 'image/png' };
    const img4 = { base64: 'D'.repeat(1000), mimeType: 'image/png' };

    cache.add(img1);
    cache.add(img2);
    cache.add(img3);
    cache.add(img4); // Should evict img1

    const items = cache.getAll();
    expect(items.length).toBe(3);
    expect(items[0]).toBe(img4); // Most recent first
    expect(items[2]).toBe(img2); // img1 evicted
  });

  it('should evict images when maxBytes exceeded', () => {
    const cache = new ImageLRUCache({ maxItems: 100, maxBytes: 2000 }); // ~2KB limit
    const largeImg = { base64: 'X'.repeat(3000), mimeType: 'image/png' }; // ~2.25KB

    cache.add(largeImg);
    const metrics = cache.getMetrics();
    expect(metrics.itemCount).toBe(1); // Within byte limit (barely)

    const anotherImg = { base64: 'Y'.repeat(3000), mimeType: 'image/png' };
    cache.add(anotherImg); // Should evict largeImg

    const items = cache.getAll();
    expect(items.length).toBe(1);
    expect(items[0]).toBe(anotherImg);
  });
});
```

### Manual Testing

**Test 1: Generate 60 Images (Exceeds maxItems=50)**
1. Generate 60 images using any feature
2. Open gallery
3. Verify only 50 most recent images present
4. Oldest 10 images should be evicted

**Test 2: Memory Usage Over Session**
```javascript
// Chrome DevTools → Memory → Take heap snapshot
1. Initial snapshot (no images)
2. Generate 20 images
3. Check memory usage (~10-40MB)
4. Generate 40 more images (total 60, cache evicts 10)
5. Final snapshot
6. Verify: Memory NOT doubled (cache working)
```

**Test 3: Cache Metrics Display (Dev Mode)**
1. Add CacheMetrics component
2. Generate images
3. Watch metrics update in real-time
4. Verify eviction logs in console

---

## Acceptance Criteria

✅ **ImageLRUCache class implemented**
✅ **Size-based eviction working (tracks base64 bytes)**
✅ **Count-based eviction working (max 50 items)**
✅ **ImageGalleryContext integrated with cache**
✅ **getCacheMetrics available for monitoring**
✅ **Gallery scroll performance maintained**
✅ **No memory leaks over 60+ image generation**
✅ **Memory usage capped at ~100MB**
✅ **Oldest images evicted when limits exceeded**
✅ **(Optional) CacheMetrics component displays in dev mode**

---

## Edge Cases Handled

### Edge Case 1: Single Huge Image (>100MB)
```typescript
// What if a single image exceeds maxBytes?
// Current implementation: Add anyway, then evict immediately
// Better: Add but mark as "over-limit" and keep until next add
```

**Solution (if needed):**
```typescript
add(image: ImageFile): void {
  const imageSize = this.calculateImageSize(image);

  // If single image exceeds limit, allow it but warn
  if (imageSize > this.config.maxBytes) {
    console.warn(`[ImageCache] Single image (${(imageSize / 1024 / 1024).toFixed(2)}MB) exceeds cache limit. Storing anyway.`);
  }

  this.items.unshift(image);
  this.currentBytes += imageSize;
  this.evictIfNeeded();
}
```

### Edge Case 2: Rapid Image Generation
- Cache handles rapid adds efficiently
- No race conditions (synchronous operations)

### Edge Case 3: User Manually Clears Gallery
- clearImages() resets cache properly
- No orphaned memory

---

## Performance Verification

**Before (No Cache):**
```
Generate 100 images
Memory usage: 100-200MB
Gallery scroll: Laggy (many large images)
```

**After (LRU Cache):**
```
Generate 100 images
Memory usage: ~100MB (capped)
Gallery shows: 50 most recent
Gallery scroll: Smooth (fewer images)
```

---

## Future Enhancements (Out of Scope)

1. **Persistence:** Save cache to IndexedDB for cross-session persistence
2. **Smart Eviction:** Evict based on usage frequency, not just age
3. **Compression:** Store images compressed, decompress on display
4. **Configurable Limits:** Let user adjust cache size in settings

---

## Rollback Plan

```bash
# If issues arise
git checkout contexts/ImageGalleryContext.tsx
rm utils/imageCache.ts
rm components/CacheMetrics.tsx  # if created
```

**Risk Level:** Low - cache is additive feature, no breaking changes

---

**Status:** Ready for implementation
**Agent:** fullstack-developer-2c
**Prerequisites:** Phase 1 complete
