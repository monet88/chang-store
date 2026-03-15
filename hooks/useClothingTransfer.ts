import { useState, useRef } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage } from '../services/imageEditingService';

interface ReferenceItem {
  id: number;
  image: ImageFile | null;
  label: string;
}

/**
 * Build the clothing transfer prompt.
 * IMPORTANT: Caller must pass images as [ref_1...ref_N, concept_last].
 * Wrong order causes AI to process incorrectly with no error thrown.
 */
function buildClothingTransferPrompt(referenceLabels: string[], extraInstructions: string): string {
  const refCount = referenceLabels.length;
  const labelLines = referenceLabels
    .map((label, i) => `  Image ${i + 1} (SOURCE): ${label || 'auto-detect'}`)
    .join('\n');

  return `You are performing a clothing transfer task. Follow these steps precisely.

ROLE OF EACH IMAGE:
- Images 1 to ${refCount} are SOURCE OUTFITS — these contain the clothing items you MUST extract and use.
- The LAST image (Image ${refCount + 1}) is the DESTINATION SCENE — this defines the background, arrangement, lighting, and display style you MUST preserve.

SOURCE outfit details:
${labelLines}

STEP-BY-STEP INSTRUCTIONS:
1. ANALYSE SOURCE: Look at images 1 to ${refCount}. Identify every clothing item — note the exact colors, fabric textures, patterns, folds, and proportions.
2. ANALYSE DESTINATION: Look at the last image. Identify the scene layout — how items are arranged (on hangers, laid flat, on mannequin, folded, displayed in a closet, etc.), the background, lighting, camera angle, and overall composition.
3. REMOVE: Remove all existing clothing from the destination scene. Keep EVERYTHING else — background, props, accessories, lighting, camera angle — completely unchanged.
4. INSERT: Place the source outfits into the destination scene, replacing the removed clothing. Each outfit must match the destination's display style and arrangement. Maintain realistic proportions, orientation, spacing, and natural layering order. The inserted clothing must blend seamlessly, looking as if it was genuinely part of the original scene.

CRITICAL: The clothing in the final result MUST come from the SOURCE images (images 1 to ${refCount}), NOT from the destination. The destination only provides the scene/arrangement.${extraInstructions ? `\n\nAdditional instructions: ${extraInstructions}` : ''}`;
}

export function useClothingTransfer() {
  const idCounter = useRef(0);
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([{ id: ++idCounter.current, image: null, label: '' }]);
  const [conceptImage, setConceptImage] = useState<ImageFile | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ImageFile[]>([]);
  const [upscalingStates, setUpscalingStates] = useState<Record<number, boolean>>({});

  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { localApiBaseUrl, localApiKey, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.ClothingTransfer);

  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    localApiBaseUrl,
    localApiKey,
  });

  const validReferences = referenceItems.filter(item => item.image !== null);
  const anyUpscaling = Object.values(upscalingStates).some(s => s);

  const handleReferenceUpload = (file: ImageFile | null, id: number) => {
    setReferenceItems(items => items.map(item => item.id === id ? { ...item, image: file } : item));
  };

  const handleReferenceLabel = (label: string, id: number) => {
    setReferenceItems(items => items.map(item => item.id === id ? { ...item, label } : item));
  };

  const addReference = () => setReferenceItems(prev => [...prev, { id: ++idCounter.current, image: null, label: '' }]);

  const removeReference = (id: number) => setReferenceItems(prev => prev.filter(item => item.id !== id));

  const handleConceptUpload = (file: ImageFile | null) => setConceptImage(file);

  const handleGenerate = async () => {
    if (validReferences.length === 0 || !conceptImage) {
      setError(t('clothingTransfer.inputError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('clothingTransfer.generatingStatus'));
    setError(null);
    setGeneratedImages([]);

    try {
      const referenceLabels = validReferences.map(item => item.label);
      const prompt = buildClothingTransferPrompt(referenceLabels, extraPrompt.trim());
      const imagesForApi = [...validReferences.map(item => item.image as ImageFile), conceptImage];
      const results = await editImage(
        { images: imagesForApi, prompt, numberOfImages: numImages, aspectRatio, resolution },
        imageEditModel,
        buildImageServiceConfig(setLoadingMessage)
      );
      setGeneratedImages(results);
      results.forEach(img => addImage(img));
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

  return {
    referenceItems, conceptImage, extraPrompt, numImages,
    aspectRatio, resolution, isLoading, loadingMessage,
    error, generatedImages, upscalingStates,
    setExtraPrompt, setNumImages, setAspectRatio, setResolution, setError,
    handleReferenceUpload, handleReferenceLabel, addReference, removeReference,
    handleConceptUpload, handleGenerate, handleUpscale,
    validReferences, anyUpscaling, imageEditModel,
  };
}
