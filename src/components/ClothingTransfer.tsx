import React from 'react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import { useLanguage } from '../contexts/LanguageContext';
import { AddIcon, DeleteIcon } from './Icons';
import ResultPlaceholder from './shared/ResultPlaceholder';
import ImageOptionsPanel from './ImageOptionsPanel';
import { useClothingTransfer } from '../hooks/useClothingTransfer';
import { Feature, ImageFile } from '../types';

interface ClothingTransferProps {
  onSendToFeature?: (feature: Feature, image: ImageFile) => void;
}

const ClothingTransfer: React.FC<ClothingTransferProps> = ({ onSendToFeature }) => {
  const {
    referenceItems,
    conceptItems,
    conceptImages,
    extraPrompt,
    numImages,
    aspectRatio,
    resolution,
    isLoading,
    loadingMessage,
    error,
    upscalingStates,
    setExtraPrompt,
    setNumImages,
    setAspectRatio,
    setResolution,
    setError,
    handleReferenceUpload,
    handleReferenceLabel,
    addReference,
    removeReference,
    handleConceptImagesUpload,
    handleGenerate,
    handleRegenerateSingle,
    handleUpscale,
    handleRefine,
    handleDownloadAll,
    completedCount,
    failedCount,
    canGenerate,
    anyUpscaling,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
  } = useClothingTransfer();

  const { t } = useLanguage();
  const [refineOpen, setRefineOpen] = React.useState<Record<string, boolean>>({});

  const toggleRefine = (key: string) =>
    setRefineOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(520px,0.95fr)_minmax(0,1.05fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="workspace-label mb-1">{t('clothingTransfer.step1')}</p>
              <h4 className="workspace-title text-xl font-medium text-white">{t('clothingTransfer.referenceTitle')}</h4>
            </div>
            <p className="max-w-md text-sm leading-6 text-zinc-500">{t('clothingTransfer.sharedReferenceHint')}</p>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="workspace-panel rounded-[1.5rem] p-5">
              <div className={referenceItems.length > 1 ? 'grid grid-cols-2 gap-3 xl:grid-cols-3' : 'grid grid-cols-1 gap-5'}>
                {referenceItems.map((item, index) => (
                  <div key={item.id} className={referenceItems.length > 1 ? 'relative space-y-2 rounded-2xl border border-white/8 bg-black/25 p-2' : 'space-y-2'}>
                    {referenceItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReference(item.id)}
                        className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/70 p-1.5 text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-300"
                        aria-label="Remove"
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </button>
                    )}
                    <ImageUploader
                      image={item.image}
                      id={`ref-outfit-${item.id}`}
                      title={`#${index + 1}`}
                      onImageUpload={(file) => handleReferenceUpload(file, item.id)}
                    />
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleReferenceLabel(e.target.value, item.id)}
                      placeholder={t('clothingTransfer.referenceLabelPlaceholder')}
                      className="workspace-input px-3 py-2 text-xs"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addReference}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/12 py-3 text-xs uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:border-white/24 hover:text-zinc-100"
              >
                <AddIcon className="h-3.5 w-3.5" />
                {t('clothingTransfer.addOutfit')}
              </button>
            </div>

            <div className="workspace-panel rounded-[1.5rem] p-5">
              <div className="mb-4">
                <p className="workspace-label mb-1">{t('clothingTransfer.step2')}</p>
                <h4 className="text-lg font-medium tracking-[-0.03em] text-zinc-50">{t('clothingTransfer.conceptImagesTitle')}</h4>
              </div>
              <MultiImageUploader
                images={conceptImages}
                id="concept-upload"
                title={t('clothingTransfer.conceptImagesTitle')}
                onImagesUpload={handleConceptImagesUpload}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <details className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25" open={extraPrompt.trim() ? true : undefined}>
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left marker:hidden hover:bg-white/[0.03]">
              <span>
                <span className="workspace-label">{t('clothingTransfer.step3')}</span>
                <span className="mt-1 block text-sm font-medium text-zinc-200">{t('clothingTransfer.extraPromptLabel')}</span>
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {extraPrompt.trim() ? t('common.save') : 'Optional'} <span aria-hidden="true">⌄</span>
              </span>
            </summary>
            <div className="space-y-2 border-t border-white/8 px-4 py-4">
              <textarea
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder={t('clothingTransfer.extraPromptPlaceholder')}
                rows={2}
                className="workspace-input p-3"
              />
              <p className="text-xs leading-5 text-zinc-500">{t('clothingTransfer.extraPromptDescription')}</p>
            </div>
          </details>

          <div className="workspace-panel rounded-[2rem] p-5 sm:p-6">
            <div className="space-y-4">
              <div>
                <p className="workspace-label mb-1">{t('workspace.panels.generationSettings')}</p>
                <h4 className="text-xl font-medium tracking-[-0.03em] text-white">{t('clothingTransfer.generateButton')}</h4>
              </div>

              <ImageOptionsPanel
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                resolution={resolution}
                setResolution={setResolution}
                model={imageEditModel}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>{t('clothingTransfer.numberOfImages')}</span>
                  <span className="rounded-full border border-white/10 bg-[var(--workspace-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--workspace-accent-text)]">
                    {numImages}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={numImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-xs text-zinc-600 select-none">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading || anyUpscaling || !canGenerate}
                className="w-full rounded-[1.25rem] bg-[var(--workspace-accent)] px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent-text)] hover:opacity-92 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500"
              >
                {isLoading ? <Spinner /> : t('clothingTransfer.generateButton')}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="workspace-stage rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-6">
        {conceptItems.length === 0 ? (
          <div className="flex min-h-[32rem] items-center justify-center">
            <ResultPlaceholder description={t('clothingTransfer.outputPanelDescription')} />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col gap-3 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/8 pb-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="workspace-label">{t('workspace.panels.resultStage')}</p>
                <h3 className="text-2xl font-medium tracking-[-0.04em] text-zinc-50">
                  {t('clothingTransfer.batchResultsTitle')}
                </h3>
                <p className="text-sm text-zinc-400">
                  {t('clothingTransfer.batchProgress', {
                    completed: completedCount,
                    total: conceptItems.length,
                    failed: failedCount,
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={isLoading}
                    className="runway-action-secondary px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('common.downloadBatch')}
                  </button>
                )}
                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    <div className="flex items-start justify-between gap-3">
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)} className="text-xs text-red-200 hover:text-white">
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <p className="animate-pulse text-xs uppercase tracking-[0.18em] text-zinc-400">
                    {loadingMessage || t('clothingTransfer.generatingStatus')}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
              {conceptItems.flatMap((item, itemIdx) =>
                item.results.length > 0
                  ? item.results.map((image, index) => {
                      const key = `${item.id}:${index}`;
                      const isOpen = !!refineOpen[key];
                      const isCurrentlyRefining = !!isRefining[key];

                      return (
                        <div key={key} className="animate-fade-in flex flex-col gap-1" style={{ animationDelay: `${(itemIdx * 4 + index) * 60}ms` }}>
                          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/8 bg-black/30 p-2">
                            <HoverableImage
                              image={image}
                              altText={`${t('clothingTransfer.conceptBatchLabel', { index: itemIdx + 1 })} - ${t('generatedImage.altText')} ${index + 1}`}
                              downloadPrefix={Feature.ClothingTransfer}
                              onRegenerate={() => handleRegenerateSingle(item.id)}
                              onUpscale={() => handleUpscale(image, index, item.id)}
                              isGenerating={isLoading}
                              isUpscaling={upscalingStates[key]}
                              onSendToFeature={onSendToFeature ? () => onSendToFeature(Feature.PhotoAlbum, image) : undefined}
                            />
                            {conceptItems.length > 1 && (
                              <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 backdrop-blur-sm">
                                <div className="h-4 w-4 overflow-hidden rounded border border-zinc-600">
                                  <img src={`data:${item.conceptImage.mimeType};base64,${item.conceptImage.base64}`} alt="" className="h-full w-full object-cover" />
                                </div>
                                <span className="text-[10px] font-medium text-zinc-300">#{itemIdx + 1}</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleRefine(key)}
                            className={`mt-2 flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] transition-all ${
                              isOpen ? 'border-white/10 bg-[var(--workspace-accent)] text-[var(--workspace-accent-text)]' : 'border-transparent text-zinc-500 hover:border-white/10 hover:bg-white/5 hover:text-zinc-200'
                            }`}
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                            </svg>
                            {isOpen ? t('imageActions.refineButton') : `✏️ ${t('imageActions.refineButton')}`}
                          </button>

                          {isOpen && (
                            <div className="flex animate-fade-in gap-1.5">
                              <input
                                type="text"
                                value={refinePrompts[key] || ''}
                                onChange={(e) => setRefinePrompts((prev) => ({ ...prev, [key]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRefine(image, index, item.id, refinePrompts[key] || '');
                                }}
                                placeholder={t('imageActions.refinePromptPlaceholder')}
                                autoFocus
                                className="workspace-input flex-1 min-w-0 px-3 py-2 text-xs"
                                disabled={isCurrentlyRefining}
                              />
                              <button
                                type="button"
                                onClick={() => handleRefine(image, index, item.id, refinePrompts[key] || '')}
                                disabled={isCurrentlyRefining || !(refinePrompts[key] || '').trim()}
                                className="runway-action flex-shrink-0 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed"
                              >
                                {isCurrentlyRefining ? <Spinner /> : '↵'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  : item.status === 'processing' || item.status === 'pending'
                    ? [
                        <div key={`${item.id}-skeleton`} className={`relative flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-white/8 ${item.status === 'processing' ? 'animate-pulse bg-white/5' : 'bg-white/[0.03]'}`}>
                          {item.status === 'processing' ? (
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-100" />
                          ) : (
                            <p className="text-xs text-zinc-500">{t('clothingTransfer.waitingStatus')}</p>
                          )}
                          <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 backdrop-blur-sm">
                            <div className="h-4 w-4 overflow-hidden rounded border border-zinc-600">
                              <img src={`data:${item.conceptImage.mimeType};base64,${item.conceptImage.base64}`} alt="" className="h-full w-full object-cover" />
                            </div>
                            <span className="text-[10px] font-medium text-zinc-300">#{itemIdx + 1}</span>
                          </div>
                        </div>,
                      ]
                    : [],
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClothingTransfer;
