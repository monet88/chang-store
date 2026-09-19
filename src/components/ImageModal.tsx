import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { BackIcon, CloseIcon, ForwardIcon } from './Icons';

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  canNext?: boolean;
  canPrev?: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose, onNext, onPrev, canNext, canPrev }) => {
  const { t } = useLanguage();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight' && onNext && canNext) {
        onNext();
      } else if (event.key === 'ArrowLeft' && onPrev && canPrev) {
        onPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onNext, onPrev, canNext, canPrev]);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/80 z-modal-backdrop flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('imageViewer.fullScreen')}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-modal p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        aria-label={t('imageViewer.close')}
      >
        <CloseIcon className="w-8 h-8" />
      </button>

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          disabled={!canPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-modal p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label={t('imageViewer.prev')}
        >
          <BackIcon className="w-8 h-8" />
        </button>
      )}

      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          disabled={!canNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-modal p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label={t('imageViewer.next')}
        >
          <ForwardIcon className="w-8 h-8" />
        </button>
      )}

      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt={t('imageViewer.fullScreen')}
          loading="lazy"
          decoding="async"
          className="object-contain max-w-full max-h-[90vh] w-auto h-auto rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ImageModal;
