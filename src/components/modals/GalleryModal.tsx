/**
 * Gallery Modal Component
 *
 * Displays saved images in a fullscreen modal with sync status indicator.
 * Shows loading state when fetching from Google Drive.
 */

import React, { useEffect } from 'react';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import { useGoogleDrive } from '../../contexts/GoogleDriveContext';
import HoverableImage from '../HoverableImage';
import { useLanguage } from '../../contexts/LanguageContext';
import { ImageFile } from '../../types';
import { CloseIcon, CloudIcon, CheckCircleIcon, WarningIcon, RefreshIcon } from '../Icons';
import Spinner from '../Spinner';

// ============================================================================
// Types
// ============================================================================

interface GalleryModalProps {
  onClose: () => void;
  onEditImage: (image: ImageFile) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Loading skeleton shown during Drive fetch */
const GalleryLoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
    {Array.from({ length: 12 }).map((_, i) => (
      <div
        key={i}
        className="aspect-square bg-slate-700/50 rounded-lg animate-pulse"
      />
    ))}
  </div>
);

/** Sync status pill shown in header when connected to Drive */
const SyncStatusPill: React.FC<{
  syncStatus: string;
  isLoading: boolean;
  syncError: string | null;
  t: (key: string) => string;
}> = ({ syncStatus, isLoading, syncError, t }) => {
  // Determine icon and color based on status
  const renderIcon = () => {
    if (isLoading || syncStatus === 'syncing') {
      return <Spinner />;
    }
    if (syncStatus === 'error' || syncError) {
      return <WarningIcon className="w-3.5 h-3.5 text-red-400" />;
    }
    if (syncStatus === 'synced') {
      return <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" />;
    }
    return <CloudIcon className="w-3.5 h-3.5 text-slate-400" />;
  };

  const getStatusText = (): string => {
    if (isLoading) return t('googleDrive.status.syncing');
    return t(`googleDrive.status.${syncStatus}`);
  };

  const getBgColor = (): string => {
    if (syncStatus === 'error' || syncError) return 'bg-red-900/50';
    if (syncStatus === 'synced') return 'bg-green-900/50';
    if (syncStatus === 'syncing' || isLoading) return 'bg-amber-900/50';
    return 'bg-slate-700/50';
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${getBgColor()}`}>
      {renderIcon()}
      <span className="text-slate-200">{getStatusText()}</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const GalleryModal: React.FC<GalleryModalProps> = ({ onClose, onEditImage }) => {
  const {
    images,
    deleteImage,
    clearImages,
    syncStatus,
    syncError,
    isLoadingFromDrive,
  } = useImageGallery();
  const { isConnected } = useGoogleDrive();
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
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col p-4 animate-fade-in"
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

          {/* Sync status pill - only show when connected */}
          {isConnected && (
            <SyncStatusPill
              syncStatus={syncStatus}
              isLoading={isLoadingFromDrive}
              syncError={syncError}
              t={t}
            />
          )}

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
        {/* Loading state */}
        {isLoadingFromDrive ? (
          <GalleryLoadingSkeleton />
        ) : images.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-xl">{t('gallery.emptyMessage')}</p>
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
                    onEdit={() => onEditImage(image)}
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
