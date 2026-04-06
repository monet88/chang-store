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
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
  /** Current number of images in cache */
  itemCount: number;
  /** Total size in bytes */
  totalBytes: number;
  /** Total size in megabytes (numeric for calculations) */
  totalMB: number;
  /** Formatted total size in MB (string for display) */
  totalMBFormatted: string;
  /** Maximum allowed items */
  maxItems: number;
  /** Maximum allowed size in megabytes (numeric) */
  maxMB: number;
  /** Formatted max size in MB (string for display) */
  maxMBFormatted: string;
  /** Cache utilization percentage (numeric) */
  utilizationPercent: number;
  /** Formatted utilization percentage (string for display) */
  utilizationPercentFormatted: string;
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
 * const cache = new ImageLRUCache<GalleryImageFile>();
 * cache.add(image);
 * const allImages = cache.getAll();
 * const metrics = cache.getMetrics(); // { itemCount, totalBytes, totalMB }
 */
export class ImageLRUCache<T extends ImageFile = ImageFile> {
  private items: T[] = [];
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
  add(image: T): void {
    // Calculate image size (base64 → binary size = length * 0.75)
    const imageSize = this.calculateImageSize(image);

    // Validate size before adding (prevent cache from emptying itself)
    if (imageSize > this.config.maxBytes) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ImageCache] Single image (${(imageSize / 1024 / 1024).toFixed(2)}MB) exceeds cache limit (${(this.config.maxBytes / 1024 / 1024).toFixed(2)}MB). Skipping cache.`);
      }
      return; // Don't add to cache
    }

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
  getAll(): T[] {
    return this.items;
  }

  /**
   * Remove specific image from cache
   * More efficient than clear+rebuild for single deletions
   * @param base64 - Base64 string of image to remove
   */
  remove(base64: string): void {
    const index = this.items.findIndex(img => img.base64 === base64);
    if (index !== -1) {
      const removed = this.items[index];
      const removedSize = this.calculateImageSize(removed);

      this.items.splice(index, 1);
      this.currentBytes -= removedSize;
    }
  }

  /**
   * Clear all images from cache
   * Resets item count and byte tracking to zero
   */
  clear(): void {
    this.items = [];
    this.currentBytes = 0;
  }

  /**
   * Get cache metrics for monitoring
   * @returns Metrics object with both numeric and formatted values
   */
  getMetrics(): CacheMetrics {
    const totalMB = this.currentBytes / (1024 * 1024);
    const maxMB = this.config.maxBytes / (1024 * 1024);
    const utilizationPercent = (this.currentBytes / this.config.maxBytes) * 100;

    return {
      itemCount: this.items.length,
      totalBytes: this.currentBytes,
      totalMB,
      totalMBFormatted: totalMB.toFixed(2),
      maxItems: this.config.maxItems,
      maxMB,
      maxMBFormatted: maxMB.toFixed(2),
      utilizationPercent,
      utilizationPercentFormatted: utilizationPercent.toFixed(1)
    };
  }

  /**
   * Calculate image size in bytes
   * Base64 encoding: 4 chars = 3 bytes, accounting for padding
   */
  private calculateImageSize(image: ImageFile): number {
    const base64 = image.base64;
    // Base64 padding can only be 0, 1, or 2 '=' characters at the end of the string.
    // Using string.endsWith is O(1) compared to regex match which is O(N) where N is string length (several MBs).
    let padding = 0;
    if (base64.endsWith('==')) {
      padding = 2;
    } else if (base64.endsWith('=')) {
      padding = 1;
    }
    return Math.floor((base64.length * 3 / 4) - padding);
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
