/**
 * LookbookOutput - Display generated lookbook images with tabs
 *
 * Extracted from LookbookGenerator.tsx for better separation of concerns.
 * Memoized to prevent re-renders when form changes.
 */

import React, { useCallback } from 'react';
import { Feature, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import HoverableImage from './HoverableImage';
import Spinner, { ErrorDisplay } from './Spinner';
import Tooltip from './Tooltip';
import ResultPlaceholder from './shared/ResultPlaceholder';
import RefinementInput from './shared/RefinementInput';
import { RefinementHistoryItem } from '../services/imageEditingService';

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
  refinementHistory: RefinementHistoryItem[];
  refinementVersions: Array<{ image: ImageFile; prompt: string; timestamp: number }>;
  selectedVersionIndex: number;
  originalImage: ImageFile | null;
  onSelectVersion: (index: number) => void;
  isRefining: boolean;
  onRefineImage: (prompt: string) => void;
  onResetRefinement: () => void;
  onSendToFeature?: (image: ImageFile) => void;
  onDownloadAll: () => void;
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
  onVariationCountChange,
  refinementHistory,
  refinementVersions,
  selectedVersionIndex,
  originalImage,
  onSelectVersion,
  isRefining,
  onRefineImage,
  onResetRefinement,
  onSendToFeature,
  onDownloadAll
}) => {
  const { t } = useLanguage();

  const handleVariationCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onVariationCountChange(Number(e.target.value));
  }, [onVariationCountChange]);

  const outputContainerClasses = `relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-2 sm:p-4 min-h-[50vh] flex flex-col ${
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
          <div className="flex-shrink-0 flex justify-center items-center border-b border-zinc-800 pb-2 relative">
            <div className="flex p-1 bg-zinc-900/80 rounded-xl border border-zinc-800">
              {outputTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={onDownloadAll}
              title={t('common.downloadAll')}
              className="absolute right-0 top-1 text-xs text-amber-500 hover:text-amber-400 border border-amber-500/30 hover:border-amber-400/50 rounded-lg px-3 py-1.5 transition-colors"
            >
              ↓
            </button>
          </div>

          {/* Tab Content */}
          <div className={`flex-grow relative ${activeTab === 'main' ? 'overflow-visible' : 'overflow-y-auto'}`}>
            {/* Main Tab */}
            {activeTab === 'main' && (
              <div className="animate-fade-in flex flex-col gap-4">
                <div className="relative w-full aspect-[4/5] max-h-[70vh] mx-auto">
                  <HoverableImage
                    image={lookbook.main}
                    altText={t('lookbook.tabGeneratedImage')}
                    downloadPrefix={Feature.Lookbook}
                    onUpscale={() => onUpscale(lookbook.main, 'main')}
                    isUpscaling={upscalingStates['main']}
                    onSendToFeature={onSendToFeature ? () => onSendToFeature(lookbook.main) : undefined}
                    containerClassName="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-zinc-800"
                  />
                </div>
                <RefinementInput
                  onRefine={onRefineImage}
                  onReset={onResetRefinement}
                  history={refinementHistory}
                  isRefining={isRefining}
                  disabled={!lookbook?.main}
                />
                
                {/* Version History Picker */}
                {refinementVersions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-zinc-400 font-medium">{t('generatedImage.versionHistory')}</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {/* Original version */}
                      <button
                        onClick={() => onSelectVersion(-1)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedVersionIndex === -1 
                            ? 'border-amber-500 ring-2 ring-amber-500/30' 
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                        title={t('generatedImage.originalVersion')}
                      >
                        {originalImage && (
                          <img
                            src={`data:${originalImage.mimeType};base64,${originalImage.base64}`}
                            alt="Original"
                            className="w-full h-full object-cover opacity-50"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-[10px] text-white font-medium">Original</span>
                        </div>
                      </button>
                      
                      {/* Refined versions */}
                      {refinementVersions.map((version, index) => (
                        <button
                          key={version.timestamp}
                          onClick={() => onSelectVersion(index)}
                          className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all group ${
                            selectedVersionIndex === index 
                              ? 'border-amber-500 ring-2 ring-amber-500/30' 
                              : 'border-zinc-700 hover:border-zinc-500'
                          }`}
                          title={version.prompt}
                        >
                          <img
                            src={`data:${version.image.mimeType};base64,${version.image.base64}`}
                            alt={`Version ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                            <span className="text-[10px] text-white font-medium">v{index + 1}</span>
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                            <span className="text-[8px] text-white text-center line-clamp-3">{version.prompt}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                        downloadPrefix={Feature.Lookbook}
                        onUpscale={() => onUpscale(img, `var-${i}`)}
                        isUpscaling={upscalingStates[`var-${i}`]}
                        onSendToFeature={onSendToFeature ? () => onSendToFeature(img) : undefined}
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
                        downloadPrefix={Feature.Lookbook}
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
