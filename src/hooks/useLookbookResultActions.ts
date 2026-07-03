import { useCallback } from 'react';
import { Feature, ImageFile } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { downloadImagesAsZip } from '../utils/zipDownload';
import type { GeminiImageDriver, LookbookSet } from './useLookbookGeneration';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

export interface UseLookbookResultActionsConfig {
  driver: GeminiImageDriver;
  generatedLookbook: LookbookSet | null;
  setGeneratedLookbook: React.Dispatch<React.SetStateAction<LookbookSet | null>>;
  imageEditModel: string;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  upscalingStates: Record<string, boolean>;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setError: (message: string | null) => void;
  t: TranslateFn;
}

export interface UseLookbookResultActionsReturn {
  handleUpscale: (imageToUpscale: ImageFile, imageKey: string) => Promise<void>;
  handleDownloadAll: () => Promise<void>;
}

/**
 * Per-result actions for Lookbook (upscale, download-all), extracted to keep
 * useLookbookGenerator under the line limit. Mirrors the Clothing Transfer and
 * Virtual Try-On result-actions split. Uses the injected GeminiImageDriver so
 * the same mock-driver seam covers these actions.
 */
export const useLookbookResultActions = (
  config: UseLookbookResultActionsConfig,
): UseLookbookResultActionsReturn => {
  const { driver, generatedLookbook, setGeneratedLookbook, imageEditModel,
    buildImageServiceConfig, setUpscalingStates, setError, t } = config;

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, imageKey: string) => {
    setUpscalingStates((prev) => ({ ...prev, [imageKey]: true }));
    setError(null);
    try {
      const result = await driver.upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => {}),
      );

      setGeneratedLookbook((prev) => {
        if (!prev) return null;
        const newState = { ...prev };
        if (prev.main.base64 === imageToUpscale.base64) {
          newState.main = result;
        } else {
          const variationIndex = prev.variations.findIndex((v) => v.base64 === imageToUpscale.base64);
          if (variationIndex > -1) {
            newState.variations = [...prev.variations];
            newState.variations[variationIndex] = result;
          }

          const closeupIndex = prev.closeups.findIndex((c) => c.base64 === imageToUpscale.base64);
          if (closeupIndex > -1) {
            newState.closeups = [...prev.closeups];
            newState.closeups[closeupIndex] = result;
          }
        }
        return newState;
      });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [imageKey]: false }));
    }
  }, [driver, imageEditModel, buildImageServiceConfig, t, setError, setGeneratedLookbook, setUpscalingStates]);

  const handleDownloadAll = useCallback(async () => {
    if (!generatedLookbook) return;

    const imagesToDownload = [
      generatedLookbook.main,
      ...generatedLookbook.variations,
      ...generatedLookbook.closeups,
    ];

    if (imagesToDownload.length === 0) return;

    try {
      await downloadImagesAsZip(imagesToDownload, `${Feature.Lookbook}-batch`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [generatedLookbook, t, setError]);

  return { handleUpscale, handleDownloadAll };
};
