import { useMemo } from 'react';
import { Feature, ImageEngineId, ImageFile } from '../types';
import { UseClothingTransferConceptsReturn } from './useClothingTransferConcepts';
import { UseImageRefinementReturn } from './useImageRefinement';
import type { ClothingTransferImageDriver } from './useClothingTransferEngine';
import {
  GeneratedResultSlotAdapter,
  useGeneratedResultActions,
  UseGeneratedResultActionsReturn,
} from './useGeneratedResultActions';

export interface UseClothingTransferResultActionsConfig {
  driver: ClothingTransferImageDriver;
  concepts: UseClothingTransferConceptsReturn;
  imageEditModel: string;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  addImage: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  engineId?: ImageEngineId;
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

/**
 * Clothing Transfer's adapter over the shared result actions. Unlike Try-On it
 * persists every applicable upscale/refine result to the gallery with its own
 * Feature and engine tagging, which lives here in the commit step.
 */
export const useClothingTransferResultActions = (
  config: UseClothingTransferResultActionsConfig,
): UseGeneratedResultActionsReturn => {
  const { driver, concepts, addImage, engineId, ...rest } = config;
  const { activeConceptItem, updateConceptItem, conceptItems } = concepts;

  const adapter = useMemo<GeneratedResultSlotAdapter>(() => ({
    activeItemId: activeConceptItem?.id,
    commitResult: (itemId, index, image) => {
      updateConceptItem(itemId, (item) => ({
        ...item,
        results: item.results.map((result, resultIndex) => (resultIndex === index ? image : result)),
      }));
      addImage(image, Feature.ClothingTransfer, engineId);
    },
    collectDownloadableResults: () => conceptItems
      .filter((item) => item.status === 'completed' && item.results && item.results.length > 0)
      .flatMap((item) => item.results),
  }), [activeConceptItem?.id, updateConceptItem, conceptItems, addImage, engineId]);

  return useGeneratedResultActions({
    ...rest,
    driver,
    adapter,
    downloadName: `${Feature.ClothingTransfer}-batch`,
  });
};
