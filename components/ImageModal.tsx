import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-[52] p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        aria-label="Close image view"
      >
        <CloseIcon className="w-8 h-8" />
      </button>

      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          disabled={!canPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-[52] p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous image"
        >
            <BackIcon className="w-8 h-8" />
        </button>
      )}
      
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          disabled={!canNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-[52] p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next image"
        >
            <ForwardIcon className="w-8 h-8" />
        </button>
      )}

      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <img 
          src={imageUrl} 
          alt="Full screen view" 
          className="object-contain max-w-full max-h-[90vh] w-auto h-auto rounded-lg shadow-2xl" 
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ImageModal;