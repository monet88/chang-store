/**
 * LookbookOutput - Display generated lookbook images with tabs
 *
 * Extracted from LookbookGenerator.tsx for better separation of concerns.
 * Memoized to prevent re-renders when form changes.
 */

import React, { useCallback } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import HoverableImage from './HoverableImage';
import Spinner, { ErrorDisplay } from './Spinner';
import Tooltip from './Tooltip';
import ResultPlaceholder from './shared/ResultPlaceholder';

/**
 * Lookbook set interface
 */
export interface LookbookSet {
  main: ImageFile;
  variations: ImageFile[];
  closeups: ImageFile[];
}

/**
 * Output tab type
 */
type OutputTab = 'main' | 'variations' | 'closeup';

/**
 * Props for LookbookOutput component
 */
interface LookbookOutputProps {
  lookbook: LookbookSet | null;
  activeTab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  onUpscale: (image: ImageFile, imageKey: string) => void;
  onGenerateVariations: () => void;
  onGenerateCloseUp: () => void;
  upscalingStates: Record<string, boolean>;
  isGeneratingVariations: boolean;
  isGeneratingCloseUp: boolean;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  onClearError: () => void;
  variationCount: number;
  onVariationCountChange: (count: number) => void;
}

/**
 * LookbookOutput component
 * Displays generated lookbook images with tabs for main, variations, and close-ups
 */
export const LookbookOutput = React.memo<LookbookOutputProps>(({
  lookbook,
  activeTab,
  onTabChange,
  onUpscale,
  onGenerateVariations,
  onGenerateCloseUp,
  upscalingStates,
  isGeneratingVariations,
  isGeneratingCloseUp,
  isLoading,
  loadingMessage,
  error,
  onClearError,
  variationCount,
  onVariationCountChange
}) => {
  const { t } = useLanguage();

  const handleVariationCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onVariationCountChange(Number(e.target.value));
  }, [onVariationCountChange]);

  const outputContainerClasses = `relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-2 sm:p-4 min-h-[50vh] lg:min-h-0 lg:aspect-[4/5] flex flex-col ${
    lookbook ? '' : 'items-center justify-center'
  }`;

  const outputTabs: { id: OutputTab; label: string }[] = [
    { id: 'main', label: t('lookbook.tabGeneratedImage') },
    { id: 'variations', label: t('lookbook.tabVariations') },
    { id: 'closeup', label: t('lookbook.tabCloseup') },
  ];

  // Loading state
  if (isLoading || isGeneratingVariations || isGeneratingCloseUp) {
    return (
      <div className="sticky top-8">
        <div className={outputContainerClasses}>
          <div className="flex flex-col items-center justify-center gap-4 text-center h-full">
            <Spinner />
            <p className="text-zinc-400">{loadingMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="sticky top-8">
        <div className={outputContainerClasses}>
          <div className="p-4 w-full h-full flex items-center justify-center">
            <ErrorDisplay
              title={t('common.generationFailed')}
              message={error}
              onClear={onClearError}
            />
          </div>
        </div>
      </div>
    );
  }

  // No lookbook generated yet
  if (!lookbook) {
    return (
      <div className="sticky top-8">
        <div className={outputContainerClasses}>
          <ResultPlaceholder description={t('lookbook.outputPanelDescription')} />
        </div>
      </div>
    );
  }

  // Lookbook available - show tabs and content
  return (
    <div className="sticky top-8">
      <div className={outputContainerClasses}>
        <div className="flex flex-col h-full gap-4">
          {/* Tabs */}
          <div className="flex-shrink-0 flex justify-center border-b border-zinc-700">
            {outputTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className={`flex-grow relative ${activeTab === 'main' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {/* Main Tab */}
            {activeTab === 'main' && (
              <div className="animate-fade-in">
                <HoverableImage
                  image={lookbook.main}
                  altText={t('lookbook.tabGeneratedImage')}
                  onUpscale={() => onUpscale(lookbook.main, 'main')}
                  isUpscaling={upscalingStates['main']}
                />
              </div>
            )}

            {/* Variations Tab */}
            {activeTab === 'variations' && (
              <div className="animate-fade-in flex flex-col gap-4">
                <div className="flex items-center justify-center gap-4">
                  <label htmlFor="variation-slider" className="text-sm text-zinc-300">
                    {t('lookbook.variationsLabel')}:
                  </label>
                  <input
                    id="variation-slider"
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={variationCount}
                    onChange={handleVariationCountChange}
                  />
                  <span className="bg-zinc-700 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center text-sm">
                    {variationCount}
                  </span>
                  <Tooltip content={t('tooltips.lookbookVariations')} position="bottom">
                    <button
                      onClick={onGenerateVariations}
                      disabled={isGeneratingVariations || isGeneratingCloseUp}
                      className="bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:bg-zinc-600"
                    >
                      {isGeneratingVariations ? <Spinner /> : t('lookbook.generateVariationsButton')}
                    </button>
                  </Tooltip>
                </div>
                {lookbook.variations.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {lookbook.variations.map((img, i) => (
                      <HoverableImage
                        key={i}
                        image={img}
                        altText={t('lookbook.variationAltText', { index: i + 1 })}
                        onUpscale={() => onUpscale(img, `var-${i}`)}
                        isUpscaling={upscalingStates[`var-${i}`]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-zinc-500 p-8">
                    <h4 className="font-semibold">{t('lookbook.variationsPlaceholderTitle')}</h4>
                    <p className="text-xs mt-1">{t('lookbook.variationsPlaceholderDescription')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Close-up Tab */}
            {activeTab === 'closeup' && (
              <div className="animate-fade-in flex flex-col gap-4">
                <div className="text-center">
                  <Tooltip content={t('tooltips.lookbookCloseups')} position="bottom">
                    <button
                      onClick={onGenerateCloseUp}
                      disabled={isGeneratingCloseUp || isGeneratingVariations}
                      className="bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:bg-zinc-600"
                    >
                      {isGeneratingCloseUp ? <Spinner /> : t('lookbook.generateCloseUpButton')}
                    </button>
                  </Tooltip>
                </div>
                {lookbook.closeups.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {lookbook.closeups.map((img, i) => (
                      <HoverableImage
                        key={i}
                        image={img}
                        altText={t('lookbook.closeUpAltText', { index: i + 1 })}
                        onUpscale={() => onUpscale(img, `close-${i}`)}
                        isUpscaling={upscalingStates[`close-${i}`]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-zinc-500 p-8">
                    <h4 className="font-semibold">{t('lookbook.closeupPlaceholderTitle')}</h4>
                    <p className="text-xs mt-1">{t('lookbook.closeupPlaceholderDescription')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

LookbookOutput.displayName = 'LookbookOutput';
