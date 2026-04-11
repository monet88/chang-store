/**
 * UpscaleSessionImageRail — Lightweight thumbnail rail for multi-image sessions.
 *
 * Shows all uploaded images as thumbnails with:
 * - Active-image emphasis (border highlight)
 * - Per-image status badge (upscaled ✓, pending ●)
 * - Upload button at the end
 *
 * Does not own state — receives session images and callbacks from parent.
 */

import React, { useRef } from 'react';
import { UpscaleSessionImage } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscaleSessionImageRailProps {
  images: UpscaleSessionImage[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
}

const UpscaleSessionImageRail: React.FC<UpscaleSessionImageRailProps> = ({
  images,
  activeId,
  onSelect,
  onUpload,
  onRemove,
}) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-zinc-700">
      {/* Thumbnail rail */}
      {images.map((img) => {
        const isActive = img.id === activeId;
        const hasResult = !!img.quickResult;

        return (
          <div key={img.id} className="relative flex-shrink-0 group">
            <button
              onClick={() => onSelect(img.id)}
              aria-label={t('upscale.selectImage')}
              aria-pressed={isActive}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                isActive
                  ? 'border-white/70 ring-1 ring-white/30 scale-105'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <img
                src={`data:${img.original.mimeType};base64,${img.original.base64}`}
                alt={t('upscale.sessionImageAlt')}
                className="w-full h-full object-cover"
              />
            </button>

            {/* Status badge */}
            {hasResult && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-md">
                ✓
              </span>
            )}

            {/* Remove button (visible on hover) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(img.id);
              }}
              aria-label={t('upscale.removeImage')}
              className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-red-500/90 rounded-full items-center justify-center text-[10px] text-white font-bold shadow-md hidden group-hover:flex transition-opacity"
            >
              ×
            </button>
          </div>
        );
      })}

      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        aria-label={t('upscale.addImage')}
        className="w-16 h-16 flex-shrink-0 rounded-lg border-2 border-dashed border-zinc-700 hover:border-white/40 flex items-center justify-center text-zinc-500 hover:text-zinc-100 transition-all duration-200"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default UpscaleSessionImageRail;
