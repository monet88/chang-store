import type { ImageResolution } from '../types';

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
  {
    pattern: /gemini-2\.5/,
    capabilities: {
      supportsImageSize: false,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    },
  },
];

const DEFAULT_CAPABILITIES: ModelCapability = {
  supportsImageSize: false,
  supportsAspectRatio: true,
};

const IMAGE_EDIT_MODELS: RegisteredModel[] = [
  {
    providerId: 'google',
    modelId: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    selectionType: 'imageEdit',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    selectionType: 'imageEdit',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite',
    selectionType: 'imageEdit',
    capabilities: {
      supportsImageSize: true,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    },
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    selectionType: 'imageEdit',
    capabilities: {
      supportsImageSize: false,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    },
  },
];

const IMAGE_GENERATE_MODELS: RegisteredModel[] = [
  {
    providerId: 'google',
    modelId: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    selectionType: 'imageGenerate',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    selectionType: 'imageGenerate',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite',
    selectionType: 'imageGenerate',
    capabilities: {
      supportsImageSize: true,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    },
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    selectionType: 'imageGenerate',
    capabilities: {
      supportsImageSize: false,
      supportsAspectRatio: true,
      supportedImageSizes: ['1K'],
    },
  },
];

const TEXT_GENERATE_MODELS: RegisteredModel[] = [
  {
    providerId: 'google',
    modelId: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro (Preview)',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
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
  imageEdit: 'gemini-3.1-flash-image',
  imageGenerate: 'gemini-3.1-flash-image',
  textGenerate: 'gemini-3.5-flash',
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
