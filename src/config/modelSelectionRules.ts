import { Feature } from '../types';
import {
  getDefaultModelForSelectionType,
  getModelsBySelectionType,
  type ModelSelectionType,
  type RegisteredModel,
} from './modelRegistry';

export interface ModelSelectionScope {
  selectionType: ModelSelectionType;
  labelKey: string;
  defaultModelId: string;
  options: RegisteredModel[];
}

const MODEL_SELECTION_LABEL_KEY: Record<ModelSelectionType, string> = {
  imageEdit: 'modelSelector.scopes.imageEdit',
  imageGenerate: 'modelSelector.scopes.imageGenerate',
  textGenerate: 'modelSelector.scopes.textGenerate',
};

const FEATURE_SELECTION_SCOPE: Record<Feature, ModelSelectionType | null> = {
  [Feature.TryOn]: 'imageEdit',
  [Feature.Lookbook]: 'imageEdit',
  [Feature.Background]: 'imageEdit',
  [Feature.Pose]: 'imageEdit',
  [Feature.PhotoAlbum]: 'imageEdit',
  [Feature.OutfitAnalysis]: 'textGenerate',
  [Feature.Relight]: 'imageEdit',
  [Feature.Upscale]: 'imageEdit',
  [Feature.ImageEditor]: 'imageGenerate',
  [Feature.AIEditor]: 'imageEdit',
  [Feature.WatermarkRemover]: null,
  [Feature.ClothingTransfer]: 'imageEdit',
  [Feature.PatternGenerator]: 'imageEdit',
};

export function resolveModelSelectionScope(feature: Feature): ModelSelectionScope | null {
  const selectionType = FEATURE_SELECTION_SCOPE[feature];
  if (!selectionType) {
    return null;
  }

  return {
    selectionType,
    labelKey: MODEL_SELECTION_LABEL_KEY[selectionType],
    defaultModelId: getDefaultModelForSelectionType(selectionType),
    options: getModelsBySelectionType(selectionType),
  };
}
