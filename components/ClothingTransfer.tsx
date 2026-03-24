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
import ImageBatchSessionRail from './shared/ImageBatchSessionRail';
import { BatchImageStatus, Feature, ImageFile } from '../types';

const STATUS_CLASS_NAME: Record<BatchImageStatus, string> = {
  pending: 'bg-zinc-700/80 text-zinc-200',
  processing: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  error: 'bg-red-500/20 text-red-300 border border-red-500/30',
};

interface ClothingTransferProps {
  onSendToFeature?: (feature: Feature, image: ImageFile) => void;
}

const ClothingTransfer: React.FC<ClothingTransferProps> = ({ onSendToFeature }) => {
  const {
    referenceItems,
    conceptItems,
    conceptImages,
    selectedConceptItemId,
    setSelectedConceptItemId,
    activeConceptItem,
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
    handleUpscale,
    handleRefine,
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

  // Track which image slots have the refine bar expanded
  const [refineOpen, setRefineOpen] = React.useState<Record<string, boolean>>({});

  const toggleRefine = (key: string) =>
    setRefineOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const getGridColsClass = (count: number) => {
    if (count <= 1) {
      return 'grid-cols-1';
    }

    return 'grid-cols-1 sm:grid-cols-2';
  };

  const selectedItemIndex = activeConceptItem
    ? conceptItems.findIndex((item) => item.id === activeConceptItem.id)
    : -1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-center flex-shrink-0">{t('clothingTransfer.title')}</h2>
            <p className="text-xs text-center text-zinc-400">{t('clothingTransfer.providerNotice')}</p>
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('clothingTransfer.step1')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {referenceItems.map((item, index) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-300">
                      {t('clothingTransfer.referenceTitle')} {index + 1}
                    </span>
                    {referenceItems.length > 1 && (
                      <button
                        onClick={() => removeReference(item.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        aria-label="Remove"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <ImageUploader
                      image={item.image}
                      id={`ref-outfit-${item.id}`}
                      title={`${t('clothingTransfer.referenceTitle')} ${referenceItems.findIndex(r => r.id === item.id) + 1}`}
                      onImageUpload={(file) => handleReferenceUpload(file, item.id)}
                    />
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleReferenceLabel(e.target.value, item.id)}
                      placeholder={t('clothingTransfer.referenceLabelPlaceholder')}
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
            {referenceItems.length < 2 && (
              <button
                onClick={addReference}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-600 py-2 text-xs text-zinc-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                <AddIcon className="w-3.5 h-3.5" />
                {t('clothingTransfer.addOutfit')}
              </button>
            )}
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('clothingTransfer.step2')}</h3>
            <MultiImageUploader
              images={conceptImages}
              id="concept-upload"
              title={t('clothingTransfer.conceptImagesTitle')}
              onImagesUpload={handleConceptImagesUpload}
            />
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('clothingTransfer.step3')}</h3>
            <ImageOptionsPanel
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              model={imageEditModel}
            />
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>{t('clothingTransfer.numberOfImages')}</span>
                <span className="bg-amber-600 text-white text-xs font-bold rounded-full h-6 w-6 flex-shrink-0 flex items-center justify-center">
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
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-zinc-600 select-none">
                <span>1</span><span>2</span><span>3</span><span>4</span>
              </div>
            </div>
          </div>

          <div className="text-center flex-shrink-0 pb-2">
            <button
              onClick={handleGenerate}
              disabled={isLoading || anyUpscaling || !canGenerate}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
            >
              {isLoading ? <Spinner /> : t('clothingTransfer.generateButton')}
            </button>
          </div>
        </div>

      {/* ── Results Panel ── */}
      <div className="sticky top-8">
        <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col items-center justify-center">
          {conceptItems.length === 0 ? (
            <ResultPlaceholder description={t('clothingTransfer.outputPanelDescription')} />
          ) : (
            <div className="flex flex-col h-full gap-3 w-full overflow-hidden">

              {/* Header: title + progress */}
              <div className="flex-shrink-0 text-center">
                <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  {t('clothingTransfer.batchResultsTitle')}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('clothingTransfer.batchProgress', {
                    completed: completedCount,
                    total: conceptItems.length,
                    failed: failedCount,
                  })}
                </p>
                {error && (
                  <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    <div className="flex items-start justify-between gap-3">
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)} className="text-xs text-red-200 hover:text-white">
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <p className="text-xs text-amber-300 animate-pulse mt-1">
                    {loadingMessage || t('clothingTransfer.generatingStatus')}
                  </p>
                )}
              </div>

              {/* Concept selector rail */}
              <ImageBatchSessionRail
                items={conceptItems.map((item) => ({
                  id: item.id,
                  image: item.conceptImage,
                  status: item.status,
                  resultCount: item.results.length,
                }))}
                selectedId={selectedConceptItemId}
                onSelect={setSelectedConceptItemId}
                getItemLabel={(index) => t('clothingTransfer.conceptBatchLabel', { index: index + 1 })}
              />

              {/* Active concept results — full width, concept shown as badge */}
              {activeConceptItem && (
                <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-0">

                  {/* Concept identity badge row */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900">
                      <img
                        src={`data:${activeConceptItem.conceptImage.mimeType};base64,${activeConceptItem.conceptImage.base64}`}
                        alt={t('clothingTransfer.conceptBatchLabel', { index: selectedItemIndex + 1 })}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 leading-tight truncate">
                        {t('clothingTransfer.conceptBatchLabel', { index: selectedItemIndex + 1 })}
                      </p>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        {t('clothingTransfer.resultsForConcept')}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS_NAME[activeConceptItem.status]}`}>
                      {t(`clothingTransfer.status.${activeConceptItem.status}`)}
                    </span>
                  </div>

                  {activeConceptItem.error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {activeConceptItem.error}
                    </div>
                  )}

                  {/* Output grid — full width */}
                  {activeConceptItem.results.length > 0 ? (
                    <div className={`grid ${getGridColsClass(activeConceptItem.results.length)} gap-3`}>
                      {activeConceptItem.results.map((image, index) => {
                        const key = `${activeConceptItem.id}:${index}`;
                        const isOpen = !!refineOpen[key];
                        const isCurrentlyRefining = !!isRefining[key];
                        return (
                          <div key={key} className="animate-fade-in flex flex-col gap-1" style={{ animationDelay: `${index * 80}ms` }}>
                            <HoverableImage
                              image={image}
                              altText={`${t('generatedImage.altText')} ${index + 1}`}
                              onRegenerate={handleGenerate}
                              onUpscale={() => handleUpscale(image, index, activeConceptItem.id)}
                              isGenerating={isLoading}
                              isUpscaling={upscalingStates[key]}
                              onSendToFeature={onSendToFeature ? () => onSendToFeature(Feature.PhotoAlbum, image) : undefined}
                            />

                            {/* Refine toggle — compact pill */}
                            <button
                              onClick={() => toggleRefine(key)}
                              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md transition-all w-fit ${
                                isOpen
                                  ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80'
                              }`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                              </svg>
                              {isOpen ? t('imageActions.refineButton') : '✏️ ' + t('imageActions.refineButton')}
                            </button>

                            {/* Collapsed refine input — only when open */}
                            {isOpen && (
                              <div className="flex gap-1.5 animate-fade-in">
                                <input
                                  type="text"
                                  value={refinePrompts[key] || ''}
                                  onChange={(e) => setRefinePrompts((prev) => ({ ...prev, [key]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRefine(image, index, activeConceptItem.id, refinePrompts[key] || '');
                                  }}
                                  placeholder={t('imageActions.refinePromptPlaceholder')}
                                  autoFocus
                                  className="flex-1 min-w-0 bg-zinc-800/70 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                                  disabled={isCurrentlyRefining}
                                />
                                <button
                                  onClick={() => handleRefine(image, index, activeConceptItem.id, refinePrompts[key] || '')}
                                  disabled={isCurrentlyRefining || !(refinePrompts[key] || '').trim()}
                                  className="flex-shrink-0 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  {isCurrentlyRefining ? <Spinner /> : '↵'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : activeConceptItem.status === 'processing' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-300">{t('clothingTransfer.processingItem')}</p>
                      <div className={`grid ${getGridColsClass(numImages)} gap-3`}>
                        {Array.from({ length: numImages }).map((_, index) => (
                          <div key={index} className="aspect-[3/4] bg-zinc-800/50 rounded-lg flex items-center justify-center animate-pulse">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-400 text-center">
                      {t('clothingTransfer.waitingStatus')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClothingTransfer;
