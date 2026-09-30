import React, { createContext, useContext } from 'react';
import type { ImageFile } from '../types';
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
  type StudioDriverErrorCode,
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
} from '../services/providers/ImageDriver';
import { useImageEngine } from './ImageEngineContext';

export type {
  ImageDriver,
  GenerateJob,
  UpscaleJob,
  ReferenceRoleImage,
  StudioDriverErrorCode,
  ImageFile,
};

export {
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
};

export const ImageDriverContext = createContext<ImageDriver | null>(null);

export interface ImageDriverProviderProps {
  driver: ImageDriver;
  children: React.ReactNode;
}

/**
 * Standalone provider for ImageDriver.
 * Primarily used in test harnesses (injecting InMemoryImageDriverFake)
 * or isolated sub-trees.
 */
export const ImageDriverProvider: React.FC<ImageDriverProviderProps> = ({ driver, children }) => {
  return React.createElement(ImageDriverContext.Provider, { value: driver }, children);
};

const createMockBridgeDriver = (engine: any): ImageDriver => {
  const generate = async (job: GenerateJob): Promise<ImageFile[]> => {
    if (typeof engine.generate === 'function') {
      return engine.generate(job);
    }
    if (typeof engine.editImage === 'function') {
      const prompt = (job as any).interleavedParts ? '' : job.prompt;
      const images = job.images ?? job.references?.map((r: any) => r.image) ?? [];
      return engine.editImage(
        {
          images,
          prompt,
          numberOfImages: job.count ?? 1,
          aspectRatio: job.aspectRatio,
          resolution: job.resolution,
          interleavedParts: (job as any).interleavedParts,
          ...(job.workflow ? { workflow: job.workflow } : {}),
        },
        job.model ?? engine.model ?? 'gemini-2.5-flash-image',
        job.onProgress ? { onStatusUpdate: job.onProgress } : undefined,
      );
    }
    return [];
  };

  const generateOne = async (job: GenerateJob): Promise<ImageFile> => {
    if (typeof engine.generateOne === 'function') {
      return engine.generateOne(job);
    }
    const results = await generate({ ...job, count: 1 });
    if (!results.length) {
      throw new Error('No images generated');
    }
    return results[0];
  };

  const upscale = async (job: UpscaleJob): Promise<ImageFile> => {
    if (typeof engine.upscale === 'function') {
      return engine.upscale(job);
    }
    if (typeof engine.upscaleImage === 'function') {
      const config = { onStatusUpdate: job.onProgress ?? (() => {}) };
      return engine.upscaleImage(
        job.image,
        engine.model ?? 'gemini-2.5-flash-image',
        config,
        ...(job.quality !== undefined ? [job.quality] : []),
      );
    }
    return job.image;
  };

  return {
    get id() {
      return engine.id ?? 'gemini';
    },
    generate,
    generateOne,
    upscale,
  };
};

/**
 * Accesses the active ImageDriver if mounted, or null if outside a driver/engine tree.
 */
export const useOptionalImageDriver = (): ImageDriver | null => {
  const driver = useContext(ImageDriverContext);

  let engine: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    engine = useImageEngine();
  } catch {
    // not inside ImageEngineProvider or legacy unmounted test
  }

  if (driver) {
    return driver;
  }

  if (engine?.driver) {
    return engine.driver;
  }

  // Dynamic bridge for tests or legacy callers that mock useImageEngine without driver
  if (engine && (engine.editImage || engine.upscaleImage || engine.id)) {
    return createMockBridgeDriver(engine);
  }

  return null;
};

/**
 * Accesses the active ImageDriver for executing image generation and upscale jobs.
 *
 * Resolves from:
 * 1. An explicit ImageDriverContext.Provider (e.g. testing with InMemoryImageDriverFake)
 * 2. The active ImageEngineContext.Provider (production studio mode)
 * 3. Dynamic bridge if only legacy useImageEngine is mocked in tests
 *
 * Throws if none is mounted.
 */
export const useImageDriver = (): ImageDriver => {
  const driver = useOptionalImageDriver();
  if (driver) {
    return driver;
  }

  throw new Error('useImageDriver must be used inside ImageDriverProvider or ImageEngineProvider');
};
