import { useCallback, useMemo, useState } from 'react';
import { type ImageFile, type WatermarkBatchItem, type WatermarkConfig } from '@/types';
import { DEFAULT_PROMPT_ID, DEFAULT_WATERMARK_MODEL, type WatermarkModel } from '@/utils/watermark-prompts';

/** Generate unique ID for batch items */
const generateId = (): string =>
  `wm-${crypto.randomUUID()}`;

/** Clamp concurrency value to valid range */
const clampConcurrency = (n: number): number =>
  Math.max(1, Math.min(10, Math.round(n)));

export interface UseWatermarkRemoverQueueReturn {
  items: WatermarkBatchItem[];
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  config: WatermarkConfig;
  setModel: (model: WatermarkModel) => void;
  setPromptId: (id: string) => void;
  setCustomPrompt: (prompt: string) => void;
  setConcurrency: (n: number) => void;
  addImages: (images: ImageFile[]) => void;
  removeImage: (id: string) => void;
  clearAll: () => void;
  updateItem: (id: string, updates: Partial<WatermarkBatchItem>) => void;
  completedCount: number;
  totalCount: number;
  successItems: WatermarkBatchItem[];
  pendingCount: number;
  errorCount: number;
}

/**
 * Queue and config sub-hook for Watermark Remover: owns batch item state,
 * processing flag, configuration, queue mutations, and derived counts.
 * Extracted to keep useWatermarkRemover under the line limit.
 */
export const useWatermarkRemoverQueue = (): UseWatermarkRemoverQueueReturn => {
  const [items, setItems] = useState<WatermarkBatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState<WatermarkConfig>({
    model: DEFAULT_WATERMARK_MODEL,
    promptId: DEFAULT_PROMPT_ID,
    customPrompt: '',
    concurrency: 3,
  });

  const setModel = useCallback((model: WatermarkModel) => {
    setConfig((prev) => ({ ...prev, model }));
  }, []);

  const setPromptId = useCallback((promptId: string) => {
    setConfig((prev) => ({ ...prev, promptId }));
  }, []);

  const setCustomPrompt = useCallback((customPrompt: string) => {
    setConfig((prev) => ({ ...prev, customPrompt }));
  }, []);

  const setConcurrency = useCallback((concurrency: number) => {
    setConfig((prev) => ({ ...prev, concurrency: clampConcurrency(concurrency) }));
  }, []);

  const addImages = useCallback((images: ImageFile[]) => {
    const newItems: WatermarkBatchItem[] = images.map((img) => ({
      id: generateId(),
      original: img,
      status: 'pending',
      retryCount: 0,
    }));
    setItems((prev) => {
      const nextItems = [...prev, ...newItems];
      setConfig((c) => ({
        ...c,
        concurrency: clampConcurrency(nextItems.length),
      }));
      return nextItems;
    });
  }, []);

  const removeImage = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<WatermarkBatchItem>) => {
    setItems((prev) => prev.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    ));
  }, []);

  const completedCount = useMemo(() =>
    items.filter((i) => i.status === 'completed' || i.status === 'error').length,
    [items],
  );
  const totalCount = items.length;
  const successItems = useMemo(() =>
    items.filter((i) => i.status === 'completed'),
    [items],
  );
  const pendingCount = useMemo(() =>
    items.filter((i) => i.status === 'pending').length,
    [items],
  );
  const errorCount = useMemo(() =>
    items.filter((i) => i.status === 'error').length,
    [items],
  );

  return {
    items, isProcessing, setIsProcessing, config,
    setModel, setPromptId, setCustomPrompt, setConcurrency,
    addImages, removeImage, clearAll, updateItem,
    completedCount, totalCount, successItems, pendingCount, errorCount,
  };
};
