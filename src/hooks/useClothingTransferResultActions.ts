import { useCallback } from 'react';
import { Feature, ImageFile } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { UseClothingTransferConceptsReturn } from './useClothingTransferConcepts';
import { UseImageRefinementReturn } from './useImageRefinement';
import type { GeminiImageDriver } from './useClothingTransferEngine';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

const getUpscaleStateKey = (itemId: string, index: number) => `${itemId}:${index}`;

export interface UseClothingTransferResultActionsConfig {
  driver: GeminiImageDriver;
  concepts: UseClothingTransferConceptsReturn;
  imageEditModel: string;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  addImage: (image: ImageFile) => void;
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: TranslateFn;
}

export interface UseClothingTransferResultActionsReturn {
  handleUpscale: (image: ImageFile, index: number, itemId?: string) => Promise<void>;
  handleRefine: (image: ImageFile, index: number, itemId: string, prompt: string) => Promise<void>;
  handleDownloadAll: () => Promise<void>;
}

/**
 * Per-result actions for Clothing Transfer (upscale, refine, download-all),
 * extracted to keep useClothingTransfer under the line limit. Mirrors the VTO
 * `useVirtualTryOnResultActions` split. Uses the injected GeminiImageDriver so
 * the same mock-driver seam covers these actions.
 */
export const useClothingTransferResultActions = (
  config: UseClothingTransferResultActionsConfig,
): UseClothingTransferResultActionsReturn => {
  const { driver, concepts, imageEditModel, refinement, buildImageServiceConfig,
    addImage, setError, setUpscalingStates, t } = config;
  const { activeConceptItem, updateConceptItem, conceptItems } = concepts;

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, index: number, itemId?: string) => {
    const targetItemId = itemId ?? activeConceptItem?.id;
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
        buildImageServiceConfig(() => {}),
      );

      updateConceptItem(targetItemId, (item) => ({
        ...item,
        results: item.results.map((image, resultIndex) => (
          resultIndex === index ? result : image
        )),
      }));
      addImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [stateKey]: false }));
    }
  }, [driver, activeConceptItem?.id, updateConceptItem, imageEditModel,
    buildImageServiceConfig, addImage, setUpscalingStates, setError, t]);

  const handleRefine = useCallback(async (imageToRefine: ImageFile, index: number, itemId: string, prompt: string) => {
    const key = `${itemId}:${index}`;
    await refinement.runRefine(key, prompt, imageToRefine, (refined) => {
      updateConceptItem(itemId, (item) => ({
        ...item,
        results: item.results.map((img, i) => (i === index ? refined : img)),
      }));
      addImage(refined);
    });
  }, [refinement, updateConceptItem, addImage]);

  const handleDownloadAll = useCallback(async () => {
    const successItems = conceptItems.filter(
      (item) => item.status === 'completed' && item.results && item.results.length > 0,
    );
    if (successItems.length === 0) return;

    const allResults = successItems.flatMap((item) => item.results);
    if (allResults.length === 0) return;

    try {
      await downloadImagesAsZip(allResults, `${Feature.ClothingTransfer}-batch`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [conceptItems, setError, t]);

  return { handleUpscale, handleRefine, handleDownloadAll };
};
