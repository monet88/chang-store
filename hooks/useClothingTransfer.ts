import { useState, useRef } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage } from '../services/imageEditingService';
import type { Part } from '@google/genai';

interface ReferenceItem {
  id: number;
  image: ImageFile | null;
  label: string;
}

/**
 * Build interleaved parts for clothing transfer.
 * Structure: [label_concept, img_concept, label_ref1, img_ref1, ..., task_instructions]
 * This ensures Gemini knows exactly which image is the destination vs source.
 */
function buildClothingTransferParts(
  conceptImage: ImageFile,
  references: { image: ImageFile; label: string }[],
  extraInstructions: string
): Part[] {
  const parts: Part[] = [];

  // 1. Concept image with clear label
  parts.push({ text: 'DESTINATION SCENE (keep this background, arrangement and display style):' });
  parts.push({ inlineData: { data: conceptImage.base64, mimeType: conceptImage.mimeType } });

  // 2. Each reference image with clear label
  references.forEach((ref, i) => {
    const label = ref.label || 'auto-detect clothing type';
    parts.push({ text: `SOURCE OUTFIT ${i + 1} (extract this clothing — ${label}):` });
    parts.push({ inlineData: { data: ref.image.base64, mimeType: ref.image.mimeType } });
  });

  // 3. Task instructions at the end
  const taskPrompt = `TASK: Replace all clothing in the DESTINATION SCENE with the clothing from the SOURCE OUTFIT images above.

RULES:
- The OUTPUT must use the DESTINATION SCENE's background, layout, camera angle, lighting, and arrangement style.
- The CLOTHING in the output must come from the SOURCE OUTFIT images — preserve their exact colors, patterns, textures, and fabric details.
- Remove existing clothing from the destination scene first, then insert the source outfits.
- Match the display style of the destination (hangers, flat lay, mannequin, closet display, etc.).
- Keep all non-clothing elements from the destination unchanged (props, accessories, background).${extraInstructions ? `\n\nAdditional instructions: ${extraInstructions}` : ''}`;

  parts.push({ text: taskPrompt });

  return parts;
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
      const refsWithImages = validReferences.map(item => ({
        image: item.image as ImageFile,
        label: item.label,
      }));
      const interleavedParts = buildClothingTransferParts(conceptImage, refsWithImages, extraPrompt.trim());
      const imagesForApi = [conceptImage, ...refsWithImages.map(r => r.image)];
      const results = await editImage(
        { images: imagesForApi, prompt: '', numberOfImages: numImages, aspectRatio, resolution, interleavedParts },
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
