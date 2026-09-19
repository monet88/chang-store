import linhFaceUrl from '../../docs/images/models/linh/face.png';
import linhBodyUrl from '../../docs/images/models/linh/body.png';
import maiFaceUrl from '../../docs/images/models/mai/face.png';
import maiBodyUrl from '../../docs/images/models/mai/body.png';
import type { ImageFile } from '../types';
import { compressImage } from '../utils/imageUtils';

export interface BrandModelMetadata {
  age: number;
  height: string;
  weight: string;
  bodyType: string;
  skinTone: string;
  facialFeatures: string;
  styleVibe: string;
}

export interface BrandModelProfile {
  id: string;
  name: string;
  metadata: BrandModelMetadata;
  faceImage: ImageFile | null;
  bodyImage: ImageFile | null;
}

export interface BrandModelDefinition {
  id: string;
  name: string;
  faceUrl: string;
  bodyUrl: string;
  metadata: BrandModelMetadata;
}

export const DEFAULT_BRAND_MODEL_DEFINITIONS: BrandModelDefinition[] = [
  {
    id: 'linh',
    name: 'Linh',
    faceUrl: linhFaceUrl,
    bodyUrl: linhBodyUrl,
    metadata: {
      age: 22,
      height: '1m66',
      weight: '48kg',
      bodyType: 'slender hourglass build, defined small waist, feminine curves',
      skinTone: 'fair porcelain skin with natural soft warm undertones',
      facialFeatures: 'almond brown eyes, delicate soft nose, natural rosy lips, long dark wavy hair',
      styleVibe: 'elegant, graceful, Korean muse aesthetic',
    },
  },
  {
    id: 'mai',
    name: 'Mai',
    faceUrl: maiFaceUrl,
    bodyUrl: maiBodyUrl,
    metadata: {
      age: 20,
      height: '1m62',
      weight: '47kg',
      bodyType: 'slender youthful build, delicate shoulders, balanced natural proportions',
      skinTone: 'bright fair skin with rosy peach undertones',
      facialFeatures: 'large expressive dark eyes, delicate nose, soft bangs, fresh natural smile',
      styleVibe: 'youthful, chic, sweet modern Gen Z aesthetic',
    },
  },
];

const loadReferenceImage = async (url: string, fileName: string): Promise<ImageFile | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await compressImage(new File([blob], fileName, { type: blob.type || 'image/png' }));
  } catch {
    return null;
  }
};

let cachedBrandModelsPromise: Promise<BrandModelProfile[]> | null = null;

/**
 * Loads the default brand model profiles (Linh & Mai) with bundled face and body assets.
 * Caches in-memory so subsequent requests resolve instantly.
 */
export const loadDefaultBrandModels = (): Promise<BrandModelProfile[]> => {
  if (!cachedBrandModelsPromise) {
    cachedBrandModelsPromise = Promise.all(
      DEFAULT_BRAND_MODEL_DEFINITIONS.map(async (def) => {
        const [faceImage, bodyImage] = await Promise.all([
          loadReferenceImage(def.faceUrl, `${def.id}-face.png`),
          loadReferenceImage(def.bodyUrl, `${def.id}-body.png`),
        ]);

        return {
          id: def.id,
          name: def.name,
          metadata: { ...def.metadata },
          faceImage,
          bodyImage,
        };
      }),
    );
  }

  return cachedBrandModelsPromise;
};

export const CUSTOM_BRAND_MODELS_STORAGE_KEY = 'chang_store_custom_brand_models';

/**
 * Returns true if the model profile is a user-created custom model.
 */
export const isCustomBrandModel = (id: string): boolean => {
  return !DEFAULT_BRAND_MODEL_DEFINITIONS.some((def) => def.id === id);
};

/**
 * Loads saved custom brand models from local storage.
 */
export const loadCustomBrandModels = (): BrandModelProfile[] => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_BRAND_MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BrandModelProfile => {
      return Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string');
    });
  } catch {
    return [];
  }
};

/**
 * Saves or updates a custom brand model profile in local storage.
 */
export const saveCustomBrandModel = (profile: BrandModelProfile): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const existing = loadCustomBrandModels();
    const filtered = existing.filter((m) => m.id !== profile.id);
    window.localStorage.setItem(
      CUSTOM_BRAND_MODELS_STORAGE_KEY,
      JSON.stringify([...filtered, profile]),
    );
  } catch (err) {
    // Quota exceeded or private browsing restrictions
    console.warn('Unable to persist custom brand model to localStorage:', err);
  }
};

/**
 * Deletes a custom brand model profile from local storage.
 */
export const deleteCustomBrandModel = (id: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const existing = loadCustomBrandModels();
    const filtered = existing.filter((m) => m.id !== id);
    window.localStorage.setItem(
      CUSTOM_BRAND_MODELS_STORAGE_KEY,
      JSON.stringify(filtered),
    );
  } catch (err) {
    console.warn('Unable to remove custom brand model from localStorage:', err);
  }
};
