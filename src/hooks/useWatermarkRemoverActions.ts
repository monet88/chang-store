import { useCallback } from 'react';
import { Feature, type ImageFile, type WatermarkBatchItem } from '@/types';
import { downloadImagesAsZip } from '@/utils/zipDownload';
import { downloadImageAsJpeg } from '@/utils/imageDownload';

export interface UseWatermarkRemoverActionsConfig {
  items: WatermarkBatchItem[];
  addToGallery: (image: ImageFile) => void;
}

export interface UseWatermarkRemoverActionsReturn {
  saveToGallery: (item: WatermarkBatchItem) => void;
  saveAllToGallery: () => void;
  downloadItem: (item: WatermarkBatchItem) => void;
  downloadAllZip: () => Promise<void>;
}

/**
 * Output actions for Watermark Remover (save to gallery, download single,
 * download all as ZIP). Extracted to keep useWatermarkRemover under the line
 * limit. Mirrors the result-actions split used in other feature hooks.
 */
export const useWatermarkRemoverActions = (
  config: UseWatermarkRemoverActionsConfig,
): UseWatermarkRemoverActionsReturn => {
  const { items, addToGallery } = config;

  const saveToGallery = useCallback((item: WatermarkBatchItem) => {
    if (item.result) {
      addToGallery(item.result);
    }
  }, [addToGallery]);

  const saveAllToGallery = useCallback(() => {
    items
      .filter((i) => i.status === 'completed' && i.result)
      .forEach((item) => {
        if (item.result) addToGallery(item.result);
      });
  }, [items, addToGallery]);

  const downloadItem = useCallback((item: WatermarkBatchItem) => {
    if (!item.result) return;
    void downloadImageAsJpeg(item.result, {
      baseName: `${Feature.WatermarkRemover}-${item.id}`,
    });
  }, []);

  const downloadAllZip = useCallback(async () => {
    const successResults = items
      .filter((i) => i.status === 'completed' && i.result)
      .map((i) => i.result!);

    if (successResults.length > 0) {
      await downloadImagesAsZip(successResults, `${Feature.WatermarkRemover}-batch`);
    }
  }, [items]);

  return { saveToGallery, saveAllToGallery, downloadItem, downloadAllZip };
};
