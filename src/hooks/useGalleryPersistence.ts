import { useEffect, useCallback, useState } from 'react';
import { GalleryImageFile } from './useGoogleDriveSync';
import { galleryDB } from '../utils/galleryDB';
import { ImageLRUCache } from '../utils/imageCache';

/**
 * Hook to manage gallery persistence with IndexedDB
 * 
 * Provides hydration from DB on mount and persistence methods.
 */
export const useGalleryPersistence = (
  imageCache: ImageLRUCache<GalleryImageFile>,
  setImages: React.Dispatch<React.SetStateAction<GalleryImageFile[]>>
) => {
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    const hydrate = async () => {
      try {
        const savedImages = await galleryDB.getAllImages();
        
        if (savedImages.length > 0) {
          // Map back to GalleryImageFile (adding Date objects if they were stringified)
          const processedImages: GalleryImageFile[] = savedImages.map(img => ({
            ...img,
            createdAt: img.createdAt ? new Date(img.createdAt) : undefined
          }));
          
          // Hydrate LRU cache to maintain metrics and eviction state
          imageCache.hydrate(processedImages);
          
          // Update state
          setImages(imageCache.getAll());
          
          console.log(`[GalleryDB] Hydrated ${processedImages.length} images from IndexedDB`);
        }
      } catch (error) {
        console.error('[GalleryDB] Hydration failed:', error);
      } finally {
        setIsHydrated(true);
      }
    };

    hydrate();
  }, [imageCache, setImages]);

  // Persist to IndexedDB
  const persistGallery = useCallback(async (images: GalleryImageFile[]) => {
    try {
      await galleryDB.saveAllImages(images);
    } catch (error) {
      console.error('[GalleryDB] Persistence failed:', error);
    }
  }, []);

  return { isHydrated, persistGallery };
};
