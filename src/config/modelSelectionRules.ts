import { Feature, SelectableModel } from '../types';
import {
  getModelsBySelectionType,
  type ModelSelectionType,
  type RegisteredModel,
} from './modelRegistry';
import {
  IMAGE_MODEL_CATALOG,
  getImageModelDescriptor,
  isVerifiedModel,
  resolveCapabilities,
  type ImageDriverId,
} from './imageModelCatalog';

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

/** The driver a scope's models are served by; `textGenerate` has no image driver. */
const DRIVER_BY_SELECTION_TYPE: Record<ModelSelectionType, ImageDriverId | null> = {
  imageEdit: 'gemini-native',
  imageGenerate: 'gemini-native',
  textGenerate: null,
};

const toOption = ({ modelId, label }: RegisteredModel): SelectableModel => ({ modelId, label });

/** A catalog row that belongs to this lane and carries live evidence for the active gateway. */
const isLaneCatalogRow = (modelId: string, driver: ImageDriverId | null, gatewayHost?: string): boolean => {
  const descriptor = getImageModelDescriptor(modelId);
  if (!descriptor || driver === null) {
    return false;
  }
  return resolveCapabilities(descriptor, gatewayHost).driver === driver && isVerifiedModel(descriptor, gatewayHost);
};

/**
 * Lane-scoped picker options.
 *
 * `served === undefined` (discovery not run) ⇒ the static registry list, i.e. today's
 * behaviour: the feature degrades to the current UX, never to an empty picker. With a served
 * list, only served models stay selectable; catalog rows the profile does not serve are listed
 * disabled, and served ids the registry does not carry are listed with an `unverified` badge.
 */
export function resolveSelectableModels(
  selectionType: ModelSelectionType,
  served?: readonly string[],
): SelectableModel[] {
  const registered = getModelsBySelectionType(selectionType);
  if (served === undefined) {
    return registered.map(toOption);
  }

  const driver = DRIVER_BY_SELECTION_TYPE[selectionType];
  const servedIds = new Set(served);
  const knownIds = new Set(registered.map((model) => model.modelId));
  const options: SelectableModel[] = registered.map((model) => {
    if (servedIds.has(model.modelId)) {
      return toOption(model);
    }
    // Only a model with catalog capability facts can be proven unservable and disabled; a
    // text model the catalog knows nothing about stays selectable, because a per-key model
    // list is not evidence about a route we never measured.
    return isLaneCatalogRow(model.modelId, driver)
      ? { ...toOption(model), disabled: true }
      : toOption(model);
  });

  for (const modelId of served) {
    if (knownIds.has(modelId) || !isLaneCatalogRow(modelId, driver)) {
      continue;
    }
    // Served by this profile, absent from the registry: selectable, generic contract, flagged.
    options.push({ modelId, label: getImageModelDescriptor(modelId)?.label ?? modelId, unverified: true });
  }

  return options;
}

export function resolveModelSelectionScope(
  feature: Feature,
  served?: readonly string[],
): ModelSelectionScope | null {
  const selectionType = FEATURE_SELECTION_SCOPE[feature];
  if (!selectionType) {
    return null;
  }

  return {
    selectionType,
    labelKey: MODEL_SELECTION_LABEL_KEY[selectionType],
    options: resolveSelectableModels(selectionType, served),
  };
}

/**
 * Provider-studio options for one driver.
 *
 * `fallback` is the studio's pinned membership (the pre-profile behaviour); it is replaced by
 * `catalog ∩ served` as soon as discovery has run, so a model the profile does not serve can
 * never be selected, and one it does serve can.
 */
export function resolveProviderModelOptions(
  driver: ImageDriverId,
  fallback: readonly SelectableModel[],
  served?: readonly string[],
  gatewayHost?: string,
): SelectableModel[] {
  if (served === undefined) {
    return [...fallback];
  }

  const catalogRows = IMAGE_MODEL_CATALOG.filter(
    (descriptor) =>
      resolveCapabilities(descriptor, gatewayHost).driver === driver && isVerifiedModel(descriptor, gatewayHost),
  );
  const servedIds = new Set(served);
  const catalogIds = new Set(catalogRows.map((descriptor) => descriptor.modelId));
  const options: SelectableModel[] = catalogRows
    .filter((descriptor) => servedIds.has(descriptor.modelId))
    .map((descriptor) => ({ modelId: descriptor.modelId, label: descriptor.label }));

  for (const modelId of served) {
    if (!catalogIds.has(modelId)) {
      options.push({ modelId, label: getImageModelDescriptor(modelId)?.label ?? modelId, unverified: true });
    }
  }
  for (const descriptor of catalogRows) {
    if (!servedIds.has(descriptor.modelId)) {
      options.push({ modelId: descriptor.modelId, label: descriptor.label, disabled: true });
    }
  }

  return options;
}

/** The first option a picker may actually select. */
export const firstSelectableModelId = (options: readonly SelectableModel[]): string | undefined =>
  options.find((option) => !option.disabled && !option.unverified)?.modelId
  ?? options.find((option) => !option.disabled)?.modelId;
