import React from 'react';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { useLanguage } from '../contexts/LanguageContext';
import { usePatternGenerator } from '../hooks/usePatternGenerator';

const PatternGenerator: React.FC = () => {
  const {
    referenceImages,
    generatedPatterns,
    numImages,
    selectedPatternIndex,
    showTilingPreview,
    isLoading,
    loadingMessage,
    error,
    refinePrompt,
    isRefining,
    canGenerate,
    canRefine,
    selectedPattern,
    setReferenceImages,
    setNumImages,
    setSelectedPatternIndex,
    setShowTilingPreview,
    setRefinePrompt,
    setError,
    handleGenerate,
    handleRefine,
    handleDownloadSelected,
    handleDownloadAllZip,
  } = usePatternGenerator();
  const { t } = useLanguage();

  const getPatternAltText = (index: number) => {
    const translated = t('patternGenerator.patternAlt', { index });
    return translated === 'patternGenerator.patternAlt' ? `Pattern ${index}` : translated;
  };

  const getPatternPreviewAltText = (index: number) => {
    const translated = t('patternGenerator.patternPreviewAlt', { index });
    return translated === 'patternGenerator.patternPreviewAlt'
      ? `Selected pattern preview ${index}`
      : translated;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-center flex-shrink-0">{t('patternGenerator.title')}</h2>
          <p className="text-xs text-center text-zinc-400">{t('patternGenerator.providerNotice')}</p>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
          <h3 className="text-lg font-semibold text-center text-amber-400">{t('patternGenerator.referenceTitle')}</h3>
          <p className="text-sm text-center text-zinc-400">{t('patternGenerator.referenceHint')}</p>
          <MultiImageUploader
            images={referenceImages}
            id="pattern-generator-reference-images"
            title={t('patternGenerator.referenceTitle')}
            onImagesUpload={setReferenceImages}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>{t('patternGenerator.numImagesLabel')}</span>
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

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
          >
            {isLoading ? <Spinner /> : t('patternGenerator.generateButton')}
          </button>
        </div>
      </div>

      <div className="sticky top-8">
        <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-4">
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

          {(isLoading || isRefining) && (
            <p className="text-xs text-amber-300 animate-pulse text-center">
              {loadingMessage || (isRefining ? t('patternGenerator.refiningStatus') : t('patternGenerator.generatingStatus'))}
            </p>
          )}

          {generatedPatterns.length === 0 ? (
            <ResultPlaceholder description={t('patternGenerator.placeholderText')} />
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 text-center">
                  {t('patternGenerator.outputTitle')}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {generatedPatterns.map((pattern, index) => (
                    <button
                      key={`${pattern.base64.slice(0, 16)}-${index}`}
                      type="button"
                      onClick={() => setSelectedPatternIndex(index)}
                      className={`rounded-xl overflow-hidden border transition-colors ${selectedPatternIndex === index ? 'border-amber-400' : 'border-zinc-700 hover:border-zinc-500'}`}
                    >
                      <HoverableImage
                        image={pattern}
                        altText={getPatternAltText(index + 1)}
                        containerClassName="w-full aspect-square"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{t('patternGenerator.tilingPreview')}</span>
                  <button
                    type="button"
                    onClick={() => setShowTilingPreview(!showTilingPreview)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {t('patternGenerator.tilingToggle')}
                  </button>
                </div>

                {selectedPattern ? (
                  <div className={`grid ${showTilingPreview ? 'grid-cols-2' : 'grid-cols-1'} gap-2 rounded-xl overflow-hidden`}>
                    {Array.from({ length: showTilingPreview ? 4 : 1 }).map((_, index) => (
                      <HoverableImage
                        key={index}
                        image={selectedPattern}
                        altText={getPatternPreviewAltText(index + 1)}
                        containerClassName="w-full aspect-square"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 text-center">{t('patternGenerator.noPatternSelected')}</p>
                )}

                <div className="space-y-2">
                  <label htmlFor="pattern-refine-prompt" className="text-sm text-zinc-300">
                    {t('patternGenerator.refineLabel')}
                  </label>
                  <textarea
                    id="pattern-refine-prompt"
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder={t('patternGenerator.refinePlaceholder')}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRefine}
                    disabled={!canRefine || !refinePrompt.trim()}
                    className="w-full rounded-lg border border-amber-500/40 text-amber-400 py-2 text-sm font-medium hover:border-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRefining ? <Spinner /> : t('patternGenerator.refineButton')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadSelected}
                    disabled={!selectedPattern}
                    className="rounded-lg border border-zinc-700 py-2 text-sm text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('patternGenerator.downloadSelected')}
                  </button>
                  {generatedPatterns.length > 1 && (
                    <button
                      type="button"
                      onClick={handleDownloadAllZip}
                      className="rounded-lg border border-zinc-700 py-2 text-sm text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('patternGenerator.downloadAll')}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatternGenerator;
