import { useState } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage } from '../services/imageEditingService';

interface ReferenceItem {
  id: number;
  image: ImageFile | null;
}

/** Build the clothing transfer prompt with reference count and optional extra instructions */
function buildClothingTransferPrompt(refCount: number, extraInstructions: string): string {
  return `Use images 1 to ${refCount} as references, extracting tops, bottoms, or full outfits from each image. Insert each outfit into the last image (concept/styled photo), preserving all clothing details, colors, patterns, and textures. Keep the background, lighting, perspective, and all other elements of the concept image exactly the same. Each outfit should integrate naturally into the scene, with realistic proportions, folds, and fabric textures.${extraInstructions ? `\n\nAdditional instructions: ${extraInstructions}` : ''}`;
}

export function useClothingTransfer() {
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([{ id: Date.now(), image: null }]);
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
  const { antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.ClothingTransfer);

  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    antiApiBaseUrl,
    antiApiKey,
    localApiBaseUrl,
    localApiKey,
  });

  const validReferences = referenceItems.filter(item => item.image !== null);
  const anyUpscaling = Object.values(upscalingStates).some(s => s);

  const handleReferenceUpload = (file: ImageFile | null, id: number) => {
    setReferenceItems(items => items.map(item => item.id === id ? { ...item, image: file } : item));
  };

  const addReference = () => setReferenceItems(prev => [...prev, { id: Date.now(), image: null }]);

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
      // References first, concept LAST
      const imagesForApi = [...validReferences.map(item => item.image as ImageFile), conceptImage];
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
        buildImageServiceConfig(() => {})
      );
      setGeneratedImages(prev => prev.map((img, i) => i === index ? result : img));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates(prev => ({ ...prev, [index]: false }));
    }
  };

  return {
    // State
    referenceItems, conceptImage, extraPrompt, numImages,
    aspectRatio, resolution, isLoading, loadingMessage,
    error, generatedImages, upscalingStates,
    // Setters
    setExtraPrompt, setNumImages, setAspectRatio, setResolution, setError,
    // Handlers
    handleReferenceUpload, addReference, removeReference,
    handleConceptUpload, handleGenerate, handleUpscale,
    // Computed
    validReferences, anyUpscaling, imageEditModel,
  };
}
