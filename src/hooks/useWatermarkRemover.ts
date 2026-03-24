/**
 * Watermark Remover Hook
 * 
 * Manages batch processing of images to remove watermarks using Gemini AI.
 * Features:
 * - Batch image queue management
 * - Configurable concurrency (parallel processing)
 * - Multiple preset prompts and custom prompt support
 * - Individual retry and bulk actions
 * - ZIP download for batch results
 */
import { useState, useCallback, useMemo } from 'react';
import { editImage } from '@/services/gemini/image';
import { downloadImagesAsZip } from '@/utils/zipDownload';
import { 
  getPromptText, 
  DEFAULT_WATERMARK_MODEL,
  DEFAULT_PROMPT_ID,
  type WatermarkModel 
} from '@/utils/watermark-prompts';
import type { ImageFile, WatermarkBatchItem, WatermarkConfig } from '@/types';

// ============================================
// TYPES
// ============================================

/** Return type for useWatermarkRemover hook */
export interface UseWatermarkRemoverReturn {
  // State
  /** All items in the processing queue */
  items: WatermarkBatchItem[];
  /** Whether batch processing is currently running */
  isProcessing: boolean;
  /** Current configuration */
  config: WatermarkConfig;
  
  // Config setters
  /** Set the AI model for processing */
  setModel: (model: WatermarkModel) => void;
  /** Set the prompt preset ID */
  setPromptId: (id: string) => void;
  /** Set custom prompt text */
  setCustomPrompt: (prompt: string) => void;
  /** Set concurrency level (1-5) */
  setConcurrency: (n: number) => void;
  
  // Queue actions
  /** Add images to the processing queue */
  addImages: (images: ImageFile[]) => void;
  /** Remove a single image from queue */
  removeImage: (id: string) => void;
  /** Clear all items from queue */
  clearAll: () => void;
  
  // Processing actions
  /** Start processing all pending items */
  startProcessing: () => Promise<void>;
  /** Retry a failed item with optional new prompt */
  retryItem: (id: string, newPromptId?: string, newCustomPrompt?: string) => Promise<void>;
  
  // Output actions
  /** Save a single result to gallery */
  saveToGallery: (item: WatermarkBatchItem) => void;
  /** Save all successful results to gallery */
  saveAllToGallery: () => void;
  /** Download a single result */
  downloadItem: (item: WatermarkBatchItem) => void;
  /** Download all successful results as ZIP */
  downloadAllZip: () => Promise<void>;
  
  // Computed values
  /** Number of completed items (success + error) */
  completedCount: number;
  /** Total number of items in queue */
  totalCount: number;
  /** Items that completed successfully */
  successItems: WatermarkBatchItem[];
  /** Number of pending items */
  pendingCount: number;
  /** Number of failed items */
  errorCount: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Generate unique ID for batch items */
const generateId = (): string => 
  `wm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Clamp concurrency value to valid range */
const clampConcurrency = (n: number): number => 
  Math.max(1, Math.min(5, Math.round(n)));

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * Hook for managing batch watermark removal
 * 
 * @param addToGallery - Callback to add processed image to app gallery
 * @returns Hook state and actions
 * 
 * @example
 * ```tsx
 * const {
 *   items,
 *   addImages,
 *   startProcessing,
 *   downloadAllZip,
 * } = useWatermarkRemover(addImageToGallery);
 * ```
 */
export function useWatermarkRemover(
  addToGallery: (image: ImageFile) => void
): UseWatermarkRemoverReturn {
  
  // ============================================
  // STATE
  // ============================================
  
  const [items, setItems] = useState<WatermarkBatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState<WatermarkConfig>({
    model: DEFAULT_WATERMARK_MODEL,
    promptId: DEFAULT_PROMPT_ID,
    customPrompt: '',
    concurrency: 3,
  });

  // ============================================
  // CONFIG SETTERS
  // ============================================

  const setModel = useCallback((model: WatermarkModel) => {
    setConfig(prev => ({ ...prev, model }));
  }, []);

  const setPromptId = useCallback((promptId: string) => {
    setConfig(prev => ({ ...prev, promptId }));
  }, []);

  const setCustomPrompt = useCallback((customPrompt: string) => {
    setConfig(prev => ({ ...prev, customPrompt }));
  }, []);

  const setConcurrency = useCallback((concurrency: number) => {
    setConfig(prev => ({ ...prev, concurrency: clampConcurrency(concurrency) }));
  }, []);

  // ============================================
  // QUEUE MANAGEMENT
  // ============================================

  const addImages = useCallback((images: ImageFile[]) => {
    const newItems: WatermarkBatchItem[] = images.map(img => ({
      id: generateId(),
      original: img,
      status: 'pending',
      retryCount: 0,
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  // ============================================
  // PROCESSING LOGIC
  // ============================================

  /** Update a single item's state */
  const updateItem = useCallback((
    id: string, 
    updates: Partial<WatermarkBatchItem>
  ) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  /** Process a single item through the API */
  const processItem = useCallback(async (
    item: WatermarkBatchItem,
    prompt: string,
    model: string
  ): Promise<void> => {
    try {
      // Mark as processing
      updateItem(item.id, { status: 'processing', error: undefined });

      // Call Gemini API
      const results = await editImage({
        images: [item.original],
        prompt,
        model,
        numberOfImages: 1,
      });

      if (results.length > 0) {
        // Success
        updateItem(item.id, { 
          status: 'completed', 
          result: results[0] 
        });
      } else {
        throw new Error('No result returned from API');
      }
    } catch (error) {
      // Error
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      updateItem(item.id, { 
        status: 'error', 
        error: errorMsg,
        retryCount: item.retryCount + 1,
      });
    }
  }, [updateItem]);

  /** Start batch processing with concurrency control */
  const startProcessing = useCallback(async () => {
    const pendingItems = items.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    const prompt = getPromptText(config.promptId, config.customPrompt);

    // Create a queue for concurrent processing
    const queue = [...pendingItems];
    
    /** Worker function that processes items from queue */
    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) {
          await processItem(item, prompt, config.model);
        }
      }
    };

    // Start concurrent workers
    const workers = Array.from(
      { length: Math.min(config.concurrency, pendingItems.length) },
      () => processNext()
    );

    await Promise.all(workers);
    setIsProcessing(false);
  }, [items, config, processItem]);

  /** Retry a single failed item */
  const retryItem = useCallback(async (
    id: string,
    newPromptId?: string,
    newCustomPrompt?: string
  ) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Use provided prompt or fall back to current config
    const promptId = newPromptId ?? config.promptId;
    const customPrompt = newCustomPrompt ?? config.customPrompt;
    const prompt = getPromptText(promptId, customPrompt);

    // Reset status and process
    updateItem(id, { status: 'pending', error: undefined });
    await processItem({ ...item, status: 'pending' }, prompt, config.model);
  }, [items, config, updateItem, processItem]);

  // ============================================
  // OUTPUT ACTIONS
  // ============================================

  const saveToGallery = useCallback((item: WatermarkBatchItem) => {
    if (item.result) {
      addToGallery(item.result);
    }
  }, [addToGallery]);

  const saveAllToGallery = useCallback(() => {
    items
      .filter(i => i.status === 'completed' && i.result)
      .forEach(item => {
        if (item.result) addToGallery(item.result);
      });
  }, [items, addToGallery]);

  const downloadItem = useCallback((item: WatermarkBatchItem) => {
    if (!item.result) return;
    
    // Create data URL from base64
    const dataUrl = `data:${item.result.mimeType};base64,${item.result.base64}`;
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `watermark-removed-${item.id}.png`;
    link.click();
  }, []);

  const downloadAllZip = useCallback(async () => {
    const successResults = items
      .filter(i => i.status === 'completed' && i.result)
      .map(i => i.result!);
    
    if (successResults.length > 0) {
      await downloadImagesAsZip(successResults, 'watermark-removed-batch');
    }
  }, [items]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const completedCount = useMemo(() => 
    items.filter(i => i.status === 'completed' || i.status === 'error').length,
    [items]
  );

  const totalCount = items.length;

  const successItems = useMemo(() => 
    items.filter(i => i.status === 'completed'),
    [items]
  );

  const pendingCount = useMemo(() => 
    items.filter(i => i.status === 'pending').length,
    [items]
  );

  const errorCount = useMemo(() => 
    items.filter(i => i.status === 'error').length,
    [items]
  );

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    items,
    isProcessing,
    config,
    // Config setters
    setModel,
    setPromptId,
    setCustomPrompt,
    setConcurrency,
    // Queue actions
    addImages,
    removeImage,
    clearAll,
    // Processing actions
    startProcessing,
    retryItem,
    // Output actions
    saveToGallery,
    saveAllToGallery,
    downloadItem,
    downloadAllZip,
    // Computed
    completedCount,
    totalCount,
    successItems,
    pendingCount,
    errorCount,
  };
}
