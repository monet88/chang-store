/**
 * Image Gallery Context
 *
 * Manages local gallery state, persisted to IndexedDB through
 * `hooks/useGalleryPersistence.ts`.
 */

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { ImageFile, GalleryImageFile, Feature, ImageEngineId } from '../types';
import { ImageLRUCache } from '../utils/imageCache';
import { useGalleryPersistence } from '../hooks/useGalleryPersistence';

// ============================================================================
// Types
// ============================================================================

interface ImageGalleryContextType {
  /** Gallery images */
  images: GalleryImageFile[];
  /** Add image to gallery */
  addImage: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  /** Delete image from gallery */
  deleteImage: (base64: string) => void;
  /** Clear all images */
  clearImages: () => void;

  // --- LRU Cache metrics ---
  /** Get cache metrics for monitoring/debugging */
  getCacheMetrics: () => ReturnType<ImageLRUCache['getMetrics']>;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum images in gallery */
const GALLERY_SIZE_LIMIT = 20;

/**
 * LRU Cache instance (singleton pattern)
 * Persists across component re-renders
 * Limits: 50 images OR 100MB
 * Generic type ensures type safety with GalleryImageFile
 */
const imageCache = new ImageLRUCache<GalleryImageFile>();

// ============================================================================
// Context
// ============================================================================

const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export const ImageGalleryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Local state ---
  const [images, setImages] = useState<GalleryImageFile[]>([]);

  // --- Persistence ---
  const { isHydrated, persistGallery } = useGalleryPersistence(imageCache, setImages);

  // Auto-persist to IndexedDB when images state changes, but only after initial hydration
  useEffect(() => {
    if (isHydrated) {
      persistGallery(images);
    }
  }, [images, persistGallery, isHydrated]);

  // --- Add Image ---
  const addImage = useCallback((image: ImageFile, feature?: Feature, engine?: ImageEngineId) => {
    // Create gallery image with metadata
    const galleryImage: GalleryImageFile = {
      ...image,
      feature: feature || 'unknown',
      engine,
      createdAt: new Date(),
    };

    setImages((prevImages) => {
      // Deduplicate by base64
      if (prevImages.some((img) => img.base64 === image.base64)) {
        return prevImages;
      }

      // Add to LRU cache (handles eviction automatically)
      imageCache.add(galleryImage);

      // Get cached images (evicted if needed) - type-safe now
      const cachedImages = imageCache.getAll();

      // Apply gallery size limit on top of cache limit
      return cachedImages.slice(0, GALLERY_SIZE_LIMIT);
    });
  }, []);

  // --- Delete Image ---
  const deleteImage = useCallback((base64: string) => {
    setImages((prevImages) => {
      const filteredImages = prevImages.filter((img) => img.base64 !== base64);

      // Use efficient remove() instead of clear+rebuild (O(n) vs O(n²))
      imageCache.remove(base64);

      return filteredImages;
    });
  }, []);

  // --- Clear Images ---
  const clearImages = useCallback(() => {
    setImages(() => {
      // Clear cache
      imageCache.clear();

      return [];
    });
  }, []);

  // --- Get Cache Metrics ---
  const getCacheMetrics = useCallback(() => {
    return imageCache.getMetrics();
  }, []);

  // --- Context Value ---
  // ⚡ Bolt: Wrap Context Provider value in useMemo to preserve object identity
  // and prevent massive cascading re-renders across all consumer components.
  // Overriding previous architectural note because passing literal objects forces re-renders.
  const contextValue = useMemo<ImageGalleryContextType>(() => ({
    images,
    addImage,
    deleteImage,
    clearImages,
    getCacheMetrics,
  }), [images, addImage, deleteImage, clearImages, getCacheMetrics]);

  return (
    <ImageGalleryContext.Provider value={contextValue}>
      {children}
    </ImageGalleryContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access gallery state and methods
 * @throws Error if used outside of ImageGalleryProvider
 */
export const useImageGallery = (): ImageGalleryContextType => {
  const context = useContext(ImageGalleryContext);

  if (context === undefined) {
    throw new Error('useImageGallery must be used within an ImageGalleryProvider');
  }

  return context;
};
