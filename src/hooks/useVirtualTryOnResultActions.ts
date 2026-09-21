import { useMemo } from 'react';
import { Feature } from '../types';
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
}

/**
 * Virtual Try-On's adapter over the shared result actions. Try-On mutates the
 * subject item result slots and does not persist results to the gallery, so its
 * adapter commits the slot alone.
 */
export const useVirtualTryOnResultActions = (
  config: UseVirtualTryOnResultActionsConfig,
): UseGeneratedResultActionsReturn => {
  const { driver, subjects, ...rest } = config;

  const adapter = useMemo<GeneratedResultSlotAdapter>(() => ({
    activeItemId: subjects.activeSubjectItem?.id,
    commitResult: (itemId, index, image) => subjects.updateSubjectItem(itemId, (item) => ({
      ...item,
      results: item.results.map((result, resultIndex) => (resultIndex === index ? image : result)),
    })),
    collectDownloadableResults: () => subjects.subjectItems
      .filter((item) => item.status === 'completed' && item.results && item.results.length > 0)
      .flatMap((item) => item.results),
  }), [subjects.activeSubjectItem?.id, subjects.updateSubjectItem, subjects.subjectItems]);

  return useGeneratedResultActions({
    ...rest,
    driver,
    adapter,
    downloadName: `${Feature.TryOn}-batch`,
  });
};
