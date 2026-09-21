import { useCallback } from 'react';
import {
  AspectRatio,
  ClothingTransferReferenceItem,
  Feature,
  ImageEngineId,
  ImageFile,
  ImageResolution,
} from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { buildGeminiClothingTransferParts } from '../utils/gemini-clothing-transfer-prompt';
import { buildGptClothingTransferParts } from '../utils/gpt-clothing-transfer-prompt';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { UseClothingTransferConceptsReturn } from './useClothingTransferConcepts';
import { UseImageRefinementReturn } from './useImageRefinement';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Image primitives the engine orchestrates, mirroring the provider
 * `ProviderImageDriver` seam. The main hook builds the default driver from the
 * real `imageEditingService`; tests can inject a mock driver to exercise the
 * generation core without hitting the active image API.
 */
export interface ClothingTransferImageDriver {
  editImage: typeof editImage;
  upscaleImage: typeof upscaleImage;
}

const CLOTHING_TRANSFER_BATCH_MAX_CONCURRENCY = 3;

export interface UseClothingTransferEngineConfig {
  driver: ClothingTransferImageDriver;
  concepts: UseClothingTransferConceptsReturn;
  validReferences: ClothingTransferReferenceItem[];
  extraPrompt: string;
  numImages: number;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  imageEditModel: string;
  canGenerate: boolean;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  addImage: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  engineId?: ImageEngineId;
  setIsLoading: (value: boolean) => void;
  setLoadingMessage: (message: string) => void;
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: TranslateFn;
}

export interface UseClothingTransferEngineReturn {
  handleGenerate: () => Promise<void>;
  handleRegenerateSingle: (itemId: string) => Promise<void>;
}

/**
 * Generation engine for Clothing Transfer, extracted to keep useClothingTransfer
 * under the line limit and isolate the generation core behind a driver seam.
 * Owns the batch run and per-item regenerate; result actions live in their own
 * hook.
 */
export const useClothingTransferEngine = (
  config: UseClothingTransferEngineConfig,
): UseClothingTransferEngineReturn => {
  const {
    driver, concepts, validReferences, extraPrompt, numImages, aspectRatio,
    resolution, imageEditModel, canGenerate, refinement, buildImageServiceConfig,
    addImage, engineId, setIsLoading, setLoadingMessage, setError, setUpscalingStates, t,
  } = config;
  const { conceptItems, updateConceptItem, resetAllStatus } = concepts;

  // Shared per-item generation used by both batch run and single regenerate so
  // the two paths cannot drift apart.
  const generateForItem = useCallback(
    async (
      conceptImage: ImageFile,
      itemId: string,
      refsWithImages: { image: ImageFile; label: string }[],
      referenceImages: ImageFile[],
    ) => {
      updateConceptItem(itemId, { status: 'processing', results: [], error: undefined });
      try {
        const interleavedParts = engineId === 'gptImage'
          ? buildGptClothingTransferParts(conceptImage, refsWithImages, extraPrompt.trim())
          : buildGeminiClothingTransferParts(conceptImage, refsWithImages, extraPrompt.trim());
        const results = await driver.editImage(
          {
            images: [conceptImage, ...referenceImages],
            prompt: '',
            numberOfImages: numImages,
            aspectRatio,
            resolution,
            interleavedParts,
          },
          imageEditModel,
          buildImageServiceConfig(setLoadingMessage),
        );
        updateConceptItem(itemId, { status: 'completed', results, error: undefined });
        results.forEach((image) => addImage(image, Feature.ClothingTransfer, engineId));
      } catch (itemError) {
        updateConceptItem(itemId, {
          status: 'error',
          results: [],
          error: getErrorMessage(itemError, t),
        });
      }
    },
    [driver, updateConceptItem, extraPrompt, numImages, aspectRatio, resolution,
      imageEditModel, buildImageServiceConfig, setLoadingMessage, addImage, engineId, t],
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      setError(t('clothingTransfer.inputError'));
      return;
    }

    const refsWithImages = validReferences.map((item) => ({
      image: item.image as ImageFile,
      label: item.label,
    }));
    const referenceImages = refsWithImages.map((item) => item.image);
    const jobs = conceptItems.map((item) => ({
      id: item.id,
      conceptImage: item.conceptImage,
    }));
    const batchConcurrency = Math.min(CLOTHING_TRANSFER_BATCH_MAX_CONCURRENCY, jobs.length);

    setIsLoading(true);
    setLoadingMessage(t('clothingTransfer.generatingStatus'));
    setError(null);
    setUpscalingStates({});
    refinement.resetSessions();
    resetAllStatus();

    try {
      await runBoundedWorkers(jobs, batchConcurrency, (job) =>
        generateForItem(job.conceptImage, job.id, refsWithImages, referenceImages),
      );
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [canGenerate, validReferences, conceptItems, resetAllStatus, refinement,
    setIsLoading, setLoadingMessage, setError, setUpscalingStates, t, generateForItem]);

  const handleRegenerateSingle = useCallback(async (itemId: string) => {
    const targetItem = conceptItems.find((item) => item.id === itemId);
    if (!targetItem || validReferences.length === 0) return;

    const refsWithImages = validReferences.map((item) => ({
      image: item.image as ImageFile,
      label: item.label,
    }));
    const referenceImages = refsWithImages.map((item) => item.image);

    setError(null);
    refinement.clearSessionsForPrefix(itemId);
    await generateForItem(targetItem.conceptImage, itemId, refsWithImages, referenceImages);
  }, [conceptItems, validReferences, refinement, setError, generateForItem]);

  return { handleGenerate, handleRegenerateSingle };
};
