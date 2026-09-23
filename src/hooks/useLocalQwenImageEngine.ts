import { useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { ImageEngine } from '../contexts/ImageEngineContext';
import type { EditImageParams } from '../services/imageEditingService';
import type { ImageFile, UpscaleQuality } from '../types';
import { snapshotLocalQwenSettings } from '../config/localQwenSettings';
import { flattenInterleavedParts } from '../utils/flattenInterleavedParts';
import { generateLocalQwenImage } from '../services/providers/local-qwen/localQwenService';

// Module-level serialized queue ensuring max 1 active generation job at a time
let executionQueue: Promise<unknown> = Promise.resolve();
let currentBatchId = 0;

export const cancelQueuedLocalQwenJobs = (): void => {
  currentBatchId++;
};

export const runSerializedLocalQwenJob = async <T>(task: () => Promise<T>): Promise<T> => {
  const batchId = currentBatchId;
  const previous = executionQueue;
  const { promise, resolve: release } = Promise.withResolvers<void>();
  executionQueue = promise;

  try {
    await previous;
    if (batchId !== currentBatchId) {
      throw new Error('Local Qwen generation was cancelled.');
    }
    try {
      return await task();
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.toLowerCase().includes('cancel') ||
          err.message.toLowerCase().includes('interrupted') ||
          err.message.toLowerCase().includes('abort'))
      ) {
        cancelQueuedLocalQwenJobs();
      }
      throw err;
    }
  } finally {
    release();
  }
};

interface LocalQwenServiceConfig {
  onStatusUpdate?: (message: string) => void;
}

/**
 * Image Engine for Local Qwen running on local ComfyUI.
 *
 * Invariants:
 * - Desktop only.
 * - Max 1 active generation at a time (strictly serialized).
 * - Snapshot settings when job starts; subsequent mutations don't affect running job.
 * - Never falls back to cloud providers on failure.
 * - No auto-upscale; results remain at configured resolution.
 */
export const useLocalQwenImageEngine = (): ImageEngine => {
  const { t } = useLanguage();
  return useMemo<ImageEngine>(() => {
    const editImage = async (
      params: EditImageParams,
      _model: string,
      config?: LocalQwenServiceConfig,
    ): Promise<ImageFile[]> => {
      return runSerializedLocalQwenJob(async () => {
        config?.onStatusUpdate?.(t('studio.localQwenStatus.initializing'));

        // 1. Snapshot settings for this job
        const settings = snapshotLocalQwenSettings();

        // 2. Extract prompt and images from interleaved parts or fallback params
        const interleaved = flattenInterleavedParts(params.interleavedParts);
        const prompt = interleaved ? interleaved.prompt : params.prompt || '';
        const images: ImageFile[] = interleaved ? interleaved.images : params.images || [];

        config?.onStatusUpdate?.(t('studio.localQwenStatus.generatingStatus'));

        const results = await generateLocalQwenImage({
          prompt,
          images,
          resolution: settings.resolution,
          steps: settings.steps,
          cfg: settings.cfg,
          sampler: settings.sampler,
          scheduler: settings.scheduler,
        });

        return results;
      });
    };

    const upscaleImage = async (
      image: ImageFile,
      _model?: string,
      config?: LocalQwenServiceConfig,
      quality?: UpscaleQuality,
    ): Promise<ImageFile> => {
      return runSerializedLocalQwenJob(async () => {
        config?.onStatusUpdate?.(t('studio.localQwenStatus.upscaling'));

        const desktopApi = window.desktopLocalQwen;
        if (!desktopApi?.upscaleImage) {
          throw new Error('Local Qwen upscale requires desktop app runtime.');
        }

        const scale = quality === '4K' ? 4 : 2;
        const res = await desktopApi.upscaleImage({
          image: image.base64,
          scale,
        });

        if (res.ok === false) {
          throw new Error(res.error.message || 'Local Qwen upscale failed');
        }
        if (!res.value) {
          throw new Error('Local Qwen upscale returned empty response');
        }

        const upscaledImage: ImageFile = {
          base64: res.value.image,
          mimeType: res.value.mimeType || 'image/png',
        };

        return upscaledImage;
      });
    };

    return {
      id: 'localQwen',
      model: 'qwen-image-2.1',
      editImage,
      upscaleImage,
      createImageChatSession: null,
      modelOptions: null,
      setModel: null,
      noSelectableModel: false,
      options: null,
    };
  }, [t]);
};
