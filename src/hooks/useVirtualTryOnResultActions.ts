import { useCallback } from 'react';
import { Feature, ImageFile } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { upscaleImage } from '../services/imageEditingService';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { UseVirtualTryOnSubjectsReturn } from './useVirtualTryOnSubjects';
import { UseImageRefinementReturn } from './useImageRefinement';
import type { VirtualTryOnImageDriver } from './useVirtualTryOnEngine';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

const getUpscaleStateKey = (itemId: string, index: number) => `${itemId}:${index}`;

export interface UseVirtualTryOnResultActionsConfig {
  driver: VirtualTryOnImageDriver;
  subjects: UseVirtualTryOnSubjectsReturn;
  imageEditModel: string;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: TranslateFn;
}

export interface UseVirtualTryOnResultActionsReturn {
  handleUpscale: (image: ImageFile, index: number, itemId?: string) => Promise<void>;
  handleRefine: (image: ImageFile, index: number, itemId: string, prompt: string) => Promise<void>;
  handleDownloadAll: () => Promise<void>;
}

/**
 * Per-result actions for Virtual Try-On (upscale, refine, download-all),
 * extracted to keep useVirtualTryOn under the line limit. Mirrors the provider
 * `useProviderResultActions` split. Uses the injected VirtualTryOnImageDriver so the
 * same mock-driver seam covers these actions.
 */
export const useVirtualTryOnResultActions = (
  config: UseVirtualTryOnResultActionsConfig,
): UseVirtualTryOnResultActionsReturn => {
  const { driver, subjects, imageEditModel, refinement, buildImageServiceConfig,
    setError, setUpscalingStates, t } = config;

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, index: number, itemId?: string) => {
    const targetItemId = itemId ?? subjects.activeSubjectItem?.id;
    if (!imageToUpscale || !targetItemId) {
      return;
    }

    const stateKey = getUpscaleStateKey(targetItemId, index);
    setUpscalingStates((prev) => ({ ...prev, [stateKey]: true }));
    setError(null);

    try {
      const result = await driver.upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => { }),
      );

      subjects.updateSubjectItem(targetItemId, (item) => ({
        ...item,
        results: item.results.map((image, resultIndex) => (resultIndex === index ? result : image)),
      }));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [stateKey]: false }));
    }
  }, [driver, subjects.activeSubjectItem, subjects.updateSubjectItem, imageEditModel,
    buildImageServiceConfig, setUpscalingStates, setError, t]);

  const handleRefine = useCallback(async (imageToRefine: ImageFile, index: number, itemId: string, prompt: string) => {
    const key = `${itemId}:${index}`;
    await refinement.runRefine(key, prompt, imageToRefine, (refined) => {
      subjects.updateSubjectItem(itemId, (item) => ({
        ...item,
        results: item.results.map((img, i) => (i === index ? refined : img)),
      }));
    });
  }, [refinement, subjects.updateSubjectItem]);

  const handleDownloadAll = useCallback(async () => {
    const successItems = subjects.subjectItems.filter(
      (item) => item.status === 'completed' && item.results && item.results.length > 0,
    );
    if (successItems.length === 0) return;

    const allResults = successItems.flatMap((item) => item.results);
    if (allResults.length === 0) return;

    try {
      await downloadImagesAsZip(allResults, `${Feature.TryOn}-batch`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [subjects.subjectItems, setError, t]);

  return { handleUpscale, handleRefine, handleDownloadAll };
};
