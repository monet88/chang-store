import { useCallback } from 'react';
import { ImageFile, UpscaleQuality } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { upscaleImage } from '../services/imageEditingService';
import { downloadImagesAsZip } from '../utils/zipDownload';
import type { UseImageRefinementReturn } from './useImageRefinement';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * The Feature-owned seam for per-result actions. The shared mechanics below never
 * read a Feature's collection shape: they only name the slot to commit and ask
 * for the results a batch download should archive. Each Feature keeps its own
 * mutation and gallery-persistence adapter behind this interface.
 */
export interface GeneratedResultSlotAdapter {
  /** Item that owns the slot when the caller does not name one. */
  activeItemId?: string;
  /**
   * Commit one result into the Feature collection at `itemId:index`, persisting
   * it (gallery save/tagging) when that Feature persists results.
   */
  commitResult: (itemId: string, index: number, image: ImageFile) => void;
  /** Flat list of results eligible for batch download. */
  collectDownloadableResults: () => ImageFile[];
  /** Optional matching ZIP entry paths when a Feature needs grouped archives. */
  collectDownloadableEntryPaths?: () => string[];
}

export interface UseGeneratedResultActionsConfig {
  driver: { upscaleImage: typeof upscaleImage };
  adapter: GeneratedResultSlotAdapter;
  imageEditModel: string;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Base name for the batch archive, e.g. `try-on-batch`. */
  downloadName: string;
  t: TranslateFn;
}

export interface UseGeneratedResultActionsReturn {
  handleUpscale: (
    image: ImageFile,
    index: number,
    itemId?: string,
    quality?: UpscaleQuality,
  ) => Promise<void>;
  handleRefine: (image: ImageFile, index: number, itemId: string, prompt: string) => Promise<void>;
  handleDownloadAll: () => Promise<void>;
}

const getUpscaleStateKey = (itemId: string, index: number) => `${itemId}:${index}`;

/**
 * Deep module for the generated-result actions shared by Try-On and Clothing
 * Transfer: upscale one slot, iteratively refine one slot, and archive every
 * completed result. Feature differences live in the injected adapter, so the
 * loading-state keying, error surfacing, and batch guard exist once.
 */
export const useGeneratedResultActions = (
  config: UseGeneratedResultActionsConfig,
): UseGeneratedResultActionsReturn => {
  const { driver, adapter, imageEditModel, refinement, buildImageServiceConfig,
    setError, setUpscalingStates, downloadName, t } = config;

  const handleUpscale = useCallback(async (
    imageToUpscale: ImageFile,
    index: number,
    itemId?: string,
    quality?: UpscaleQuality,
  ) => {
    const targetItemId = itemId ?? adapter.activeItemId;
    if (!imageToUpscale || !targetItemId) {
      return;
    }

    const stateKey = getUpscaleStateKey(targetItemId, index);
    setUpscalingStates((prev) => ({ ...prev, [stateKey]: true }));
    setError(null);

    try {
      const serviceConfig = buildImageServiceConfig(() => { });
      const result = quality
        ? await driver.upscaleImage(imageToUpscale, imageEditModel, serviceConfig, quality)
        : await driver.upscaleImage(imageToUpscale, imageEditModel, serviceConfig);

      adapter.commitResult(targetItemId, index, result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [stateKey]: false }));
    }
  }, [driver, adapter, imageEditModel, buildImageServiceConfig, setUpscalingStates, setError, t]);

  const handleRefine = useCallback(async (imageToRefine: ImageFile, index: number, itemId: string, prompt: string) => {
    await refinement.runRefine(`${itemId}:${index}`, prompt, imageToRefine, (refined) => {
      adapter.commitResult(itemId, index, refined);
    });
  }, [refinement, adapter]);

  const handleDownloadAll = useCallback(async () => {
    const allResults = adapter.collectDownloadableResults();
    if (allResults.length === 0) return;

    try {
      const entryPaths = adapter.collectDownloadableEntryPaths?.();
      if (entryPaths && entryPaths.length === allResults.length) {
        await downloadImagesAsZip(allResults, downloadName, entryPaths);
      } else {
        await downloadImagesAsZip(allResults, downloadName);
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [adapter, downloadName, setError, t]);

  return { handleUpscale, handleRefine, handleDownloadAll };
};
