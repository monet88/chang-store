import React, { createContext, useContext, useMemo } from 'react';
import type { ImageAspectRatio, SelectableModel, StudioMode, ImageEngineId, ImageFile, ImageEditModel, UpscaleQuality } from '../types';
import type { GptImageQuality } from '../config/gptImageModelRegistry';
import { createImageChatSession, editImage, upscaleImage, type EditImageParams } from '../services/imageEditingService';
import { useApi } from './ApiProviderContext';
import { useGptImageEngine } from '../hooks/useGptImageEngine';
import { useLocalQwenImageEngine } from '../hooks/useLocalQwenImageEngine';
import type { ImageDriver, GenerateJob, UpscaleJob } from '../services/providers/ImageDriver';
import { GeminiImageDriverAdapter } from '../services/providers/gemini/GeminiImageDriverAdapter';
import { ImageDriverContext, useImageDriver } from './useImageDriver';
import { flattenInterleavedParts } from '../utils/flattenInterleavedParts';

export { useImageDriver };

/**
 * UI Controls Plane: options for aspect ratios, sizes, and qualities.
 * Retained with 100% backward compatibility for GptStudio and GptImageOptionsPanel.
 */
export interface ImageEngineOptions {
  /** Ratios the studio offers (GPT: 1:1, 3:4 and 9:16, each with a pixel size behind it). */
  ratios: readonly ImageAspectRatio[];
  quality: GptImageQuality;
  setQuality: (value: GptImageQuality) => void;
  qualityOptions: readonly GptImageQuality[];
  /** Pixel size the active gateway honors for a ratio; `auto` when it advertises none. */
  sizeFor: (ratio: ImageAspectRatio) => string;
  /** Measured honor rate of a `flaky` size on this (gateway, model) pair, when recorded. */
  sizeObservation?: { honored: number; total: number };
  supportsQuality: boolean;
}

export type LegacyBridgeEditParams = Omit<Partial<EditImageParams>, 'workflow'> & {
  workflow?: string;
  prompt?: string;
};

export type LegacyBridgeEditImage = (
  params: LegacyBridgeEditParams,
  model?: ImageEditModel,
  config?: { onStatusUpdate?: (message: string) => void },
  signal?: AbortSignal
) => Promise<ImageFile[]>;

export type LegacyBridgeUpscaleImage = (
  image: ImageFile,
  model?: ImageEditModel,
  config?: { onStatusUpdate?: (message: string) => void },
  quality?: UpscaleQuality | string,
  signalOrQuickModel?: AbortSignal | string,
  signal?: AbortSignal
) => Promise<ImageFile>;

/**
 * Dual-Plane Facade for Studio Image Transport:
 * - UI Plane: model selection and options controls (options, modelOptions, setModel, model, noSelectableModel, id).
 * - Transport Plane: active ImageDriver instance and driver methods (generate, generateOne, upscale).
 * - Legacy Bridge: legacy editImage and upscaleImage delegate directly to driver.generate and driver.upscale.
 */
export interface ImageEngine {
  id: ImageEngineId;
  /** Image model id every request on this lane carries. */
  model: string;
  // Facade legacy transport methods (delegating to active driver)
  editImage: LegacyBridgeEditImage | typeof editImage;
  upscaleImage: LegacyBridgeUpscaleImage | typeof upscaleImage;
  /** Gemini only: a GPT/LocalQwen refine is a single-shot edit. */
  createImageChatSession: typeof createImageChatSession | null;
  // UI control properties (100% backward compatible)
  modelOptions: SelectableModel[] | null;
  setModel: ((modelId: string) => void) | null;
  noSelectableModel: boolean;
  /** Non-null on the GPT lane: pixel sizes and qualities replace ratio + resolution. */
  options: ImageEngineOptions | null;
  // Dual-Plane: active ImageDriver instance & methods
  driver: ImageDriver;
  generate: (job: GenerateJob) => Promise<ImageFile[]>;
  generateOne: (job: GenerateJob) => Promise<ImageFile>;
  upscale: (job: UpscaleJob) => Promise<ImageFile>;
}

export const ImageEngineContext = createContext<ImageEngine | null>(null);

export const useImageEngine = (): ImageEngine => {
  const engine = useContext(ImageEngineContext);
  if (!engine) {
    throw new Error('useImageEngine must be used inside ImageEngineProvider');
  }
  return engine;
};

export const useOptionalImageEngine = (): ImageEngine | null => {
  return useContext(ImageEngineContext);
};

/**
 * Bridges legacy editImage and upscaleImage calls to the canonical ImageDriver seam.
 * Guarantees that callers using legacy signatures immediately gain rate-limiting slots,
 * localQwenLock serialization, and normalized StudioDriverError handling.
 */
export function createLegacyDriverBridge(driver: ImageDriver, defaultModel?: string): {
  editImage: LegacyBridgeEditImage;
  upscaleImage: LegacyBridgeUpscaleImage;
} {
  const bridgeEditImage: LegacyBridgeEditImage = async (params, model, config, signal) => {
    const interleaved = flattenInterleavedParts((params as any).interleavedParts);
    const prompt = interleaved ? interleaved.prompt : params.prompt || '';
    const images: ImageFile[] = interleaved ? interleaved.images : (params as any).images || [];

    const job: GenerateJob = {
      prompt,
      images: images.length > 0 ? images : undefined,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      workflow: params.workflow,
      negativePrompt: params.negativePrompt,
      count: params.numberOfImages ?? 1,
      model: model || defaultModel,
      signal,
      onProgress: config?.onStatusUpdate,
    };

    return driver.generate(job);
  };

  const bridgeUpscaleImage: LegacyBridgeUpscaleImage = async (
    image,
    _model,
    config,
    quality,
    signalOrQuickModel,
    signal
  ) => {
    const resolvedSignal =
      signalOrQuickModel instanceof AbortSignal ? signalOrQuickModel : signal;
    const job: UpscaleJob = {
      image,
      quality: quality === '4K' ? '4K' : '2K',
      signal: resolvedSignal,
      onProgress: config?.onStatusUpdate,
    };

    return driver.upscale(job);
  };

  return { editImage: bridgeEditImage, upscaleImage: bridgeUpscaleImage };
}

const GeminiImageEngineProvider: React.FC<{
  driverOverride?: ImageDriver;
  children: React.ReactNode;
}> = ({ driverOverride, children }) => {
  const { imageEditModel } = useApi();
  const driver = useMemo<ImageDriver>(
    () => driverOverride ?? new GeminiImageDriverAdapter({ model: imageEditModel }),
    [driverOverride, imageEditModel],
  );

  const engine = useMemo<ImageEngine>(() => {
    const bridge = createLegacyDriverBridge(driver, imageEditModel);
    return {
      id: 'gemini',
      model: imageEditModel,
      driver,
      generate: (job) => driver.generate(job),
      generateOne: (job) => driver.generateOne(job),
      upscale: (job) => driver.upscale(job),
      editImage: bridge.editImage,
      upscaleImage: bridge.upscaleImage,
      createImageChatSession,
      modelOptions: null,
      setModel: null,
      noSelectableModel: false,
      options: null,
    };
  }, [imageEditModel, driver]);

  return (
    <ImageDriverContext.Provider value={driver}>
      <ImageEngineContext.Provider value={engine}>{children}</ImageEngineContext.Provider>
    </ImageDriverContext.Provider>
  );
};

const GptImageEngineProvider: React.FC<{
  driverOverride?: ImageDriver;
  children: React.ReactNode;
}> = ({ driverOverride, children }) => {
  const engine = useGptImageEngine();
  const effectiveDriver = driverOverride ?? engine.driver;

  const effectiveEngine = useMemo<ImageEngine>(() => {
    if (!driverOverride) return engine;
    const bridge = createLegacyDriverBridge(driverOverride, engine.model);
    return {
      ...engine,
      driver: driverOverride,
      generate: (job) => driverOverride.generate(job),
      generateOne: (job) => driverOverride.generateOne(job),
      upscale: (job) => driverOverride.upscale(job),
      editImage: bridge.editImage,
      upscaleImage: bridge.upscaleImage,
    };
  }, [engine, driverOverride]);

  return (
    <ImageDriverContext.Provider value={effectiveDriver}>
      <ImageEngineContext.Provider value={effectiveEngine}>{children}</ImageEngineContext.Provider>
    </ImageDriverContext.Provider>
  );
};

const LocalQwenImageEngineProvider: React.FC<{
  driverOverride?: ImageDriver;
  children: React.ReactNode;
}> = ({ driverOverride, children }) => {
  const engine = useLocalQwenImageEngine();
  const effectiveDriver = driverOverride ?? engine.driver;

  const effectiveEngine = useMemo<ImageEngine>(() => {
    if (!driverOverride) return engine;
    const bridge = createLegacyDriverBridge(driverOverride, engine.model);
    return {
      ...engine,
      driver: driverOverride,
      generate: (job) => driverOverride.generate(job),
      generateOne: (job) => driverOverride.generateOne(job),
      upscale: (job) => driverOverride.upscale(job),
      editImage: bridge.editImage,
      upscaleImage: bridge.upscaleImage,
    };
  }, [engine, driverOverride]);

  return (
    <ImageDriverContext.Provider value={effectiveDriver}>
      <ImageEngineContext.Provider value={effectiveEngine}>{children}</ImageEngineContext.Provider>
    </ImageDriverContext.Provider>
  );
};

export interface ImageEngineProviderProps {
  mode: StudioMode;
  driverOverride?: ImageDriver;
  children: React.ReactNode;
}

/** Mounts the engine and driver of the active studio mode around the studio surface. */
export const ImageEngineProvider: React.FC<ImageEngineProviderProps> = ({
  mode,
  driverOverride,
  children,
}) => {
  if (mode === 'localQwen') {
    return <LocalQwenImageEngineProvider driverOverride={driverOverride}>{children}</LocalQwenImageEngineProvider>;
  }
  if (mode === 'gptImage') {
    return <GptImageEngineProvider driverOverride={driverOverride}>{children}</GptImageEngineProvider>;
  }
  return <GeminiImageEngineProvider driverOverride={driverOverride}>{children}</GeminiImageEngineProvider>;
};
