import { useCallback } from 'react';
import { editImage } from '@/services/gemini/image';
import { runBoundedWorkers } from '@/utils/run-bounded-workers';
import { getPromptText } from '@/utils/watermark-prompts';
import { type ImageFile, type WatermarkBatchItem, type WatermarkConfig } from '@/types';

/**
 * Image-edit primitive the engine orchestrates. The main hook builds the
 * default driver from the real gemini service; tests can inject a mock driver
 * to exercise the processing core without hitting the Gemini API.
 */
export interface WatermarkImageDriver {
  editImage: typeof editImage;
}

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

      const results = await driver.editImage({
        images: [item.original],
        prompt,
        model,
        numberOfImages: 1,
      });

      if (results.length > 0) {
        updateItem(item.id, { status: 'completed', result: results[0] });
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
