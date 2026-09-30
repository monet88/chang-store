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
import type { ImageDriver, GenerateJob, UpscaleJob, ReferenceRoleImage } from '../services/providers/ImageDriver';
import {
  lookbookAiScanSources,
  buildCloseUpNegativePrompt,
  type LookbookPromptInput,
} from '../utils/lookbook-prompt-types';
import {
  buildGeminiLookbookPrompt,
  buildGeminiVariationPrompt,
  buildGeminiCloseUpPrompts,
} from '../utils/gemini-lookbook-prompt';
import {
  buildGptLookbookPrompt,
  buildGptVariationPrompt,
  buildGptCloseUpPrompts,
} from '../utils/gpt-lookbook-prompt';
import { LookbookFormState } from './useLookbookDraft';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Image primitives the engine orchestrates. Accepts canonical ImageDriver
 * or legacy driver for test compatibility.
 */
export type GeminiImageDriver = Partial<ImageDriver> & {
  id?: ImageEngineId;
  editImage?: typeof editImage;
  upscaleImage?: typeof upscaleImage;
  createImageChatSession?: typeof createImageChatSession;
  generate?: (job: GenerateJob) => Promise<ImageFile[]>;
  generateOne?: (job: GenerateJob) => Promise<ImageFile>;
  upscale?: (job: UpscaleJob) => Promise<ImageFile>;
};

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
    const promptInput: LookbookPromptInput = {
      formState,
      images: imagesForApi,
      fabricTextureImage,
      outfitBlueprint: blueprint,
    };
    const prompt = engineId === 'gptImage'
      ? buildGptLookbookPrompt(promptInput)
      : buildGeminiLookbookPrompt(promptInput);

    try {
      const references: ReferenceRoleImage[] = imagesForApi.map((img, idx) => ({
        image: img,
        role: 'garment' as const,
        label: `garment-${idx + 1}`,
      }));
      if (fabricTextureImage) {
        references.push({ image: fabricTextureImage, role: 'style', label: 'fabric-texture' });
      }

      let results: ImageFile[];
      if (typeof (driver as any).generate === 'function') {
        results = await (driver as any).generate({
          images: imagesForApi,
          prompt,
          negativePrompt,
          references,
          count: 1,
          aspectRatio,
          resolution,
          workflow: 'lookbook',
          model: imageEditModel,
          onProgress: setLoadingMessage,
        });
      } else {
        results = await (driver as any).editImage({
          images: imagesForApi,
          prompt,
          negativePrompt,
          numberOfImages: 1,
          aspectRatio,
          resolution,
        }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      }
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
    const prompt = engineId === 'gptImage'
      ? buildGptVariationPrompt(formState.lookbookStyle, generatedLookbook.blueprint ?? '')
      : buildGeminiVariationPrompt(formState.lookbookStyle, generatedLookbook.blueprint ?? '');

    try {
      let newVariations: ImageFile[];
      if (typeof (driver as any).generate === 'function') {
        newVariations = await (driver as any).generate({
          images: [baseImage],
          prompt,
          negativePrompt: formState.negativePrompt,
          references: [{ image: baseImage, role: 'subject', label: 'base-main' }],
          count: variationCount,
          aspectRatio,
          resolution,
          workflow: 'lookbook-variations',
          model: imageEditModel,
          onProgress: setLoadingMessage,
        });
      } else {
        newVariations = await (driver as any).editImage({
          images: [baseImage],
          prompt,
          negativePrompt: formState.negativePrompt,
          numberOfImages: variationCount,
          aspectRatio,
          resolution,
        }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      }
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
    const closeUpPrompts = engineId === 'gptImage'
      ? buildGptCloseUpPrompts(generatedLookbook.blueprint ?? '')
      : buildGeminiCloseUpPrompts(generatedLookbook.blueprint ?? '');
    const combinedNegativePrompt = buildCloseUpNegativePrompt(formState.negativePrompt);

    try {
      const closeups: ImageFile[] = [];
      for (const closeUpPrompt of closeUpPrompts) {
        setLoadingMessage(t('lookbook.generatingCloseUp', { current: closeups.length + 1, total: closeUpPrompts.length }));
        let results: ImageFile[];
        if (typeof (driver as any).generate === 'function') {
          results = await (driver as any).generate({
            images: [baseImage],
            prompt: closeUpPrompt,
            negativePrompt: combinedNegativePrompt,
            references: [{ image: baseImage, role: 'subject', label: 'base-main' }],
            count: 1,
            aspectRatio,
            resolution,
            workflow: 'lookbook-closeup',
            model: imageEditModel,
          });
        } else {
          results = await (driver as any).editImage({
            images: [baseImage],
            prompt: closeUpPrompt,
            negativePrompt: combinedNegativePrompt,
            numberOfImages: 1,
            aspectRatio,
            resolution,
          }, imageEditModel, buildImageServiceConfig(() => {}));
        }
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
