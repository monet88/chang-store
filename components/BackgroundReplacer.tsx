
import React from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { useLanguage } from '../contexts/LanguageContext';
import { MagicWandIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { useBackgroundReplacer } from '../hooks/useBackgroundReplacer';

const BackgroundReplacer: React.FC = () => {
  const { t } = useLanguage();
  const {
    subjectImage,
    setSubjectImage,
    backgroundImage,
    setBackgroundImage,
    promptText,
    setPromptText,
    selectedPredefinedKey,
    setSelectedPredefinedKey,
    generatedImages,
    isLoading,
    loadingMessage,
    upscalingStates,
    isGeneratingDescription,
    error,
    setError,
    negativePrompt,
    setNegativePrompt,
    cameraView,
    setCameraView,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    handleGenerate,
    handleUpscale,
    handleRefine,
    handleGenerateDescription,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    PREDEFINED_BG_KEYS,
    allBackgroundPrompts,
  } = useBackgroundReplacer();

  const allBackgroundLabels: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
  const predefinedBackgroundOptions = PREDEFINED_BG_KEYS.map((key) => ({
    key,
    label: allBackgroundLabels[key],
  }));

  const cameraViewOptions = [
    { key: 'default', label: t('cameraView.options.default') },
    { key: 'fullBody', label: t('cameraView.options.fullBody') },
    { key: 'halfBody', label: t('cameraView.options.halfBody') },
    { key: 'kneesUp', label: t('cameraView.options.kneesUp') },
  ];

  const handlePredefinedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setSelectedPredefinedKey(key);
    if (key !== 'custom') {
      setPromptText(allBackgroundPrompts[key] ?? '');
      setBackgroundImage(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* --- Left Column: Inputs & Controls --- */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-center mb-1">{t('background.title')}</h2>
          <p className="text-zinc-400 text-center">{t('background.description')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImageUploader image={subjectImage} id="subject-upload" title={t('background.subjectUploadTitle')} onImageUpload={setSubjectImage} />
          <div>
            <ImageUploader image={backgroundImage} id="background-upload" title={t('background.backgroundUploadTitle')} onImageUpload={setBackgroundImage} />
            {backgroundImage && (
              <div className="text-center mt-2">
                <button
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDescription}
                  className="w-full bg-zinc-700 text-zinc-200 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                  aria-label={t('background.generateDescriptionAria')}
                >
                  {isGeneratingDescription ? (
                    <Spinner />
                  ) : (
                    <>
                      <MagicWandIcon className="w-4 h-4" />
                      <span>{t('background.generateDescriptionButton')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="predefined-bg-select" className="block text-sm font-medium text-zinc-300 mb-2">{t('predefinedBackgrounds.title')}</label>
          <select
            id="predefined-bg-select"
            value={selectedPredefinedKey}
            onChange={handlePredefinedChange}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
            }}
          >
            <option value="custom">{t('background.describeLabel')}</option>
            {predefinedBackgroundOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <textarea
            id="bg-prompt"
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (backgroundImage) setBackgroundImage(null);
              setSelectedPredefinedKey('custom');
            }}
            placeholder={t('background.describePlaceholder')}
            rows={3}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="negative-prompt-bg" className="block text-sm font-medium text-zinc-300 mb-2">{t('common.negativePromptLabel')}</label>
          <textarea
            id="negative-prompt-bg"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder={t('background.negativePromptPlaceholder')}
            rows={2}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          />
          <p className="text-xs text-zinc-500 mt-1">{t('common.negativePromptHelp')}</p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2 text-center">{t('cameraView.label')}</label>
          <div className="flex justify-center">
            <div className="flex flex-wrap justify-center gap-2 p-1.5 bg-zinc-800/50 rounded-lg">
              {cameraViewOptions.map((opt) => (
                <button key={opt.key} onClick={() => setCameraView(opt.key)} className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-200 ${cameraView === opt.key ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <ImageOptionsPanel
            aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
            resolution={resolution} setResolution={setResolution}
            model={imageEditModel}
          />
        </div>

        <div className="text-center pt-2">
          <button
            onClick={handleGenerate}
            disabled={isLoading || Object.values(upscalingStates).some((s) => s) || !subjectImage || (!backgroundImage && !promptText)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
          >
            {isLoading ? <Spinner /> : t('background.generateButton')}
          </button>
        </div>
      </div>

      {/* --- Right Column: Output --- */}
      <div className="lg:sticky lg:top-8 lg:h-full">
        <div className="relative w-full min-h-[400px] lg:min-h-0 lg:h-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-2 sm:p-4 flex flex-col">
          {isLoading ? (
            <div className="flex flex-col h-full gap-4">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse">
                {loadingMessage || t('background.generatingStatus')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="aspect-[4/5] bg-zinc-800/50 rounded-lg flex items-center justify-center animate-pulse">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex-grow flex items-center justify-center p-4">
              <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
            </div>
          ) : generatedImages.length > 0 ? (
            <div className="flex flex-col h-full gap-4">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {t('generatedImage.outputTitle')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {generatedImages.map((image, index) => (
                  <div key={index}>
                    <HoverableImage
                      image={image}
                      altText={`${t('generatedImage.altText')} ${index + 1}`}
                      onRegenerate={handleGenerate}
                      onUpscale={() => handleUpscale(image, index)}
                      isGenerating={isLoading}
                      isUpscaling={upscalingStates[index]}
                    />
                    {/* Refine prompt UI */}
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={refinePrompts[String(index)] || ''}
                        onChange={(e) => setRefinePrompts((prev) => ({ ...prev, [String(index)]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(image, index, refinePrompts[String(index)] || ''); }}
                        placeholder={t('imageActions.refinePromptPlaceholder')}
                        className="flex-1 min-w-0 bg-zinc-800/50 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                        disabled={isRefining[String(index)]}
                      />
                      <button
                        onClick={() => handleRefine(image, index, refinePrompts[String(index)] || '')}
                        disabled={isRefining[String(index)] || !(refinePrompts[String(index)] || '').trim()}
                        className="flex-shrink-0 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isRefining[String(index)] ? <Spinner /> : t('imageActions.refineButton')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResultPlaceholder description={t('background.outputPanelDescription')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default BackgroundReplacer;
