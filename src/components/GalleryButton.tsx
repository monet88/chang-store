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

  const galleryCountLabel = images.length > 0
    ? t(images.length === 1 ? 'gallery.itemCountSingular' : 'gallery.itemCountPlural', { count: images.length })
    : t('gallery.title');

  return (
    <button
      type="button"
      onClick={onClick}
      className="workspace-button min-w-[8.75rem] justify-start gap-3 rounded-2xl px-4 py-3 text-left"
      aria-label={t('gallery.openAria', { count: images.length })}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30">
        <GalleryIcon className="h-5 w-5" />
      </span>
      <span className="flex flex-col">
        <span className="workspace-label mb-1 block">
          {t('workspace.utility.gallery')}
        </span>
        <span className="text-sm font-medium tracking-[-0.01em]">
          {galleryCountLabel}
        </span>
      </span>
      {images.length > 0 && (
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-medium text-zinc-200">{images.length}</span>
      )}
    </button>
  );
};

export default GalleryButton;
