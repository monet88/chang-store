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
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300 mb-2">
        {title}
      </label>

      {/* Upload Area */}
      <div
        className={`relative w-full bg-zinc-800/50 rounded-lg border-2 border-dashed transition-colors duration-300 flex items-center justify-center overflow-hidden min-h-[120px] ${
          isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700'
        } hover:border-amber-500 cursor-pointer`}
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
        <div className="text-center text-zinc-400 p-4">
          <CloudUploadIcon className="mx-auto h-10 w-10 mb-2" />
          <p className="text-sm font-medium mb-1">
            {isDragging ? t('imageUploader.drop') : t('imageUploader.upload')}
          </p>
          <p className="text-xs opacity-70">
            {t('imageUploader.fileTypes')}
          </p>
          <p className="text-xs opacity-70 mt-1">
            {maxImages
              ? t('common.selectMultipleImagesMax', { max: maxImages, count: images.length })
              : t('common.selectMultipleImages')}
          </p>
        </div>
      </div>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image, index) => {
            const preview = `data:${image.mimeType};base64,${image.base64}`;
            return (
              <div
                key={`${id}-preview-${index}`}
                className="relative aspect-square w-full bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden group"
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
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-red-500/90 transition-all duration-200 opacity-0 group-hover:opacity-100"
                  aria-label={`${t('imageUploader.removeAria')} ${index + 1}`}
                >
                  <DeleteIcon className="w-4 h-4" />
                </button>
                {/* Tag overlay - always visible for @mention reference */}
                <div className="absolute top-1 left-1 bg-black/70 text-amber-400 text-xs font-mono px-1.5 py-0.5 rounded">
                  @img{index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image count */}
      {images.length > 0 && (
        <p className="text-xs text-zinc-500 mt-2 text-center">
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
