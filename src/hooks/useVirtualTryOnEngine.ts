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
import { aiScanGuidanceFromItems, aiScanSourceSet, combineAiScanGuidance } from '../utils/ai-scan-blueprint';
import { buildGeminiVirtualTryOnParts } from '../utils/gemini-virtual-try-on-prompt';
import { buildGptVirtualTryOnParts } from '../utils/gpt-virtual-try-on-prompt';
import { buildQwenVirtualTryOnParts } from '../utils/qwen-virtual-try-on-prompt';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { dispatchByEngine, resolveEngineConcurrency } from '../utils/engineDispatch';
import { UseVirtualTryOnSubjectsReturn } from './useVirtualTryOnSubjects';
import { UseImageRefinementReturn } from './useImageRefinement';
import { useAiScan } from '../contexts/AiScanContext';
import { flattenInterleavedParts } from '../utils/flattenInterleavedParts';
import type { ImageDriver, ReferenceRoleImage, GenerateJob } from '../services/providers/ImageDriver';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

export type VirtualTryOnImageDriver = ImageDriver;


export interface UseVirtualTryOnEngineConfig {
  driver: VirtualTryOnImageDriver;
  subjects: UseVirtualTryOnSubjectsReturn;
  validClothingItems: VirtualTryOnClothingItem[];
  isMultiPersonMode: boolean;
  backgroundPrompt: string;
  extraPrompt: string;
  /** The operator's own note about the outfit, appended to the per-item notes. */
  userGuidance: string;
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
    extraPrompt, userGuidance, numImages, aspectRatio, resolution, imageEditModel, canGenerate,
    isWardrobeGenerating, refinement, buildImageServiceConfig, addImage, engineId,
    setIsLoading, setLoadingMessage, setError, setUpscalingStates, t,
  } = config;

  // AI Scan (issue #162): optional analytical pre-pass over each job's own
  // source set. The blueprint it returns rides in the prompt; a disabled or
  // failed scan yields null and the base prompt is unchanged.
  const { scan } = useAiScan();

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
        // One analysis per subject, over that subject's own photo: every
        // subject is an independent job, so a batch-wide blueprint would
        // deconstruct one subject's garments inside another subject's prompt.
        const guidance = combineAiScanGuidance(aiScanGuidanceFromItems(sourceItems), userGuidance);
        const blueprint = await scan(
          aiScanSourceSet(sourceItems.map((item) => item.image), [subjectImage]),
          guidance || undefined,
        );
        let finalSubjectImage = subjectImage;
        if (isMultiPersonMode && subjects.markerPosition) {
          finalSubjectImage = await compositeMarkerOnImage(subjectImage, subjects.markerPosition);
        }
        const promptInput = {
          subjectImage: finalSubjectImage,
          sourceItems,
          extraPrompt,
          backgroundPrompt,
          isMultiPersonMode: isMultiPersonMode && subjects.markerPosition !== null,
          outfitBlueprint: blueprint ?? undefined,
          userGuidance: userGuidance.trim() || undefined,
        };
        const interleavedParts = dispatchByEngine(engineId, {
          localQwen: () => buildQwenVirtualTryOnParts(promptInput),
          gptImage: () => buildGptVirtualTryOnParts(promptInput),
          gemini: () => buildGeminiVirtualTryOnParts(promptInput),
        });

        const references: ReferenceRoleImage[] = [
          { image: finalSubjectImage, role: 'subject', label: 'model' },
          ...sourceItems.map((item, index) => ({
            image: item.image,
            role: 'garment' as const,
            label: `item-${index + 1}-${item.sourceItemType}${item.sourcePrompt ? `: ${item.sourcePrompt}` : ''}`,
          })),
        ];

        const flattened = flattenInterleavedParts(interleavedParts);
        const compiledPrompt = flattened ? flattened.prompt : '';

        const results = await driver.generate({
          prompt: compiledPrompt,
          references,
          count: numImages,
          aspectRatio,
          resolution,
          workflow: 'virtual-try-on',
          model: imageEditModel,
          onProgress: setLoadingMessage,
          interleavedParts,
        });
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
      extraPrompt, backgroundPrompt, userGuidance, numImages, aspectRatio, resolution, imageEditModel,
      buildImageServiceConfig, setLoadingMessage, addImage, engineId, t, scan],
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
    const batchConcurrency = resolveEngineConcurrency(
      engineId,
      jobs.length,
    );

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
    // The subject's own source set again: a regenerate of subject B must scan
    // subject B, even when subject A was the most recent job.
    await generateForSubject(targetItem.subjectImage, itemId, sourceItems);
  }, [subjects.subjectItems, validClothingItems, refinement, setError, generateForSubject]);

  return { handleGenerateImage, handleRegenerateSingle };
};
