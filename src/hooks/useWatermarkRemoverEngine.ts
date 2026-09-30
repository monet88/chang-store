import { useCallback } from 'react';
import { editImage } from '@/services/gemini/image';
import type { ImageDriver, GenerateJob } from '@/services/providers/ImageDriver';
import { runBoundedWorkers } from '@/utils/run-bounded-workers';
import { getPromptText } from '@/utils/watermark-prompts';
import { type ImageFile, type WatermarkBatchItem, type WatermarkConfig } from '@/types';

/**
 * Image-edit primitive the engine orchestrates. Accepts canonical ImageDriver
 * or legacy driver for test compatibility.
 */
export type WatermarkImageDriver = ImageDriver | {
  editImage?: typeof editImage;
  generate?: (job: GenerateJob) => Promise<ImageFile[]>;
  generateOne?: (job: GenerateJob) => Promise<ImageFile>;
};

export interface UseWatermarkRemoverEngineConfig {
  driver: WatermarkImageDriver;
  items: WatermarkBatchItem[];
  config: WatermarkConfig;
  updateItem: (id: string, updates: Partial<WatermarkBatchItem>) => void;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseWatermarkRemoverEngineReturn {
  startProcessing: () => Promise<void>;
  retryItem: (id: string, newPromptId?: string, newCustomPrompt?: string) => Promise<void>;
}

/**
 * Processing engine for Watermark Remover: single-item processing, batch
 * start with concurrency control, and per-item retry. Extracted to keep
 * useWatermarkRemover under the line limit and isolate the processing core
 * behind a driver seam.
 */
export const useWatermarkRemoverEngine = (
  config: UseWatermarkRemoverEngineConfig,
): UseWatermarkRemoverEngineReturn => {
  const { driver, items, updateItem, setIsProcessing } = config;

  const processItem = useCallback(async (
    item: WatermarkBatchItem,
    prompt: string,
    model: string,
  ): Promise<void> => {
    try {
      updateItem(item.id, { status: 'processing', error: undefined });

      let result: ImageFile | undefined;
      if (typeof (driver as any).generateOne === 'function') {
        result = await (driver as any).generateOne({
          images: [item.original],
          prompt,
          model,
          workflow: 'watermark-remover',
        });
      } else if (typeof (driver as any).generate === 'function') {
        const results = await (driver as any).generate({
          images: [item.original],
          prompt,
          count: 1,
          model,
          workflow: 'watermark-remover',
        });
        result = results[0];
      } else {
        const results = await (driver as any).editImage({
          images: [item.original],
          prompt,
          model,
          numberOfImages: 1,
        });
        result = results[0];
      }

      if (result) {
        updateItem(item.id, { status: 'completed', result });
      } else {
        throw new Error('No result returned from API');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      updateItem(item.id, {
        status: 'error',
        error: errorMsg,
        retryCount: item.retryCount + 1,
      });
    }
  }, [driver, updateItem]);

  const startProcessing = useCallback(async () => {
    const pendingItems = items.filter((i) => i.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    const prompt = getPromptText(config.config.promptId, config.config.customPrompt);

    try {
      await runBoundedWorkers(pendingItems, config.config.concurrency, async (item) => {
        await processItem(item, prompt, config.config.model);
      });
    } finally {
      setIsProcessing(false);
    }
  }, [items, config, processItem, setIsProcessing]);

  const retryItem = useCallback(async (
    id: string,
    newPromptId?: string,
    newCustomPrompt?: string,
  ) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const promptId = newPromptId ?? config.config.promptId;
    const customPrompt = newCustomPrompt ?? config.config.customPrompt;
    const prompt = getPromptText(promptId, customPrompt);

    updateItem(id, { status: 'pending', error: undefined });
    await processItem({ ...item, status: 'pending' }, prompt, config.config.model);
  }, [items, config, updateItem, processItem]);

  return { startProcessing, retryItem };
};
