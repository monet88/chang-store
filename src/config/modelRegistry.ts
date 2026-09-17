import { IMAGE_RESOLUTIONS, type ImageResolution } from '../types';
import { requireImageModelDescriptor, resolveCapabilities } from './imageModelCatalog';

export interface ModelCapability {
  /** Whether the API accepts imageConfig.imageSize for this model. */
  supportsImageSize: boolean;
  supportsAspectRatio: boolean;
  /** Output sizes the model can produce, including fixed sizes not settable through imageConfig. */
  supportedImageSizes?: readonly ImageResolution[];
}

export type ModelSelectionType = 'imageEdit' | 'imageGenerate' | 'textGenerate';

export interface RegisteredModel {
  providerId: string;
  modelId: string;
  label: string;
  selectionType: ModelSelectionType;
  capabilities?: ModelCapability;
}

const CAPABILITY_RULES: Array<{ pattern: RegExp; capabilities: ModelCapability }> = [
  {
    pattern: /gemini-3/,
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
];

const DEFAULT_CAPABILITIES: ModelCapability = {
  supportsImageSize: false,
  supportsAspectRatio: true,
};

/** The Gemini image model the app drives; its capability facts live in `imageModelCatalog.ts`. */
const GEMINI_IMAGE_MODEL_ID = 'gemini-3.1-flash-image';

/** Only models the configured gateway serves: verified on 2026-09-17, gemini-3.1-flash-image
 *  is the sole image model on the CPA route (the Pro/Lite/2.5 rows answer 400). */
const registeredGeminiImageModel = (selectionType: ModelSelectionType): RegisteredModel => {
  const descriptor = requireImageModelDescriptor(GEMINI_IMAGE_MODEL_ID);
  const capabilities = resolveCapabilities(descriptor);
  return {
    providerId: descriptor.providerId,
    modelId: descriptor.modelId,
    label: descriptor.label,
    selectionType,
    capabilities: {
      supportsImageSize: (capabilities.resolutions?.length ?? 0) > 0,
      supportsAspectRatio: capabilities.sizeMode === 'ratio',
    },
  };
};

const IMAGE_EDIT_MODELS: RegisteredModel[] = [registeredGeminiImageModel('imageEdit')];

const IMAGE_GENERATE_MODELS: RegisteredModel[] = [registeredGeminiImageModel('imageGenerate')];

const TEXT_GENERATE_MODELS: RegisteredModel[] = [
  {
    providerId: 'google',
    modelId: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-pro',
    label: 'Gemini 3.1 Pro',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    selectionType: 'textGenerate',
  },
];

export const MODEL_REGISTRY: RegisteredModel[] = [
  ...IMAGE_EDIT_MODELS,
  ...IMAGE_GENERATE_MODELS,
  ...TEXT_GENERATE_MODELS,
];

export const DEFAULT_MODEL_BY_SELECTION_TYPE: Record<ModelSelectionType, string> = {
  imageEdit: IMAGE_EDIT_MODELS[0].modelId,
  imageGenerate: IMAGE_GENERATE_MODELS[0].modelId,
  textGenerate: 'gemini-3.8-flash',
};

const MODEL_REGISTRY_BY_SELECTION_TYPE: Record<ModelSelectionType, RegisteredModel[]> = {
  imageEdit: IMAGE_EDIT_MODELS,
  imageGenerate: IMAGE_GENERATE_MODELS,
  textGenerate: TEXT_GENERATE_MODELS,
};

const QUALIFIED_MODEL_SEPARATOR = ':';

export function getModelsBySelectionType(selectionType: ModelSelectionType): RegisteredModel[] {
  return MODEL_REGISTRY_BY_SELECTION_TYPE[selectionType];
}

export function getDefaultModelForSelectionType(selectionType: ModelSelectionType): string {
  return DEFAULT_MODEL_BY_SELECTION_TYPE[selectionType];
}

function buildModelCandidates(modelId: string | null | undefined): string[] {
  if (!modelId) {
    return [];
  }

  const trimmedModelId = modelId.trim();
  if (!trimmedModelId) {
    return [];
  }

  const candidates = [trimmedModelId];
  if (trimmedModelId.includes(QUALIFIED_MODEL_SEPARATOR)) {
    const qualifiedModelId = trimmedModelId.split(QUALIFIED_MODEL_SEPARATOR).slice(1).join(QUALIFIED_MODEL_SEPARATOR);
    if (qualifiedModelId) {
      candidates.push(qualifiedModelId);
    }
  }

  return [...new Set(candidates)];
}

export function getRegisteredModel(modelId: string | null | undefined, selectionType?: ModelSelectionType): RegisteredModel | null {
  const candidates = buildModelCandidates(modelId);
  if (candidates.length === 0) {
    return null;
  }

  const models = selectionType ? MODEL_REGISTRY_BY_SELECTION_TYPE[selectionType] : MODEL_REGISTRY;
  for (const candidate of candidates) {
    const match = models.find((model) => model.modelId === candidate);
    if (match) {
      return match;
    }
  }

  return null;
}

export function isRegisteredModelId(modelId: string | null | undefined, selectionType?: ModelSelectionType): boolean {
  return getRegisteredModel(modelId, selectionType) !== null;
}

export function resolveRegisteredModelId(selectionType: ModelSelectionType, modelId: string | null | undefined): string {
  return getRegisteredModel(modelId, selectionType)?.modelId ?? getDefaultModelForSelectionType(selectionType);
}

export function getModelCapabilities(modelId: string): ModelCapability {
  const registeredModel = getRegisteredModel(modelId);
  if (registeredModel?.capabilities) {
    return registeredModel.capabilities;
  }

  for (const rule of CAPABILITY_RULES) {
    if (rule.pattern.test(modelId)) {
      return rule.capabilities;
    }
  }
  return DEFAULT_CAPABILITIES;
}

/** UI options for a model; falls back to the full selector list when unset/empty. */
export function getSupportedImageResolutions(modelId: string): readonly ImageResolution[] {
  const supportedImageSizes = getModelCapabilities(modelId).supportedImageSizes;
  return supportedImageSizes && supportedImageSizes.length > 0
    ? supportedImageSizes
    : IMAGE_RESOLUTIONS;
}

/**
 * Clamp a requested size to what the model can produce.
 * Always returns a concrete size for UI state and prompt wording.
 */
export function resolveEffectiveImageResolution(
  modelId: string,
  requested?: ImageResolution,
): ImageResolution {
  const supported = getSupportedImageResolutions(modelId);
  if (requested && supported.includes(requested)) {
    return requested;
  }
  return supported[0] ?? IMAGE_RESOLUTIONS[0];
}

/**
 * Resolve `imageConfig.imageSize` for Gemini requests.
 * - Omit when the model does not accept imageSize.
 * - When the model has an explicit supported list, always return an allowed size
 *   (so Flash-Lite always sends 1K even if the caller omits resolution).
 * - When imageSize is accepted without an explicit list, pass through the request.
 */
export function resolveImageSizeConfig(
  modelId: string,
  requested?: ImageResolution,
): ImageResolution | undefined {
  const capabilities = getModelCapabilities(modelId);
  if (!capabilities.supportsImageSize) {
    return undefined;
  }

  const supportedImageSizes = capabilities.supportedImageSizes;
  if (!supportedImageSizes || supportedImageSizes.length === 0) {
    return requested;
  }

  if (requested && supportedImageSizes.includes(requested)) {
    return requested;
  }

  return supportedImageSizes[0];
}

export function getModelOptionsBySelectionType(selectionType: ModelSelectionType): Array<{ id: string; name: string }> {
  return getModelsBySelectionType(selectionType).map(({ modelId, label }) => ({
    id: modelId,
    name: label,
  }));
}

export function isKnownModelId(modelId: string): boolean {
  return MODEL_REGISTRY.some((entry) => entry.modelId === modelId);
}

export function isKnownModelForSelectionType(selectionType: ModelSelectionType, modelId: string): boolean {
  return getModelsBySelectionType(selectionType).some((entry) => entry.modelId === modelId);
}
