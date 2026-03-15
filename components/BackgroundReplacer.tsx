
import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generateImageDescription } from '../services/textService';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import { MagicWandIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';

const BackgroundReplacer: React.FC = () => {
  const { t } = useLanguage();
  const { getModelsForFeature, localApiBaseUrl, localApiKey, antiApiBaseUrl, antiApiKey, textGenerateModel } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Background);
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    localApiBaseUrl,
    localApiKey,
    antiApiBaseUrl,
    antiApiKey,
  });

  const [subjectImage, setSubjectImage] = useState<ImageFile | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<ImageFile | null>(null);
  const [promptText, setPromptText] = useState<string>('');
  const [selectedPredefinedKey, setSelectedPredefinedKey] = useState<string>('custom');
  const [generatedImages, setGeneratedImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [upscalingStates, setUpscalingStates] = useState<Record<number, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cameraView, setCameraView] = useState<string>('fullBody');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const PREDEFINED_BG_KEYS = ['studioMirrorChair', 'sofaMirrorCurtain', 'curvedSofaCurtain'];
  const allBackgroundLabels: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
  const allBackgroundPrompts: Record<string, string> = PHOTO_ALBUM_BACKGROUNDS.reduce((acc, curr) => {
    acc[curr.id] = curr.prompt;
    return acc;
  }, {} as Record<string, string>);

  const predefinedBackgroundOptions = PREDEFINED_BG_KEYS.map(key => ({
    key,
    label: allBackgroundLabels[key]
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

    if (key === 'custom') {
      setPromptText('');
    } else {
      setPromptText(allBackgroundPrompts[key]);
    }
    setBackgroundImage(null);
  };

  const handleSubjectUpload = (file: ImageFile | null) => {
    setSubjectImage(file);
  };

  const handleBackgroundUpload = (file: ImageFile | null) => {
    setBackgroundImage(file);
    if (file) {
      setPromptText('');
      setSelectedPredefinedKey('custom');
    }
  };

  const handleGenerateDescription = async () => {
    if (!backgroundImage) {
      setError(t('background.descriptionError'));
      return;
    }
    setIsGeneratingDescription(true);
    setError(null);
    try {
      const description = await generateImageDescription(backgroundImage, textGenerateModel, { localApiBaseUrl, localApiKey });
      setPromptText(description);
      setBackgroundImage(null);
      setSelectedPredefinedKey('custom');
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGenerate = async () => {
    if (!subjectImage) {
      setError(t('background.subjectError'));
      return;
    }
    if (!backgroundImage && !promptText) {
      setError(t('background.backgroundError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('background.generatingStatus'));
    setError(null);
    setGeneratedImages([]);

    const images: ImageFile[] = [subjectImage];

    let framingInstruction = "Use default framing provided by the model.";
    if (cameraView !== 'default') {
      const keyMap: Record<string, string> = {
        fullBody: 'fullBody',
        halfBody: 'halfBody',
        kneesUp: 'kneesUp',
      };
      const instructionKey = `framingInstructions.${keyMap[cameraView]}`;
      const instructionText = t(instructionKey);
      if (instructionText) {
        framingInstruction = instructionText;
      }
    }

    const coreInstruction = `
      **Task**: Perform a photorealistic background replacement for a fashion photograph.
      **Subject Image**: Contains the model to be isolated.
      **Background Source**: The new environment into which the subject will be placed.
      **Instructions for Integration**:
      1. **Subject Isolation**: From the Subject Image, isolate only the main person. Remove all other people or objects. The final output must contain only this subject.
      2. **Preserve Subject Integrity**: CRITICAL RULE. Do not alter, redraw, or change the subject in any way. Preserve exact body proportions, facial features, pose, and clothing details from the Subject Image.
      3. **Seamless Masking**: Perform a perfect, high-quality cutout. Pay close attention to edges, hair strands, and semi-translucent fabrics. There must be no halos, rough edges, or leftover background artifacts.
      4. **Lighting and Shadow Harmony**:
         * **Lighting Matching**: Adjust the subject’s lighting to match the dominant light source in the Background Source (direction, intensity, color temperature). Pay special attention to matching any rim lighting or highlights from the background environment onto the subject's edges for a perfect blend.
         * **Physically Accurate Shadows**:
            - **Contact Shadows & Ambient Occlusion**: Add subtle shadows where the subject touches surfaces (e.g., feet on the ground). Generate realistic ambient occlusion (contact darkening) where the subject is very close to other surfaces or parts of their own body, enhancing realism and depth.
            - **Cast Shadows**: Create realistic shadows consistent with the light source in the Background Source (sharp if hard light, soft if diffused).
            - Shadows must firmly anchor the subject to the scene.
         * **Color Grading**: Apply consistent tones and colors across subject and background so they look unified.
         * **Reflections**: If the Background Source has reflective surfaces, generate accurate reflections from the subject.
      5. **Perspective and Proportion**:
         * Scale the subject naturally to match the environment (height vs. doors, chairs, tables).
         * Align the subject’s feet with the ground plane to avoid floating or sinking.
      6. **Framing**: ${framingInstruction}
      **Goal**: The final output must be a high-resolution (2K), photorealistic image where the Subject Image is seamlessly integrated into the Background Source with no trace of the original background.
    `;

    let prompt: string;

    if (backgroundImage) {
      images.push(backgroundImage);
      if (promptText) {
        prompt = `
            ${coreInstruction}
            **Background Source**: Completely remove and discard the original background from the Subject Image. 
            Replace it entirely with the Background Source provided.
            **Modification**: While using the Background Source, also apply this modification: "${promptText}".
          `;
      } else {
        prompt = `
            ${coreInstruction}
            **Background Source**: Completely remove and discard the original background from the Subject Image. 
            Replace it entirely with the Background Source provided.
          `;
      }
    } else {
      prompt = `
        ${coreInstruction}
        **Background Source**: Completely remove and discard the original background from the Subject Image. 
        Generate a new, photorealistic background based on this description: "${promptText}". 
        The generated background must be realistic, high-quality, and suitable for fashion photography, 
        with correct perspective and scale.
      `;
    }

    try {
      const results = await editImage({
        images,
        prompt,
        negativePrompt,
        numberOfImages: 2,
        aspectRatio,
        resolution,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      setGeneratedImages(results);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* --- Left Column: Inputs & Controls --- */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-center mb-1">{t('background.title')}</h2>
          <p className="text-zinc-400 text-center">{t('background.description')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImageUploader image={subjectImage} id="subject-upload" title={t('background.subjectUploadTitle')} onImageUpload={handleSubjectUpload} />
          <div>
            <ImageUploader image={backgroundImage} id="background-upload" title={t('background.backgroundUploadTitle')} onImageUpload={handleBackgroundUpload} />
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
            {predefinedBackgroundOptions.map(opt => (
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
              {cameraViewOptions.map(opt => (
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
            disabled={isLoading || Object.values(upscalingStates).some(s => s) || !subjectImage || (!backgroundImage && !promptText)}
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
                  <HoverableImage
                    key={index}
                    image={image}
                    altText={`${t('generatedImage.altText')} ${index + 1}`}
                    onRegenerate={handleGenerate}
                    onUpscale={() => handleUpscale(image, index)}
                    isGenerating={isLoading}
                    isUpscaling={upscalingStates[index]}
                  />
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
