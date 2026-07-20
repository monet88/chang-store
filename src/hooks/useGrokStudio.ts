import { useCallback, useMemo, useState } from 'react';
import { Feature, ImageFile, StudioMode } from '../types';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  GrokModelId,
  GrokAspectRatio,
  GrokResolution,
  DEFAULT_GROK_MODEL,
  DEFAULT_GROK_ASPECT_RATIO,
  DEFAULT_GROK_RESOLUTION,
  GROK_MODELS,
  GROK_ASPECT_RATIOS,
  GROK_RESOLUTIONS,
  GROK_MAX_REFERENCE_IMAGES,
  GROK_MIN_OUTPUTS,
  GROK_MAX_OUTPUTS,
  isKnownGrokModel,
} from '../config/grokModelRegistry';
import { generateGrokImage, editGrokImage } from '../services/providers/grok/grokImageService';
import { PROVIDER_UPSCALE_PROMPTS } from '../utils/provider-refine-prompt';
import {
  useProviderStudioEngine,
  UseProviderStudioEngineReturn,
  ProviderImageDriver,
} from './useProviderStudioEngine';
import { VirtualTryOnMode } from '../types';

/** Grok wardrobe caps: 4 sets, 4 items/set, concurrency 4 (Grok handles parallel). */
const GROK_WARDROBE_CONFIG = { maxSets: 4, maxItemsPerSet: 4, concurrency: 4 };
/** Grok lookbook: up to 4 variations. */
const GROK_LOOKBOOK_MAX_VARIATIONS = 4;

export interface ProviderOption {
  value: string;
  label: string;
}

export interface UseGrokStudioReturn extends UseProviderStudioEngineReturn {
  // Settings (from ApiProviderContext)
  apiKey: string;
  baseUrl: string;
  setApiKey: (value: string) => void;
  setBaseUrl: (value: string) => void;
  resetSettings: () => void;
  // Grok-specific workflow options
  model: GrokModelId;
  setModel: (model: string) => void;
  n: number;
  setN: (value: number) => void;
  aspectRatio: GrokAspectRatio;
  setAspectRatio: (value: string) => void;
  resolution: GrokResolution;
  setResolution: (value: string) => void;
  // Option lists (sourced from registry, exposed so the UI never imports config)
  modelOptions: ProviderOption[];
  aspectRatioOptions: string[];
  resolutionOptions: string[];
  // Bounds
  maxReferenceImages: number;
  minOutputs: number;
  maxOutputs: number;
}

/**
 * State + logic for the Grok provider studio.
 *
 * Owns only Grok-specific options (model / aspect / resolution / n) and the
 * Grok service driver; the shared workflow lives in `useProviderStudioEngine`.
 * When source images are present the request is an edit, otherwise a
 * text-to-image generation. Grok honours the `n` output count natively and
 * upscales via its native `2k` resolution plus a preservation prompt.
 */
export const useGrokStudio = (activeFeature: Feature, _studioMode: StudioMode): UseGrokStudioReturn => {
  const { t } = useLanguage();
  const { providerSettings, setProviderSettings, resetProviderSettings } = useApi();
  const settings = providerSettings.grok;

  const [model, setModel] = useState<GrokModelId>(DEFAULT_GROK_MODEL);
  const [n, setN] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<GrokAspectRatio>(DEFAULT_GROK_ASPECT_RATIO);
  const [resolution, setResolution] = useState<GrokResolution>(DEFAULT_GROK_RESOLUTION);

  // Grok image primitives for the shared engine. Memoized so the engine gets a
  // stable reference; the driver only changes when the values it closes over
  // (model / aspect / resolution / key / url) actually change, which keeps the
  // engine's downstream callbacks from being rebuilt every render.
  const driver = useMemo<ProviderImageDriver>(
    () => ({
      edit: (prompt, images, count, signal) =>
        editGrokImage(
          { model, prompt, images, n: count, aspectRatio, resolution },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
      generate: (prompt, count, signal) =>
        generateGrokImage(
          { model, prompt, n: count, aspectRatio, resolution },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
      // Grok upscale uses the native 2k resolution plus a preservation prompt.
      upscale: (source, quality, signal) =>
        editGrokImage(
          { model, prompt: PROVIDER_UPSCALE_PROMPTS[quality], images: [source], n: 1, aspectRatio, resolution: '2k' },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
    }),
    [model, aspectRatio, resolution, settings.apiKey, settings.baseUrl],
  );

  const engine = useProviderStudioEngine(
    {
      activeFeature,
      driver,
      wardrobeConfig: GROK_WARDROBE_CONFIG,
      maxVariations: GROK_LOOKBOOK_MAX_VARIATIONS,
      mainCount: n,
      serialVariations: false,
    },
    t,
  );

  const setModelSafe = useCallback((value: string) => {
    if (isKnownGrokModel(value)) {
      setModel(value);
    }
  }, []);

  return {
    ...engine,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    setApiKey: (value: string) => setProviderSettings('grok', { apiKey: value }),
    setBaseUrl: (value: string) => setProviderSettings('grok', { baseUrl: value }),
    resetSettings: () => resetProviderSettings('grok'),
    model,
    setModel: setModelSafe,
    n,
    setN,
    aspectRatio,
    setAspectRatio: (value: string) => setAspectRatio(value as GrokAspectRatio),
    resolution,
    setResolution: (value: string) => setResolution(value as GrokResolution),
    modelOptions: GROK_MODELS.map((m) => ({ value: m.modelId, label: m.label })),
    aspectRatioOptions: [...GROK_ASPECT_RATIOS],
    resolutionOptions: [...GROK_RESOLUTIONS],
    maxReferenceImages: GROK_MAX_REFERENCE_IMAGES,
    minOutputs: GROK_MIN_OUTPUTS,
    maxOutputs: GROK_MAX_OUTPUTS,
  };
};

export type { VirtualTryOnMode };
