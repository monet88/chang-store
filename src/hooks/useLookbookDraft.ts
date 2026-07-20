import { useState, useEffect, useRef, useCallback } from 'react';
import { ImageFile } from '../types';
import {
  LookbookStyle,
  GarmentType,
  FoldedPresentationType,
  MannequinBackgroundStyleKey,
  ProductShotSubType,
} from '../components/LookbookGenerator.prompts';

const DRAFT_STORAGE_KEY = 'lookbookGeneratorDraft';
const DRAFT_SAVE_DEBOUNCE_MS = 1000;
const MAX_CLOTHING_SLOTS = 8;

interface LookbookDraftState {
  clothingSlotCount: number;
  fabricTexturePrompt: string;
  clothingDescription: string;
  lookbookStyle: LookbookStyle;
  garmentType: GarmentType;
  foldedPresentationType: FoldedPresentationType;
  mannequinBackgroundStyle: MannequinBackgroundStyleKey;
  negativePrompt: string;
  productShotSubType: ProductShotSubType;
  includeAccessories: boolean;
  includeFootwear: boolean;
}

export interface ClothingItem {
  id: string;
  image: ImageFile | null;
}

export interface LookbookFormState {
  clothingImages: ClothingItem[];
  fabricTextureImage: ImageFile | null;
  fabricTexturePrompt: string;
  clothingDescription: string;
  lookbookStyle: LookbookStyle;
  garmentType: GarmentType;
  foldedPresentationType: FoldedPresentationType;
  mannequinBackgroundStyle: MannequinBackgroundStyleKey;
  negativePrompt: string;
  // Product Shot fields
  productShotSubType: ProductShotSubType;
  includeAccessories: boolean;
  includeFootwear: boolean;
}

export const initialFormState: LookbookFormState = {
  clothingImages: [{ id: crypto.randomUUID(), image: null }],
  fabricTextureImage: null,
  fabricTexturePrompt: '',
  clothingDescription: '',
  lookbookStyle: 'flat lay',
  garmentType: 'one-piece',
  foldedPresentationType: 'boxed',
  mannequinBackgroundStyle: 'minimalistShowroom',
  negativePrompt: '',
  productShotSubType: 'ghost-mannequin',
  includeAccessories: false,
  includeFootwear: false,
};

export const createEmptyClothingSlots = (count: number): ClothingItem[] => {
  const normalizedCount = Math.max(1, Math.min(MAX_CLOTHING_SLOTS, Math.floor(count)));
  return Array.from({ length: normalizedCount }, (_, index) => ({
    id: crypto.randomUUID(),
    image: null,
  }));
};

const parseDraftState = (rawDraft: string): LookbookDraftState | null => {
  try {
    const parsed = JSON.parse(rawDraft) as Partial<LookbookDraftState> & {
      clothingImages?: unknown;
    };

    const legacySlotCount = Array.isArray(parsed.clothingImages) ? parsed.clothingImages.length : 0;
    const clothingSlotCount = typeof parsed.clothingSlotCount === 'number'
      ? parsed.clothingSlotCount
      : legacySlotCount || 1;

    return {
      clothingSlotCount,
      fabricTexturePrompt: parsed.fabricTexturePrompt ?? '',
      clothingDescription: parsed.clothingDescription ?? '',
      lookbookStyle: parsed.lookbookStyle ?? initialFormState.lookbookStyle,
      garmentType: parsed.garmentType ?? initialFormState.garmentType,
      foldedPresentationType: parsed.foldedPresentationType ?? initialFormState.foldedPresentationType,
      mannequinBackgroundStyle: parsed.mannequinBackgroundStyle ?? initialFormState.mannequinBackgroundStyle,
      negativePrompt: parsed.negativePrompt ?? '',
      productShotSubType: parsed.productShotSubType ?? initialFormState.productShotSubType,
      includeAccessories: parsed.includeAccessories ?? false,
      includeFootwear: parsed.includeFootwear ?? false,
    };
  } catch {
    return null;
  }
};

const toDraftState = (state: LookbookFormState): LookbookDraftState => ({
  clothingSlotCount: state.clothingImages.length,
  fabricTexturePrompt: state.fabricTexturePrompt,
  clothingDescription: state.clothingDescription,
  lookbookStyle: state.lookbookStyle,
  garmentType: state.garmentType,
  foldedPresentationType: state.foldedPresentationType,
  mannequinBackgroundStyle: state.mannequinBackgroundStyle,
  negativePrompt: state.negativePrompt,
  productShotSubType: state.productShotSubType,
  includeAccessories: state.includeAccessories,
  includeFootwear: state.includeFootwear,
});

export interface UseLookbookDraftReturn {
  formState: LookbookFormState;
  updateForm: (updates: Partial<LookbookFormState>) => void;
  handleClearForm: () => void;
}

/**
 * Focused hook for Lookbook form draft persistence (localStorage).
 * Extracted to keep useLookbookGenerator under 200 LOC and isolate pure draft logic.
 */
export const useLookbookDraft = (): UseLookbookDraftReturn => {
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formState, setFormState] = useState<LookbookFormState>(() => {
    if (typeof window === 'undefined') {
      return initialFormState;
    }
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    } catch {
      return initialFormState;
    }
    if (!saved) {
      return initialFormState;
    }

    const parsedDraft = parseDraftState(saved);
    if (!parsedDraft) {
      return initialFormState;
    }

    return {
      ...initialFormState,
      ...parsedDraft,
      clothingImages: createEmptyClothingSlots(parsedDraft.clothingSlotCount),
      fabricTextureImage: null,
    };
  });

  const updateForm = useCallback((updates: Partial<LookbookFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleClearForm = useCallback(() => {
    setFormState(initialFormState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      try {
        // Persist only lightweight draft fields; never persist image binaries.
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toDraftState(formState)));
      } catch (error) {
        console.error('Failed to save draft to localStorage:', error);
        // Silently fail - draft saving is non-critical
      } finally {
        draftSaveTimerRef.current = null;
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);

    // Cleanup: cancel pending save on unmount or state change
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [formState]);

  return {
    formState,
    updateForm,
    handleClearForm,
  };
};

