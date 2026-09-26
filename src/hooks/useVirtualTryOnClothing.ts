import { useCallback, useMemo, useRef, useState } from 'react';
import {
  VirtualTryOnClothingItem,
  VirtualTryOnSourceItemType,
  ImageFile,
} from '../types';
import { classifyVirtualTryOnItemTypes } from '../services/typesafeService';

const MAX_SHARED_OUTFIT_IMAGES = 4;
const MAX_SOURCE_PROMPT_LENGTH = 180;

const normalizeSourcePrompt = (value: string) =>
  value.replace(/\s+/g, ' ').slice(0, MAX_SOURCE_PROMPT_LENGTH);

export interface UseVirtualTryOnClothingReturn {
  clothingItems: VirtualTryOnClothingItem[];
  validClothingItems: VirtualTryOnClothingItem[];
  handleClothingUpload: (file: ImageFile | null, id: number) => void;
  handleMultipleClothingUpload: (files: ImageFile[], targetId?: number) => void;
  handleSourceItemTypeChange: (id: number, sourceItemType: VirtualTryOnSourceItemType) => void;
  handleSourcePromptChange: (id: number, sourcePrompt: string) => void;
  addClothingUploader: () => void;
  removeClothingUploader: (id: number) => void;
  detectingItemIds: Record<number, boolean>;
  isAutoDetectingAll: boolean;
  autoDetectItemType: (id: number, fallbackText?: string) => Promise<{ success: boolean; error?: string }>;
  autoDetectAllItemTypes: (fallbackBlueprint?: string | null) => Promise<{ detectedCount: number; error?: string }>;
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
  const [detectingItemIds, setDetectingItemIds] = useState<Record<number, boolean>>({});
  const [isAutoDetectingAll, setIsAutoDetectingAll] = useState(false);

  const validClothingItems = useMemo(
    () => clothingItems.filter((item) => item.image !== null),
    [clothingItems],
  );

  const handleClothingUpload = useCallback((file: ImageFile | null, id: number) => {
    setClothingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, image: file } : item)),
    );
  }, []);

  const handleMultipleClothingUpload = useCallback((files: ImageFile[], targetId?: number) => {
    if (!files || files.length === 0) return;

    setClothingItems((prev) => {
      const newItems = [...prev];
      let fileIdx = 0;

      if (targetId !== undefined) {
        const targetIndex = newItems.findIndex((item) => item.id === targetId);
        if (targetIndex !== -1 && fileIdx < files.length) {
          newItems[targetIndex] = { ...newItems[targetIndex], image: files[fileIdx++] };
        }
      }

      for (let i = 0; i < newItems.length && fileIdx < files.length; i++) {
        if (newItems[i].image === null) {
          newItems[i] = { ...newItems[i], image: files[fileIdx++] };
        }
      }

      while (fileIdx < files.length && newItems.length < MAX_SHARED_OUTFIT_IMAGES) {
        newItems.push({
          id: ++clothingIdCounter.current,
          image: files[fileIdx++],
          sourceItemType: 'clothing',
          sourcePrompt: '',
        });
      }

      return newItems;
    });
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

  const autoDetectItemType = useCallback(
    async (id: number, fallbackText?: string): Promise<{ success: boolean; error?: string }> => {
      const item = clothingItems.find((ci) => ci.id === id);
      if (!item) return { success: false, error: 'Item not found' };

      const text = item.sourcePrompt.trim() || fallbackText?.trim() || '';
      if (!text) {
        return { success: false, error: 'noText' };
      }

      setDetectingItemIds((prev) => ({ ...prev, [id]: true }));
      try {
        const result = await classifyVirtualTryOnItemTypes([{ id, text }]);
        const detected = result[String(id)];
        if (detected && detected.confidence >= 0.5) {
          handleSourceItemTypeChange(id, detected.type);
          return { success: true };
        }
        return { success: false, error: 'lowConfidence' };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      } finally {
        setDetectingItemIds((prev) => ({ ...prev, [id]: false }));
      }
    },
    [clothingItems, handleSourceItemTypeChange],
  );

  const autoDetectAllItemTypes = useCallback(
    async (fallbackBlueprint?: string | null): Promise<{ detectedCount: number; error?: string }> => {
      const itemsToClassify = clothingItems
        .map((item) => {
          const text = item.sourcePrompt.trim() || fallbackBlueprint?.trim() || '';
          return { id: item.id, text };
        })
        .filter((item) => item.text.length > 0);

      if (itemsToClassify.length === 0) {
        return { detectedCount: 0, error: 'noText' };
      }

      setIsAutoDetectingAll(true);
      try {
        const result = await classifyVirtualTryOnItemTypes(itemsToClassify);
        let count = 0;
        for (const item of itemsToClassify) {
          const detected = result[String(item.id)];
          if (detected && detected.confidence >= 0.5) {
            handleSourceItemTypeChange(Number(item.id), detected.type);
            count += 1;
          }
        }
        return { detectedCount: count };
      } catch (err) {
        return { detectedCount: 0, error: err instanceof Error ? err.message : String(err) };
      } finally {
        setIsAutoDetectingAll(false);
      }
    },
    [clothingItems, handleSourceItemTypeChange],
  );

  return {
    clothingItems,
    validClothingItems,
    handleClothingUpload,
    handleMultipleClothingUpload,
    handleSourceItemTypeChange,
    handleSourcePromptChange,
    addClothingUploader,
    removeClothingUploader,
    detectingItemIds,
    isAutoDetectingAll,
    autoDetectItemType,
    autoDetectAllItemTypes,
  };
};
