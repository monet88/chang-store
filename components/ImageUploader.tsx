


import React, { useState, useRef, useEffect } from 'react';
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

const ImageUploader: React.FC<ImageUploaderProps> = ({ image, onImageUpload, title, id }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isGallerySelectionOpen, setIsGallerySelectionOpen] = useState(false);
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [image]);

  const preview = image ? `data:${image.mimeType};base64,${image.base64}` : null;

  const processFile = async (file: File) => {
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
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageUpload(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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
  };

  return (
    <>
      <div className="w-full">
        <label htmlFor={id} className="block text-xs font-medium text-slate-300 mb-1">{title}</label>
        <div
          className={`relative aspect-[4/3] w-full bg-slate-800/50 rounded-lg border-2 border-dashed transition-colors duration-300 flex items-center justify-center overflow-hidden ${isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700'
            } ${!image ? 'hover:border-amber-500' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-red-500/80 transition-all duration-200"
                aria-label={t('imageUploader.removeAria')}
              >
                <DeleteIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="text-center text-slate-400 p-2 flex flex-col items-stretch justify-center h-full w-full">
              <div
                className="flex-grow flex flex-col items-center justify-center cursor-pointer"
                onClick={() => inputRef.current?.click()}
              >
                <CloudUploadIcon className="mx-auto h-8 w-8" />
                <p className="mt-1 text-xs">{isDragging ? t('imageUploader.drop') : t('imageUploader.upload')}</p>
                <p className="text-xs opacity-70">{t('imageUploader.fileTypes')}</p>
              </div>
              <div className="mt-2 w-full border-t border-slate-700/50 pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsGallerySelectionOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs bg-slate-700/80 text-slate-200 font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-700 transition-colors duration-200"
                >
                  <GalleryIcon className="w-4 h-4" />
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
};

export default ImageUploader;
