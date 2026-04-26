import React from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay, ProgressBar } from './Spinner';
import HoverableImage from './HoverableImage';
import { Feature } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { usePoseChanger } from '../hooks/usePoseChanger';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';

const PhotoAlbumIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
  </svg>
);

const WandIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 21.75l-.648-1.188a2.25 2.25 0 00-1.423-1.423L12.937 18.5l1.188-.648a2.25 2.25 0 001.423-1.423L16.25 15l.648 1.188a2.25 2.25 0 001.423 1.423l1.188.648-1.188.648a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

interface PoseChangerProps {
  onOpenPoseLibrary: (onConfirm: (poses: string[]) => void, initialPoses: string[]) => void;
}

const PoseChanger: React.FC<PoseChangerProps> = ({ onOpenPoseLibrary }) => {
  const { t } = useLanguage();
  const {
    subjectImage,
    setSubjectImage,
    poseReferenceImage,
    customPosePrompt,
    selectedLibraryPoses,
    generatedImages,
    upscalingStates,
    regeneratingStates,
    isLoading,
    isGeneratingPoseDescription,
    generationStatus,
    error,
    negativePrompt,
    setNegativePrompt,
    cameraView,
    setCameraView,
    cameraViewOptions,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    imageEditModel,
    isGenerateDisabled,
    buttonText,
    handleCustomPosePromptChange,
    handleGeneratePoseDescription,
    handleGenerate,
    handleRegenerateSingle,
    handleUpscale,
    handlePoseReferenceUpload,
    handleConfirmSelection,
    clearError,
  } = usePoseChanger();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
        <div className="flex flex-col gap-6">
          <h2 className="text-xl md:text-2xl font-bold text-center">{t('pose.title')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploader image={subjectImage} id="pose-subject-upload" title={t('pose.subjectUploadTitle')} onImageUpload={setSubjectImage} />
            <div>
              <ImageUploader image={poseReferenceImage} id="pose-reference-upload" title={t('pose.referenceUploadTitle')} onImageUpload={handlePoseReferenceUpload} />
              <div className="text-center mt-2">
                <button
                  onClick={handleGeneratePoseDescription}
                  disabled={isGeneratingPoseDescription || !poseReferenceImage}
                  className="w-full bg-zinc-700 text-zinc-200 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                  aria-label={t('pose.generatePoseDescriptionAria')}
                >
                  {isGeneratingPoseDescription ? (
                    <Spinner />
                  ) : (
                    <>
                      <WandIcon className="w-4 h-4" />
                      <span>{t('pose.generatePoseDescriptionButton')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-base md:text-lg font-semibold text-center text-zinc-100 mb-4">{t('pose.orTitle')}</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="pose-prompt" className="block text-sm font-medium text-zinc-300 mb-2">{t('pose.customPoseLabel')}</label>
                <textarea
                  id="pose-prompt"
                  value={customPosePrompt}
                  onChange={(event) => handleCustomPosePromptChange(event.target.value)}
                  placeholder={t('pose.customPosePlaceholder')}
                  rows={2}
                  className="workspace-input p-3"
                />
              </div>

              <div className="text-center text-zinc-400 text-sm font-semibold">{t('pose.orDivider')}</div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">{t('pose.libraryLabel')}</label>
                <div className="p-3 bg-zinc-800/50 rounded-lg flex items-center justify-between">
                  <p className="text-zinc-200">
                    {selectedLibraryPoses.length > 0
                      ? t('pose.posesSelected', { count: selectedLibraryPoses.length })
                      : t('pose.noPosesSelected')}
                  </p>
                  <button
                    onClick={() => onOpenPoseLibrary(handleConfirmSelection, selectedLibraryPoses)}
                    className="workspace-button workspace-button-primary min-h-0 px-4 py-2 text-sm font-semibold"
                  >
                    <PhotoAlbumIcon className="w-5 h-5" />
                    {t('pose.browseLibraryButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
            <div>
              <label htmlFor="negative-prompt-pose" className="block text-sm font-medium text-zinc-300 mb-2">{t('common.negativePromptLabel')}</label>
              <textarea
                id="negative-prompt-pose"
                value={negativePrompt}
                onChange={(event) => setNegativePrompt(event.target.value)}
                placeholder={t('pose.negativePromptPlaceholder')}
                rows={2}
                className="workspace-input p-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2 text-center">{t('cameraView.label')}</label>
              <div className="flex justify-center">
                <div className="flex flex-wrap justify-center gap-1 p-1 bg-zinc-800/50 rounded-lg">
                  {cameraViewOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setCameraView(option.key)}
                      className={`px-2 py-1.5 text-xs font-semibold rounded-md border transition-colors duration-200 ${cameraView === option.key ? 'border-white/60 bg-zinc-100 text-zinc-950' : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-100'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ImageOptionsPanel
              aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
              resolution={resolution} setResolution={setResolution}
              model={imageEditModel}
            />
          </div>

          <div className="text-center">
            <button onClick={handleGenerate} disabled={isGenerateDisabled} className="workspace-button workspace-button-primary px-8 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {generationStatus.active || isLoading ? <Spinner /> : buttonText}
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-8">
          <div className="relative w-full min-h-[400px] lg:min-h-0 lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 p-2 sm:p-4 flex flex-col items-center justify-center">
            {isLoading || generationStatus.active ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Spinner />
                <p className="text-zinc-400">{generationStatus.message}</p>
                {generationStatus.total > 1 && (
                  <ProgressBar progress={generationStatus.progress} total={generationStatus.total} />
                )}
              </div>
            ) : error ? (
              <div className="p-4">
                <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={clearError} />
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="w-full h-full overflow-y-auto pr-2">
                <h3 className="text-xl font-semibold text-center mb-4 text-zinc-100">{t('pose.generatedPosesTitle', { count: generatedImages.length })}</h3>
                <div className={`grid gap-4 ${generatedImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {generatedImages.map((image, index) => (
                    <HoverableImage
                      key={index}
                      image={image}
                      altText={t('pose.generatedPoseAlt', { index: index + 1 })}
                      downloadPrefix={Feature.Pose}
                      onRegenerate={poseReferenceImage ? handleGenerate : () => handleRegenerateSingle(index)}
                      onUpscale={() => handleUpscale(image, index)}
                      isGenerating={generationStatus.active || isLoading || regeneratingStates[index]}
                      isUpscaling={upscalingStates[index]}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <ResultPlaceholder description={t('pose.outputPanelDescription')} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PoseChanger;
