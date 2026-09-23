import { useMemo } from 'react';
import { Feature, type ImageFile, type ImageEngineId } from '../types';
import { UseVirtualTryOnSubjectsReturn } from './useVirtualTryOnSubjects';
import { UseImageRefinementReturn } from './useImageRefinement';
import type { VirtualTryOnImageDriver } from './useVirtualTryOnEngine';
import {
  GeneratedResultSlotAdapter,
  useGeneratedResultActions,
  UseGeneratedResultActionsReturn,
} from './useGeneratedResultActions';

export interface UseVirtualTryOnResultActionsConfig {
  driver: VirtualTryOnImageDriver;
  subjects: UseVirtualTryOnSubjectsReturn;
  imageEditModel: string;
  refinement: UseImageRefinementReturn;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  setError: (message: string | null) => void;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: (key: string, options?: { [key: string]: string | number }) => string;
  addImage?: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  engineId?: ImageEngineId;
}

/**
 * Virtual Try-On's adapter over the shared result actions. Try-On mutates the
 * subject item result slots. Only the Local Qwen engine persists an upscaled or
 * refined slot from here — the engine does not own a gallery, so the committed
 * result is saved as Feature.TryOn under `localQwen`. Cloud engines keep their
 * prior behavior: generation persists its own results in the generation engine
 * and result actions never touch the gallery.
 */
export const useVirtualTryOnResultActions = (
  config: UseVirtualTryOnResultActionsConfig,
): UseGeneratedResultActionsReturn => {
  const { driver, subjects, addImage, engineId, ...rest } = config;

  const adapter = useMemo<GeneratedResultSlotAdapter>(() => ({
    activeItemId: subjects.activeSubjectItem?.id,
    commitResult: (itemId, index, image) => {
      subjects.updateSubjectItem(itemId, (item) => ({
        ...item,
        results: item.results.map((result, resultIndex) => (resultIndex === index ? image : result)),
      }));
      if (engineId === 'localQwen') {
        addImage?.(image, Feature.TryOn, engineId);
      }
    },
    collectDownloadableResults: () => subjects.subjectItems
      .filter((item) => item.status === 'completed' && item.results && item.results.length > 0)
      .flatMap((item) => item.results),
  }), [subjects.activeSubjectItem?.id, subjects.updateSubjectItem, subjects.subjectItems, addImage, engineId]);

  return useGeneratedResultActions({
    ...rest,
    driver,
    adapter,
    downloadName: `${Feature.TryOn}-batch`,
  });
};
