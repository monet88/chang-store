import React, { useCallback } from 'react';
import { Feature, ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import HoverableImage from './HoverableImage';
import Spinner, { ErrorDisplay } from './Spinner';
import Tooltip from './Tooltip';
import ResultPlaceholder from './shared/ResultPlaceholder';
import RefinementInput from './shared/RefinementInput';
import { RefinementHistoryItem } from '../services/imageEditingService';

export interface LookbookSet {
  main: ImageFile;
  variations: ImageFile[];
  closeups: ImageFile[];
}

type OutputTab = 'main' | 'variations' | 'closeup';

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

const panelClass = 'sticky top-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6';
const labelClass = 'text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500';
const tabButton = (active: boolean) => `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
  active ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
}`;
const secondaryButtonClass = 'inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

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
  onDownloadAll,
}) => {
  const { t } = useLanguage();

  const handleVariationCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onVariationCountChange(Number(e.target.value));
  }, [onVariationCountChange]);

  const outputTabs: { id: OutputTab; label: string }[] = [
    { id: 'main', label: t('lookbook.tabGeneratedImage') },
    { id: 'variations', label: t('lookbook.tabVariations') },
    { id: 'closeup', label: t('lookbook.tabCloseup') },
  ];

  if (isLoading || isGeneratingVariations || isGeneratingCloseUp) {
    return (
      <div className={panelClass}>
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
          <Spinner />
          <p className="text-sm text-zinc-400">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={panelClass}>
        <div className="flex min-h-[55vh] items-center justify-center">
          <ErrorDisplay
            title={t('common.generationFailed')}
            message={error}
            onClear={onClearError}
          />
        </div>
      </div>
    );
  }

  if (!lookbook) {
    return (
      <div className={panelClass}>
        <div className="flex min-h-[55vh] items-center justify-center">
          <ResultPlaceholder description={t('lookbook.outputPanelDescription')} />
        </div>
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className={labelClass}>{t('workspace.panels.outputCanvas')}</p>
            <h3 className="text-xl font-medium tracking-[-0.03em] text-zinc-50">
              {t('lookbook.tabGeneratedImage')}
            </h3>
            <p className="text-sm leading-6 text-zinc-500">
              {t('workspace.flows.lookbook')}
            </p>
          </div>
          <button type="button" onClick={onDownloadAll} className={secondaryButtonClass}>
            {t('common.downloadAll')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-black/30 p-2">
          {outputTabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} className={tabButton(activeTab === tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[48vh]">
          {activeTab === 'main' && (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-black/30 p-3">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px]">
                  <HoverableImage
                    image={lookbook.main}
                    altText={t('lookbook.tabGeneratedImage')}
                    downloadPrefix={Feature.Lookbook}
                    onUpscale={() => onUpscale(lookbook.main, 'main')}
                    isUpscaling={upscalingStates.main}
                    onSendToFeature={onSendToFeature ? () => onSendToFeature(lookbook.main) : undefined}
                    containerClassName="h-full w-full overflow-hidden rounded-[24px]"
                  />
                </div>
              </div>

              <RefinementInput
                onRefine={onRefineImage}
                onReset={onResetRefinement}
                history={refinementHistory}
                isRefining={isRefining}
                disabled={!lookbook.main}
              />

              {refinementVersions.length > 0 && (
                <div className="space-y-3">
                  <p className={labelClass}>{t('generatedImage.versionHistory')}</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    <button
                      type="button"
                      onClick={() => onSelectVersion(-1)}
                      className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition-colors ${
                        selectedVersionIndex === -1 ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-black/30'
                      }`}
                      title={t('generatedImage.originalVersion')}
                    >
                      {originalImage && (
                        <img
                          src={`data:${originalImage.mimeType};base64,${originalImage.base64}`}
                          alt={t('generatedImage.originalShort')}
                          className="h-full w-full object-cover opacity-60"
                        />
                      )}
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] uppercase tracking-[0.18em] text-white">
                        {t('generatedImage.originalShort')}
                      </div>
                    </button>

                    {refinementVersions.map((version, index) => (
                      <button
                        key={version.timestamp}
                        type="button"
                        onClick={() => onSelectVersion(index)}
                        className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition-colors ${
                          selectedVersionIndex === index ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-black/30'
                        }`}
                        title={version.prompt}
                      >
                        <img
                          src={`data:${version.image.mimeType};base64,${version.image.base64}`}
                          alt={`Version ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] uppercase tracking-[0.18em] text-white">
                          v{index + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'variations' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <p className={labelClass}>{t('lookbook.tabVariations')}</p>
                  <div className="flex items-center gap-3">
                    <input
                      id="variation-slider"
                      type="range"
                      min="1"
                      max="4"
                      step="1"
                      value={variationCount}
                      onChange={handleVariationCountChange}
                      className="w-40 cursor-pointer"
                    />
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-100">
                      {variationCount}
                    </span>
                  </div>
                </div>
                <Tooltip content={t('tooltips.lookbookVariations')} position="bottom">
                  <button type="button" onClick={onGenerateVariations} disabled={isGeneratingVariations || isGeneratingCloseUp} className={secondaryButtonClass}>
                    {t('lookbook.generateVariationsButton')}
                  </button>
                </Tooltip>
              </div>

              {lookbook.variations.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {lookbook.variations.map((img, i) => (
                    <div key={i} className="rounded-[24px] border border-white/10 bg-black/30 p-3">
                      <HoverableImage
                        image={img}
                        altText={t('lookbook.variationAltText', { index: i + 1 })}
                        downloadPrefix={Feature.Lookbook}
                        onUpscale={() => onUpscale(img, `var-${i}`)}
                        isUpscaling={upscalingStates[`var-${i}`]}
                        onSendToFeature={onSendToFeature ? () => onSendToFeature(img) : undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[24px] border border-white/10 bg-black/30 p-8 text-center text-zinc-500">
                  <div>
                    <h4 className="font-medium text-zinc-200">{t('lookbook.variationsPlaceholderTitle')}</h4>
                    <p className="mt-2 text-sm">{t('lookbook.variationsPlaceholderDescription')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'closeup' && (
            <div className="space-y-5">
              <div className="flex justify-end">
                <Tooltip content={t('tooltips.lookbookCloseups')} position="bottom">
                  <button type="button" onClick={onGenerateCloseUp} disabled={isGeneratingCloseUp || isGeneratingVariations} className={secondaryButtonClass}>
                    {t('lookbook.generateCloseUpButton')}
                  </button>
                </Tooltip>
              </div>

              {lookbook.closeups.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {lookbook.closeups.map((img, i) => (
                    <div key={i} className="rounded-[24px] border border-white/10 bg-black/30 p-3">
                      <HoverableImage
                        image={img}
                        altText={t('lookbook.closeUpAltText', { index: i + 1 })}
                        downloadPrefix={Feature.Lookbook}
                        onUpscale={() => onUpscale(img, `close-${i}`)}
                        isUpscaling={upscalingStates[`close-${i}`]}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[24px] border border-white/10 bg-black/30 p-8 text-center text-zinc-500">
                  <div>
                    <h4 className="font-medium text-zinc-200">{t('lookbook.closeupPlaceholderTitle')}</h4>
                    <p className="mt-2 text-sm">{t('lookbook.closeupPlaceholderDescription')}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

LookbookOutput.displayName = 'LookbookOutput';
