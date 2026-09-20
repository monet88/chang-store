import { useCallback, useMemo } from 'react';
import {
  AspectRatio,
  Feature,
  ImageEngineId,
  ImageFile,
  ImageResolution,
} from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { useAiScan } from '../contexts/AiScanContext';
import type { editImage, upscaleImage, createImageChatSession } from '../services/imageEditingService';
import {
  buildLookbookPrompt,
  buildVariationPrompt,
  buildCloseUpPrompts,
  buildCloseUpNegativePrompt,
  lookbookAiScanSources,
  LookbookFormState as PromptFormState,
} from '../utils/lookbookPromptBuilder';
import { promptFormatFor } from '../utils/promptFormat';
import { LookbookFormState } from './useLookbookDraft';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Gemini image primitives the engine orchestrates, mirroring the provider
 * `ProviderImageDriver` seam. The main hook builds the default driver from the
 * studio-scoped engine context; tests can inject a mock driver to exercise the
 * generation core without hitting the Gemini API. The chat session is
 * Gemini-only: a GPT-lane refine is a single-shot edit (issue #152 Decision 5),
 * so callers fall back to `createSingleShotRefineSession` when it is absent.
 */
export interface GeminiImageDriver {
  editImage: typeof editImage;
  upscaleImage: typeof upscaleImage;
  createImageChatSession?: typeof createImageChatSession;
}

export interface LookbookSet {
  main: ImageFile;
  variations: ImageFile[];
  closeups: ImageFile[];
  /**
   * Blueprint of the source set the `main` was generated from. Variations and
   * close-ups are derived from `main`, so they reuse this exact analysis — the
   * form may already describe a different outfit by then.
   */
  blueprint: string | null;
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
  addImage?: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  engineId?: ImageEngineId;
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
    setActiveOutputTab, addImage, engineId, t,
  } = config;

  const aiScan = useAiScan();

  // Same ImageFile objects the panel pre-scans (object identity is the scan
  // cache key), so generation reuses the one analysis already running.
  const aiScanSources = useMemo<ImageFile[]>(
    () => lookbookAiScanSources(formState.clothingImages, formState.fabricTextureImage),
    [formState.clothingImages, formState.fabricTextureImage],
  );

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

    const blueprint = await aiScan.scan(aiScanSources);
    const prompt = buildLookbookPrompt(
      formState as PromptFormState,
      imagesForApi,
      fabricTextureImage,
      promptFormatFor(engineId),
      blueprint ?? '',
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
        setGeneratedLookbook({ main: generatedImage, variations: [], closeups: [], blueprint });
        setActiveOutputTab('main');
        onMainImageGenerated(generatedImage);
        addImage?.(generatedImage, Feature.Lookbook, engineId);
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [driver, formState, imageEditModel, buildImageServiceConfig, aspectRatio, resolution,
    t, setError, setIsLoading, setLoadingMessage, setGeneratedLookbook, setActiveOutputTab, onMainImageGenerated, addImage, engineId, aiScan, aiScanSources]);

  const handleGenerateVariations = useCallback(async () => {
    if (!generatedLookbook) {
      setError(t('lookbook.variationError'));
      return;
    }
    setIsGeneratingVariations(true);
    setError(null);

    const baseImage = generatedLookbook.main;
    // The blueprint belongs to the generated main, not to the current form:
    // editing the outfit after generating must not re-analyze the new garments
    // into the variations of the old main.
    const prompt = buildVariationPrompt(formState.lookbookStyle, generatedLookbook.blueprint ?? '', promptFormatFor(engineId));

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
      newVariations.forEach((image) => addImage?.(image, Feature.Lookbook, engineId));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingVariations(false);
      setLoadingMessage('');
    }
  }, [driver, generatedLookbook, formState.negativePrompt, formState.lookbookStyle,
    variationCount, imageEditModel, buildImageServiceConfig, aspectRatio, resolution,
    t, setError, setIsGeneratingVariations, setLoadingMessage, setGeneratedLookbook, addImage, engineId]);

  const handleGenerateCloseUp = useCallback(async () => {
    if (!generatedLookbook) {
      setError(t('lookbook.closeUpError'));
      return;
    }
    setIsGeneratingCloseUp(true);
    setError(null);
    setGeneratedLookbook((prev) => prev ? { ...prev, closeups: [] } : null);

    const baseImage = generatedLookbook.main;
    // Same source of truth as the variations: the analysis of the outfit the
    // main was generated from.
    const closeUpPrompts = buildCloseUpPrompts(generatedLookbook.blueprint ?? '', promptFormatFor(engineId));
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
          addImage?.(results[0], Feature.Lookbook, engineId);
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
    t, setError, setIsGeneratingCloseUp, setLoadingMessage, setGeneratedLookbook, addImage, engineId]);

  return {
    handleGenerate,
    handleGenerateVariations,
    handleGenerateCloseUp,
  };
};
