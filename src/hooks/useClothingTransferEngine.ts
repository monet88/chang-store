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
import type { ImageDriver, GenerateJob, ReferenceRoleImage } from '../services/providers/ImageDriver';
import { flattenInterleavedParts } from '../utils/flattenInterleavedParts';
import { buildGeminiClothingTransferParts } from '../utils/gemini-clothing-transfer-prompt';
import { buildGptClothingTransferParts } from '../utils/gpt-clothing-transfer-prompt';
import { buildQwenClothingTransferParts } from '../utils/qwen-clothing-transfer-prompt';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { dispatchByEngine, resolveEngineConcurrency } from '../utils/engineDispatch';
import { UseClothingTransferConceptsReturn } from './useClothingTransferConcepts';
import { UseImageRefinementReturn } from './useImageRefinement';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

export type ClothingTransferImageDriver = ImageDriver;

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
        const trimmedExtraPrompt = extraPrompt.trim();
        const interleavedParts = dispatchByEngine(engineId, {
          localQwen: () => buildQwenClothingTransferParts(conceptImage, refsWithImages, trimmedExtraPrompt),
          gptImage: () => buildGptClothingTransferParts(conceptImage, refsWithImages, trimmedExtraPrompt),
          gemini: () => buildGeminiClothingTransferParts(conceptImage, refsWithImages, trimmedExtraPrompt),
        });
        const references: ReferenceRoleImage[] = [
          { image: conceptImage, role: 'subject', label: 'destination-model' },
          ...refsWithImages.map((ref) => ({
            image: ref.image,
            role: 'garment' as const,
            label: ref.label,
          })),
        ];

        const flattened = flattenInterleavedParts(interleavedParts);
        const compiledPrompt = flattened ? flattened.prompt : trimmedExtraPrompt;

        const results = await driver.generate({
          prompt: compiledPrompt,
          references,
          count: numImages,
          aspectRatio,
          resolution,
          workflow: 'clothing-transfer',
          model: imageEditModel,
          onProgress: setLoadingMessage,
          interleavedParts,
        });
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
      imageEditModel, setLoadingMessage, addImage, engineId, t],
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
    const batchConcurrency = resolveEngineConcurrency(
      engineId,
      jobs.length,
    );

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
    setIsLoading, setLoadingMessage, setError, setUpscalingStates, t, generateForItem, engineId]);

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
