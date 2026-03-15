import React from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { useLanguage } from '../contexts/LanguageContext';
import { AddIcon, DeleteIcon } from './Icons';
import ResultPlaceholder from './shared/ResultPlaceholder';
import ImageOptionsPanel from './ImageOptionsPanel';
import { useClothingTransfer } from '../hooks/useClothingTransfer';

const ClothingTransfer: React.FC = () => {
  const {
    referenceItems, conceptImage, extraPrompt, numImages,
    aspectRatio, resolution, isLoading, loadingMessage,
    error, generatedImages, upscalingStates,
    setExtraPrompt, setNumImages, setAspectRatio, setResolution, setError,
    handleReferenceUpload, handleReferenceLabel, addReference, removeReference,
    handleConceptUpload, handleGenerate, handleUpscale,
    validReferences, anyUpscaling, imageEditModel,
  } = useClothingTransfer();

  const { t } = useLanguage();

  const getGridColsClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    return 'grid-cols-1 sm:grid-cols-2';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* Left panel — inputs */}
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
          <button
            onClick={addReference}
            className="w-full mt-3 bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <AddIcon className="w-5 h-5" /><span>{t('clothingTransfer.addOutfit')}</span>
          </button>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('clothingTransfer.step2')}</h3>
          <div className="max-w-[50%] mx-auto">
            <ImageUploader
              image={conceptImage}
              id="concept-upload"
              title={t('clothingTransfer.conceptTitle')}
              onImageUpload={handleConceptUpload}
            />
          </div>
        </div>

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
              aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
              resolution={resolution} setResolution={setResolution}
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
            disabled={isLoading || anyUpscaling || validReferences.length === 0 || !conceptImage}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
          >
            {isLoading ? <Spinner /> : t('clothingTransfer.generateButton')}
          </button>
        </div>
      </div>

      {/* Right panel — results */}
      <div className="sticky top-8">
        <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col min-h-[50vh] lg:min-h-0 lg:aspect-[4/5] items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col h-full gap-4 w-full">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse flex-shrink-0">
                {loadingMessage || t('clothingTransfer.generatingStatus')}
              </h3>
              <div className={`grid ${getGridColsClass(numImages)} gap-4 w-full flex-1 min-h-0`}>
                {Array.from({ length: numImages }).map((_, index) => (
                  <div key={index} className="aspect-[4/5] bg-zinc-800/50 rounded-lg flex items-center justify-center animate-pulse">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
            </div>
          ) : generatedImages.length > 0 ? (
            <div className="flex flex-col h-full gap-4 w-full overflow-hidden">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 flex-shrink-0">
                {t('generatedImage.outputTitle')}
              </h3>
              <div className={`grid ${getGridColsClass(generatedImages.length)} gap-4 w-full flex-1 min-h-0 ${generatedImages.length > 2 ? 'overflow-y-auto pr-2' : 'overflow-hidden'}`}>
                {generatedImages.map((image, index) => (
                  <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <HoverableImage
                      image={image}
                      altText={`${t('generatedImage.altText')} ${index + 1}`}
                      onRegenerate={handleGenerate}
                      onUpscale={() => handleUpscale(image, index)}
                      isGenerating={isLoading}
                      isUpscaling={upscalingStates[index]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResultPlaceholder description={t('clothingTransfer.outputPanelDescription')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ClothingTransfer;
