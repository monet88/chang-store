import React, { useCallback } from 'react';
import { ImageFile } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useImageViewer } from '../../../contexts/ImageViewerContext';
import { downloadImageAsJpeg } from '../../../utils/imageDownload';
import { DownloadIcon, FullscreenIcon } from '../../Icons';

interface ProviderResultsGridProps {
  results: ImageFile[];
  downloadPrefix?: string;
}

/**
 * Local-only results grid for provider studios. Displays generated images with
 * view + download actions. Intentionally has NO gallery context integration —
 * provider results never persist to the Gemini gallery.
 */
const ProviderResultsGrid: React.FC<ProviderResultsGridProps> = ({
  results,
  downloadPrefix = 'provider-image',
}) => {
  const { t } = useLanguage();
  const { openImageViewer } = useImageViewer();

  const handleDownload = useCallback(
    (image: ImageFile, index: number) => {
      void downloadImageAsJpeg(image, { prefix: downloadPrefix, index: index + 1 });
    },
    [downloadPrefix],
  );

  if (results.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label={t('studio.provider.results.label')}
    >
      {results.map((image, index) => {
        const src = `data:${image.mimeType};base64,${image.base64}`;
        return (
          <div
            key={`${image.base64.slice(0, 16)}-${index}`}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50"
          >
            <img
              src={src}
              alt={t('studio.provider.results.alt', { index: index + 1 })}
              className="aspect-[4/5] w-full cursor-pointer object-cover"
              onClick={() => openImageViewer(image)}
            />
            <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-2 bg-black/40 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => openImageViewer(image)}
                className="pointer-events-auto rounded-full bg-zinc-900/70 p-2 text-white transition-colors hover:bg-zinc-800"
                aria-label={t('studio.provider.results.view')}
              >
                <FullscreenIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleDownload(image, index)}
                className="pointer-events-auto rounded-full bg-white p-2 text-black transition-colors hover:bg-zinc-200"
                aria-label={t('studio.provider.results.download')}
              >
                <DownloadIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProviderResultsGrid;
