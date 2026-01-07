import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GalleryIcon } from '../Icons';

/**
 * Props for ResultPlaceholder component
 */
interface ResultPlaceholderProps {
  /** Feature-specific description from i18n (required) */
  description: string;
  /** Override default title if needed */
  title?: string;
  /** Additional container classes for layout customization */
  className?: string;
}

/**
 * Standardized result placeholder for all features.
 *
 * Shows a centered icon, title, and description when no result is available.
 * Used consistently across VirtualTryOn, BackgroundReplacer, PoseChanger,
 * Relight, VideoGenerator, LookbookOutput, PhotoAlbumCreator, Upscale, AIEditor.
 */
const ResultPlaceholder: React.FC<ResultPlaceholderProps> = ({
  description,
  title,
  className = ''
}) => {
  const { t } = useLanguage();

  return (
    <div className={`text-center text-zinc-500 pointer-events-none p-4 ${className}`}>
      <GalleryIcon className="mx-auto h-16 w-16" />
      <h3 className="mt-4 text-base md:text-lg font-semibold text-zinc-400">
        {title || t('common.outputPanelTitle')}
      </h3>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
};

export default ResultPlaceholder;
