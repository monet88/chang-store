/**
 * Result actions for Pose Changer (upscale).
 *
 * Extracted from engine to keep files under 200 LOC and isolate output actions.
 * Uses the driver seam for future mock testing.
 */

import { useCallback } from 'react';
import { ImageFile } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { type PoseImageDriver } from './usePoseChangerEngine';

export interface UsePoseChangerResultActionsConfig {
  driver: PoseImageDriver;
  imageEditModel: string;
  t: (key: string, options?: any) => string;
  setGeneratedImages: React.Dispatch<React.SetStateAction<ImageFile[]>>;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setError: (e: string | null) => void;
}

export interface UsePoseChangerResultActionsReturn {
  handleUpscale: (imageToUpscale: ImageFile, index: number) => Promise<void>;
}

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({ onStatusUpdate });

export const usePoseChangerResultActions = (
  config: UsePoseChangerResultActionsConfig,
): UsePoseChangerResultActionsReturn => {
  const { driver, imageEditModel, t, setGeneratedImages, setUpscalingStates, setError } = config;

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, index: number) => {
    setUpscalingStates((prev) => ({ ...prev, [index]: true }));
    setError(null);

    try {
      const result = await driver.upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => {}),
      );
      setGeneratedImages((prev) => prev.map((image, imageIndex) => (imageIndex === index ? result : image)));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [index]: false }));
    }
  }, [driver, imageEditModel, t, setGeneratedImages, setUpscalingStates, setError]);

  return { handleUpscale };
};
