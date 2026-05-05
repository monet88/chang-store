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
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { submitJob, pollJob, getJobResults, downloadJobResultBlob, type Job } from '@/services/jobService';
import { downloadImagesAsZip } from '@/utils/zipDownload';
import { downloadImageAsJpeg } from '@/utils/imageDownload';
import { runBoundedWorkers } from '@/utils/run-bounded-workers';
import {
  getPromptText,
  DEFAULT_WATERMARK_MODEL,
  DEFAULT_PROMPT_ID,
  type WatermarkModel,
} from '@/utils/watermark-prompts';
import { Feature, type ImageFile, type WatermarkBatchItem, type WatermarkConfig } from '@/types';
import { setSharedJobState } from './useJobPoll';

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

const POLL_INTERVAL_MS = 2000;
const MAX_JOB_PAYLOAD_BYTES = 4 * 1024 * 1024;

const generateId = (): string =>
  `wm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const clampConcurrency = (n: number): number =>
  Math.max(1, Math.min(5, Math.round(n)));

function assertPayloadSizeBelowLimit(payload: unknown): void {
  const bytes = new Blob([JSON.stringify(payload)]).size;
  if (bytes > MAX_JOB_PAYLOAD_BYTES) {
    throw new Error('Payload too large. Reduce image count or resolution and try again.');
  }
}

async function waitForJobCompletion(
  jobId: string,
  shouldContinue: () => boolean,
): Promise<Job> {
  while (shouldContinue()) {
    try {
      const job = await pollJob(jobId);
      const isPolling = job.status === 'queued' || job.status === 'running';
      setSharedJobState({
        job,
        isPolling,
        error: job.status === 'failed' ? job.error_message || 'Job failed' : null,
      }, { ownerJobId: jobId });

      if (!isPolling) {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSharedJobState({ isPolling: false, error: message }, { ownerJobId: jobId });
      throw error;
    }
  }

  setSharedJobState({ isPolling: false, error: null }, { ownerJobId: jobId });
  throw new Error('Job polling cancelled');
}

async function fetchJobImageResults(jobId: string): Promise<ImageFile[]> {
  const { results } = await getJobResults(jobId);
  const outputResults = results.filter((result) => result.kind === 'output');
  const images = await Promise.all(
    outputResults.map(async (result) => ({
      base64: await downloadJobResultBlob(result.blob_path),
      mimeType: result.mime_type,
    })),
  );
  return images;
}

export function useWatermarkRemover(
  addToGallery: (image: ImageFile) => void,
): UseWatermarkRemoverReturn {
  const [items, setItems] = useState<WatermarkBatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState<WatermarkConfig>({
    model: DEFAULT_WATERMARK_MODEL,
    promptId: DEFAULT_PROMPT_ID,
    customPrompt: '',
    concurrency: 3,
  });

  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

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

  const updateItem = useCallback((
    id: string,
    updates: Partial<WatermarkBatchItem>,
  ) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item,
    ));
  }, []);

  const processItem = useCallback(async (
    item: WatermarkBatchItem,
    prompt: string,
    model: string,
  ): Promise<void> => {
    try {
      updateItem(item.id, { status: 'processing', error: undefined });

      const payload = {
        image: item.original.base64,
        prompt,
        model,
      };
      assertPayloadSizeBelowLimit(payload);

      const submittedJob = await submitJob('watermark-remover', payload as Record<string, unknown>);
      setSharedJobState({ job: submittedJob, isPolling: true, error: null }, { ownerJobId: submittedJob.id });

      if (submittedJob.status === 'failed') {
        setSharedJobState(
          { job: submittedJob, isPolling: false, error: submittedJob.error_message || 'Job failed' },
          { ownerJobId: submittedJob.id },
        );
        throw new Error(submittedJob.error_message || 'Job failed');
      }

      const completedJob = submittedJob.status === 'completed' || submittedJob.status === 'partial'
        ? submittedJob
        : await waitForJobCompletion(submittedJob.id, () => isMountedRef.current);
      setSharedJobState(
        {
          job: completedJob,
          isPolling: false,
          error: completedJob.status === 'failed' ? (completedJob.error_message || 'Job failed') : null,
        },
        { ownerJobId: submittedJob.id },
      );

      if (completedJob.status === 'failed') {
        throw new Error(completedJob.error_message || 'Job failed');
      }

      const results = await fetchJobImageResults(submittedJob.id);
      const result = results[0];

      if (!result) {
        throw new Error('No result returned from API');
      }

      updateItem(item.id, {
        status: 'completed',
        result,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      updateItem(item.id, {
        status: 'error',
        error: errorMsg,
        retryCount: item.retryCount + 1,
      });
    }
  }, [updateItem]);

  const startProcessing = useCallback(async () => {
    const pendingItems = items.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    const prompt = getPromptText(config.promptId, config.customPrompt);

    try {
      await runBoundedWorkers(
        pendingItems,
        config.concurrency,
        async (item) => {
          await processItem(item, prompt, config.model);
        },
      );
    } finally {
      setIsProcessing(false);
    }
  }, [items, config, processItem]);

  const retryItem = useCallback(async (
    id: string,
    newPromptId?: string,
    newCustomPrompt?: string,
  ) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const promptId = newPromptId ?? config.promptId;
    const customPrompt = newCustomPrompt ?? config.customPrompt;
    const prompt = getPromptText(promptId, customPrompt);

    updateItem(id, { status: 'pending', error: undefined });
    await processItem({ ...item, status: 'pending' }, prompt, config.model);
  }, [items, config, updateItem, processItem]);

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

    void downloadImageAsJpeg(item.result, {
      baseName: `${Feature.WatermarkRemover}-${item.id}`,
    });
  }, []);

  const downloadAllZip = useCallback(async () => {
    const successResults = items
      .filter(i => i.status === 'completed' && i.result)
      .map(i => i.result!);

    if (successResults.length > 0) {
      await downloadImagesAsZip(successResults, `${Feature.WatermarkRemover}-batch`);
    }
  }, [items]);

  const completedCount = useMemo(() =>
    items.filter(i => i.status === 'completed' || i.status === 'error').length,
  [items]);

  const totalCount = items.length;

  const successItems = useMemo(() =>
    items.filter(i => i.status === 'completed'),
  [items]);

  const pendingCount = useMemo(() =>
    items.filter(i => i.status === 'pending').length,
  [items]);

  const errorCount = useMemo(() =>
    items.filter(i => i.status === 'error').length,
  [items]);

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
    pendingCount,
    errorCount,
  };
}
