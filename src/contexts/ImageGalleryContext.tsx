/**
 * Image Gallery Context
 *
 * Manages local gallery state with persistence.
 * Images are stored in memory and persisted to IndexedDB.
 */

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { ImageFile, GalleryImageFile } from '../types';
import { ImageLRUCache } from '../utils/imageCache';
import { useGalleryPersistence } from '../hooks/useGalleryPersistence';

// ============================================================================
// Types
// ============================================================================

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/** Extended context type */
interface ImageGalleryContextType {
  /** Gallery images */
  images: GalleryImageFile[];
  /** Add image to gallery */
  addImage: (image: ImageFile, feature?: string) => void;
  /** Delete image from gallery */
  deleteImage: (base64: string) => void;
  /** Clear all images */
  clearImages: () => void;

  // --- Sync state (stubs, no longer Drive-backed) ---
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  syncError: string | null;
  isLoadingFromDrive: boolean;
  forceSync: () => Promise<void>;
  clearSyncError: () => void;

  // --- LRU Cache metrics ---
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
  const [syncStatus] = useState<SyncStatus>('idle');
  const [lastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoadingFromDrive] = useState(false);

  // --- Persistence ---
  const { isHydrated, persistGallery } = useGalleryPersistence(imageCache, setImages);

  // Auto-persist to IndexedDB when images state changes, but only after initial hydration
  useEffect(() => {
    if (isHydrated) {
      persistGallery(images);
    }
  }, [images, persistGallery, isHydrated]);

  // --- Add Image ---
  const addImage = useCallback((image: ImageFile, feature?: string) => {
    const galleryImage: GalleryImageFile = {
      ...image,
      feature: feature || 'unknown',
      createdAt: new Date(),
    };

    setImages((prevImages) => {
      if (prevImages.some((img) => img.base64 === image.base64)) {
        return prevImages;
      }
      imageCache.add(galleryImage);
      const cachedImages = imageCache.getAll();
      return cachedImages.slice(0, GALLERY_SIZE_LIMIT);
    });
  }, []);

  // --- Delete Image ---
  const deleteImage = useCallback((base64: string) => {
    setImages((prevImages) => {
      const filteredImages = prevImages.filter((img) => img.base64 !== base64);
      imageCache.remove(base64);
      return filteredImages;
    });
  }, []);

  // --- Clear Images ---
  const clearImages = useCallback(() => {
    imageCache.clear();
    setImages([]);
  }, []);

  // --- Force Sync (no-op stub) ---
  const forceSync = useCallback(async () => {
    // No-op: Google Drive sync removed
  }, []);

  // --- Clear Sync Error ---
  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  // --- Get Cache Metrics ---
  const getCacheMetrics = useCallback(() => {
    return imageCache.getMetrics();
  }, []);

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
