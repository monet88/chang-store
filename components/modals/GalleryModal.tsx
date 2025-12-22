import React, { useState, useEffect } from 'react';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import HoverableImage from '../HoverableImage';
import { useLanguage } from '../../contexts/LanguageContext';
import { ImageFile } from '../../types';
import { CloseIcon } from '../Icons';

interface GalleryModalProps {
  onClose: () => void;
  onEditImage: (image: ImageFile) => void;
}

const GalleryModal: React.FC<GalleryModalProps> = ({ onClose, onEditImage }) => {
    const { images, deleteImage, clearImages } = useImageGallery();
    const { t } = useLanguage();

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
            <div className="flex justify-between items-center p-4 text-white w-full max-w-7xl mx-auto flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">{t('gallery.title')} ({images.length})</h2>
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
            <div
                className="flex-grow overflow-y-auto p-4"
                onClick={(e) => e.stopPropagation()}
            >
                {images.length === 0 ? (
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
                                        downloadFileName={`gallery-image-${index + 1}.png`}
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
