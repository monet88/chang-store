import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { ImageFile } from '../types';
import { useImageGallery } from './ImageGalleryContext';
import ImageModal from '../components/ImageModal';

interface ImageViewerContextType {
  openImageViewer: (image: ImageFile) => void;
}

const ImageViewerContext = createContext<ImageViewerContextType | undefined>(undefined);

export const ImageViewerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { images } = useImageGallery();
  const [viewingImage, setViewingImage] = useState<ImageFile | null>(null);

  const openImageViewer = useCallback((image: ImageFile) => {
    setViewingImage(image);
  }, []);

  const closeImageViewer = useCallback(() => {
    setViewingImage(null);
  }, []);

  const handleNav = (direction: 'next' | 'prev') => {
    if (!viewingImage) return;
    const currentIndex = images.findIndex(img => img.base64 === viewingImage.base64);

    if (currentIndex === -1) {
      // If the currently viewed image is not in the main gallery, we can't navigate.
      return; 
    }

    if (direction === 'next' && currentIndex < images.length - 1) {
      setViewingImage(images[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setViewingImage(images[currentIndex - 1]);
    }
  };

  const viewingIndexInGallery = viewingImage ? images.findIndex(img => img.base64 === viewingImage.base64) : -1;
  const canNavigate = viewingIndexInGallery !== -1 && images.length > 1;

  return (
    <ImageViewerContext.Provider value={{ openImageViewer }}>
      {children}
      {viewingImage && (
        <ImageModal
          imageUrl={`data:${viewingImage.mimeType};base64,${viewingImage.base64}`}
          onClose={closeImageViewer}
          onNext={canNavigate ? () => handleNav('next') : undefined}
          onPrev={canNavigate ? () => handleNav('prev') : undefined}
          canNext={canNavigate && viewingIndexInGallery < images.length - 1}
          canPrev={canNavigate && viewingIndexInGallery > 0}
        />
      )}
    </ImageViewerContext.Provider>
  );
};

export const useImageViewer = (): ImageViewerContextType => {
  const context = useContext(ImageViewerContext);
  if (context === undefined) {
    throw new Error('useImageViewer must be used within an ImageViewerProvider');
  }
  return context;
};
