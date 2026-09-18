import React, { createContext, useContext, useMemo } from 'react';
import type { ImageAspectRatio, SelectableModel } from '../types';
import type { StudioMode } from '../types';
import type { GptImageQuality } from '../config/gptImageModelRegistry';
import { createImageChatSession, editImage, upscaleImage } from '../services/imageEditingService';
import { useApi } from './ApiProviderContext';
import { useGptImageEngine } from '../hooks/useGptImageEngine';

/**
 * Studio-scoped image transport. Feature hooks take their driver, model and
 * generation options from here instead of importing a service module, so the
 * same five feature engines serve both the Gemini views and the GPT clones
 * (issue #152, Decision 3). `imageEditingService` stays the Gemini
 * implementation; the GPT lane supplies `gptImageEngine`.
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
  maxReferenceImages: number;
}

export interface ImageEngine {
  id: 'gemini' | 'gptImage';
  /** Image model id every request on this lane carries. */
  model: string;
  editImage: typeof editImage;
  upscaleImage: typeof upscaleImage;
  /** Gemini only: a GPT refine is a stateless single-shot edit (Decision 5). */
  createImageChatSession: typeof createImageChatSession | null;
  /** Engine-owned model picker; the Gemini lane picks models in the header instead. */
  modelOptions: SelectableModel[] | null;
  setModel: ((modelId: string) => void) | null;
  noSelectableModel: boolean;
  /** Non-null on the GPT lane: pixel sizes and qualities replace ratio + resolution. */
  options: ImageEngineOptions | null;
}

const ImageEngineContext = createContext<ImageEngine | null>(null);

export const useImageEngine = (): ImageEngine => {
  const engine = useContext(ImageEngineContext);
  if (!engine) {
    throw new Error('useImageEngine must be used inside ImageEngineProvider');
  }
  return engine;
};

const GeminiImageEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { imageEditModel } = useApi();
  const engine = useMemo<ImageEngine>(
    () => ({
      id: 'gemini',
      model: imageEditModel,
      editImage,
      upscaleImage,
      createImageChatSession,
      modelOptions: null,
      setModel: null,
      noSelectableModel: false,
      options: null,
    }),
    [imageEditModel],
  );

  return <ImageEngineContext.Provider value={engine}>{children}</ImageEngineContext.Provider>;
};

const GptImageEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const engine = useGptImageEngine();
  return <ImageEngineContext.Provider value={engine}>{children}</ImageEngineContext.Provider>;
};

/** Mounts the engine of the active studio mode around the studio surface. */
export const ImageEngineProvider: React.FC<{ mode: StudioMode; children: React.ReactNode }> = ({
  mode,
  children,
}) =>
  mode === 'gemini' ? (
    <GeminiImageEngineProvider>{children}</GeminiImageEngineProvider>
  ) : (
    <GptImageEngineProvider>{children}</GptImageEngineProvider>
  );
