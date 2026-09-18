/**
 * Shared types for the provider studio generation engine.
 *
 * Extracted from `useProviderStudioGeneration` to keep that hook file under
 * the 200 LOC limit. The generation hook owns the driver contract; provider
 * studio hooks (useGptImageStudio) build a driver from their
 * service + options and inject it -- the engine and generation hooks never
 * import provider services directly.
 */
import { Feature, ImageFile, UpscaleQuality, VirtualTryOnClothingItem, VirtualTryOnMode } from '../types';
import { UseProviderResultActionsReturn } from './useProviderResultActions';
import { UseProviderStudioFieldsReturn } from './useProviderStudioFields';
import { UseProviderTryOnBatchReturn } from './useProviderTryOnBatch';
import { UseProviderLookbookFieldsReturn } from './useProviderLookbookFields';

export type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * `count` is the requested output count. 
 * GPT ignores it (its endpoints always emit a fixed count).
 */
export interface ProviderImageDriver {
  /** Edit `images` with `prompt`, requesting `count` outputs. */
  edit: (prompt: string, images: ImageFile[], count: number, signal?: AbortSignal) => Promise<ImageFile[]>;
  /** Text-to-image generate from `prompt`, requesting `count` outputs. */
  generate: (prompt: string, count: number, signal?: AbortSignal) => Promise<ImageFile[]>;
  /** Preservation-first upscale of a single result (provider param overrides live here). */
  upscale: (source: ImageFile, quality: UpscaleQuality, signal?: AbortSignal) => Promise<ImageFile[]>;
}

/**
 * Public surface of `useProviderStudioGeneration`, folded as-is into the
 * combined `UseProviderStudioEngineReturn` for GPT studios.
 */
export interface UseProviderStudioGenerationReturn extends UseProviderResultActionsReturn {
  prompt: string;
  setPrompt: (value: string) => void;
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  isLoading: boolean;
  error: string | null;
  results: ImageFile[];
  clearError: () => void;
  handleGenerate: () => Promise<void>;
  tryOnMode: VirtualTryOnMode;
  setTryOnMode: (mode: VirtualTryOnMode) => void;
  /** Exposed for wardrobe injection (engine wires useProviderWardrobe). */
  generateSet: (
    subject: ImageFile,
    items: VirtualTryOnClothingItem[],
    prompts: { backgroundPrompt: string; extraPrompt: string },
    signal?: AbortSignal,
  ) => Promise<ImageFile[]>;
  getSignal: () => AbortSignal | undefined;
  /** Reset transient generation state (called by engine on feature change). */
  reset: () => void;
  /** Abort any in-flight generation (called during reset). */
  abortCurrent: () => void;
}

export interface UseProviderStudioGenerationConfig {
  activeFeature: Feature;
  driver: ProviderImageDriver;
  fields: UseProviderStudioFieldsReturn;
  batch: UseProviderTryOnBatchReturn;
  lookbook: UseProviderLookbookFieldsReturn;
  mainCount: number;
  t: TranslateFn;
}
