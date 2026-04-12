export interface ModelCapability {
  supportsImageSize: boolean;
  supportsAspectRatio: boolean;
}

export type ModelSelectionType = 'imageEdit' | 'imageGenerate' | 'textGenerate';

export interface RegisteredModel {
  providerId: string;
  modelId: string;
  label: string;
  selectionType: ModelSelectionType;
  capabilities?: ModelCapability;
}

const CAPABILITY_RULES = [
  {
    pattern: /gemini-3/,
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    pattern: /imagen-[34]/,
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    pattern: /gemini-2\.5/,
    capabilities: { supportsImageSize: false, supportsAspectRatio: true },
  },
];

const DEFAULT_CAPABILITIES: ModelCapability = {
  supportsImageSize: false,
  supportsAspectRatio: true,
};

const IMAGE_EDIT_MODELS: RegisteredModel[] = [
  {
    providerId: 'google',
    modelId: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image (Preview)',
    selectionType: 'imageEdit',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image (Preview)',
    selectionType: 'imageEdit',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    selectionType: 'imageEdit',
    capabilities: { supportsImageSize: false, supportsAspectRatio: true },
  },
];

const IMAGE_GENERATE_MODELS: RegisteredModel[] = [
  {
    providerId: 'google',
    modelId: 'imagen-4.0-ultra-generate-001',
    label: 'Imagen 4 Ultra',
    selectionType: 'imageGenerate',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'imagen-4.0-generate-001',
    label: 'Imagen 4',
    selectionType: 'imageGenerate',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    providerId: 'google',
    modelId: 'imagen-4.0-fast-generate-001',
    label: 'Imagen 4 Fast',
    selectionType: 'imageGenerate',
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
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
    modelId: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Preview)',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    selectionType: 'textGenerate',
  },
  {
    providerId: 'google',
    modelId: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    selectionType: 'textGenerate',
  },
];

export const MODEL_REGISTRY: RegisteredModel[] = [
  ...IMAGE_EDIT_MODELS,
  ...IMAGE_GENERATE_MODELS,
  ...TEXT_GENERATE_MODELS,
];

export const DEFAULT_MODEL_BY_SELECTION_TYPE: Record<ModelSelectionType, string> = {
  imageEdit: 'gemini-3.1-flash-image-preview',
  imageGenerate: 'imagen-4.0-generate-001',
  textGenerate: 'gemini-3-flash-preview',
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
