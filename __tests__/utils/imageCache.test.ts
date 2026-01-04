/**
 * Unit tests for ImageLRUCache
 * Tests eviction policy, size limits, and metrics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImageLRUCache } from '../../utils/imageCache';
import { ImageFile } from '../../types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create test image with specified size
 * @param sizeKB - Approximate size in KB (base64 encoded)
 * @param id - Unique identifier for image
 */
function createTestImage(sizeKB: number, id: string): ImageFile {
  // Base64 encoding: 3 bytes → 4 chars, so 1KB binary → ~1.33KB base64
  const targetChars = Math.floor((sizeKB * 1024) / 0.75); // Reverse calculation
  const base64 = id.repeat(Math.ceil(targetChars / id.length)).substring(0, targetChars);

  return {
    base64,
    mimeType: 'image/png',
  };
}

/**
 * Create small test image (~1KB)
 */
function createSmallImage(id: string): ImageFile {
  return {
    base64: id.repeat(1000), // ~1KB
    mimeType: 'image/png',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ImageLRUCache', () => {
  let cache: ImageLRUCache;

  beforeEach(() => {
    cache = new ImageLRUCache();
  });

  // --------------------------------------------------------------------------
  // Basic Operations
  // --------------------------------------------------------------------------

  describe('Basic Operations', () => {
    it('should start empty', () => {
      expect(cache.getAll()).toEqual([]);
      const metrics = cache.getMetrics();
      expect(metrics.itemCount).toBe(0);
      expect(metrics.totalBytes).toBe(0);
    });

    it('should add image to cache', () => {
      const image = createSmallImage('test');
      cache.add(image);

      const images = cache.getAll();
      expect(images).toHaveLength(1);
      expect(images[0]).toBe(image);
    });

    it('should add images to front (newest first)', () => {
      const img1 = createSmallImage('a');
      const img2 = createSmallImage('b');
      const img3 = createSmallImage('c');

      cache.add(img1);
      cache.add(img2);
      cache.add(img3);

      const images = cache.getAll();
      expect(images).toEqual([img3, img2, img1]); // Newest first
    });

    it('should clear all images', () => {
      cache.add(createSmallImage('a'));
      cache.add(createSmallImage('b'));

      cache.clear();

      expect(cache.getAll()).toEqual([]);
      const metrics = cache.getMetrics();
      expect(metrics.itemCount).toBe(0);
      expect(metrics.totalBytes).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Count-Based Eviction (maxItems)
  // --------------------------------------------------------------------------

  describe('Count-Based Eviction', () => {
    beforeEach(() => {
      cache = new ImageLRUCache({ maxItems: 3 }); // Small limit for testing
    });

    it('should enforce max items limit', () => {
      cache.add(createSmallImage('a'));
      cache.add(createSmallImage('b'));
      cache.add(createSmallImage('c'));

      expect(cache.getAll()).toHaveLength(3);

      cache.add(createSmallImage('d')); // Triggers eviction

      expect(cache.getAll()).toHaveLength(3); // Still at limit
    });

    it('should evict oldest images (LRU)', () => {
      const img1 = createSmallImage('a');
      const img2 = createSmallImage('b');
      const img3 = createSmallImage('c');
      const img4 = createSmallImage('d');

      cache.add(img1);
      cache.add(img2);
      cache.add(img3);
      cache.add(img4); // img1 should be evicted

      const images = cache.getAll();
      expect(images).toEqual([img4, img3, img2]); // img1 gone
      expect(images).not.toContain(img1);
    });

    it('should evict multiple images if needed', () => {
      const img1 = createSmallImage('a');
      const img2 = createSmallImage('b');
      const img3 = createSmallImage('c');
      const img4 = createSmallImage('d');
      const img5 = createSmallImage('e');

      cache.add(img1);
      cache.add(img2);
      cache.add(img3);
      cache.add(img4);
      cache.add(img5);

      const images = cache.getAll();
      expect(images).toEqual([img5, img4, img3]); // Only latest 3
      expect(images).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // Size-Based Eviction (maxBytes)
  // --------------------------------------------------------------------------

  describe('Size-Based Eviction', () => {
    beforeEach(() => {
      // 10KB limit for testing
      cache = new ImageLRUCache({ maxBytes: 10 * 1024 });
    });

    it('should enforce max bytes limit', () => {
      // Add images totaling ~12KB (exceeds 10KB limit)
      cache.add(createTestImage(4, 'a'));
      cache.add(createTestImage(4, 'b'));
      cache.add(createTestImage(4, 'c')); // Triggers eviction

      const metrics = cache.getMetrics();
      expect(metrics.totalBytes).toBeLessThanOrEqual(10 * 1024);
    });

    it('should evict oldest images when size limit exceeded', () => {
      const img1 = createTestImage(4, 'a');
      const img2 = createTestImage(4, 'b');
      const img3 = createTestImage(4, 'c');

      cache.add(img1);
      cache.add(img2);
      cache.add(img3); // Should evict img1 to stay under 10KB

      const images = cache.getAll();
      expect(images).not.toContain(img1); // Oldest evicted
      expect(images).toContain(img2);
      expect(images).toContain(img3);
    });

    it('should calculate image size correctly', () => {
      const image = createTestImage(5, 'test');
      cache.add(image);

      const metrics = cache.getMetrics();
      const expectedBytes = Math.floor(image.base64.length * 0.75);
      expect(metrics.totalBytes).toBe(expectedBytes);
    });
  });

  // --------------------------------------------------------------------------
  // Combined Eviction (maxItems OR maxBytes)
  // --------------------------------------------------------------------------

  describe('Combined Eviction', () => {
    it('should evict when either limit exceeded', () => {
      // Test count limit with small images (won't trigger size limit)
      const countCache = new ImageLRUCache({
        maxItems: 5,
        maxBytes: 1024 * 1024, // 1MB (large enough)
      });

      for (let i = 0; i < 6; i++) {
        countCache.add(createSmallImage(`img${i}`));
      }
      expect(countCache.getAll()).toHaveLength(5); // Count limit enforced

      // Test size limit with large images
      const sizeCache = new ImageLRUCache({
        maxItems: 100, // High count
        maxBytes: 10 * 1024, // 10KB
      });

      sizeCache.add(createTestImage(6, 'a'));
      sizeCache.add(createTestImage(6, 'b')); // Exceeds 10KB

      const metrics = sizeCache.getMetrics();
      expect(metrics.totalBytes).toBeLessThanOrEqual(10 * 1024);
    });

    it('should evict until both limits satisfied', () => {
      const cache = new ImageLRUCache({
        maxItems: 5,
        maxBytes: 10 * 1024, // 10KB
      });

      // Add 6 images of 3KB each (18KB total, exceeds both limits)
      for (let i = 0; i < 6; i++) {
        cache.add(createTestImage(3, `img${i}`));
      }

      const images = cache.getAll();
      const metrics = cache.getMetrics();

      expect(images.length).toBeLessThanOrEqual(5); // Count limit
      expect(metrics.totalBytes).toBeLessThanOrEqual(10 * 1024); // Size limit
    });
  });

  // --------------------------------------------------------------------------
  // Metrics
  // --------------------------------------------------------------------------

  describe('Metrics', () => {
    it('should provide accurate metrics', () => {
      const img1 = createTestImage(500, 'a'); // 500KB
      const img2 = createTestImage(700, 'b'); // 700KB

      cache.add(img1);
      cache.add(img2);

      const metrics = cache.getMetrics();

      expect(metrics.itemCount).toBe(2);
      expect(metrics.totalBytes).toBeGreaterThan(0);
      expect(metrics.totalMB).toBeGreaterThan(0); // ~1.2MB total
      expect(metrics.utilizationPercent).toBeGreaterThan(0);
      expect(metrics.maxItems).toBe(50); // Default
      expect(metrics.maxMBFormatted).toBe('100.00'); // Default 100MB
    });

    it('should update metrics after clear', () => {
      cache.add(createSmallImage('a'));
      cache.clear();

      const metrics = cache.getMetrics();
      expect(metrics.itemCount).toBe(0);
      expect(metrics.totalBytes).toBe(0);
      expect(metrics.totalMBFormatted).toBe('0.00');
      expect(metrics.utilizationPercentFormatted).toBe('0.0');
    });

    it('should reflect custom config in metrics', () => {
      const customCache = new ImageLRUCache({
        maxItems: 10,
        maxBytes: 5 * 1024 * 1024, // 5MB
      });

      const metrics = customCache.getMetrics();
      expect(metrics.maxItems).toBe(10);
      expect(metrics.maxMBFormatted).toBe('5.00');
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('should handle empty base64 string', () => {
      const image: ImageFile = { base64: '', mimeType: 'image/png' };
      cache.add(image);

      const metrics = cache.getMetrics();
      expect(metrics.itemCount).toBe(1);
      expect(metrics.totalBytes).toBe(0);
    });

    it('should handle very large single image', () => {
      cache = new ImageLRUCache({ maxBytes: 5 * 1024 }); // 5KB limit

      // Add 3KB image (under limit)
      cache.add(createTestImage(3, 'large'));

      // Should be added successfully
      expect(cache.getAll()).toHaveLength(1);

      // Add 4KB image (combined 7KB exceeds 5KB limit)
      cache.add(createTestImage(4, 'medium'));

      // First image should be evicted, only second remains
      const images = cache.getAll();
      expect(images).toHaveLength(1);
      expect(images[0].base64).toContain('medium');

      const metrics = cache.getMetrics();
      expect(metrics.totalBytes).toBeLessThanOrEqual(5 * 1024);
    });

    it('should handle custom config partial override', () => {
      const customCache = new ImageLRUCache({ maxItems: 10 });

      const metrics = customCache.getMetrics();
      expect(metrics.maxItems).toBe(10); // Custom
      expect(metrics.maxMBFormatted).toBe('100.00'); // Default
    });

    it('should handle rapid additions', () => {
      cache = new ImageLRUCache({ maxItems: 10 });

      // Add 100 images rapidly
      for (let i = 0; i < 100; i++) {
        cache.add(createSmallImage(`img${i}`));
      }

      const images = cache.getAll();
      expect(images).toHaveLength(10); // Only latest 10

      // Verify newest images kept
      const latestImage = images[0];
      expect(latestImage.base64).toContain('img99');
    });
  });

  // --------------------------------------------------------------------------
  // Real-World Scenarios
  // --------------------------------------------------------------------------

  describe('Real-World Scenarios', () => {
    it('should work with default config (50 images, 100MB)', () => {
      const defaultCache = new ImageLRUCache();

      // Add 60 small images (exceeds count limit)
      for (let i = 0; i < 60; i++) {
        defaultCache.add(createSmallImage(`img${i}`));
      }

      const images = defaultCache.getAll();
      expect(images).toHaveLength(50); // Count limit enforced

      const metrics = defaultCache.getMetrics();
      expect(metrics.totalBytes).toBeLessThan(100 * 1024 * 1024); // Under size limit
    });

    it('should evict old images as new ones are added', () => {
      cache = new ImageLRUCache({ maxItems: 20 });

      // Simulate gallery usage
      const addedImages: ImageFile[] = [];

      for (let i = 0; i < 30; i++) {
        const img = createSmallImage(`session${i}`);
        addedImages.push(img);
        cache.add(img);
      }

      const cachedImages = cache.getAll();

      // Should only have latest 20
      expect(cachedImages).toHaveLength(20);

      // First 10 should be evicted
      expect(cachedImages).not.toContain(addedImages[0]);
      expect(cachedImages).not.toContain(addedImages[9]);

      // Last 20 should remain
      expect(cachedImages).toContain(addedImages[29]);
      expect(cachedImages).toContain(addedImages[20]);
    });
  });
});
