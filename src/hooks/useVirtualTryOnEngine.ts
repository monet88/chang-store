import { useCallback } from 'react';
import {
  AspectRatio,
  Feature,
  ImageEngineId,
  ImageFile,
  ImageResolution,
  VirtualTryOnClothingItem,
} from '../types';
import { getErrorMessage, compositeMarkerOnImage } from '../utils/imageUtils';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { buildVirtualTryOnParts } from '../utils/virtual-try-on-prompt-builder';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { UseVirtualTryOnSubjectsReturn } from './useVirtualTryOnSubjects';
import { UseImageRefinementReturn } from './useImageRefinement';

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
}

const VIRTUAL_TRY_ON_BATCH_MAX_CONCURRENCY = 3;

export interface UseVirtualTryOnEngineConfig {
  driver: GeminiImageDriver;
  subjects: UseVirtualTryOnSubjectsReturn;
  validClothingItems: VirtualTryOnClothingItem[];
  isMultiPersonMode: boolean;
  backgroundPrompt: string;
  extraPrompt: string;
  numImages: number;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  imageEditModel: string;
  canGenerate: boolean;
  isWardrobeGenerating: boolean;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  addImage?: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  engineId?: ImageEngineId;
  setIsLoading: (value: boolean) => void;
  setLoadingMessage: (message: string) => void;
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: TranslateFn;
}

export interface UseVirtualTryOnEngineReturn {
  handleGenerateImage: () => Promise<void>;
  handleRegenerateSingle: (itemId: string) => Promise<void>;
}

/**
 * Generation engine for Virtual Try-On, extracted to keep useVirtualTryOn under
 * the line limit and isolate the generation core behind a driver seam. Owns the
 * batch run and per-subject regenerate; result actions live in their own hook.
 */
export const useVirtualTryOnEngine = (
  config: UseVirtualTryOnEngineConfig,
): UseVirtualTryOnEngineReturn => {
  const {
    driver, subjects, validClothingItems, isMultiPersonMode, backgroundPrompt,
    extraPrompt, numImages, aspectRatio, resolution, imageEditModel, canGenerate,
    isWardrobeGenerating, refinement, buildImageServiceConfig, addImage, engineId,
    setIsLoading, setLoadingMessage, setError, setUpscalingStates, t,
  } = config;

  // Shared per-subject generation: marker compositing + prompt build + driver
  // edit + status commit. Used by both the batch run and single regenerate so
  // the two paths cannot drift apart.
  const generateForSubject = useCallback(
    async (subjectImage: ImageFile, itemId: string, sourceItems: {
      image: ImageFile;
      sourceItemType: VirtualTryOnClothingItem['sourceItemType'];
      sourcePrompt: string;
    }[]) => {
      subjects.updateSubjectItem(itemId, { status: 'processing', results: [], error: undefined });
      try {
        let finalSubjectImage = subjectImage;
        if (isMultiPersonMode && subjects.markerPosition) {
          finalSubjectImage = await compositeMarkerOnImage(subjectImage, subjects.markerPosition);
        }
        const interleavedParts = buildVirtualTryOnParts({
          subjectImage: finalSubjectImage,
          sourceItems,
          extraPrompt,
          backgroundPrompt,
          isMultiPersonMode: isMultiPersonMode && subjects.markerPosition !== null,
        });
        const results = await driver.editImage(
          {
            images: [],
            prompt: '',
            numberOfImages: numImages,
            aspectRatio,
            resolution,
            interleavedParts,
          },
          imageEditModel,
          buildImageServiceConfig(setLoadingMessage),
        );
        subjects.updateSubjectItem(itemId, { status: 'completed', results, error: undefined });
        results.forEach((image) => addImage?.(image, Feature.TryOn, engineId));
      } catch (itemError) {
        subjects.updateSubjectItem(itemId, {
          status: 'error',
          results: [],
          error: getErrorMessage(itemError, t),
        });
      }
    },
    [driver, subjects.markerPosition, subjects.updateSubjectItem, isMultiPersonMode,
      extraPrompt, backgroundPrompt, numImages, aspectRatio, resolution, imageEditModel,
      buildImageServiceConfig, setLoadingMessage, addImage, engineId, t],
  );

  const handleGenerateImage = useCallback(async () => {
    if (isWardrobeGenerating) return;
    if (!canGenerate) {
      setError(t('virtualTryOn.inputError'));
      return;
    }

    const sourceItems = validClothingItems.map((item) => ({
      image: item.image as ImageFile,
      sourceItemType: item.sourceItemType,
      sourcePrompt: item.sourcePrompt,
    }));
    const jobs = subjects.subjectItems.map((item) => ({
      id: item.id,
      subjectImage: item.subjectImage,
    }));
    const batchConcurrency = Math.min(VIRTUAL_TRY_ON_BATCH_MAX_CONCURRENCY, jobs.length);

    setIsLoading(true);
    setLoadingMessage(t('virtualTryOn.generatingStatus'));
    setError(null);
    setUpscalingStates({});
    refinement.resetSessions();
    subjects.setSubjectItems((prev) =>
      prev.map((item) => ({ ...item, status: 'pending', results: [], error: undefined })),
    );

    try {
      await runBoundedWorkers(jobs, batchConcurrency, (job) =>
        generateForSubject(job.subjectImage, job.id, sourceItems),
      );
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [isWardrobeGenerating, canGenerate, validClothingItems, subjects, refinement,
    setIsLoading, setLoadingMessage, setError, setUpscalingStates, t, generateForSubject]);

  const handleRegenerateSingle = useCallback(async (itemId: string) => {
    const targetItem = subjects.subjectItems.find((item) => item.id === itemId);
    if (!targetItem || validClothingItems.length === 0) return;

    const sourceItems = validClothingItems.map((item) => ({
      image: item.image as ImageFile,
      sourceItemType: item.sourceItemType,
      sourcePrompt: item.sourcePrompt,
    }));

    setError(null);
    refinement.clearSessionsForPrefix(itemId);
    await generateForSubject(targetItem.subjectImage, itemId, sourceItems);
  }, [subjects.subjectItems, validClothingItems, refinement, setError, generateForSubject]);

  return { handleGenerateImage, handleRegenerateSingle };
};
