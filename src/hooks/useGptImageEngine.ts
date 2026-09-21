import { useMemo, useState } from 'react';
import {
  DEFAULT_GPT_IMAGE_MODEL,
  DEFAULT_GPT_IMAGE_QUALITY,
  GPT_IMAGE_MODELS,
  GPT_IMAGE_QUALITIES,
  resolveGptImageSizeObservations,
  resolveGptImageSizeOptions,
  resolveGptImageSupportsQuality,
  type GptImageQuality,
} from '../config/gptImageModelRegistry';
import { resolveActiveProfile } from '../config/gatewayProfiles';
import { firstSelectableModelId, resolveProviderModelOptions } from '../config/modelSelectionRules';
import { gatewayHostOf } from '../services/providers/shared/imageDriverPolicy';
import {
  buildGptImageEngine,
  GPT_STUDIO_ASPECT_RATIOS,
  resolveSizeForRatio,
} from '../services/providers/gpt-image/gptImageEngine';
import { useApi } from '../contexts/ApiProviderContext';
import type { ImageEngine } from '../contexts/ImageEngineContext';
import { useServedModels } from './useServedModels';

/**
 * The GPT lane's engine: credentials from the resolved image profile, model
 * availability from discovery, size and quality from the (gateway, model)
 * capability. Consumed through `ImageEngineContext`, never directly by a view.
 */
export const useGptImageEngine = (): ImageEngine => {
  const { imageProfiles, activeImageProfileId, servedModelsVersion } = useApi();

  // The image-lane profile the studio is pointed at decides which models can be
  // offered and which of their fields the gateway honors.
  const profile = resolveActiveProfile(imageProfiles, 'image', activeImageProfileId, 'openai-images');
  const gatewayHost = profile ? gatewayHostOf(profile.baseUrl) : undefined;
  const served = useServedModels(profile?.baseUrl, profile?.apiKey, servedModelsVersion, profile?.id);

  const [requestedModel, setModel] = useState<string>(DEFAULT_GPT_IMAGE_MODEL);
  const [quality, setQuality] = useState<GptImageQuality>(DEFAULT_GPT_IMAGE_QUALITY);

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
  const noSelectableModel = !modelOptions.some((option) => !option.disabled);

  const sizeOptions = useMemo(() => resolveGptImageSizeOptions(model, gatewayHost), [model, gatewayHost]);
  const supportsQuality = resolveGptImageSupportsQuality(model, gatewayHost);
  const sizeObservation = resolveGptImageSizeObservations(model, gatewayHost);

  // Fail closed: an address-less profile makes the service throw instead of
  // pairing a gateway key with a provider default (issue #152, Decision 8).
  const apiKey = profile?.apiKey ?? '';
  const baseUrl = profile?.baseUrl ?? '';

  return useMemo<ImageEngine>(
    () => ({
      id: 'gptImage',
      model,
      ...buildGptImageEngine({
        model,
        quality,
        sizeOptions,
        credentials: { apiKey, baseUrl, credentialRef: profile?.id },
      }),
      createImageChatSession: null,
      modelOptions,
      setModel,
      noSelectableModel,
      options: {
        ratios: GPT_STUDIO_ASPECT_RATIOS,
        quality,
        setQuality,
        qualityOptions: GPT_IMAGE_QUALITIES,
        sizeFor: (ratio) => resolveSizeForRatio(sizeOptions, ratio),
        sizeObservation,
        supportsQuality,
      },
    }),
    [model, quality, sizeOptions, sizeObservation, apiKey, baseUrl, profile?.id, modelOptions, noSelectableModel, supportsQuality],
  );
};
