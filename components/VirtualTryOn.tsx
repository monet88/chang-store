



import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import Tooltip from './Tooltip';
import ImageOptionsPanel from './ImageOptionsPanel';

// --- Helper Icons ---
const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);
const ImageIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z" />
  </svg>
);

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
  
  const { addImage } = useImageGallery();
  const { t } = useLanguage();
  const { aivideoautoAccessToken, aivideoautoImageModels, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.TryOn);
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    aivideoautoAccessToken,
    aivideoautoImageModels,
  });
  
  const validClothingItems = clothingItems.filter(item => item.image !== null);
  const requiresAivideoauto = imageEditModel.startsWith('aivideoauto--');

  const handleGenerateImage = async () => {
    if (!subjectImage || validClothingItems.length === 0) {
      setError(t('virtualTryOn.inputError'));
      return;
    }
    if (requiresAivideoauto && !aivideoautoAccessToken) {
      setError(t('error.api.aivideoautoAuth'));
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
            "Clothing must fit the subject’s body naturally, aligned with pose and proportions.",
            "Respect garment construction from the Clothing Source (neckline, sleeve style, hem length, waistband height, silhouette, fabric drape, decorative details).",
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
        { images: imagesForApi, prompt, numberOfImages: numImages, aspectRatio },
        imageEditModel,
        buildImageServiceConfig(setLoadingMessage)
      );
      setGeneratedImages(results);
      results.forEach(addImage);
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
            buildImageServiceConfig(() => {})
        );
        setGeneratedImages(prev => prev.map((img, i) => i === index ? result : img));
        addImage(result);
    } catch (err) {
        setError(getErrorMessage(err, t));
    } finally {
        setUpscalingStates(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleClothingUpload = (file: ImageFile | null, id: number) => {
    setClothingItems(items => items.map(item => item.id === id ? { ...item, image: file } : item));
    if(file) addImage(file);
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
      {/* Left panel - scrollable input section */}
      <div className="flex flex-col gap-4 overflow-y-auto pr-2 max-h-full">
        <h2 className="text-xl md:text-2xl font-bold text-center flex-shrink-0">{t('virtualTryOn.title')}</h2>
        
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
            <h3 className="text-base font-semibold text-center text-emerald-400 mb-3">{t('virtualTryOn.step1')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Tooltip content={t('tooltips.tryOnSubject')} position="right" className="w-full">
                    <ImageUploader image={subjectImage} id="subject-upload" title={t('virtualTryOn.subjectImageTitle')} onImageUpload={(file) => { setSubjectImage(file); if (file) addImage(file); }} />
                </Tooltip>
                <div className="flex flex-col gap-3">
                    {clothingItems.map((item, index) => (
                        <div key={item.id} className="relative group">
                            <Tooltip content={t('tooltips.tryOnClothing')} position="left">
                              <ImageUploader image={item.image} id={`clothing-${item.id}`} title={t('virtualTryOn.clothingItemTitle', { index: index + 1 })} onImageUpload={(file) => handleClothingUpload(file, item.id)} />
                            </Tooltip>
                            {clothingItems.length > 1 && <button onClick={() => removeClothingUploader(item.id)} className="absolute -top-2 -right-2 z-10 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4" /></button>}
                        </div>
                    ))}
                    <Tooltip content={t('tooltips.tryOnAddClothing')} position="bottom" className="w-full">
                      <button onClick={addClothingUploader} className="w-full bg-slate-700/80 text-slate-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center justify-center gap-2">
                        <PlusIcon className="w-5 h-5" /><span>{t('virtualTryOn.addItem')}</span>
                      </button>
                    </Tooltip>
                </div>
            </div>
        </div>
        
        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
            <h3 className="text-base font-semibold text-center text-emerald-400 mb-3">{t('virtualTryOn.step2')}</h3>
            <div className="space-y-3">
                <Tooltip content={t('tooltips.tryOnBackground')} position="bottom" className="w-full">
                    <label htmlFor="background-prompt" className="block text-xs font-medium text-center text-slate-300 mb-1">{t('virtualTryOn.backgroundPromptLabel')}</label>
                    <textarea
                        id="background-prompt"
                        value={backgroundPrompt}
                        onChange={(e) => setBackgroundPrompt(e.target.value)}
                        placeholder={t('virtualTryOn.backgroundPromptPlaceholder')}
                        rows={1}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-0.5 text-center">{t('virtualTryOn.backgroundPromptDescription')}</p>
                </Tooltip>
                <Tooltip content={t('tooltips.tryOnInstructions')} position="bottom" className="w-full">
                    <label htmlFor="extra-prompt" className="block text-xs font-medium text-center text-slate-300 mb-1">{t('virtualTryOn.extraPromptLabel')}</label>
                    <textarea
                        id="extra-prompt"
                        value={extraPrompt}
                        onChange={(e) => setExtraPrompt(e.target.value)}
                        placeholder={t('virtualTryOn.extraPromptPlaceholder')}
                        rows={1}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-0.5 text-center">{t('virtualTryOn.extraPromptDescription')}</p>
                </Tooltip>
                <div className="space-y-3">
                    <ImageOptionsPanel
                      aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                      resolution={resolution} setResolution={setResolution}
                      model={imageEditModel}
                    />
                    <Tooltip content={t('tooltips.tryOnImageCount')} position="top">
                        <label htmlFor="num-images-slider" className="block text-xs font-medium text-center text-slate-300 mb-1">{t('virtualTryOn.numberOfImages')}</label>
                        <div className="flex items-center gap-3 max-w-xs mx-auto">
                            <input
                                id="num-images-slider"
                                type="range"
                                min="1"
                                max="4"
                                step="1"
                                value={numImages}
                                onChange={(e) => setNumImages(Number(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="bg-emerald-600 text-white text-xs font-bold rounded-full h-6 w-6 flex-shrink-0 flex items-center justify-center">
                                {numImages}
                            </span>
                        </div>
                    </Tooltip>
                </div>
            </div>
        </div>


        {/* Step 3: Generate button - compact */}
        <div className="text-center flex-shrink-0 pb-2">
            <h3 className="text-base font-semibold text-emerald-400 mb-2">{t('virtualTryOn.step3')}</h3>
            <Tooltip content={t('tooltips.tryOnGenerate')} position="top">
              <button onClick={handleGenerateImage} disabled={isLoading || anyUpscaling || !subjectImage || validClothingItems.length === 0} className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-full hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 text-sm">
                {isLoading ? <Spinner /> : t('virtualTryOn.generateButton')}
              </button>
            </Tooltip>
        </div>
      </div>

      {/* Right panel - result display */}
      <div className="h-full min-h-0">
        <div className="relative w-full h-full bg-slate-900/50 rounded-2xl border border-slate-800 p-3 flex flex-col overflow-hidden">
          {isLoading ? (
             <div className="flex flex-col h-full gap-3">
                <h3 className="text-lg font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-500 animate-pulse flex-shrink-0">
                    {loadingMessage || t('virtualTryOn.generatingStatus')}
                </h3>
                <div className={`grid ${getGridColsClass(numImages)} gap-3 w-full flex-1 min-h-0`}>
                    {Array.from({ length: numImages }).map((_, index) => (
                        <div key={index} className="aspect-[4/5] bg-slate-800/50 rounded-lg flex items-center justify-center animate-pulse">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400"></div>
                        </div>
                    ))}
                </div>
             </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
            </div>
          ) : generatedImages.length > 0 ? (
            <div className="flex flex-col h-full gap-3 overflow-hidden">
                <h3 className="text-lg font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-500 flex-shrink-0">
                    {t('generatedImage.outputTitle')}
                </h3>
                <div className={`grid ${getGridColsClass(generatedImages.length)} gap-3 w-full flex-1 min-h-0 overflow-y-auto`}>
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
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div className="text-center text-slate-600 pointer-events-none max-w-xs w-full p-6 bg-slate-900/30 rounded-2xl border border-slate-700/50">
                  <ImageIcon className="mx-auto h-14 w-14 text-slate-700" />
                  <h3 className="mt-4 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-500">
                      {t('common.outputPanelTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                      {t('virtualTryOn.outputPanelDescription')}
                  </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn;
