import { useCallback } from 'react';
import {
  AspectRatio,
  ImageFile,
  ImageResolution,
} from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage, createImageChatSession } from '../services/imageEditingService';
import {
  buildLookbookPrompt,
  buildVariationPrompt,
  buildCloseUpPrompts,
  buildCloseUpNegativePrompt,
  LookbookFormState as PromptFormState,
} from '../utils/lookbookPromptBuilder';
import { LookbookFormState } from './useLookbookDraft';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Gemini image primitives the engine orchestrates, mirroring the provider
 * `ProviderImageDriver` seam. The main hook builds the default driver from the
 * real `imageEditingService`; tests can inject a mock driver to exercise the
 * generation core without hitting the Gemini API.
 */
export interface GeminiImageDriver {
  editImage: typeof editImage;
  upscaleImage: typeof upscaleImage;
  createImageChatSession: typeof createImageChatSession;
}

export interface LookbookSet {
  main: ImageFile;
  variations: ImageFile[];
  closeups: ImageFile[];
}

export interface UseLookbookGenerationConfig {
  driver: GeminiImageDriver;
  formState: LookbookFormState;
  generatedLookbook: LookbookSet | null;
  setGeneratedLookbook: React.Dispatch<React.SetStateAction<LookbookSet | null>>;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  variationCount: number;
  imageEditModel: string;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  onMainImageGenerated: (image: ImageFile) => void;
  setIsLoading: (value: boolean) => void;
  setLoadingMessage: (message: string) => void;
  setError: (message: string | null) => void;
  setIsGeneratingVariations: (value: boolean) => void;
  setIsGeneratingCloseUp: (value: boolean) => void;
  setActiveOutputTab: (tab: 'main' | 'variations' | 'closeup') => void;
  t: TranslateFn;
}

export interface UseLookbookGenerationReturn {
  handleGenerate: () => Promise<void>;
  handleGenerateVariations: () => Promise<void>;
  handleGenerateCloseUp: () => Promise<void>;
}

/**
 * Image generation engine for Lookbook (main image, variations, close-ups),
 * extracted to keep useLookbookGenerator under the line limit and isolate the
 * generation core behind a driver seam. Text description generation lives in
 * the orchestrator since it does not use the image driver.
 */
export const useLookbookGeneration = (
  config: UseLookbookGenerationConfig,
): UseLookbookGenerationReturn => {
  const {
    driver, formState, generatedLookbook, setGeneratedLookbook,
    aspectRatio, resolution, variationCount, imageEditModel,
    buildImageServiceConfig, onMainImageGenerated,
    setIsLoading, setLoadingMessage, setError,
    setIsGeneratingVariations, setIsGeneratingCloseUp,
    setActiveOutputTab, t,
  } = config;

  const handleGenerate = useCallback(async () => {
    const { clothingImages, fabricTextureImage, negativePrompt } = formState;
    const validClothingImages = clothingImages.filter((item) => item.image !== null);
    if (validClothingImages.length === 0) {
      setError(t('lookbook.inputError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('lookbook.generatingStatus'));
    setError(null);
    setGeneratedLookbook(null);

    const imagesForApi: ImageFile[] = validClothingImages.map((item) => item.image as ImageFile);
    if (fabricTextureImage) {
      imagesForApi.push(fabricTextureImage);
    }

    const prompt = buildLookbookPrompt(
      formState as PromptFormState,
      imagesForApi,
      fabricTextureImage,
    );

    try {
      const results = await driver.editImage({
        images: imagesForApi,
        prompt,
        negativePrompt,
        numberOfImages: 1,
        aspectRatio,
        resolution,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      if (results.length > 0) {
        const generatedImage = results[0];
        setGeneratedLookbook({ main: generatedImage, variations: [], closeups: [] });
        setActiveOutputTab('main');
        onMainImageGenerated(generatedImage);
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [driver, formState, imageEditModel, buildImageServiceConfig, aspectRatio, resolution,
    t, setError, setIsLoading, setLoadingMessage, setGeneratedLookbook, setActiveOutputTab, onMainImageGenerated]);

  const handleGenerateVariations = useCallback(async () => {
    if (!generatedLookbook) {
      setError(t('lookbook.variationError'));
      return;
    }
    setIsGeneratingVariations(true);
    setError(null);

    const baseImage = generatedLookbook.main;
    const prompt = buildVariationPrompt(formState.lookbookStyle, variationCount);

    try {
      const newVariations = await driver.editImage({
        images: [baseImage],
        prompt,
        negativePrompt: formState.negativePrompt,
        numberOfImages: variationCount,
        aspectRatio,
        resolution,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      setGeneratedLookbook((prev) => prev ? { ...prev, variations: newVariations } : null);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingVariations(false);
      setLoadingMessage('');
    }
  }, [driver, generatedLookbook, formState.negativePrompt, formState.lookbookStyle,
    variationCount, imageEditModel, buildImageServiceConfig, aspectRatio, resolution,
    t, setError, setIsGeneratingVariations, setLoadingMessage, setGeneratedLookbook]);

  const handleGenerateCloseUp = useCallback(async () => {
    if (!generatedLookbook) {
      setError(t('lookbook.closeUpError'));
      return;
    }
    setIsGeneratingCloseUp(true);
    setError(null);
    setGeneratedLookbook((prev) => prev ? { ...prev, closeups: [] } : null);

    const baseImage = generatedLookbook.main;
    const closeUpPrompts = buildCloseUpPrompts();
    const combinedNegativePrompt = buildCloseUpNegativePrompt(formState.negativePrompt);

    try {
      const closeups: ImageFile[] = [];
      for (const closeUpPrompt of closeUpPrompts) {
        setLoadingMessage(t('lookbook.generatingCloseUp', { current: closeups.length + 1, total: closeUpPrompts.length }));
        const results = await driver.editImage({
          images: [baseImage],
          prompt: closeUpPrompt,
          negativePrompt: combinedNegativePrompt,
          numberOfImages: 1,
          aspectRatio,
          resolution,
        }, imageEditModel, buildImageServiceConfig(() => {}));
        if (results.length > 0) {
          closeups.push(results[0]);
          setGeneratedLookbook((prev) => prev ? { ...prev, closeups: [...closeups] } : null);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingCloseUp(false);
      setLoadingMessage('');
    }
  }, [driver, generatedLookbook, formState.negativePrompt, imageEditModel,
    buildImageServiceConfig, aspectRatio, resolution,
    t, setError, setIsGeneratingCloseUp, setLoadingMessage, setGeneratedLookbook]);

  return {
    handleGenerate,
    handleGenerateVariations,
    handleGenerateCloseUp,
  };
};
