


import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CloudUploadIcon, DeleteIcon, GalleryIcon } from './Icons';
import { compressImage, validateImageFile } from '../utils/imageUtils';
import ImageSelectionModal from './modals/ImageSelectionModal';

interface ImageUploaderProps {
  image: ImageFile | null;
  onImageUpload: (file: ImageFile | null) => void;
  onMultipleImagesUpload?: (files: ImageFile[]) => void;
  title: string;
  /** Keep the title accessible without rendering a duplicate visible heading */
  hideTitle?: boolean;
  id: string;
  allowMultiple?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = React.memo(({
  image,
  onImageUpload,
  onMultipleImagesUpload,
  title,
  hideTitle = false,
  id,
  allowMultiple = false,
}) => {
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

  // Helper to convert a single File to ImageFile
  const convertFile = useCallback(async (file: File): Promise<ImageFile | null> => {
    const validation = await validateImageFile(file);
    if (!validation.isValid) {
      if (import.meta.env.DEV) {
        console.error("Upload validation failed:", validation.errorKey);
      }
      return null;
    }

    try {
      return await compressImage(file);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error compressing image, falling back to original file:", error);
      }
      return new Promise<ImageFile>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64String = reader.result.substring(reader.result.indexOf(',') + 1);
            resolve({ base64: base64String, mimeType: file.type });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }, []);

  // Memoize processFile - prevents re-creation on every render
  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    const res = await convertFile(file);
    if (res) {
      onImageUpload(res);
    }
  }, [convertFile, onImageUpload]);

  const processMultipleFiles = useCallback(async (files: File[]) => {
    if (!onMultipleImagesUpload || files.length === 0) return;
    const processed: ImageFile[] = [];
    for (const file of files) {
      const res = await convertFile(file);
      if (res) {
        processed.push(res);
      }
    }
    if (processed.length > 0) {
      onMultipleImagesUpload(processed);
    }
  }, [convertFile, onMultipleImagesUpload]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    if ((allowMultiple || onMultipleImagesUpload) && fileList.length > 1 && onMultipleImagesUpload) {
      await processMultipleFiles(Array.from(fileList));
      return;
    }

    const file = fileList[0];
    if (file) {
      processFile(file);
    }
  }, [allowMultiple, onMultipleImagesUpload, processMultipleFiles, processFile]);

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

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    if ((allowMultiple || onMultipleImagesUpload) && fileList.length > 1 && onMultipleImagesUpload) {
      await processMultipleFiles(Array.from(fileList));
      return;
    }

    const file = fileList[0];
    if (file) {
      processFile(file);
      if (inputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputRef.current.files = dataTransfer.files;
      }
    }
  }, [allowMultiple, onMultipleImagesUpload, processMultipleFiles, processFile]);

  return (
    <>
      <div className="w-full">
        <label htmlFor={id} className={hideTitle ? 'sr-only' : 'mb-1.5 block text-xs font-semibold text-zinc-100'}>{title}</label>
        <div
          className={`relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-black/35 transition-colors duration-200 ${isDragging ? 'border-white/40 bg-white/[0.08]' : 'border-white/12'
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
            multiple={Boolean(allowMultiple || onMultipleImagesUpload)}
            className="hidden"
            onChange={handleFileChange}
          />
          {preview ? (
            <>
              <img src={preview} alt="Preview" className="object-contain h-full w-full" />
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 rounded-full border border-white/10 bg-black/60 p-1.5 text-white transition-all duration-150 hover:bg-red-500/80"
                aria-label={t('imageUploader.removeAria')}
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2.5 text-center text-zinc-400">
              <div
                className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                role="img"
                aria-label={isDragging ? t('imageUploader.drop') : t('imageUploader.upload')}
              >
                <CloudUploadIcon className="mx-auto h-6 w-6 text-zinc-300" />
              </div>
              <div className="flex w-full justify-center border-t border-white/10 pt-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsGallerySelectionOpen(true);
                  }}
                  className="flex min-h-[28px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-zinc-100 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.1]"
                >
                  <GalleryIcon className="h-3 w-3" />
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
