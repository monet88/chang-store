

import React, { useEffect } from 'react';
import { ImageFile } from '../../types';
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { CloseIcon } from '../Icons';

interface ImageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: ImageFile) => void;
}

const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { images } = useImageGallery();
    const { t } = useLanguage();

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);
    
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="flex justify-between items-center p-4 text-white w-full max-w-7xl mx-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold">{t('imageSelectionModal.title')} ({images.length})</h2>
                <button onClick={onClose} className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors" aria-label={t('gallery.closeAria')}>
                    <CloseIcon className="w-8 h-8" />
                </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
                {images.length === 0 ? (
                    <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-xl">{t('gallery.emptyMessage')}</p></div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
                        {images.map((image, index) => (
                           <button
                                key={`${index}-${image.base64.substring(0, 20)}`}
                                onClick={() => onSelect(image)}
                                className="aspect-square bg-slate-800 rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-500 transition-transform transform hover:scale-105"
                                aria-label={`${t('imageSelectionModal.select')} ${t('gallery.altText', { index: index + 1 })}`}
                            >
                                <img src={`data:${image.mimeType};base64,${image.base64}`} alt={t('gallery.altText', { index: index + 1 })} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white font-bold">{t('imageSelectionModal.select')}</span>
                                </div>
                           </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageSelectionModal;