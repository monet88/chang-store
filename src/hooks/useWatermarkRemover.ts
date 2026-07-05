import { useMemo } from 'react';
import { editImage } from '@/services/gemini/image';
import { type ImageFile, type WatermarkBatchItem, type WatermarkConfig } from '@/types';
import { type WatermarkModel } from '@/utils/watermark-prompts';
import { useWatermarkRemoverQueue } from './useWatermarkRemoverQueue';
import { useWatermarkRemoverEngine, type WatermarkImageDriver } from './useWatermarkRemoverEngine';
import { useWatermarkRemoverActions } from './useWatermarkRemoverActions';

/** Return type for useWatermarkRemover hook */
export interface UseWatermarkRemoverReturn {
  items: WatermarkBatchItem[];
  isProcessing: boolean;
  config: WatermarkConfig;
  setModel: (model: WatermarkModel) => void;
  setPromptId: (id: string) => void;
  setCustomPrompt: (prompt: string) => void;
  setConcurrency: (n: number) => void;
  addImages: (images: ImageFile[]) => void;
  removeImage: (id: string) => void;
  clearAll: () => void;
  startProcessing: () => Promise<void>;
  retryItem: (id: string, newPromptId?: string, newCustomPrompt?: string) => Promise<void>;
  saveToGallery: (item: WatermarkBatchItem) => void;
  saveAllToGallery: () => void;
  downloadItem: (item: WatermarkBatchItem) => void;
  downloadAllZip: () => Promise<void>;
  completedCount: number;
  totalCount: number;
  successItems: WatermarkBatchItem[];
  pendingCount: number;
  errorCount: number;
}

/**
 * Orchestrator for batch watermark removal. Owns nothing directly — composes
 * focused sub-hooks for queue/config, processing engine, and output actions.
 * Builds the default driver from the real gemini service; tests can inject a
 * mock driver. Public return surface is identical to the pre-split hook so the
 * component needs zero changes.
 */
export function useWatermarkRemover(
  addToGallery: (image: ImageFile) => void,
): UseWatermarkRemoverReturn {
  const queue = useWatermarkRemoverQueue();

  // Default driver wraps the real gemini service; tests can inject a mock.
  const driver = useMemo<WatermarkImageDriver>(() => ({ editImage }), []);

  const engine = useWatermarkRemoverEngine({
    driver,
    items: queue.items,
    config: queue.config,
    updateItem: queue.updateItem,
    setIsProcessing: queue.setIsProcessing,
  });

  const actions = useWatermarkRemoverActions({
    items: queue.items,
    addToGallery,
  });

  return {
    items: queue.items,
    isProcessing: queue.isProcessing,
    config: queue.config,
    setModel: queue.setModel,
    setPromptId: queue.setPromptId,
    setCustomPrompt: queue.setCustomPrompt,
    setConcurrency: queue.setConcurrency,
    addImages: queue.addImages,
    removeImage: queue.removeImage,
    clearAll: queue.clearAll,
    startProcessing: engine.startProcessing,
    retryItem: engine.retryItem,
    saveToGallery: actions.saveToGallery,
    saveAllToGallery: actions.saveAllToGallery,
    downloadItem: actions.downloadItem,
    downloadAllZip: actions.downloadAllZip,
    completedCount: queue.completedCount,
    totalCount: queue.totalCount,
    successItems: queue.successItems,
    pendingCount: queue.pendingCount,
    errorCount: queue.errorCount,
  };
}
