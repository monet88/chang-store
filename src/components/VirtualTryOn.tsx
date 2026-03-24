import React from 'react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import { BatchImageStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

import { AddIcon, DeleteIcon } from './Icons';
import Tooltip from './Tooltip';
import ResultPlaceholder from './shared/ResultPlaceholder';
import ImageOptionsPanel from './ImageOptionsPanel';
import ImageBatchSessionRail from './shared/ImageBatchSessionRail';
import { useVirtualTryOn } from '../hooks/useVirtualTryOn';

const STATUS_CLASS_NAME: Record<BatchImageStatus, string> = {
  pending: 'bg-zinc-700/80 text-zinc-200',
  processing: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  error: 'bg-red-500/20 text-red-300 border border-red-500/30',
};

const getGridColsClass = (count: number) => {
  if (count <= 1) {
    return 'grid-cols-1';
  }

  return 'grid-cols-1 sm:grid-cols-2';
};

const VirtualTryOn: React.FC = () => {
  const {
    subjectItems,
    subjectImages,
    selectedSubjectItemId,
    setSelectedSubjectItemId,
    activeSubjectItem,
    clothingItems,
    backgroundPrompt,
    setBackgroundPrompt,
    extraPrompt,
    setExtraPrompt,
    numImages,
    setNumImages,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    isLoading,
    upscalingStates,
    loadingMessage,
    error,
    setError,
    completedCount,
    failedCount,
    canGenerate,
    handleGenerateImage,
    handleUpscale,
    handleRefine,
    handleSubjectImagesUpload,
    handleClothingUpload,
    addClothingUploader,
    removeClothingUploader,
    anyUpscaling,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
  } = useVirtualTryOn();

  const { t } = useLanguage();

  // Track which image slots have the refine bar expanded
  const [refineOpen, setRefineOpen] = React.useState<Record<string, boolean>>({});

  const toggleRefine = (key: string) =>
    setRefineOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectedItemIndex = activeSubjectItem
    ? subjectItems.findIndex((item) => item.id === activeSubjectItem.id)
    : -1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      <div className="flex flex-col gap-6">
        <h2 className="text-xl md:text-2xl font-bold text-center flex-shrink-0">{t('virtualTryOn.title')}</h2>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('virtualTryOn.step1')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Tooltip content={t('tooltips.tryOnSubject')} position="right" className="w-full">
              <MultiImageUploader
                images={subjectImages}
                id="subject-upload"
                title={t('virtualTryOn.subjectImagesTitle')}
                onImagesUpload={handleSubjectImagesUpload}
              />
            </Tooltip>

            <div className="flex flex-col gap-3">
              <p className="text-xs text-center text-zinc-500">{t('virtualTryOn.sharedOutfitHint')}</p>
              {clothingItems.map((item, index) => (
                <div key={item.id} className="relative group">
                  <Tooltip content={t('tooltips.tryOnClothing')} position="top">
                    <ImageUploader
                      image={item.image}
                      id={`clothing-${item.id}`}
                      title={t('virtualTryOn.clothingItemTitle', { index: index + 1 })}
                      onImageUpload={(file) => handleClothingUpload(file, item.id)}
                    />
                  </Tooltip>
                  {clothingItems.length > 1 && (
                    <button
                      onClick={() => removeClothingUploader(item.id)}
                      className="absolute -top-2 -right-2 z-10 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <Tooltip content={t('tooltips.tryOnAddClothing')} position="bottom" className="w-full">
                <button
                  onClick={addClothingUploader}
                  disabled={clothingItems.length >= 2}
                  className="w-full bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AddIcon className="w-5 h-5" />
                  <span>{t('virtualTryOn.addItem')}</span>
                </button>
              </Tooltip>
              <p className="text-xs text-zinc-500 mt-1 text-center">{t('virtualTryOn.clothingUploadHint')}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('virtualTryOn.step2')}</h3>
          <div className="space-y-4">
            <Tooltip content={t('tooltips.tryOnBackground')} position="bottom" className="w-full">
              <label htmlFor="background-prompt" className="block text-sm font-medium text-center text-zinc-300 mb-2">
                {t('virtualTryOn.backgroundPromptLabel')}
              </label>
              <textarea
                id="background-prompt"
                value={backgroundPrompt}
                onChange={(e) => setBackgroundPrompt(e.target.value)}
                placeholder={t('virtualTryOn.backgroundPromptPlaceholder')}
                rows={2}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1 text-center">{t('virtualTryOn.backgroundPromptDescription')}</p>
            </Tooltip>

            <Tooltip content={t('tooltips.tryOnInstructions')} position="bottom" className="w-full">
              <label htmlFor="extra-prompt" className="block text-sm font-medium text-center text-zinc-300 mb-2">
                {t('virtualTryOn.extraPromptLabel')}
              </label>
              <textarea
                id="extra-prompt"
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder={t('virtualTryOn.extraPromptPlaceholder')}
                rows={2}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1 text-center">{t('virtualTryOn.extraPromptDescription')}</p>
            </Tooltip>

            <div className="space-y-3">
              <ImageOptionsPanel
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                resolution={resolution}
                setResolution={setResolution}
                model={imageEditModel}
              />

              <Tooltip content={t('tooltips.tryOnImageCount')} position="top">
                <label htmlFor="num-images-slider" className="block text-sm font-medium text-center text-zinc-300 mb-2">
                  {t('virtualTryOn.numberOfImages')}
                </label>
                <div className="flex items-center gap-3 max-w-xs mx-auto">
                  <input
                    id="num-images-slider"
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
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="text-center flex-shrink-0 pb-2">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('virtualTryOn.step3')}</h3>
          <Tooltip content={t('tooltips.tryOnGenerate')} position="top">
            <button
              onClick={handleGenerateImage}
              disabled={isLoading || anyUpscaling || !canGenerate}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
            >
              {isLoading ? <Spinner /> : t('virtualTryOn.generateButton')}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="sticky top-8">
        <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col items-center justify-center">
          {subjectItems.length === 0 ? (
            <ResultPlaceholder description={t('virtualTryOn.outputPanelDescription')} />
          ) : (
            <div className="flex flex-col h-full gap-4 w-full overflow-hidden">
              <div className="flex-shrink-0 space-y-2">
                <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  {t('virtualTryOn.batchResultsTitle')}
                </h3>
                <p className="text-xs text-center text-zinc-400">
                  {t('virtualTryOn.batchProgress', {
                    completed: completedCount,
                    total: subjectItems.length,
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
                    {loadingMessage || t('virtualTryOn.generatingStatus')}
                  </p>
                )}
              </div>

              <ImageBatchSessionRail
                items={subjectItems.map((item) => ({
                  id: item.id,
                  image: item.subjectImage,
                  status: item.status,
                  resultCount: item.results.length,
                }))}
                selectedId={selectedSubjectItemId}
                onSelect={setSelectedSubjectItemId}
                getItemLabel={(index) => t('virtualTryOn.subjectBatchLabel', { index: index + 1 })}
              />

              {activeSubjectItem && (
                <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-0">

                  {/* Subject identity badge row */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900">
                      <img
                        src={`data:${activeSubjectItem.subjectImage.mimeType};base64,${activeSubjectItem.subjectImage.base64}`}
                        alt={t('virtualTryOn.subjectBatchLabel', { index: selectedItemIndex + 1 })}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 leading-tight truncate">
                        {t('virtualTryOn.subjectBatchLabel', { index: selectedItemIndex + 1 })}
                      </p>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        {t('virtualTryOn.resultsForSubject')}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS_NAME[activeSubjectItem.status]}`}>
                      {t(`virtualTryOn.status.${activeSubjectItem.status}`)}
                    </span>
                  </div>

                  {activeSubjectItem.error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {activeSubjectItem.error}
                    </div>
                  )}

                  {/* Output grid — full width */}
                  {activeSubjectItem.results.length > 0 ? (
                    <div className={`grid ${getGridColsClass(activeSubjectItem.results.length)} gap-3`}>
                      {activeSubjectItem.results.map((image, index) => {
                        const key = `${activeSubjectItem.id}:${index}`;
                        const isOpen = !!refineOpen[key];
                        const isCurrentlyRefining = !!isRefining[key];
                        return (
                          <div key={key} className="animate-fade-in flex flex-col gap-1" style={{ animationDelay: `${index * 80}ms` }}>
                            <HoverableImage
                              image={image}
                              altText={`${t('generatedImage.altText')} ${index + 1}`}
                              onRegenerate={handleGenerateImage}
                              onUpscale={() => handleUpscale(image, index, activeSubjectItem.id)}
                              isGenerating={isLoading}
                              isUpscaling={upscalingStates[key]}
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
                                    if (e.key === 'Enter') handleRefine(image, index, activeSubjectItem.id, refinePrompts[key] || '');
                                  }}
                                  placeholder={t('imageActions.refinePromptPlaceholder')}
                                  autoFocus
                                  className="flex-1 min-w-0 bg-zinc-800/70 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                                  disabled={isCurrentlyRefining}
                                />
                                <button
                                  onClick={() => handleRefine(image, index, activeSubjectItem.id, refinePrompts[key] || '')}
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
                  ) : activeSubjectItem.status === 'processing' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-300">{t('virtualTryOn.processingItem')}</p>
                      <div className="grid grid-cols-3 gap-3">
                        {Array.from({ length: numImages }).map((_, index) => (
                          <div key={index} className="aspect-[3/4] bg-zinc-800/50 rounded-lg flex items-center justify-center animate-pulse">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-400 text-center">
                      {t('virtualTryOn.waitingStatus')}
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

export default VirtualTryOn;
