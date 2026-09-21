import type { GarmentScope, ImageFile } from '../types';

/** One source-outfit reference: the garment image plus its user-supplied label. */
export interface ClothingTransferReferenceInput {
  image: ImageFile;
  label: string;
}

/**
 * Engine-agnostic garment-scope vocabulary.
 *
 * Both prompt families and the feature views must name a scope identically, so
 * this wording is shared input vocabulary rather than either family's policy.
 */
export const formatGarmentScope = (scope: GarmentScope): string => {
  switch (scope) {
    case 'top':
      return 'top garment (shirt/blouse/jacket)';
    case 'bottom':
      return 'bottom garment (pants/skirt/trousers)';
    case 'dress':
      return 'one-piece dress';
    case 'outerwear':
      return 'outerwear jacket/coat';
    case 'full-set':
    default:
      return 'entire fashion outfit (complete clothing set)';
  }
};

export const formatGarmentScopeSelection = (scopes: GarmentScope[]): string => {
  const effectiveScopes = scopes.length > 0 ? scopes : ['full-set'];
  return effectiveScopes.map(formatGarmentScope).join(' + ');
};
