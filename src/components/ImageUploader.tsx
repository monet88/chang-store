


import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CloudUploadIcon, DeleteIcon, GalleryIcon } from './Icons';
import { processUploadImageFile, processMultipleImageFiles } from '../utils/imageUtils';
import ImageSelectionModal from './modals/ImageSelectionModal';

interface ImageUploaderProps {
  image: ImageFile | null;
  onImageUpload: (file: ImageFile | null) => void;
  /** Enables multi-select and batch upload; the single prop drives both the input and the routing. */
  onMultipleImagesUpload?: (files: ImageFile[]) => void;
  title: string;
  /** Keep the title accessible without rendering a duplicate visible heading */
  hideTitle?: boolean;
  id: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = React.memo(({
  image,
  onImageUpload,
  onMultipleImagesUpload,
  title,
  hideTitle = false,
  id,
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


  /**
   * One routing rule for every file entry point (picker and drag & drop):
   * a multi-file selection goes to the batch handler, anything else to the
   * single-image handler.
   */
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    if (onMultipleImagesUpload && fileList.length > 1) {
      const processed = await processMultipleImageFiles(Array.from(fileList));
      if (processed.length > 0) onMultipleImagesUpload(processed);
      return;
    }

    const file = fileList[0];
    if (!file) return;
    const res = await processUploadImageFile(file);
    if (res) onImageUpload(res);
  }, [onImageUpload, onMultipleImagesUpload]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
  }, [handleFiles]);

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

    await handleFiles(fileList);

    // Mirror a single dropped file into the hidden input so the picker stays in sync.
    if (fileList.length === 1 && fileList[0] && inputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(fileList[0]);
      inputRef.current.files = dataTransfer.files;
    }
  }, [handleFiles]);

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
            multiple={Boolean(onMultipleImagesUpload)}
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
