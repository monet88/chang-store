import { useMemo, useState } from 'react';
import { Feature, StudioMode, type SelectableModel } from '../types';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  GptImageQuality,
  DEFAULT_GPT_IMAGE_MODEL,
  DEFAULT_GPT_IMAGE_QUALITY,
  DEFAULT_GPT_IMAGE_SIZE,
  GPT_IMAGE_MODELS,
  GPT_IMAGE_QUALITIES,
  MAX_GPT_REFERENCE_IMAGES,
  resolveGptImageSizeObservations,
  resolveGptImageSizeOptions,
  resolveGptImageSupportsQuality,
  resolveGptImageSupportsSize,
} from '../config/gptImageModelRegistry';
import { firstSelectableModelId, resolveProviderModelOptions } from '../config/modelSelectionRules';
import { resolveActiveProfile } from '../config/gatewayProfiles';
import { gatewayHostOf } from '../services/providers/shared/imageDriverPolicy';
import { useServedModels } from './useServedModels';
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
  model: string;
  setModel: (value: string) => void;
  modelOptions: SelectableModel[];
  quality: GptImageQuality;
  setQuality: (value: string) => void;
  /** `false` when the gateway answers its own size / ignores the quality it is sent. */
  supportsSize: boolean;
  supportsQuality: boolean;
  size: string;
  setSize: (value: string) => void;
  qualityOptions: string[];
  sizeOptions: string[];
  /** Measured honor rate of a `flaky` size on the active gateway, when recorded. */
  sizeObservations?: { honored: number; total: number };
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
  const {
    providerSettings,
    setProviderSettings,
    resetProviderSettings,
    imageProfiles,
    activeImageProfileId,
    servedModelsVersion,
  } = useApi();
  const settings = providerSettings.gptImage;

  // The image-lane profile the studio is pointed at decides which models can be offered and
  // which of their fields the gateway honors (capabilities are a (gateway, model) property).
  const profile = resolveActiveProfile(imageProfiles, 'image', activeImageProfileId, 'openai-images');
  const gatewayHost = profile ? gatewayHostOf(profile.baseUrl) : undefined;
  const served = useServedModels(profile?.baseUrl, servedModelsVersion);

  const [requestedModel, setModel] = useState<string>(DEFAULT_GPT_IMAGE_MODEL);
  const [quality, setQuality] = useState<GptImageQuality>(DEFAULT_GPT_IMAGE_QUALITY);
  const [requestedSize, setSize] = useState<string>(DEFAULT_GPT_IMAGE_SIZE);

  const modelOptions = useMemo(
    () => resolveProviderModelOptions('openai-images', GPT_IMAGE_MODELS, served, gatewayHost),
    [served, gatewayHost],
  );
  // A profile that serves none of the pinned models must not leave the studio on a dead id.
  const isSelectable = (modelId: string): boolean =>
    modelOptions.some((option) => option.modelId === modelId && !option.disabled);
  const model = isSelectable(requestedModel)
    ? requestedModel
    : firstSelectableModelId(modelOptions) ?? DEFAULT_GPT_IMAGE_MODEL;
  const sizeOptions = useMemo(() => resolveGptImageSizeOptions(model, gatewayHost), [model, gatewayHost]);
  // Sizes are per model: keep the studio on one this model can actually produce.
  const size = sizeOptions.includes(requestedSize) ? requestedSize : sizeOptions[0] ?? DEFAULT_GPT_IMAGE_SIZE;
  const supportsSize = resolveGptImageSupportsSize(model, gatewayHost);
  const supportsQuality = resolveGptImageSupportsQuality(model, gatewayHost);
  const sizeObservations = resolveGptImageSizeObservations(model, gatewayHost);

  // GPT image primitives for the shared engine. The `count` argument is ignored
  // (GPT endpoints always emit `GPT_IMAGE_OUTPUT_COUNT`). Memoized so the engine
  // gets a stable reference; it only changes when size / quality / key / url
  // change, avoiding needless downstream callback recomputation.
  const driver = useMemo<ProviderImageDriver>(
    () => ({
      edit: (prompt, images, _count, signal) =>
        editGptImage(
          { model, prompt, images, size, quality },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
      generate: (prompt, _count, signal) =>
        generateGptImage(
          { model, prompt, size, quality },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
      // GPT has no native resolution flag; upscale uses a preservation prompt at
      // the largest quality.
      upscale: (source, qualityLevel, signal) =>
        editGptImage(
          { model, prompt: PROVIDER_UPSCALE_PROMPTS[qualityLevel], images: [source], size, quality: 'high' },
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          signal,
        ),
    }),
    [model, size, quality, settings.apiKey, settings.baseUrl],
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
    model,
    setModel,
    modelOptions,
    quality,
    setQuality: (value: string) => setQuality(value as GptImageQuality),
    supportsSize,
    supportsQuality,
    size,
    setSize,
    qualityOptions: [...GPT_IMAGE_QUALITIES],
    sizeOptions,
    sizeObservations,
    maxReferenceImages: MAX_GPT_REFERENCE_IMAGES,
  };
};
