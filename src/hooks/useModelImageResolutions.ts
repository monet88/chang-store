import { useEffect, useMemo } from 'react';
import {
  getSupportedImageResolutions,
  resolveEffectiveImageResolution,
} from '../config/modelRegistry';
import type { ImageResolution } from '../types';

export interface ModelImageResolutionsState {
  supportedResolutions: readonly ImageResolution[];
  effectiveResolution: ImageResolution;
  isFixedResolution: boolean;
}

/**
 * Owns model-aware resolution options and stale-state normalization.
 * Components only render the returned values.
 */
export function useModelImageResolutions(
  model: string | undefined,
  resolution: ImageResolution,
  setResolution: (resolution: ImageResolution) => void,
): ModelImageResolutionsState {
  const modelId = model ?? '';
  const supportedResolutions = useMemo(
    () => getSupportedImageResolutions(modelId),
    [modelId],
  );
  const effectiveResolution = resolveEffectiveImageResolution(modelId, resolution);
  const isFixedResolution = supportedResolutions.length === 1;

  useEffect(() => {
    if (resolution !== effectiveResolution) {
      setResolution(effectiveResolution);
    }
  }, [effectiveResolution, resolution, setResolution]);

  return {
    supportedResolutions,
    effectiveResolution,
    isFixedResolution,
  };
}
