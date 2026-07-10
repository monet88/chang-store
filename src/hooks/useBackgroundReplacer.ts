
// hooks/useBackgroundReplacer.ts
import { useState, useCallback, useMemo } from 'react';
import { AspectRatio, ImageFile, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generateImageDescription } from '../services/textService';
import { getErrorMessage } from '../utils/imageUtils';
import { useImageRefinement } from './useImageRefinement';
import { buildBackgroundReplacementPrompt } from '../utils/background-replacer-prompt-builder';
import { PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';

export const useBackgroundReplacer = () => {
  const { t } = useLanguage();
  const { imageEditModel, textGenerateModel } = useApi();
  const { addImage } = useImageGallery();

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
  }), []);

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

  // Refine lifecycle (chat sessions + per-slot state) lives in the shared hook.
  const refinement = useImageRefinement({ imageEditModel, setError, t });
  const { refinePrompts, setRefinePrompts, isRefining } = refinement;

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
      const description = await generateImageDescription(backgroundImage, textGenerateModel);
      setPromptText(description);
      setBackgroundImage(null);
      setSelectedPredefinedKey('custom');
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [backgroundImage, t, textGenerateModel]);

  const buildPrompt = useCallback((cameraViewStr: string): string => {
    let framingInstruction = 'Use default framing provided by the model.';
    if (cameraViewStr !== 'default') {
      const instructionKey = `framingInstructions.${cameraViewStr}`;
      const instructionText = t(instructionKey);
      if (instructionText) framingInstruction = instructionText;
    }
    return buildBackgroundReplacementPrompt({
      framingInstruction,
      hasBackgroundImage: backgroundImage !== null,
      promptText,
    });
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
    refinement.resetSessions();

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
    await refinement.runRefine(key, prompt, imageToRefine, (refined) => {
      setGeneratedImages((prev) => prev.map((img, i) => (i === index ? refined : img)));
      addImage(refined);
    });
  }, [addImage, refinement]);

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
