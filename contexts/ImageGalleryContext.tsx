/**
 * Image Gallery Context
 *
 * Manages local gallery state with optional Google Drive synchronization.
 * Images are stored in memory with automatic sync when connected to Drive.
 *
 * @see hooks/useGoogleDriveSync.ts for Drive sync logic
 */

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { ImageFile } from '../types';
import { ImageLRUCache } from '../utils/imageCache';
import { useGoogleDrive } from './GoogleDriveContext';
import {
  useGoogleDriveSync,
  SyncStatus,
  GalleryImageFile,
} from '../hooks/useGoogleDriveSync';

// ============================================================================
// Types
// ============================================================================

/** Extended context type with Drive sync state */
interface ImageGalleryContextType {
  /** Gallery images (local + Drive) */
  images: GalleryImageFile[];
  /** Add image to gallery (auto-syncs to Drive if connected) */
  addImage: (image: ImageFile, feature?: string) => void;
  /** Delete image from gallery (auto-syncs to Drive if connected) */
  deleteImage: (base64: string) => void;
  /** Clear all images (auto-syncs to Drive if connected) */
  clearImages: () => void;

  // --- Drive sync state ---
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Last successful sync timestamp */
  lastSynced: Date | null;
  /** Current sync error message */
  syncError: string | null;
  /** Whether initial load from Drive is in progress */
  isLoadingFromDrive: boolean;
  /** Force sync all pending operations */
  forceSync: () => Promise<void>;
  /** Clear sync error */
  clearSyncError: () => void;

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
  // --- External state ---
  const { isConnected } = useGoogleDrive();
  const {
    syncStatus,
    lastSynced,
    syncError,
    loadFromDrive,
    queueUpload,
    queueDelete,
    forceSync,
    clearError,
  } = useGoogleDriveSync();

  // --- Local state ---
  const [images, setImages] = useState<GalleryImageFile[]>([]);
  const [isLoadingFromDrive, setIsLoadingFromDrive] = useState(false);
  const [hasLoadedFromDrive, setHasLoadedFromDrive] = useState(false);

  // --- Refs for stable access in callbacks ---
  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // --- Load from Drive on connect ---
  useEffect(() => {
    // Cancellation flag for race condition prevention
    let cancelled = false;

    // Only load once when connected and not already loaded
    if (isConnected && !hasLoadedFromDrive && !isLoadingFromDrive) {
      setIsLoadingFromDrive(true);

      loadFromDrive()
        .then((driveImages) => {
          if (cancelled) return; // Ignore stale results
          if (driveImages.length > 0) {
            setImages(driveImages.slice(0, GALLERY_SIZE_LIMIT));
          }
          setHasLoadedFromDrive(true);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('[Gallery] Failed to load from Drive:', err.message || err);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingFromDrive(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isConnected, hasLoadedFromDrive, isLoadingFromDrive, loadFromDrive]);

  // --- Reset load state on disconnect ---
  useEffect(() => {
    if (!isConnected) {
      setHasLoadedFromDrive(false);
    }
  }, [isConnected]);

  // --- Add Image ---
  const addImage = useCallback((image: ImageFile, feature?: string) => {
    // Create gallery image with metadata
    const galleryImage: GalleryImageFile = {
      ...image,
      feature: feature || 'unknown',
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

    // Queue upload outside setImages to use fresh connection state
    if (isConnectedRef.current) {
      queueUpload(image.base64, image.mimeType, feature || 'unknown');
    }
  }, [queueUpload]);

  // --- Delete Image ---
  const deleteImage = useCallback((base64: string) => {
    setImages((prevImages) => {
      const filteredImages = prevImages.filter((img) => img.base64 !== base64);

      // Use efficient remove() instead of clear+rebuild (O(n) vs O(n²))
      imageCache.remove(base64);

      return filteredImages;
    });

    // Queue delete using ref for fresh connection state
    if (isConnectedRef.current) {
      queueDelete(base64);
    }
  }, [queueDelete]);

  // --- Clear Images ---
  const clearImages = useCallback(() => {
    // Use functional update to get fresh images and queue deletes
    setImages((currentImages) => {
      if (isConnectedRef.current) {
        currentImages.forEach((img) => queueDelete(img.base64));
      }

      // Clear cache
      imageCache.clear();

      return [];
    });
  }, [queueDelete]);

  // --- Clear Sync Error ---
  const clearSyncError = useCallback(() => {
    clearError();
  }, [clearError]);

  // --- Get Cache Metrics ---
  const getCacheMetrics = useCallback(() => {
    return imageCache.getMetrics();
  }, []);

  // --- Context Value ---
  // Note: Intentionally not using useMemo - callbacks are already memoized
  // and object identity change on state updates is expected behavior
  const contextValue: ImageGalleryContextType = {
    images,
    addImage,
    deleteImage,
    clearImages,
    syncStatus,
    lastSynced,
    syncError,
    isLoadingFromDrive,
    forceSync,
    clearSyncError,
    getCacheMetrics,
  };

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
