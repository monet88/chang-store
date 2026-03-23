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
    completedCount,
    failedCount,
    canGenerate,
    anyUpscaling,
    imageEditModel,
  } = useClothingTransfer();

  const { t } = useLanguage();

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
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      <div className="xl:[display:contents] flex flex-col gap-6">
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-center flex-shrink-0">{t('clothingTransfer.title')}</h2>
            <p className="text-xs text-center text-zinc-400">{t('clothingTransfer.providerNotice')}</p>
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('clothingTransfer.step1')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {referenceItems.map((item, index) => (
                <div key={item.id} className="relative group">
                  <ImageUploader
                    image={item.image}
                    id={`ref-outfit-${item.id}`}
                    title={`${t('clothingTransfer.referenceTitle')} ${index + 1}`}
                    onImageUpload={(file) => handleReferenceUpload(file, item.id)}
                  />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleReferenceLabel(e.target.value, item.id)}
                    placeholder={t('clothingTransfer.referenceLabelPlaceholder')}
                    className="w-full mt-1.5 bg-zinc-800/50 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                  />
                  {referenceItems.length > 1 && (
                    <button
                      onClick={() => removeReference(item.id)}
                      className="absolute -top-2 -right-2 z-10 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-center text-zinc-500">{t('clothingTransfer.sharedReferenceHint')}</p>
            <button
              onClick={addReference}
              disabled={referenceItems.length >= 2}
              className="w-full mt-3 bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AddIcon className="w-5 h-5" />
              <span>{t('clothingTransfer.addOutfit')}</span>
            </button>
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
        </div>

        <div className="flex flex-col gap-6">
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('clothingTransfer.step3')}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="ct-extra-prompt" className="block text-sm font-medium text-center text-zinc-300 mb-2">
                  {t('clothingTransfer.extraPromptLabel')}
                </label>
                <textarea
                  id="ct-extra-prompt"
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder={t('clothingTransfer.extraPromptPlaceholder')}
                  rows={2}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                />
                <p className="text-xs text-zinc-500 mt-1 text-center">{t('clothingTransfer.extraPromptDescription')}</p>
              </div>

              <ImageOptionsPanel
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                resolution={resolution}
                setResolution={setResolution}
                model={imageEditModel}
              />

              <div>
                <label htmlFor="ct-num-images" className="block text-sm font-medium text-center text-zinc-300 mb-2">
                  {t('clothingTransfer.numberOfImages')}
                </label>
                <div className="flex items-center gap-3 max-w-xs mx-auto">
                  <input
                    id="ct-num-images"
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={numImages}
                    onChange={(e) => setNumImages(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="bg-amber-600 text-white text-xs font-bold rounded-full h-6 w-6 flex-shrink-0 flex items-center justify-center">
                    {numImages}
                  </span>
                </div>
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
      </div>

      <div className="sticky top-8">
        <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col min-h-[50vh] lg:min-h-0 lg:aspect-[4/5] items-center justify-center">
          {conceptItems.length === 0 ? (
            <ResultPlaceholder description={t('clothingTransfer.outputPanelDescription')} />
          ) : (
            <div className="flex flex-col h-full gap-4 w-full overflow-hidden">
              <div className="flex-shrink-0 space-y-2">
                <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  {t('clothingTransfer.batchResultsTitle')}
                </h3>
                <p className="text-xs text-center text-zinc-400">
                  {t('clothingTransfer.batchProgress', {
                    completed: completedCount,
                    total: conceptItems.length,
                    failed: failedCount,
                  })}
                </p>
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    <div className="flex items-start justify-between gap-3">
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)} className="text-xs text-red-200 hover:text-white">
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <p className="text-xs text-center text-amber-300 animate-pulse">
                    {loadingMessage || t('clothingTransfer.generatingStatus')}
                  </p>
                )}
              </div>

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

              {activeConceptItem && (
                <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-4 items-start">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-zinc-300">{t('clothingTransfer.selectedConceptLabel')}</p>
                      <div className="aspect-[4/5] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
                        <img
                          src={`data:${activeConceptItem.conceptImage.mimeType};base64,${activeConceptItem.conceptImage.base64}`}
                          alt={t('clothingTransfer.conceptBatchLabel', { index: selectedItemIndex + 1 })}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">
                            {t('clothingTransfer.conceptBatchLabel', { index: selectedItemIndex + 1 })}
                          </p>
                          <p className="text-xs text-zinc-500">{t('clothingTransfer.resultsForConcept')}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS_NAME[activeConceptItem.status]}`}>
                          {t(`clothingTransfer.status.${activeConceptItem.status}`)}
                        </span>
                      </div>

                      {activeConceptItem.error && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                          {activeConceptItem.error}
                        </div>
                      )}

                      {activeConceptItem.results.length > 0 ? (
                        <div className={`grid ${getGridColsClass(activeConceptItem.results.length)} gap-4`}>
                          {activeConceptItem.results.map((image, index) => (
                            <div key={`${activeConceptItem.id}-${index}`} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                              <HoverableImage
                                image={image}
                                altText={`${t('generatedImage.altText')} ${index + 1}`}
                                onRegenerate={handleGenerate}
                                onUpscale={() => handleUpscale(image, index, activeConceptItem.id)}
                                isGenerating={isLoading}
                                isUpscaling={upscalingStates[`${activeConceptItem.id}:${index}`]}
                                onSendToFeature={onSendToFeature ? () => onSendToFeature(Feature.PhotoAlbum, image) : undefined}
                              />
                            </div>
                          ))}
                        </div>
                      ) : activeConceptItem.status === 'processing' ? (
                        <div className="space-y-3">
                          <p className="text-sm text-amber-300">{t('clothingTransfer.processingItem')}</p>
                          <div className={`grid ${getGridColsClass(numImages)} gap-4`}>
                            {Array.from({ length: numImages }).map((_, index) => (
                              <div key={index} className="aspect-[4/5] bg-zinc-800/50 rounded-lg flex items-center justify-center animate-pulse">
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
                  </div>
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
