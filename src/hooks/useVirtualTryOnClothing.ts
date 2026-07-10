import { useCallback, useMemo, useRef, useState } from 'react';
import {
  VirtualTryOnClothingItem,
  VirtualTryOnSourceItemType,
} from '../types';
import { ImageFile } from '../types';

const MAX_SHARED_OUTFIT_IMAGES = 4;
const MAX_SOURCE_PROMPT_LENGTH = 180;

const normalizeSourcePrompt = (value: string) =>
  value.replace(/\s+/g, ' ').slice(0, MAX_SOURCE_PROMPT_LENGTH);

export interface UseVirtualTryOnClothingReturn {
  clothingItems: VirtualTryOnClothingItem[];
  validClothingItems: VirtualTryOnClothingItem[];
  handleClothingUpload: (file: ImageFile | null, id: number) => void;
  handleSourceItemTypeChange: (id: number, sourceItemType: VirtualTryOnSourceItemType) => void;
  handleSourcePromptChange: (id: number, sourcePrompt: string) => void;
  addClothingUploader: () => void;
  removeClothingUploader: (id: number) => void;
}

/**
 * Focused hook for Virtual Try-On clothing/reference item list management.
 * Extracted to keep useVirtualTryOn under line limit and isolate list state.
 * Prepares for future engine extraction where clothing sources feed the generation driver.
 */
export const useVirtualTryOnClothing = (): UseVirtualTryOnClothingReturn => {
  const clothingIdCounter = useRef(0);

  const [clothingItems, setClothingItems] = useState<VirtualTryOnClothingItem[]>([
    { id: ++clothingIdCounter.current, image: null, sourceItemType: 'clothing', sourcePrompt: '' },
  ]);

  const validClothingItems = useMemo(
    () => clothingItems.filter((item) => item.image !== null),
    [clothingItems],
  );

  const handleClothingUpload = useCallback((file: ImageFile | null, id: number) => {
    setClothingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, image: file } : item)),
    );
  }, []);

  const handleSourceItemTypeChange = useCallback((id: number, sourceItemType: VirtualTryOnSourceItemType) => {
    setClothingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, sourceItemType } : item)),
    );
  }, []);

  const handleSourcePromptChange = useCallback((id: number, sourcePrompt: string) => {
    const normalizedPrompt = normalizeSourcePrompt(sourcePrompt);
    setClothingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, sourcePrompt: normalizedPrompt } : item)),
    );
  }, []);

  const addClothingUploader = useCallback(() => {
    setClothingItems((prev) => {
      if (prev.length >= MAX_SHARED_OUTFIT_IMAGES) {
        return prev;
      }
      return [
        ...prev,
        { id: ++clothingIdCounter.current, image: null, sourceItemType: 'clothing', sourcePrompt: '' },
      ];
    });
  }, []);

  const removeClothingUploader = useCallback((id: number) => {
    setClothingItems((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  return {
    clothingItems,
    validClothingItems,
    handleClothingUpload,
    handleSourceItemTypeChange,
    handleSourcePromptChange,
    addClothingUploader,
    removeClothingUploader,
  };
};
