import React from 'react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import { Feature, VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES, VirtualTryOnSourceItemType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { AddIcon, DeleteIcon, CloudUploadIcon } from './Icons';
import Tooltip from './Tooltip';
import ResultPlaceholder from './shared/ResultPlaceholder';
import ImageOptionsPanel from './ImageOptionsPanel';
import { useVirtualTryOn } from '../hooks/useVirtualTryOn';
import { compressImage } from '../utils/imageUtils';
import WardrobeSetCard from './WardrobeSetCard';

const panelClass = 'rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5';
const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400';
const sectionTitleClass = 'text-lg font-semibold tracking-[-0.02em] text-zinc-50';
const helperClass = 'text-xs leading-5 text-zinc-400';
const secondaryButtonClass = 'inline-flex min-h-[34px] items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass = 'inline-flex min-h-[38px] items-center justify-center rounded-lg bg-[#f4f4f2] px-5 py-2 text-xs font-semibold tracking-[-0.01em] text-[#09090b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40';
const textareaClass = 'w-full rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs leading-5 text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';

const VirtualTryOn: React.FC = () => {
  const {
    mode,
    setMode,
    isAnyGenerating,
    wardrobe,
    subjectItems,
    subjectImages,
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
    clearSubjectImages,
    handleGenerateImage,
    handleRegenerateSingle,
    handleUpscale,
    handleRefine,
    handleSubjectImagesUpload,
    handleClothingUpload,
    handleSourceItemTypeChange,
    handleSourcePromptChange,
    addClothingUploader,
    removeClothingUploader,
    handleDownloadAll,
    anyUpscaling,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    isMultiPersonMode,
    setIsMultiPersonMode,
    markerPosition,
    setMarkerPosition,
    clearMarker,
  } = useVirtualTryOn();

  const { t } = useLanguage();
  const [refineOpen, setRefineOpen] = React.useState<Record<string, boolean>>({});
  const sourceItemsGridClass = clothingItems.length === 1
    ? 'space-y-3'
    : 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3';

  const toggleRefine = (key: string) =>
    setRefineOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleDirectSubjectChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file);
      handleSubjectImagesUpload([compressed]);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          handleSubjectImagesUpload([{ base64: reader.result.substring(reader.result.indexOf(',') + 1), mimeType: file.type }]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Mode Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-0.5">
          <button
            type="button"
            onClick={() => setMode('multi-model')}
            className={`flex min-h-[30px] items-center justify-center rounded-md px-3.5 py-1 text-xs font-medium transition-colors ${mode === 'multi-model' ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
              }`}
          >
            {t('virtualTryOn.modeMultiModel')}
          </button>
          <button
            type="button"
            onClick={() => setMode('wardrobe')}
            className={`flex min-h-[30px] items-center justify-center rounded-md px-3.5 py-1 text-xs font-medium transition-colors ${mode === 'wardrobe' ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
              }`}
          >
            {t('virtualTryOn.modeWardrobe')}
          </button>
        </div>
      </div>

      {mode === 'multi-model' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(520px,1fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">
            <section className={`${panelClass} space-y-5`}>
              <div className="space-y-3">
                <p className={labelClass}>{t('workspace.panels.subjectStage')}</p>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className={sectionTitleClass}>{t('virtualTryOn.step1')}</h3>
                    <p className={helperClass}>{t('virtualTryOn.outputPanelDescription')}</p>
                  </div>
                  <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-1">
                    <button
                      id="multi-person-toggle-single"
                      type="button"
                      onClick={() => setIsMultiPersonMode(false)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${!isMultiPersonMode ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
                        }`}
                    >
                      {t('workspace.modes.single')}
                    </button>
                    <button
                      id="multi-person-toggle-multi"
                      type="button"
                      onClick={() => setIsMultiPersonMode(true)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${isMultiPersonMode ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
                        }`}
                    >
                      {t('workspace.modes.multi')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-7">
                <Tooltip content={t('tooltips.tryOnSubject')} position="right" className="w-full">
                  <div className="space-y-3">
                    <p className="text-base font-semibold text-zinc-100">{t('virtualTryOn.subjectImagesTitle')}</p>
                    <div className="relative">
                      {isMultiPersonMode && subjectImages.length > 0 ? (
                        <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-black/40">
                          <img
                            src={`data:${subjectImages[0].mimeType};base64,${subjectImages[0].base64}`}
                            alt="Target subject"
                            className="max-h-full max-w-full object-contain pointer-events-none"
                          />
                          <div
                            id="multi-person-overlay"
                            className="absolute inset-0 z-10 cursor-crosshair"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const y = e.clientY - rect.top;
                              const relX = x / rect.width;
                              const relY = y / rect.height;
                              setMarkerPosition({ x, y, relX, relY });
                            }}
                          />
                          {markerPosition && (
                            <div
                              id="multi-person-marker"
                              className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500"
                              style={{
                                left: `${markerPosition.relX * 100}%`,
                                top: `${markerPosition.relY * 100}%`,
                              }}
                              aria-label="Multi-person target marker"
                            />
                          )}
                          <label className="absolute right-3 top-3 z-30 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-white/20 hover:bg-black/80">
                            <CloudUploadIcon className="h-3.5 w-3.5" />
                            <span>{t('common.changeImage')}</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleDirectSubjectChange}
                            />
                          </label>
                        </div>
                      ) : (
                        <MultiImageUploader
                          images={subjectImages}
                          id="subject-upload"
                          title={t('virtualTryOn.subjectImagesTitle')}
                          hideTitle
                          onImagesUpload={handleSubjectImagesUpload}
                        />
                      )}
                    </div>

                    {subjectImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={clearSubjectImages}
                          disabled={isLoading}
                          className={secondaryButtonClass}
                        >
                          {isMultiPersonMode ? `${t('virtualTryOn.clearMarker')} & ${t('common.image')}` : t('virtualTryOn.clearSubjects')}
                        </button>
                        {isMultiPersonMode && markerPosition && (
                          <button
                            id="clear-marker-btn"
                            type="button"
                            onClick={clearMarker}
                            disabled={isLoading}
                            className={secondaryButtonClass}
                          >
                            {t('virtualTryOn.clearMarker')}
                          </button>
                        )}
                      </div>
                    )}

                    {isMultiPersonMode && (
                      <p className="text-base leading-7 text-zinc-400">
                        {t('virtualTryOn.multiPersonModeHint')}
                      </p>
                    )}
                  </div>
                </Tooltip>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-zinc-100">{t('virtualTryOn.step2')}</p>
                    <p className="text-base leading-7 text-zinc-400">{t('virtualTryOn.sharedOutfitHint')}</p>
                  </div>
                  <div data-testid="source-items-grid" className={sourceItemsGridClass}>
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
                        <div className="mt-3 space-y-3">
                          <div className="space-y-2">
                            <label htmlFor={`source-item-type-${item.id}`} className="text-sm font-semibold text-zinc-200">
                              {t('virtualTryOn.sourceItemTypeLabel')}
                            </label>
                            <select
                              id={`source-item-type-${item.id}`}
                              value={item.sourceItemType}
                              onChange={(e) => handleSourceItemTypeChange(item.id, e.target.value as VirtualTryOnSourceItemType)}
                              disabled={isLoading}
                              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                            >
                              {VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES.map((type) => (
                                <option key={type} value={type} className="bg-zinc-950 text-zinc-100">
                                  {t(`virtualTryOn.sourceItemTypes.${type}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor={`source-item-prompt-${item.id}`} className="text-sm font-semibold text-zinc-200">
                              {t('virtualTryOn.sourcePromptLabel')}
                            </label>
                            <textarea
                              id={`source-item-prompt-${item.id}`}
                              value={item.sourcePrompt}
                              onChange={(e) => handleSourcePromptChange(item.id, e.target.value)}
                              disabled={isLoading}
                              rows={2}
                              maxLength={180}
                              placeholder={t('virtualTryOn.sourcePromptPlaceholder')}
                              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        </div>
                        {clothingItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeClothingUploader(item.id)}
                            disabled={isLoading}
                            className="absolute right-3 top-9 z-10 rounded-full border border-red-500/30 bg-black/70 p-1.5 text-red-200 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <DeleteIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Tooltip content={t('tooltips.tryOnAddClothing')} position="bottom" className="w-full">
                    <button
                      type="button"
                      onClick={addClothingUploader}
                      disabled={isLoading || clothingItems.length >= 4}
                      className={`${secondaryButtonClass} w-full gap-2`}
                    >
                      <AddIcon className="h-4 w-4" />
                      <span>{t('virtualTryOn.addItem')}</span>
                    </button>
                  </Tooltip>
                  <p className="text-base leading-7 text-zinc-400">{t('virtualTryOn.clothingUploadHint')}</p>
                </div>
              </div>
            </section>

            <section className={`${panelClass} space-y-5`}>
              <div className="space-y-2">
                <p className={labelClass}>{t('workspace.panels.stylingInputs')}</p>
                <h3 className={sectionTitleClass}>{t('virtualTryOn.step2')}</h3>
                <p className={helperClass}>{t('workspace.flows.tryOn')}</p>
              </div>

              <div className="space-y-5">
                <Tooltip content={t('tooltips.tryOnBackground')} position="bottom" className="w-full">
                  <div className="space-y-2">
                    <label htmlFor="background-prompt" className="text-base font-semibold text-zinc-100">
                      {t('virtualTryOn.backgroundPromptLabel')}
                    </label>
                    <textarea
                      id="background-prompt"
                      value={backgroundPrompt}
                      onChange={(e) => setBackgroundPrompt(e.target.value)}
                      placeholder={t('virtualTryOn.backgroundPromptPlaceholder')}
                      rows={3}
                      className={textareaClass}
                    />
                    <p className="text-base leading-7 text-zinc-400">{t('virtualTryOn.backgroundPromptDescription')}</p>
                  </div>
                </Tooltip>

                <Tooltip content={t('tooltips.tryOnInstructions')} position="bottom" className="w-full">
                  <div className="space-y-2">
                    <label htmlFor="extra-prompt" className="text-base font-semibold text-zinc-100">
                      {t('virtualTryOn.extraPromptLabel')}
                    </label>
                    <textarea
                      id="extra-prompt"
                      value={extraPrompt}
                      onChange={(e) => setExtraPrompt(e.target.value)}
                      placeholder={t('virtualTryOn.extraPromptPlaceholder')}
                      rows={3}
                      className={textareaClass}
                    />
                    <p className="text-base leading-7 text-zinc-400">{t('virtualTryOn.extraPromptDescription')}</p>
                  </div>
                </Tooltip>

                <div className="space-y-4">
                  <ImageOptionsPanel
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    resolution={resolution}
                    setResolution={setResolution}
                    model={imageEditModel}
                  />

                  <Tooltip content={t('tooltips.tryOnImageCount')} position="top">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-zinc-300">
                        <label htmlFor="num-images-slider" className="font-medium">
                          {t('virtualTryOn.numberOfImages')}
                        </label>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-100">
                          {numImages}
                        </span>
                      </div>
                      <input
                        id="num-images-slider"
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={numImages}
                        onChange={(e) => setNumImages(Number(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>
                  </Tooltip>

                  <button
                    type="button"
                    onClick={handleGenerateImage}
                    disabled={isAnyGenerating || anyUpscaling || !canGenerate}
                    className={`${primaryButtonClass} w-full`}
                  >
                    {isLoading ? <Spinner /> : t('virtualTryOn.generateButton')}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className={`${panelClass} sticky top-8 min-h-[70vh]`}>
            {subjectItems.length === 0 ? (
              <div className="flex h-full min-h-[64vh] items-center justify-center">
                <ResultPlaceholder description={t('virtualTryOn.outputPanelDescription')} />
              </div>
            ) : (
              <div className="flex h-full flex-col gap-5">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <p className={labelClass}>{t('workspace.panels.resultStage')}</p>
                    <h3 className={sectionTitleClass}>{t('virtualTryOn.batchResultsTitle')}</h3>
                    <p className="text-base leading-7 text-zinc-400">
                      {t('virtualTryOn.batchProgress', {
                        completed: completedCount,
                        total: subjectItems.length,
                        failed: failedCount,
                      })}
                    </p>
                  </div>

                  {completedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadAll}
                      disabled={isLoading}
                      className={secondaryButtonClass}
                    >
                      {t('common.downloadBatch')}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    <div className="flex items-start justify-between gap-3">
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)} className="text-xs text-red-100 hover:text-white">
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <p className="text-sm text-zinc-400">
                    {loadingMessage || t('virtualTryOn.generatingStatus')}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                  {subjectItems.flatMap((item, itemIdx) =>
                    item.results.length > 0
                      ? item.results.map((image, index) => {
                        const key = `${item.id}:${index}`;
                        const isOpen = !!refineOpen[key];
                        const isCurrentlyRefining = !!isRefining[key];

                        return (
                          <div
                            key={key}
                            className="animate-fade-in flex flex-col gap-3 rounded-[24px] border border-white/10 bg-black/30 p-3"
                            style={{ animationDelay: `${(itemIdx * 4 + index) * 60}ms` }}
                          >
                            <div className="relative">
                              <HoverableImage
                                image={image}
                                altText={`${t('virtualTryOn.subjectBatchLabel', { index: itemIdx + 1 })} - ${t('generatedImage.altText')} ${index + 1}`}
                                downloadPrefix={Feature.TryOn}
                                onRegenerate={() => handleRegenerateSingle(item.id)}
                                onUpscale={() => handleUpscale(image, index, item.id)}
                                isGenerating={isLoading}
                                isUpscaling={upscalingStates[key]}
                              />
                              {subjectItems.length > 1 && (
                                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-zinc-300 backdrop-blur-sm">
                                  <div className="h-4 w-4 overflow-hidden rounded-full border border-white/10">
                                    <img src={`data:${item.subjectImage.mimeType};base64,${item.subjectImage.base64}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                  </div>
                                  <span>#{itemIdx + 1}</span>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleRefine(key)}
                              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                            >
                              {t('imageActions.refineButton')}
                            </button>

                            {isOpen && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={refinePrompts[key] || ''}
                                  onChange={(e) => setRefinePrompts((prev) => ({ ...prev, [key]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRefine(image, index, item.id, refinePrompts[key] || '');
                                    }
                                  }}
                                  placeholder={t('imageActions.refinePromptPlaceholder')}
                                  autoFocus
                                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                                  disabled={isCurrentlyRefining}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRefine(image, index, item.id, refinePrompts[key] || '')}
                                  disabled={isCurrentlyRefining || !(refinePrompts[key] || '').trim()}
                                  className={primaryButtonClass}
                                >
                                  {isCurrentlyRefining ? <Spinner /> : t('imageActions.refineButton')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                      : item.status === 'processing' || item.status === 'pending'
                        ? [
                          <div
                            key={`${item.id}-skeleton`}
                            className={`flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-black/30 p-4 ${item.status === 'processing' ? 'animate-pulse' : ''
                              }`}
                          >
                            {item.status === 'processing' ? (
                              <Spinner className="h-8 w-8 border-white" />
                            ) : (
                              <p className="text-sm text-zinc-500">{t('virtualTryOn.waitingStatus')}</p>
                            )}
                            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-zinc-300">
                              <div className="h-4 w-4 overflow-hidden rounded-full border border-white/10">
                                <img src={`data:${item.subjectImage.mimeType};base64,${item.subjectImage.base64}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              </div>
                              <span>#{itemIdx + 1}</span>
                            </div>
                          </div>,
                        ]
                        : []
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {mode === 'wardrobe' && (
        <div className="grid gap-8 xl:grid-cols-[minmax(620px,1fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            <section className={`${panelClass} space-y-5`}>
              <div className="space-y-3">
                <p className={labelClass}>{t('workspace.panels.subjectStage')}</p>
                <h3 className={sectionTitleClass}>{t('virtualTryOn.wardrobeSubjectLabel')}</h3>
                <p className={helperClass}>{t('virtualTryOn.outputPanelDescription')}</p>
              </div>

              <ImageUploader
                image={wardrobe.subject}
                id="wardrobe-subject-upload"
                title={t('virtualTryOn.wardrobeSubjectLabel')}
                onImageUpload={(file) => wardrobe.setSubject(file)}
              />

              {wardrobe.subject && (
                <button
                  type="button"
                  onClick={wardrobe.clearSubject}
                  disabled={isAnyGenerating}
                  className={secondaryButtonClass}
                >
                  {t('virtualTryOn.clearSubjects')}
                </button>
              )}
            </section>

            <section className={`${panelClass} space-y-5`}>
              <div className="space-y-2">
                <p className={labelClass}>{t('workspace.panels.stylingInputs')}</p>
                <h3 className={sectionTitleClass}>{t('virtualTryOn.wardrobeResultsTitle')}</h3>
              </div>

              <div className="space-y-4">
                {wardrobe.sets.map((set, idx) => (
                  <WardrobeSetCard
                    key={set.id}
                    setIndex={idx}
                    items={set.items}
                    maxItems={wardrobe.maxItemsPerSet}
                    disabled={isAnyGenerating}
                    canRemove={wardrobe.sets.length > 1}
                    onAddItem={() => wardrobe.addItem(set.id)}
                    onRemoveItem={(itemId) => wardrobe.removeItem(set.id, itemId)}
                    onUpdateItem={(itemId, updates) => wardrobe.updateItem(set.id, itemId, updates)}
                    onRemoveSet={() => wardrobe.removeSet(set.id)}
                    data-testid={`wardrobe-set-${idx}`}
                  />
                ))}

                <button
                  type="button"
                  onClick={wardrobe.addSet}
                  disabled={isAnyGenerating || wardrobe.sets.length >= wardrobe.maxSets}
                  className={`${secondaryButtonClass} w-full gap-2`}
                >
                  <AddIcon className="h-4 w-4" />
                  <span>{wardrobe.sets.length >= wardrobe.maxSets ? t('virtualTryOn.maxSetsReached') : t('virtualTryOn.addSet')}</span>
                </button>
              </div>
            </section>

            <section className={`${panelClass} space-y-5`}>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="wardrobe-background-prompt" className="text-base font-semibold text-zinc-100">
                    {t('virtualTryOn.wardrobeBackgroundPrompt')}
                  </label>
                  <textarea
                    id="wardrobe-background-prompt"
                    value={wardrobe.backgroundPrompt}
                    onChange={(e) => wardrobe.setBackgroundPrompt(e.target.value)}
                    placeholder={t('virtualTryOn.backgroundPromptPlaceholder')}
                    rows={3}
                    className={textareaClass}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="wardrobe-extra-prompt" className="text-base font-semibold text-zinc-100">
                    {t('virtualTryOn.wardrobeExtraPrompt')}
                  </label>
                  <textarea
                    id="wardrobe-extra-prompt"
                    value={wardrobe.extraPrompt}
                    onChange={(e) => wardrobe.setExtraPrompt(e.target.value)}
                    placeholder={t('virtualTryOn.extraPromptPlaceholder')}
                    rows={3}
                    className={textareaClass}
                  />
                </div>

                <ImageOptionsPanel
                  aspectRatio={aspectRatio}
                  setAspectRatio={setAspectRatio}
                  resolution={resolution}
                  setResolution={setResolution}
                  model={imageEditModel}
                />

                <button
                  type="button"
                  onClick={wardrobe.generate}
                  disabled={isAnyGenerating || !wardrobe.subject || !wardrobe.sets.some((s) => s.items.some((i) => i.image !== null))}
                  className={`${primaryButtonClass} w-full`}
                >
                  {wardrobe.isGenerating ? <Spinner /> : t('virtualTryOn.generateAllSets')}
                </button>
              </div>
            </section>
          </div>

          <section className={`${panelClass} sticky top-8 min-h-[70vh]`}>
            {wardrobe.results.length === 0 ? (
              <div className="flex h-full min-h-[64vh] items-center justify-center">
                <ResultPlaceholder description={t('virtualTryOn.outputPanelDescription')} />
              </div>
            ) : (
              <div className="flex h-full flex-col gap-5">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <p className={labelClass}>{t('workspace.panels.resultStage')}</p>
                    <h3 className={sectionTitleClass}>{t('virtualTryOn.wardrobeResultsTitle')}</h3>
                    <p className="text-base leading-7 text-zinc-400">
                      {t('virtualTryOn.wardrobeProgress', {
                        completed: wardrobe.results.filter((r) => r.status === 'completed').length,
                        total: wardrobe.results.length,
                      })}
                    </p>
                  </div>

                  {wardrobe.results.some((r) => r.status === 'completed') && (
                    <button
                      type="button"
                      onClick={wardrobe.download}
                      disabled={isAnyGenerating}
                      className={secondaryButtonClass}
                    >
                      {t('common.downloadBatch')}
                    </button>
                  )}
                </div>

                {wardrobe.error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    <span>{wardrobe.error}</span>
                  </div>
                )}

                {wardrobe.isGenerating && (
                  <p className="text-sm text-zinc-400">
                    {wardrobe.loadingMessage || t('virtualTryOn.generatingStatus')}
                  </p>
                )}

                <div className="space-y-6 overflow-y-auto pr-1">
                  {wardrobe.results.map((resultSet, setIdx) => (
                    <div key={resultSet.setId} className="space-y-3">
                      <p className="text-sm font-semibold text-zinc-200">
                        {t('virtualTryOn.wardrobeSetLabel', { number: setIdx + 1 })}
                      </p>
                      {resultSet.status === 'error' && (
                        <p className="text-sm text-red-300">{resultSet.error}</p>
                      )}
                      {(resultSet.status === 'processing' || resultSet.status === 'pending') && (
                        <div className="flex aspect-[3/4] max-h-48 items-center justify-center rounded-xl border border-white/10 bg-black/30 animate-pulse">
                          <Spinner className="h-8 w-8 border-white" />
                        </div>
                      )}
                      {resultSet.status === 'completed' && resultSet.results.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {resultSet.results.map((image, imgIdx) => (
                            <HoverableImage
                              key={`${resultSet.setId}-${imgIdx}`}
                              image={image}
                              altText={`${t('virtualTryOn.wardrobeSetLabel', { number: setIdx + 1 })} - ${imgIdx + 1}`}
                              downloadPrefix={Feature.TryOn}
                              isGenerating={false}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
};

export default VirtualTryOn;
