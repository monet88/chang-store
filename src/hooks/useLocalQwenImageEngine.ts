import { useMemo, useContext } from 'react';
import type { ImageEngine } from '../contexts/ImageEngineContext';
import { ImageGalleryContext } from '../contexts/ImageGalleryContext';
import type { EditImageParams } from '../services/imageEditingService';
import type { ImageFile, UpscaleQuality } from '../types';
import { snapshotLocalQwenSettings } from '../config/localQwenSettings';
import { flattenInterleavedParts } from '../utils/flattenInterleavedParts';
import { generateLocalQwenImage } from '../services/providers/local-qwen/localQwenService';

// Module-level serialized queue ensuring max 1 active generation job at a time
let executionQueue: Promise<unknown> = Promise.resolve();

export const runSerializedLocalQwenJob = async <T>(task: () => Promise<T>): Promise<T> => {
  const previous = executionQueue;
  const { promise, resolve: release } = Promise.withResolvers<void>();
  executionQueue = promise;

  try {
    await previous;
    return await task();
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
  const gallery = useContext(ImageGalleryContext);
  return useMemo<ImageEngine>(() => {
    const editImage = async (
      params: EditImageParams,
      _model: string,
      config?: LocalQwenServiceConfig,
    ): Promise<ImageFile[]> => {
      return runSerializedLocalQwenJob(async () => {
        config?.onStatusUpdate?.('Initializing Local Qwen generation...');

        // 1. Snapshot settings for this job
        const settings = snapshotLocalQwenSettings();

        // 2. Extract prompt and images from interleaved parts or fallback params
        const interleaved = flattenInterleavedParts(params.interleavedParts);
        const prompt = interleaved ? interleaved.prompt : params.prompt || '';
        const images: ImageFile[] = interleaved ? interleaved.images : params.images || [];

        config?.onStatusUpdate?.('Generating with local ComfyUI (Qwen-Image 2.1)...');

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
        config?.onStatusUpdate?.('Upscaling image with local ComfyUI...');

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
          mimeType: image.mimeType || 'image/png',
        };

        // Tag upscaled result in gallery as localQwen
        gallery?.addImage(upscaledImage, undefined, 'localQwen');

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
  }, [gallery]);
};
