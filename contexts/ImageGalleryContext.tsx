

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { ImageFile } from '../types';

interface ImageGalleryContextType {
  images: ImageFile[];
  addImage: (image: ImageFile) => void;
  deleteImage: (base64: string) => void;
  clearImages: () => void;
}

const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(undefined);

const GALLERY_SIZE_LIMIT = 20;

export const ImageGalleryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageFile[]>([]);

  const addImage = (image: ImageFile) => {
    setImages(prevImages => {
      if (prevImages.some(img => img.base64 === image.base64)) {
        return prevImages;
      }
      const newImages = [image, ...prevImages];
      return newImages.slice(0, GALLERY_SIZE_LIMIT);
    });
  };
  
  const deleteImage = (base64: string) => {
    setImages(prevImages => prevImages.filter(img => img.base64 !== base64));
  };

  const clearImages = () => {
    setImages([]);
  };

  return (
    <ImageGalleryContext.Provider value={{ images, addImage, deleteImage, clearImages }}>
      {children}
    </ImageGalleryContext.Provider>
  );
};

export const useImageGallery = (): ImageGalleryContextType => {
  const context = useContext(ImageGalleryContext);
  if (context === undefined) {
    throw new Error('useImageGallery must be used within an ImageGalleryProvider');
  }
  return context;
};