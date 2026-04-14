/**
 * MultiImageUploader - Component for uploading multiple images at once
 *
 * Features:
 * - Multiple file selection via file input
 * - Drag and drop multiple files
 * - Preview grid of uploaded images
 * - Individual image removal
 * - Automatic image compression
 */

import React, { useState, useRef, useCallback } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CloudUploadIcon, DeleteIcon } from './Icons';
import { compressImage } from '../utils/imageUtils';

/**
 * Props for MultiImageUploader component
 */
interface MultiImageUploaderProps {
  /** Array of uploaded images */
  images: ImageFile[];
  /** Callback when images are uploaded */
  onImagesUpload: (files: ImageFile[]) => void;
  /** Title for the uploader */
  title: string;
  /** Keep the title accessible without rendering a duplicate visible heading */
  hideTitle?: boolean;
  /** Unique ID for the component */
  id: string;
  /** Maximum number of images allowed (optional) */
  maxImages?: number;
}

/**
 * MultiImageUploader component
 * Handles uploading multiple images at once via file input or drag & drop
 */
const MultiImageUploader: React.FC<MultiImageUploaderProps> = React.memo(({
  images,
  onImagesUpload,
  title,
  hideTitle = false,
  id,
  maxImages
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  /**
   * Process multiple files and convert to ImageFile format
   * Compresses each image before adding to the list
   */
  const processFiles = useCallback(async (fileList: FileList) => {
    const files = Array.from(fileList);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    // Check max images limit
    if (maxImages && images.length + imageFiles.length > maxImages) {
      console.warn(`Maximum ${maxImages} images allowed`);
      return;
    }

    try {
      // Process all images in parallel
      const processedImages = await Promise.all(
        imageFiles.map(async (file) => {
          try {
            return await compressImage(file);
          } catch (error) {
            console.error("Error compressing image, falling back to original:", error);
            // Fallback to original file if compression fails
            return new Promise<ImageFile>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  const base64String = reader.result.split(',')[1];
                  resolve({ base64: base64String, mimeType: file.type });
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }
        })
      );

      // Add new images to existing images
      onImagesUpload([...images, ...processedImages]);
    } catch (error) {
      console.error("Error processing images:", error);
    }
  }, [images, onImagesUpload, maxImages]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
      processFiles(fileList);
    }
    // Reset input value to allow re-uploading the same files
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [processFiles]);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  /**
   * Handle drop event for drag & drop upload
   */
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const fileList = e.dataTransfer.files;
    if (fileList && fileList.length > 0) {
      processFiles(fileList);
    }
  }, [processFiles]);

  /**
   * Remove a specific image from the list
   */
  const handleRemoveImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesUpload(newImages);
  }, [images, onImagesUpload]);

  /**
   * Open file selector
   */
  const handleClickUpload = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      <label htmlFor={id} className={hideTitle ? 'sr-only' : 'mb-2 block text-base font-semibold text-zinc-100'}>
        {title}
      </label>

      {/* Upload Area */}
      <div
        className={`relative flex min-h-[11rem] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[24px] border border-dashed bg-black/35 transition-colors duration-300 ${
          isDragging ? 'border-white/40 bg-white/[0.08]' : 'border-white/12'
        } hover:border-white/30 hover:bg-white/[0.04]`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
      >
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center text-zinc-400">
          <div
            className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
            aria-label={isDragging ? t('imageUploader.drop') : t('imageUploader.upload')}
          >
            <CloudUploadIcon className="mx-auto h-10 w-10 text-zinc-300" />
          </div>
          <p className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            {maxImages
              ? t('common.selectMultipleImagesMax', { max: maxImages, count: images.length })
              : t('common.selectMultipleImages')}
          </p>
        </div>
      </div>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => {
            const preview = `data:${image.mimeType};base64,${image.base64}`;
            return (
              <div
                key={`${id}-preview-${index}`}
                className="group relative aspect-square w-full overflow-hidden rounded-[18px] border border-white/10 bg-black/30"
              >
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="object-cover h-full w-full"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(index);
                  }}
                  className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/60 p-1.5 text-white opacity-0 transition-all duration-200 hover:bg-red-500/80 group-hover:opacity-100"
                  aria-label={`${t('imageUploader.removeAria')} ${index + 1}`}
                >
                  <DeleteIcon className="w-4 h-4" />
                </button>
                {/* Tag overlay - always visible for @mention reference */}
                <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/70 px-2 py-0.5 font-mono text-[10px] text-zinc-100">
                  @img{index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image count */}
      {images.length > 0 && (
        <p className="mt-2 text-center text-xs text-zinc-500">
          {maxImages
            ? t('common.imagesCount', { count: images.length, max: maxImages })
            : t('common.imagesSelected', { count: images.length })}
        </p>
      )}
    </div>
  );
});

// Add displayName for debugging
MultiImageUploader.displayName = 'MultiImageUploader';

export default MultiImageUploader;
