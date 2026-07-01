import { useMemo, useState } from 'react';
import { Feature, StudioMode } from '../types';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  GptImageModelId,
  GptImageQuality,
  GptImageSize,
  DEFAULT_GPT_IMAGE_MODEL,
  DEFAULT_GPT_IMAGE_QUALITY,
  DEFAULT_GPT_IMAGE_SIZE,
  GPT_IMAGE_QUALITIES,
  GPT_IMAGE_SIZES,
  MAX_GPT_REFERENCE_IMAGES,
} from '../config/gptImageModelRegistry';
import { generateGptImage, editGptImage } from '../services/providers/gpt-image/gptImageService';
import { PROVIDER_UPSCALE_PROMPTS } from '../utils/provider-refine-prompt';
import {
  useProviderStudioEngine,
  UseProviderStudioEngineReturn,
  ProviderImageDriver,
} from './useProviderStudioEngine';

/** GPT wardrobe caps: 2 sets, concurrency 1 — GPT multipart edits are slow and
 * tunnel-timeout-prone, so wardrobe is bounded hard (Red Team #3 / plan caps). */
const GPT_WARDROBE_CONFIG = { maxSets: 2, maxItemsPerSet: 4, concurrency: 1 };
/** GPT lookbook: exactly 1 variation, serial (Red Team #3 / plan caps). */
const GPT_LOOKBOOK_MAX_VARIATIONS = 1;

export interface UseGptImageStudioReturn extends UseProviderStudioEngineReturn {
  apiKey: string;
  baseUrl: string;
  setApiKey: (value: string) => void;
  setBaseUrl: (value: string) => void;
  resetSettings: () => void;
  model: GptImageModelId;
  quality: GptImageQuality;
  setQuality: (value: string) => void;
  size: GptImageSize;
  setSize: (value: string) => void;
  qualityOptions: string[];
  sizeOptions: string[];
  maxReferenceImages: number;
}

/**
 * State + logic for the GPT Image provider studio.
 *
 * Owns only GPT-specific options (size / quality) and the GPT service driver;
 * the shared workflow lives in `useProviderStudioEngine`. When source images
 * are present the request is a multipart edit, otherwise a JSON text-to-image
 * generation. GPT edits/generations always emit `GPT_IMAGE_OUTPUT_COUNT`, so
 * the driver ignores the requested count; upscale relies on a preservation
 * prompt at the largest quality (no native resolution flag).
 */
export const useGptImageStudio = (
  activeFeature: Feature,
  _studioMode: StudioMode,
): UseGptImageStudioReturn => {
  const { t } = useLanguage();
  const { providerSettings, setProviderSettings, resetProviderSettings } = useApi();
  const settings = providerSettings.gptImage;

  const [quality, setQuality] = useState<GptImageQuality>(DEFAULT_GPT_IMAGE_QUALITY);
  const [size, setSize] = useState<GptImageSize>(DEFAULT_GPT_IMAGE_SIZE);

  // GPT image primitives for the shared engine. The `count` argument is ignored
  // (GPT endpoints always emit `GPT_IMAGE_OUTPUT_COUNT`). Memoized so the engine
  // gets a stable reference; it only changes when size / quality / key / url
  // change, avoiding needless downstream callback recomputation.
  const driver = useMemo<ProviderImageDriver>(
    () => ({
      edit: (prompt, images, _count, signal) =>
        editGptImage(
          { model: DEFAULT_GPT_IMAGE_MODEL, prompt, images, size, quality },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
      generate: (prompt, _count, signal) =>
        generateGptImage(
          { model: DEFAULT_GPT_IMAGE_MODEL, prompt, size, quality },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
      // GPT has no native resolution flag; upscale uses a preservation prompt at
      // the largest quality.
      upscale: (source, qualityLevel, signal) =>
        editGptImage(
          { model: DEFAULT_GPT_IMAGE_MODEL, prompt: PROVIDER_UPSCALE_PROMPTS[qualityLevel], images: [source], size, quality: 'high' },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
    }),
    [size, quality, settings.apiKey, settings.baseUrl],
  );

  const engine = useProviderStudioEngine(
    {
      activeFeature,
      driver,
      wardrobeConfig: GPT_WARDROBE_CONFIG,
      maxVariations: GPT_LOOKBOOK_MAX_VARIATIONS,
      mainCount: 1,
      serialVariations: true,
    },
    t,
  );

  return {
    ...engine,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    setApiKey: (value: string) => setProviderSettings('gptImage', { apiKey: value }),
    setBaseUrl: (value: string) => setProviderSettings('gptImage', { baseUrl: value }),
    resetSettings: () => resetProviderSettings('gptImage'),
    model: DEFAULT_GPT_IMAGE_MODEL,
    quality,
    setQuality: (value: string) => setQuality(value as GptImageQuality),
    size,
    setSize: (value: string) => setSize(value as GptImageSize),
    qualityOptions: [...GPT_IMAGE_QUALITIES],
    sizeOptions: [...GPT_IMAGE_SIZES],
    maxReferenceImages: MAX_GPT_REFERENCE_IMAGES,
  };
};
