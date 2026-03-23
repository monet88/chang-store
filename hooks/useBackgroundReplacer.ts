
// hooks/useBackgroundReplacer.ts
import { useState, useRef, useCallback, useMemo } from 'react';
import { AspectRatio, Feature, ImageFile, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage, upscaleImage, createImageChatSession, ImageChatSession } from '../services/imageEditingService';
import { generateImageDescription } from '../services/textService';
import { getErrorMessage } from '../utils/imageUtils';
import { PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';

export const useBackgroundReplacer = () => {
  const { t } = useLanguage();
  const { localApiBaseUrl, localApiKey, antiApiBaseUrl, antiApiKey, getModelsForFeature, textGenerateModel } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Background);
  const { addImage } = useImageGallery();

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    localApiBaseUrl,
    localApiKey,
    antiApiBaseUrl,
    antiApiKey,
  }), [antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey]);

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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  // Refine state — per image slot key = index (string)
  const chatSessionsRef = useRef<Record<string, ImageChatSession>>({});
  const [refinePrompts, setRefinePrompts] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState<Record<string, boolean>>({});

  const PREDEFINED_BG_KEYS = useMemo(() => ['studioMirrorChair', 'sofaMirrorCurtain', 'curvedSofaCurtain'], []);

  const allBackgroundPrompts: Record<string, string> = useMemo(() => PHOTO_ALBUM_BACKGROUNDS.reduce((acc, curr) => {
    acc[curr.id] = curr.prompt;
    return acc;
  }, {} as Record<string, string>), []);

  const handlePredefinedChange = useCallback((key: string) => {
    setSelectedPredefinedKey(key);
    // Only overwrite the prompt when a predefined preset is chosen;
    // switching back to 'custom' must NOT clear user-typed text.
    if (key !== 'custom') {
      setPromptText(allBackgroundPrompts[key] ?? '');
    }
    setBackgroundImage(null);
  }, [allBackgroundPrompts]);

  const handleSubjectUpload = useCallback((file: ImageFile | null) => {
    setSubjectImage(file);
  }, []);

  const handleBackgroundUpload = useCallback((file: ImageFile | null) => {
    setBackgroundImage(file);
    if (file) {
      setPromptText('');
      setSelectedPredefinedKey('custom');
    }
  }, []);

  const handleGenerateDescription = useCallback(async () => {
    if (!backgroundImage) {
      setError(t('background.descriptionError'));
      return;
    }
    setIsGeneratingDescription(true);
    setError(null);
    try {
      const description = await generateImageDescription(backgroundImage, textGenerateModel, { localApiBaseUrl, localApiKey, antiApiBaseUrl, antiApiKey });
      setPromptText(description);
      setBackgroundImage(null);
      setSelectedPredefinedKey('custom');
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [antiApiBaseUrl, antiApiKey, backgroundImage, localApiBaseUrl, localApiKey, t, textGenerateModel]);

  const buildPrompt = useCallback((cameraViewStr: string): string => {
    let framingInstruction = 'Use default framing provided by the model.';
    if (cameraViewStr !== 'default') {
      const instructionKey = `framingInstructions.${cameraViewStr}`;
      const instructionText = t(instructionKey);
      if (instructionText) framingInstruction = instructionText;
    }

    const coreInstruction = `
      **Task**: Perform a photorealistic background replacement for a fashion photograph.
      **Subject Image**: Contains the model to be isolated.
      **Background Source**: The new environment into which the subject will be placed.
      **Instructions for Integration**:
      1. **Subject Isolation**: From the Subject Image, isolate only the main person. Remove all other people or objects.
      2. **Preserve Subject Integrity**: CRITICAL RULE. Do not alter the subject in any way. Preserve body proportions, facial features, pose, and clothing details.
      3. **Seamless Masking**: Perform a perfect, high-quality cutout. No halos, rough edges, or leftover background artifacts.
      4. **Lighting and Shadow Harmony**: Match lighting, add shadows, and apply consistent color grading.
      5. **Perspective and Proportion**: Scale the subject naturally to match the environment.
      6. **Framing**: ${framingInstruction}
      **Goal**: A high-resolution (2K), photorealistic image where the subject is seamlessly integrated into the new background.
    `;

    if (backgroundImage) {
      if (promptText) {
        return `${coreInstruction}\n**Background Source**: Replace with the provided Background Source image.\n**Modification**: Also apply: "${promptText}".`;
      }
      return `${coreInstruction}\n**Background Source**: Replace with the provided Background Source image.`;
    }
    return `${coreInstruction}\n**Background Source**: Generate a new photorealistic background: "${promptText}".`;
  }, [backgroundImage, promptText, t]);

  const handleGenerate = useCallback(async () => {
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
    // Reset chat sessions for fresh generation
    chatSessionsRef.current = {};
    setRefinePrompts({});
    setIsRefining({});

    const images: ImageFile[] = [subjectImage];
    if (backgroundImage) images.push(backgroundImage);

    try {
      const results = await editImage({
        images,
        prompt: buildPrompt(cameraView),
        negativePrompt,
        numberOfImages: 2,
        aspectRatio,
        resolution,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      setGeneratedImages(results);
      results.forEach((img) => addImage(img));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [addImage, aspectRatio, backgroundImage, buildImageServiceConfig, buildPrompt, cameraView, imageEditModel, negativePrompt, promptText, resolution, subjectImage, t]);

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, index: number) => {
    setUpscalingStates((prev) => ({ ...prev, [index]: true }));
    setError(null);
    try {
      const result = await upscaleImage(imageToUpscale, imageEditModel, buildImageServiceConfig(() => {}));
      setGeneratedImages((prev) => prev.map((img, i) => (i === index ? result : img)));
      addImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [index]: false }));
    }
  }, [addImage, buildImageServiceConfig, imageEditModel, t]);

  const handleRefine = useCallback(async (imageToRefine: ImageFile, index: number, prompt: string) => {
    const key = String(index);
    if (!prompt.trim()) return;

    if (!chatSessionsRef.current[key]) {
      chatSessionsRef.current[key] = createImageChatSession(imageEditModel, buildImageServiceConfig(() => {}));
    }
    const session = chatSessionsRef.current[key];

    setIsRefining((prev) => ({ ...prev, [key]: true }));
    setError(null);

    try {
      const refined = await session.sendRefinement(prompt, imageToRefine);
      setGeneratedImages((prev) => prev.map((img, i) => (i === index ? refined : img)));
      addImage(refined);
      setRefinePrompts((prev) => ({ ...prev, [key]: '' }));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsRefining((prev) => ({ ...prev, [key]: false }));
    }
  }, [addImage, buildImageServiceConfig, imageEditModel, t]);

  return {
    subjectImage,
    setSubjectImage: handleSubjectUpload,
    backgroundImage,
    setBackgroundImage: handleBackgroundUpload,
    promptText,
    setPromptText,
    selectedPredefinedKey,
    setSelectedPredefinedKey: handlePredefinedChange,
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
  };
};
