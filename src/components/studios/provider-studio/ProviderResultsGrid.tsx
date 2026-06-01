import React, { useCallback } from 'react';
import { ImageFile, UpscaleQuality } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useImageViewer } from '../../../contexts/ImageViewerContext';
import { downloadImageAsJpeg } from '../../../utils/imageDownload';
import ProviderResultTile from './ProviderResultTile';

interface ProviderResultsGridProps {
  results: ImageFile[];
  downloadPrefix?: string;
  /** Index currently running a post-generation action, or null. */
  busyIndex?: number | null;
  /** When false, tiles render view/download only (no refine/upscale/regen). */
  showActions?: boolean;
  onRefine?: (index: number, instruction: string) => void;
  onUpscale?: (index: number, quality: UpscaleQuality) => void;
  onRegenerate?: (index: number) => void;
}

const noop = () => { };

/**
 * Local-only results grid for provider studios. Displays generated images with
 * view + download actions and the Phase 4 per-tile post-generation tools.
 * Intentionally has NO gallery context integration — provider results never
 * persist to the Gemini gallery.
 */
const ProviderResultsGrid: React.FC<ProviderResultsGridProps> = ({
  results,
  downloadPrefix = 'provider-image',
  busyIndex = null,
  showActions = false,
  onRefine = noop,
  onUpscale = noop,
  onRegenerate = noop,
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
      {results.map((image, index) => (
        <ProviderResultTile
          key={`${image.base64.slice(0, 16)}-${index}`}
          image={image}
          index={index}
          busy={busyIndex === index}
          hasActions={showActions}
          onView={openImageViewer}
          onDownload={handleDownload}
          onRefine={onRefine}
          onUpscale={onUpscale}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
};

export default ProviderResultsGrid;
