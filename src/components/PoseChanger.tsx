
import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay, ProgressBar } from './Spinner';
import HoverableImage from './HoverableImage';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generatePoseDescription } from '../services/textService';
import { ImageFile, PoseCollection, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';

const ImageIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

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
  const [subjectImage, setSubjectImage] = useState<ImageFile | null>(null);
  const [poseReferenceImage, setPoseReferenceImage] = useState<ImageFile | null>(null);

  const [customPosePrompt, setCustomPosePrompt] = useState('');
  const [selectedLibraryPoses, setSelectedLibraryPoses] = useState<string[]>([]);

  const [generatedImages, setGeneratedImages] = useState<ImageFile[]>([]);
  const [upscalingStates, setUpscalingStates] = useState<Record<number, boolean>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPoseDescription, setIsGeneratingPoseDescription] = useState(false);
  const [generationStatus, setGenerationStatus] = useState({ active: false, progress: 0, total: 0, message: '' });
  const [error, setError] = useState<string | null>(null);

  const [negativePrompt, setNegativePrompt] = useState('');
  const [cameraView, setCameraView] = useState<string>('fullBody');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const { t } = useLanguage();
  const { imageEditModel, textGenerateModel } = useApi();
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
  });

  const allPrompts = [...selectedLibraryPoses, ...(customPosePrompt.trim() ? [customPosePrompt.trim()] : [])];
  const totalPrompts = allPrompts.length;

  const handleGeneratePoseDescription = async () => {
    if (!poseReferenceImage) {
      setError(t('pose.poseReferenceMissingError'));
      return;
    }
    setIsGeneratingPoseDescription(true);
    setError(null);
    try {
      const description = await generatePoseDescription(poseReferenceImage, textGenerateModel);
      setCustomPosePrompt(description);
      setPoseReferenceImage(null);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingPoseDescription(false);
    }
  };

  const getFramingInstruction = () => {
    if (cameraView === 'default') {
      return "Use default framing provided by the model.";
    }
    const keyMap: Record<string, string> = {
      fullBody: 'fullBody',
      halfBody: 'halfBody',
      kneesUp: 'kneesUp',
    };
    const instructionKey = `framingInstructions.${keyMap[cameraView]}`;
    return t(instructionKey) || "Use default framing provided by the model.";
  };

  const handleGenerate = async () => {
    if (!subjectImage) {
      setError(t('pose.subjectError'));
      return;
    }

    // Reset states
    setError(null);
    setGeneratedImages([]);
    const framingInstruction = getFramingInstruction();

    // --- Single Generation with Pose Reference Image ---
    if (poseReferenceImage) {
      setIsLoading(true);
      setGenerationStatus({ active: true, progress: 1, total: 1, message: t('pose.generatingStatusOne') });
      const imagesForApi: ImageFile[] = [subjectImage, poseReferenceImage];
      const prompt = `
          **Task**: Photorealistically transfer the pose from a 'Pose Reference Image' onto the model in a 'Subject Image', while perfectly preserving the model, their clothing, and the background.
          **Image Roles**:
          -   **First Image ('Subject Image')**: Contains the model, clothing, and background to be preserved.
          -   **Second Image ('Pose Reference Image')**: Provides the target pose.
          **CRITICAL RULES**:
          1.  **Extract Pose**: Analyze the 'Pose Reference Image' to understand the exact body position.
          2.  **Preserve Subject, Clothing, and Background**: The model's identity, their entire outfit, and the entire background from the 'Subject Image' MUST be preserved with 100% accuracy.
          3.  **Apply Pose**: Re-render the model from the 'Subject Image' in the exact pose extracted from the 'Pose Reference Image'.
          4.  **Photorealistic Integration**: The model's body must be anatomically correct, clothing redraped realistically, and lighting must match.
          5.  **Camera Framing**: ${framingInstruction}
          ${customPosePrompt.trim() ? `**Additional Text Instruction**: While applying the pose from the reference image, also incorporate this detail: "${customPosePrompt.trim()}".` : ''}
          **Strict Negative Constraints**: DO NOT copy clothing, background, or identity from the 'Pose Reference Image'.
          **Final Goal**: A high-resolution (2K), photorealistic image where the model from the 'Subject Image' is now in the pose from the 'Pose Reference Image'.
        `.trim();

      try {
        const [result] = await editImage({
          images: imagesForApi,
          prompt,
          negativePrompt,
          numberOfImages: 1,
          aspectRatio,
          resolution,
        }, imageEditModel, buildImageServiceConfig((msg) => setGenerationStatus(prev => ({ ...prev, message: msg }))));
        setGeneratedImages([result]);
      } catch (err) {
        setError(getErrorMessage(err, t));
      } finally {
        setIsLoading(false);
        setGenerationStatus({ active: false, progress: 0, total: 0, message: '' });
      }

      // --- Multiple Generation with Text Prompts ---
    } else {
      const prompts = allPrompts;
      if (prompts.length === 0) {
        setError(t('pose.promptError'));
        return;
      }

      setGenerationStatus({ active: true, progress: 0, total: prompts.length, message: '' });

      const results: ImageFile[] = [];
      for (const [index, promptText] of prompts.entries()) {
        setGenerationStatus(prev => ({ ...prev, progress: index + 1, message: t('pose.generatingStatusMultiple', { progress: index + 1, total: prompts.length }) }));

        const prompt = `
              **Task**: Photorealistically change the pose of a model based on a text description, while perfectly preserving the model, their clothing, and the background.
              **Source Image**: Contains the model and their clothing.
              **New Pose Description**: "${promptText}".
              **CRITICAL RULES**:
              1.  **Analyze Clothing**: First, analyze the clothing in the Source Image to understand its type (e.g., dress, jeans, blouse), fabric properties (e.g., silk, denim, cotton), and fit (e.g., loose, tight, structured).
              2.  **Preserve Identity**: The model's identity (face, hair, body shape), their entire outfit (design, color, texture), and the entire background from the Source Image MUST be preserved with 100% accuracy.
              3.  **Apply New Pose**: Re-render the model in a new, physically plausible pose that accurately matches the **New Pose Description**.
              4.  **Realistic Draping**: This is the most important step. Re-drape the *exact same* clothing onto the model in their new pose. The draping must be physically accurate, showing how the specific fabric would naturally fold, stretch, and hang based on the new body position and gravity. The fit must remain consistent with the original garment.
              5.  **Camera Framing**: ${framingInstruction}
              **Final Goal**: A high-resolution (2K), photorealistic image.
            `.trim();

        try {
          const [result] = await editImage({
            images: [subjectImage],
            prompt,
            negativePrompt,
            numberOfImages: 1,
            aspectRatio,
            resolution,
          }, imageEditModel, buildImageServiceConfig((msg) => setGenerationStatus(prev => ({ ...prev, message: `${t('pose.generatingStatusMultiple', { progress: prev.progress, total: prev.total })} - ${msg}` }))));
          results.push(result);
          setGeneratedImages([...results]); // Update UI incrementally
        } catch (err) {
          const errorMessage = t('pose.batchError', {
            index: index + 1,
            total: prompts.length,
            prompt: promptText.substring(0, 30),
            error: getErrorMessage(err, t)
          });
          setError(errorMessage);
          setGenerationStatus({ active: false, progress: 0, total: 0, message: '' });
          return; // Stop on first error
        }
      }
      setGenerationStatus({ active: false, progress: 0, total: 0, message: '' });
    }
  };

  const handleUpscale = async (imageToUpscale: ImageFile, index: number) => {
    setUpscalingStates(prev => ({ ...prev, [index]: true }));
    setError(null);
    try {
      const result = await upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => { })
      );
      setGeneratedImages(prev => prev.map((img, i) => i === index ? result : img));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates(prev => ({ ...prev, [index]: false }));
    }
  };

  const handlePoseReferenceUpload = (file: ImageFile | null) => {
    setPoseReferenceImage(file);
    if (file) {
      setSelectedLibraryPoses([]); // Clear library selection
    }
  }

  const handleConfirmSelection = (poses: string[]) => {
    setSelectedLibraryPoses(poses);
    if (poses.length > 0) {
      setPoseReferenceImage(null); // Mutually exclusive with reference image
    }
  }

  const anyLoading = isLoading || generationStatus.active || isGeneratingPoseDescription || Object.values(upscalingStates).some(s => s);
  const isGenerateDisabled = anyLoading || !subjectImage || (!poseReferenceImage && totalPrompts === 0);

  const getButtonText = () => {
    if (isLoading) return t('pose.generatingOne');
    if (generationStatus.active) return t('pose.generatingMultiple', { progress: generationStatus.progress, total: generationStatus.total });
    if (poseReferenceImage) return t('pose.generateButton');
    if (totalPrompts > 1) return t('pose.generateMultipleButton', { count: totalPrompts });
    if (totalPrompts === 1) return t('pose.generateOneButton');
    return t('pose.generateButton');
  };

  const cameraViewOptions = [
    { key: 'default', label: t('cameraView.options.default') },
    { key: 'fullBody', label: t('cameraView.options.fullBody') },
    { key: 'halfBody', label: t('cameraView.options.halfBody') },
    { key: 'kneesUp', label: t('cameraView.options.kneesUp') },
  ];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
        {/* Left Column: Controls */}
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
            <h3 className="text-base md:text-lg font-semibold text-center text-amber-400 mb-4">{t('pose.orTitle')}</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="pose-prompt" className="block text-sm font-medium text-zinc-300 mb-2">{t('pose.customPoseLabel')}</label>
                <textarea
                  id="pose-prompt"
                  value={customPosePrompt}
                  onChange={(e) => { setCustomPosePrompt(e.target.value); if (poseReferenceImage) setPoseReferenceImage(null); }}
                  placeholder={t('pose.customPosePlaceholder')}
                  rows={2}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-2 px-4 rounded-full hover:opacity-90 transition-opacity"
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
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={t('pose.negativePromptPlaceholder')}
                rows={2}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2 text-center">{t('cameraView.label')}</label>
              <div className="flex justify-center">
                <div className="flex flex-wrap justify-center gap-1 p-1 bg-zinc-800/50 rounded-lg">
                  {cameraViewOptions.map(opt => (
                    <button key={opt.key} onClick={() => setCameraView(opt.key)} className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-colors duration-200 ${cameraView === opt.key ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'}`}>
                      {opt.label}
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
            <button onClick={handleGenerate} disabled={isGenerateDisabled} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">
              {generationStatus.active || isLoading ? <Spinner /> : getButtonText()}
            </button>
          </div>
        </div>

        {/* Right Column: Output */}
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
                <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="w-full h-full overflow-y-auto pr-2">
                <h3 className="text-xl font-semibold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">{t('pose.generatedPosesTitle', { count: generatedImages.length })}</h3>
                <div className={`grid gap-4 ${generatedImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {generatedImages.map((image, index) => (
                    <HoverableImage
                      key={index}
                      image={image}
                      altText={t('pose.generatedPoseAlt', { index: index + 1 })}
                      downloadFileName={`generated-pose-${index + 1}.png`}
                      onRegenerate={handleGenerate}
                      onUpscale={() => handleUpscale(image, index)}
                      isGenerating={generationStatus.active || isLoading}
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
