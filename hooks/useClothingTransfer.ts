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
}

/**
 * Build the clothing transfer prompt.
 * IMPORTANT: Caller must pass images as [ref_1...ref_N, concept_last].
 * Wrong order causes AI to process incorrectly with no error thrown.
 */
function buildClothingTransferPrompt(refCount: number, extraInstructions: string): string {
  return `Images 1 to ${refCount} are reference outfits. The last image is the target.

Extract tops, bottoms, skirts, or full outfits from each reference image. If a reference has a caption, prioritize the clothing type mentioned in it.

On the target image: remove all existing clothing but keep the background, lighting, camera angle, and every other detail unchanged.

Then insert each extracted outfit into the target, preserving all details — colors, patterns, fabric textures, folds, and proportions. Each outfit must blend naturally into the scene. When multiple outfits appear in the same target, maintain correct proportions, orientation, and logical layering order.${extraInstructions ? `\n\nAdditional instructions: ${extraInstructions}` : ''}`;
}

export function useClothingTransfer() {
  const idCounter = useRef(0);
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([{ id: ++idCounter.current, image: null }]);
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

  const addReference = () => setReferenceItems(prev => [...prev, { id: ++idCounter.current, image: null }]);

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
      const prompt = buildClothingTransferPrompt(validReferences.length, extraPrompt.trim());
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
    handleReferenceUpload, addReference, removeReference,
    handleConceptUpload, handleGenerate, handleUpscale,
    validReferences, anyUpscaling, imageEditModel,
  };
}
