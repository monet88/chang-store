import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feature, ImageFile, UpscaleQuality, VirtualTryOnClothingItem, VirtualTryOnMode } from '../types';
import { getErrorMessage, compositeMarkerOnImage } from '../utils/imageUtils';
import { buildProviderStudioPrompt } from '../utils/provider-studio-prompt-adapter';
import { buildProviderRefinePrompt } from '../utils/provider-refine-prompt';
import { useProviderResultActions } from './useProviderResultActions';
import type {
  ProviderImageDriver,
  UseProviderStudioGenerationReturn,
  UseProviderStudioGenerationConfig,
} from './providerStudioGenerationTypes';

// Re-export so existing imports (useProviderStudioEngine, 
// useGptImageStudio) keep working without changes.
export type {
  ProviderImageDriver,
  UseProviderStudioGenerationReturn,
} from './providerStudioGenerationTypes';

/**
 * Shared generation engine for provider studios (GPT Image).
 *
 * The parent `useProviderStudioEngine` creates the sub-hooks (fields, batch,
 * lookbook) and passes them in so this hook can build prompts and drive the
 * injected `driver` without importing provider services directly.
 *
 * Owns the workflow state that drives a single generate or batch run (prompt,
 * images, results, loading, error, tryOnMode) and the core execution surface:
 * prepareImages, runGeneration, generateSet, handleGenerate, and per-result
 * actions (refine / upscale / regenerate). See providerStudioGenerationTypes.ts
 * for the driver contract and public return/config shapes.
 */
export const useProviderStudioGeneration = (
  config: UseProviderStudioGenerationConfig,
): UseProviderStudioGenerationReturn => {
  const { activeFeature, driver, fields, batch, lookbook, mainCount, t } = config;

  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImageFile[]>([]);

  const [tryOnMode, setTryOnMode] = useState<VirtualTryOnMode>('multi-model');

  const abortControllerRef = useRef<AbortController | null>(null);

  const getSignal = useCallback(() => abortControllerRef.current?.signal, []);

  const prepareImages = useCallback(
    async (subjectOverride?: ImageFile): Promise<ImageFile[]> => {
      if (activeFeature !== Feature.TryOn || images.length === 0) {
        return images;
      }
      const [defaultSubject, ...sourceItems] = images;
      let subject = subjectOverride ?? defaultSubject;
      if (batch.isMultiPersonMode && batch.markerPosition) {
        subject = await compositeMarkerOnImage(subject, batch.markerPosition);
      }
      return [subject, ...sourceItems];
    },
    [activeFeature, images, batch.isMultiPersonMode, batch.markerPosition],
  );

  const runGeneration = useCallback(
    async (count: number, signal?: AbortSignal, subjectOverride?: ImageFile): Promise<ImageFile[]> => {
      const requestImages = await prepareImages(subjectOverride);
      const multiPerson = activeFeature === Feature.TryOn && batch.isMultiPersonMode && batch.markerPosition !== null;
      const composedPrompt = buildProviderStudioPrompt(activeFeature, prompt, requestImages, {
        ...fields.buildPromptOptions(),
        isMultiPersonMode: multiPerson,
        lookbookState: lookbook.lookbookState,
        fabricTextureImage: lookbook.lookbookFabricImage,
      });
      return requestImages.length > 0
        ? driver.edit(composedPrompt, requestImages, count, signal)
        : driver.generate(composedPrompt, count, signal);
    },
    [activeFeature, prompt, fields, batch.isMultiPersonMode, batch.markerPosition, lookbook.lookbookState, lookbook.lookbookFabricImage, prepareImages, driver],
  );

  const generateSet = useCallback(
    async (
      subject: ImageFile,
      items: VirtualTryOnClothingItem[],
      prompts: { backgroundPrompt: string; extraPrompt: string },
      signal?: AbortSignal,
    ): Promise<ImageFile[]> => {
      const withImage = items.filter((i) => i.image !== null);
      const requestImages = [subject, ...withImage.map((i) => i.image as ImageFile)];
      const composedPrompt = buildProviderStudioPrompt(Feature.TryOn, '', requestImages, {
        sourceItemTypes: withImage.map((i) => i.sourceItemType),
        sourceItemNotes: withImage.map((i) => i.sourcePrompt),
        backgroundPrompt: prompts.backgroundPrompt,
        extraPrompt: prompts.extraPrompt,
      });
      return driver.edit(composedPrompt, requestImages, mainCount, signal);
    },
    [driver, mainCount],
  );

  const resultActionsConfig = useMemo(
    () => ({
      results,
      setResults,
      getSignal,
      isBusy: isLoading || batch.isBatchRunning,
      t,
      editOne: async (source: ImageFile, instruction: string, signal?: AbortSignal) => {
        const [edited] = await driver.edit(buildProviderRefinePrompt(instruction), [source], 1, signal);
        return edited;
      },
      upscaleOne: async (source: ImageFile, quality: UpscaleQuality, signal?: AbortSignal) => {
        const [upscaled] = await driver.upscale(source, quality, signal);
        return upscaled;
      },
      regenerateOne: async (signal?: AbortSignal) => {
        const [regenerated] = await runGeneration(1, signal);
        return regenerated;
      },
    }),
    [results, setResults, getSignal, isLoading, batch.isBatchRunning, t, driver, runGeneration],
  );
  const actions = useProviderResultActions(resultActionsConfig);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (isLoading || batch.isBatchRunning || actions.busyIndex !== null) return;

    setError(null);

    if (batch.batchActive && activeFeature === Feature.TryOn && images.length > 0) {
      setResults([]);
      const subjects = [images[0], ...batch.batchSubjects];
      await batch.runBatch(
        subjects,
        (subject, signal) => runGeneration(mainCount, signal, subject),
        abortControllerRef.current?.signal,
      );
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const generated = await runGeneration(mainCount, abortControllerRef.current?.signal);
      setResults(generated);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, batch, actions.busyIndex, activeFeature, images, runGeneration, mainCount, t]);

  const abortCurrent = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortCurrent();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPrompt('');
    setImages([]);
    setResults([]);
    setError(null);
    setTryOnMode('multi-model');
  }, [abortCurrent]);

  // Ensure a controller exists for the initial mount so getSignal is usable.
  useEffect(() => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    prompt,
    setPrompt,
    images,
    setImages,
    isLoading,
    error,
    results,
    clearError: () => setError(null),
    handleGenerate,
    tryOnMode,
    setTryOnMode,
    generateSet,
    getSignal,
    reset,
    abortCurrent,
    ...actions,
  };
};
