/**
 * Wardrobe sets/items list management.
 * Extracted to keep useWardrobeMode under the 200 LOC limit.
 */

import { useCallback, useRef, useState } from 'react';
import type { ImageFile, WardrobeSet, VirtualTryOnClothingItem } from '../types';

const MAX_WARDROBE_SETS = 4;
const MAX_ITEMS_PER_SET = 4;

export interface UseWardrobeModeListReturn {
  sets: WardrobeSet[];
  subject: ImageFile | null;
  extraPrompt: string;
  setExtraPrompt: (v: string) => void;
  backgroundPrompt: string;
  setBackgroundPrompt: (v: string) => void;
  addSet: () => void;
  removeSet: (setId: string) => void;
  addItem: (setId: string) => void;
  removeItem: (setId: string, itemId: number) => void;
  updateItem: (setId: string, itemId: number, updates: Partial<Pick<VirtualTryOnClothingItem, 'image' | 'sourceItemType' | 'sourcePrompt'>>) => void;
  setSubject: (image: ImageFile | null) => void;
  clearSubject: () => void;
  maxSets: number;
  maxItemsPerSet: number;
}

export const useWardrobeModeList = (): UseWardrobeModeListReturn => {
  const setIdCounter = useRef(1);
  const itemIdCounter = useRef(0);

  const [sets, setSets] = useState<WardrobeSet[]>([
    { id: `ws-${setIdCounter.current}`, items: [] },
  ]);
  const [subject, setSubject] = useState<ImageFile | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');

  const addSet = useCallback(() => {
    setSets((prev) => {
      if (prev.length >= MAX_WARDROBE_SETS) return prev;
      return [...prev, { id: `ws-${++setIdCounter.current}`, items: [] }];
    });
  }, []);

  const removeSet = useCallback((setId: string) => {
    setSets((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== setId);
    });
  }, []);

  const addItem = useCallback((setId: string) => {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId || s.items.length >= MAX_ITEMS_PER_SET) return s;
        const newItem: VirtualTryOnClothingItem = {
          id: ++itemIdCounter.current,
          image: null,
          sourceItemType: 'clothing',
          sourcePrompt: '',
        };
        return { ...s, items: [...s.items, newItem] };
      }),
    );
  }, []);

  const removeItem = useCallback((setId: string, itemId: number) => {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId) return s;
        return { ...s, items: s.items.filter((i) => i.id !== itemId) };
      }),
    );
  }, []);

  const updateItem = useCallback(
    (setId: string, itemId: number, updates: Partial<Pick<VirtualTryOnClothingItem, 'image' | 'sourceItemType' | 'sourcePrompt'>>) => {
      setSets((prev) =>
        prev.map((s) => {
          if (s.id !== setId) return s;
          return {
            ...s,
            items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
          };
        }),
      );
    },
    [],
  );

  const setWardrobeSubject = useCallback((image: ImageFile | null) => {
    setSubject(image);
  }, []);

  const clearSubject = useCallback(() => {
    setSubject(null);
  }, []);

  return {
    sets,
    subject,
    extraPrompt,
    setExtraPrompt,
    backgroundPrompt,
    setBackgroundPrompt,
    addSet,
    removeSet,
    addItem,
    removeItem,
    updateItem,
    setSubject: setWardrobeSubject,
    clearSubject,
    maxSets: MAX_WARDROBE_SETS,
    maxItemsPerSet: MAX_ITEMS_PER_SET,
  };
};
