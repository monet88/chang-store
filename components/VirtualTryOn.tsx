



import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import { AddIcon, DeleteIcon } from './Icons';
import Tooltip from './Tooltip';
import ResultPlaceholder from './shared/ResultPlaceholder';
import ImageOptionsPanel from './ImageOptionsPanel';

// --- Type Definitions ---
interface ClothingItem {
  id: number;
  image: ImageFile | null;
}

// --- Component ---
const VirtualTryOn: React.FC = () => {
  const [subjectImage, setSubjectImage] = useState<ImageFile | null>(null);
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([{ id: Date.now(), image: null }]);
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [upscalingStates, setUpscalingStates] = useState<Record<number, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ImageFile[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const { t } = useLanguage();
  const { antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.TryOn);
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    antiApiBaseUrl,
    antiApiKey,
    localApiBaseUrl,
    localApiKey,
  });

  const validClothingItems = clothingItems.filter(item => item.image !== null);

  const handleGenerateImage = async () => {
    if (!subjectImage || validClothingItems.length === 0) {
      setError(t('virtualTryOn.inputError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('virtualTryOn.generatingStatus'));
    setError(null);
    setGeneratedImages([]);

    try {
      // --- Prompt Generation Logic ---
      const generateImagePrompt = (accessories: ClothingItem[], backgroundPrompt: string, t: (key: string) => string): string => {
        const newPoseInstruction = `Generate a new dynamic fashion pose that complements the background style and best showcases the outfit from the Clothing Source Image(s):
- Choose a pose that is confident, chic, and magazine-cover ready — never stiff or awkward.
- The posture should naturally highlight the garment’s silhouette, details, and fit (e.g., one hand on hip, gentle stride, subtle arm movement, natural weight shift).
- Use editorial, real-model poses: standing tall, relaxed shoulders, soft or neutral facial expression, slight head tilt, elegant hand placement, and an overall relaxed yet stylish attitude.
- Expression should be soft, confident, fashion-forward — such as a gentle smile, subtle smirk, or neutral gaze. Never forced or exaggerated.
- Adjust the pose to enhance the mood and context of the background (e.g., relaxed and inviting in a living room or sofa scene, poised and strong in a minimalist studio, playful and lively in lifestyle settings).
- Always avoid robotic, unnatural, or stiff gestures.`;

        const promptStructure = {
          imageRoles: "The **first image** is the 'Subject Image' (the person). All subsequent images are 'Clothing Source Images' (the garments to apply).",
          absoluteHighestPriority: "The generated image must precisely preserve the person’s facial features, hairstyle, body shape, skin tone, and proportions from the Subject Image. The resemblance must be unmistakable and identical.",
          task: {
            description: "Replace the outfit on the person in the Subject Image with the outfit provided in the Clothing Source Image(s). Use the clothing source(s) as the single source of truth for garment design, color, pattern, silhouette, and fabric texture.",
          },
          integrationRules: [
            "Completely remove the original outfit from the Subject Image; do NOT blend or reuse old clothing elements.",
            "Clothing must fit the subject's body naturally, aligned with pose and proportions.",
            "Respect garment construction from the Clothing Source (neckline, sleeve style, hem length, waistband height, silhouette, fabric drape, decorative details).",
            "CRITICAL STYLING RULE: Tops, shirts, and blouses MUST always be worn UNTUCKED — hanging naturally OUTSIDE the pants/skirt waistband. NEVER tuck any top into the bottom garment. The hem of the top should drape freely over the waistline, showing natural fabric fall. This applies to ALL top garments regardless of style.",
            "Preserve occlusions: keep hands, hair strands, accessories (like bags or cups), and natural shadows in front of the new outfit.",
            "Match lighting, shadows, and color grading of the Subject Image for a seamless result.",
            "Ensure correct scale and orientation of patterns from the Clothing Source (no mirroring, shrinking, duplication, or distortions).",
          ],
          poseAndExpression: {
            selected: newPoseInstruction,
          },
          background: {
            selected: backgroundPrompt.trim()
              ? `Keep the original background from the Subject Image but modify it with this description: "${backgroundPrompt.trim()}". The background must complement both the person and the new outfit.`
              : "Keep the original background from the Subject Image exactly as is."
          },
          strictNegativeConstraints: [
            "Do NOT add or keep any parts of the original outfit.",
            "Do NOT tuck tops/shirts/blouses into pants or skirts — tops must ALWAYS hang freely outside the waistband.",
            "Do NOT add text, logos, labels, watermarks, or extra people.",
            "Do NOT distort body shape, face, or hairstyle.",
            "The final output must be clean, photorealistic, high-resolution (2K), and professional-grade.",
          ]
        };

        return `
# INSTRUCTION: VIRTUAL FASHION TRY-ON

## 1. IMAGE ROLES
${promptStructure.imageRoles}

## 2. ABSOLUTE HIGHEST PRIORITY
${promptStructure.absoluteHighestPriority}

## 3. CORE TASK
**Description:** ${promptStructure.task.description}

## 4. INTEGRATION RULES (MUST FOLLOW)
${promptStructure.integrationRules.map(rule => `- ${rule}`).join('\n')}${extraPrompt.trim() ? `\n- ${extraPrompt.trim()}` : ""}

## 5. POSE & EXPRESSION
**Action:** ${promptStructure.poseAndExpression.selected}

## 6. BACKGROUND
**Action:** ${promptStructure.background.selected}

## 7. STRICT NEGATIVE CONSTRAINTS (DO NOT DO)
${promptStructure.strictNegativeConstraints.map(rule => `- ${rule}`).join('\n')}
        `.trim();
      };

      const prompt = generateImagePrompt(validClothingItems, backgroundPrompt, t);
      const imagesForApi = [subjectImage, ...validClothingItems.map(item => item.image as ImageFile)];
      const results = await editImage(
        { images: imagesForApi, prompt, numberOfImages: numImages, aspectRatio, resolution },
        imageEditModel,
        buildImageServiceConfig(setLoadingMessage)
      );
      setGeneratedImages(results);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleUpscale = async (imageToUpscale: ImageFile, index: number) => {
    if (!imageToUpscale) return;

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

  const handleClothingUpload = (file: ImageFile | null, id: number) => {
    setClothingItems(items => items.map(item => item.id === id ? { ...item, image: file } : item));
  };
  const addClothingUploader = () => setClothingItems(prev => [...prev, { id: Date.now(), image: null }]);
  const removeClothingUploader = (id: number) => setClothingItems(prev => prev.filter(item => item.id !== id));

  const anyUpscaling = Object.values(upscalingStates).some(s => s);

  const getGridColsClass = (count: number) => {
    if (count <= 1) {
      return 'grid-cols-1';
    }
    return 'grid-cols-1 sm:grid-cols-2';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* Left panel - scrollable input section */}
      <div className="flex flex-col gap-6">
        <h2 className="text-xl md:text-2xl font-bold text-center flex-shrink-0">{t('virtualTryOn.title')}</h2>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('virtualTryOn.step1')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Tooltip content={t('tooltips.tryOnSubject')} position="right" className="w-full">
              <ImageUploader image={subjectImage} id="subject-upload" title={t('virtualTryOn.subjectImageTitle')} onImageUpload={setSubjectImage} />
            </Tooltip>
            <div className="flex flex-col gap-3">
              {clothingItems.map((item, index) => (
                <div key={item.id} className="relative group">
                  <Tooltip content={t('tooltips.tryOnClothing')} position="top">
                    <ImageUploader image={item.image} id={`clothing-${item.id}`} title={t('virtualTryOn.clothingItemTitle', { index: index + 1 })} onImageUpload={(file) => handleClothingUpload(file, item.id)} />
                  </Tooltip>
                  {clothingItems.length > 1 && <button onClick={() => removeClothingUploader(item.id)} className="absolute -top-2 -right-2 z-10 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteIcon className="w-4 h-4" /></button>}
                </div>
              ))}
              <Tooltip content={t('tooltips.tryOnAddClothing')} position="bottom" className="w-full">
                <button onClick={addClothingUploader} className="w-full bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center gap-2">
                  <AddIcon className="w-5 h-5" /><span>{t('virtualTryOn.addItem')}</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('virtualTryOn.step2')}</h3>
          <div className="space-y-4">
            <Tooltip content={t('tooltips.tryOnBackground')} position="bottom" className="w-full">
              <label htmlFor="background-prompt" className="block text-sm font-medium text-center text-zinc-300 mb-2">{t('virtualTryOn.backgroundPromptLabel')}</label>
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
              <label htmlFor="extra-prompt" className="block text-sm font-medium text-center text-zinc-300 mb-2">{t('virtualTryOn.extraPromptLabel')}</label>
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
                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                resolution={resolution} setResolution={setResolution}
                model={imageEditModel}
              />
              <Tooltip content={t('tooltips.tryOnImageCount')} position="top">
                <label htmlFor="num-images-slider" className="block text-sm font-medium text-center text-zinc-300 mb-2">{t('virtualTryOn.numberOfImages')}</label>
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


        {/* Step 3: Generate button - compact */}
        <div className="text-center flex-shrink-0 pb-2">
          <h3 className="text-lg font-semibold text-center text-amber-400 mb-4">{t('virtualTryOn.step3')}</h3>
          <Tooltip content={t('tooltips.tryOnGenerate')} position="top">
            <button onClick={handleGenerateImage} disabled={isLoading || anyUpscaling || !subjectImage || validClothingItems.length === 0} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">
              {isLoading ? <Spinner /> : t('virtualTryOn.generateButton')}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Right panel - result display */}
      <div className="sticky top-8">
        <div className="relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col min-h-[50vh] lg:min-h-0 lg:aspect-[4/5] items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col h-full gap-4 w-full">
              <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse flex-shrink-0">
                {loadingMessage || t('virtualTryOn.generatingStatus')}
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
                      onRegenerate={handleGenerateImage}
                      onUpscale={() => handleUpscale(image, index)}
                      isGenerating={isLoading}
                      isUpscaling={upscalingStates[index]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResultPlaceholder description={t('virtualTryOn.outputPanelDescription')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn;
