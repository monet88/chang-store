import { Feature, SelectableModel } from '../types';
import {
  getModelsBySelectionType,
  type ModelSelectionType,
} from './modelRegistry';

export interface ModelSelectionScope {
  selectionType: ModelSelectionType;
  labelKey: string;
  options: SelectableModel[];
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
  [Feature.AIEditor]: 'imageEdit',
  [Feature.WatermarkRemover]: null,
  [Feature.ClothingTransfer]: 'imageEdit',
  [Feature.IdentityTransfer]: 'imageEdit',
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
    options: getModelsBySelectionType(selectionType).map(({ modelId, label }) => ({
      modelId,
      label,
    })),
  };
}
