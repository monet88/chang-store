


import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { CloseIcon, CloudUploadIcon, DeleteIcon, GalleryIcon } from './Icons';
import { compressImage } from '../utils/imageUtils';
import ImageSelectionModal from './modals/ImageSelectionModal';

interface ImageUploaderProps {
  image: ImageFile | null;
  onImageUpload: (file: ImageFile | null) => void;
  title: string;
  id: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = React.memo(({ image, onImageUpload, title, id }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isGallerySelectionOpen, setIsGallerySelectionOpen] = useState(false);
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (!image && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [image]);

  // Memoize preview calculation - prevents re-computation on every render
  const preview = useMemo(
    () => (image ? `data:${image.mimeType};base64,${image.base64}` : null),
    [image?.base64, image?.mimeType]
  );

  // Memoize processFile - prevents re-creation on every render
  const processFile = useCallback(async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      try {
        const compressedImage = await compressImage(file);
        onImageUpload(compressedImage);
      } catch (error) {
        console.error("Error compressing image, falling back to original file:", error);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64String = reader.result.split(',')[1];
            onImageUpload({ base64: base64String, mimeType: file.type });
          }
        };
        reader.onerror = (err) => {
          console.error("FileReader error on fallback:", err);
        };
        reader.readAsDataURL(file);
      }
    }
  }, [onImageUpload]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onImageUpload(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
      if (inputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputRef.current.files = dataTransfer.files;
      }
    }
  }, [processFile]);

  return (
    <>
      <div className="w-full">
        <label htmlFor={id} className="mb-2 block text-base font-semibold text-zinc-100">{title}</label>
        <div
          className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[24px] border border-dashed bg-black/35 transition-colors duration-300 ${isDragging ? 'border-white/40 bg-white/[0.08]' : 'border-white/12'
            } ${!image ? 'cursor-pointer hover:border-white/30 hover:bg-white/[0.04]' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !image && inputRef.current?.click()}
        >
          <input
            id={id}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {preview ? (
            <>
              <img src={preview} alt="Preview" className="object-contain h-full w-full" />
              <button
                onClick={handleClear}
                className="absolute top-3 right-3 rounded-full border border-white/10 bg-black/60 p-2 text-white transition-all duration-200 hover:bg-red-500/80"
                aria-label={t('imageUploader.removeAria')}
              >
                <DeleteIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-3 text-center text-zinc-400">
              <div
                className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                aria-label={isDragging ? t('imageUploader.drop') : t('imageUploader.upload')}
              >
                <CloudUploadIcon className="mx-auto h-10 w-10 text-zinc-300" />
              </div>
              <div className="flex w-full justify-center border-t border-white/10 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsGallerySelectionOpen(true);
                  }}
                  className="flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-zinc-100 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.1]"
                >
                  <GalleryIcon className="h-3.5 w-3.5" />
                  <span>{t('imageUploader.selectFromGallery')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {isGallerySelectionOpen && (
        <ImageSelectionModal
          isOpen={isGallerySelectionOpen}
          onClose={() => setIsGallerySelectionOpen(false)}
          onSelect={(selectedImage) => {
            onImageUpload(selectedImage);
            setIsGallerySelectionOpen(false);
          }}
        />
      )}
    </>
  );
});

// Add displayName for debugging
ImageUploader.displayName = 'ImageUploader';

export default ImageUploader;
