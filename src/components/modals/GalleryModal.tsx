/**
 * Gallery Modal Component
 *
 * Displays saved gallery images in a fullscreen modal.
 */

import React, { useEffect } from 'react';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import HoverableImage from '../HoverableImage';
import { useLanguage } from '../../contexts/LanguageContext';
import { CloseIcon, GalleryIcon } from '../Icons';

// ============================================================================
// Types
// ============================================================================

interface GalleryModalProps {
  onClose: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

const GalleryModal: React.FC<GalleryModalProps> = ({ onClose }) => {
  const {
    images,
    deleteImage,
    clearImages,
  } = useImageGallery();
  const { t } = useLanguage();

  // --- Keyboard and scroll lock ---
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  // --- Clear all handler ---
  const handleClearAll = () => {
    if (window.confirm(t('gallery.clearAllConfirmation', { count: images.length }))) {
      clearImages();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-modal-backdrop flex flex-col p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 text-white w-full max-w-7xl mx-auto flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl md:text-2xl font-bold">
            {t('gallery.title')} ({images.length})
          </h2>

          {images.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-red-400 hover:text-red-300 bg-red-900/50 hover:bg-red-900/80 px-3 py-1.5 rounded-md transition-colors"
            >
              {t('gallery.clearAll')}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          aria-label={t('gallery.closeAria')}
        >
          <CloseIcon className="w-8 h-8" />
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-grow overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300">
                <GalleryIcon className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-medium tracking-[-0.02em] text-zinc-50">
                {t('gallery.emptyHeading')}
              </h3>
              <p className="text-base leading-7 text-zinc-400">
                {t('gallery.emptyDescription')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
            {images.map((image, index) => (
              <div key={`${index}-${image.base64.substring(0, 20)}`} className="relative">
                <div className="rounded-lg overflow-hidden">
                  <HoverableImage
                    image={image}
                    altText={t('gallery.altText', { index: index + 1 })}
                    downloadFileName={`gallery-image-${index + 1}`}
                    onDelete={() => deleteImage(image.base64)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryModal;
