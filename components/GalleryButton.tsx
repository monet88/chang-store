

import React from 'react';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GalleryIcon } from './Icons';

interface GalleryButtonProps {
    onClick: () => void;
}

const GalleryButton: React.FC<GalleryButtonProps> = ({ onClick }) => {
    const { images } = useImageGallery();
    const { t } = useLanguage();

    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 z-40 bg-amber-600 text-white rounded-full p-4 shadow-lg shadow-amber-500/30 hover:bg-amber-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-amber-500 flex items-center justify-center gap-2 transform hover:scale-105"
            aria-label={t('gallery.openAria', { count: images.length })}
        >
            <GalleryIcon className="w-7 h-7" />
            {images.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-slate-950">
                    {images.length}
                </span>
            )}
        </button>
    );
};

export default GalleryButton;
