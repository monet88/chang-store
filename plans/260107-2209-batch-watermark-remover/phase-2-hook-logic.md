# Phase 2: Hook Logic

**Estimated**: 2 hours

## Tasks

### 2.1 Create hooks/useWatermarkRemover.ts

```typescript
/**
 * Watermark Remover Hook
 * 
 * Manages batch processing of images to remove watermarks.
 * Supports parallel processing with configurable concurrency.
 */
import { useState, useCallback } from 'react';
import { editImage } from '@/services/gemini/image';
import { downloadImagesAsZip } from '@/utils/zipDownload';
import { getPromptText, type WatermarkModel, type WatermarkPromptId } from '@/utils/watermark-prompts';
import type { ImageFile, WatermarkBatchItem, WatermarkConfig } from '@/types';

interface UseWatermarkRemoverReturn {
  // State
  items: WatermarkBatchItem[];
  isProcessing: boolean;
  config: WatermarkConfig;
  
  // Config setters
  setModel: (model: WatermarkModel) => void;
  setPromptId: (id: WatermarkPromptId | 'custom') => void;
  setCustomPrompt: (prompt: string) => void;
  setConcurrency: (n: number) => void;
  
  // Actions
  addImages: (images: ImageFile[]) => void;
  removeImage: (id: string) => void;
  clearAll: () => void;
  startProcessing: () => Promise<void>;
  retryItem: (id: string, newPromptId?: string, newCustomPrompt?: string) => Promise<void>;
  
  // Output actions
  saveToGallery: (item: WatermarkBatchItem) => void;
  saveAllToGallery: () => void;
  downloadItem: (item: WatermarkBatchItem) => void;
  downloadAllZip: () => Promise<void>;
  
  // Computed
  completedCount: number;
  totalCount: number;
  successItems: WatermarkBatchItem[];
}

export function useWatermarkRemover(
  addToGallery: (image: ImageFile) => void
): UseWatermarkRemoverReturn {
  // State
  const [items, setItems] = useState<WatermarkBatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState<WatermarkConfig>({
    model: 'gemini-2.5-flash-image',
    promptId: 'text-logo',
    customPrompt: '',
    concurrency: 5,
  });

  // Generate unique ID
  const generateId = () => `wm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Config setters
  const setModel = useCallback((model: WatermarkModel) => {
    setConfig(prev => ({ ...prev, model }));
  }, []);

  const setPromptId = useCallback((promptId: WatermarkPromptId | 'custom') => {
    setConfig(prev => ({ ...prev, promptId }));
  }, []);

  const setCustomPrompt = useCallback((customPrompt: string) => {
    setConfig(prev => ({ ...prev, customPrompt }));
  }, []);

  const setConcurrency = useCallback((concurrency: number) => {
    setConfig(prev => ({ ...prev, concurrency: Math.max(1, Math.min(10, concurrency)) }));
  }, []);

  // Add images to queue
  const addImages = useCallback((images: ImageFile[]) => {
    const newItems: WatermarkBatchItem[] = images.map(img => ({
      id: generateId(),
      original: img,
      status: 'pending',
      progress: 0,
      promptUsed: '',
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  // Remove single image
  const removeImage = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  // Process single item
  const processItem = async (
    item: WatermarkBatchItem,
    prompt: string,
    model: WatermarkModel
  ): Promise<WatermarkBatchItem> => {
    try {
      // Update to processing
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'processing', progress: 10, promptUsed: prompt } : i
      ));

      // Call Gemini API
      const results = await editImage({
        images: [item.original],
        prompt,
        model,
        numberOfImages: 1,
      });

      if (results.length > 0) {
        // Success
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, status: 'success', progress: 100, result: results[0] } : i
        ));
        return { ...item, status: 'success', progress: 100, result: results[0], promptUsed: prompt };
      } else {
        throw new Error('No result returned');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'error', progress: 0, error: errorMsg } : i
      ));
      return { ...item, status: 'error', error: errorMsg, promptUsed: prompt };
    }
  };

  // Start batch processing with concurrency control
  const startProcessing = useCallback(async () => {
    const pendingItems = items.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    const prompt = getPromptText(config.promptId as WatermarkPromptId | 'custom', config.customPrompt);

    // Process with concurrency limit
    const queue = [...pendingItems];
    const processing: Promise<void>[] = [];

    const processNext = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) {
          await processItem(item, prompt, config.model);
        }
      }
    };

    // Start concurrent workers
    for (let i = 0; i < config.concurrency; i++) {
      processing.push(processNext());
    }

    await Promise.all(processing);
    setIsProcessing(false);
  }, [items, config]);

  // Retry single item
  const retryItem = useCallback(async (
    id: string,
    newPromptId?: string,
    newCustomPrompt?: string
  ) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const promptId = newPromptId || config.promptId;
    const customPrompt = newCustomPrompt || config.customPrompt;
    const prompt = getPromptText(promptId as WatermarkPromptId | 'custom', customPrompt);

    // Reset item status
    setItems(prev => prev.map(i => 
      i.id === id ? { ...i, status: 'pending', progress: 0, error: undefined } : i
    ));

    await processItem(item, prompt, config.model);
  }, [items, config]);

  // Gallery actions
  const saveToGallery = useCallback((item: WatermarkBatchItem) => {
    if (item.result) {
      addToGallery(item.result);
    }
  }, [addToGallery]);

  const saveAllToGallery = useCallback(() => {
    items.filter(i => i.status === 'success' && i.result).forEach(item => {
      if (item.result) addToGallery(item.result);
    });
  }, [items, addToGallery]);

  // Download actions
  const downloadItem = useCallback((item: WatermarkBatchItem) => {
    if (!item.result) return;
    const link = document.createElement('a');
    link.href = item.result.data;
    link.download = item.result.name || `watermark-removed-${item.id}.png`;
    link.click();
  }, []);

  const downloadAllZip = useCallback(async () => {
    const successResults = items
      .filter(i => i.status === 'success' && i.result)
      .map(i => i.result!);
    
    if (successResults.length > 0) {
      await downloadImagesAsZip(successResults, 'watermark-removed-batch');
    }
  }, [items]);

  // Computed values
  const completedCount = items.filter(i => i.status === 'success' || i.status === 'error').length;
  const totalCount = items.length;
  const successItems = items.filter(i => i.status === 'success');

  return {
    items,
    isProcessing,
    config,
    setModel,
    setPromptId,
    setCustomPrompt,
    setConcurrency,
    addImages,
    removeImage,
    clearAll,
    startProcessing,
    retryItem,
    saveToGallery,
    saveAllToGallery,
    downloadItem,
    downloadAllZip,
    completedCount,
    totalCount,
    successItems,
  };
}
```

## Checklist

- [ ] Create `hooks/useWatermarkRemover.ts`
- [ ] Verify imports resolve correctly
- [ ] Test concurrency logic conceptually
