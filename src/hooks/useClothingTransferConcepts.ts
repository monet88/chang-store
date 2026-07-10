import { useCallback, useMemo, useRef, useState } from 'react';
import { ClothingTransferBatchItem, ImageFile } from '../types';
import { remapImageBatchItems } from '../utils/batch-image-session';

export interface UseClothingTransferConceptsConfig {
  setError: (error: string | null) => void;
}

export interface UseClothingTransferConceptsReturn {
  conceptItems: ClothingTransferBatchItem[];
  conceptImages: ImageFile[];
  conceptImage: ImageFile | null;
  selectedConceptItemId: string | null;
  setSelectedConceptItemId: React.Dispatch<React.SetStateAction<string | null>>;
  activeConceptItem: ClothingTransferBatchItem | null;
  generatedImages: ImageFile[];
  completedCount: number;
  failedCount: number;
  createConceptItem: (image: ImageFile) => ClothingTransferBatchItem;
  updateConceptItem: (
    id: string,
    updater: Partial<ClothingTransferBatchItem> | ((item: ClothingTransferBatchItem) => ClothingTransferBatchItem),
  ) => void;
  resetAllStatus: () => void;
  handleConceptImagesUpload: (images: ImageFile[]) => void;
  handleConceptUpload: (file: ImageFile | null) => void;
}

/**
 * Concept-image batch management for Clothing Transfer, extracted to keep
 * useClothingTransfer under the line limit. Owns batch item state, selection,
 * derived values, and upload handlers.
 */
export const useClothingTransferConcepts = (
  config: UseClothingTransferConceptsConfig,
): UseClothingTransferConceptsReturn => {
  const { setError } = config;
  const batchIdCounter = useRef(0);
  const [conceptItems, setConceptItems] = useState<ClothingTransferBatchItem[]>([]);
  const [selectedConceptItemId, setSelectedConceptItemId] = useState<string | null>(null);

  const createConceptItem = useCallback((image: ImageFile): ClothingTransferBatchItem => ({
    id: `ct-${++batchIdCounter.current}`,
    conceptImage: image,
    status: 'pending',
    results: [],
  }), []);

  const updateConceptItem = useCallback(
    (
      id: string,
      updater: Partial<ClothingTransferBatchItem> | ((item: ClothingTransferBatchItem) => ClothingTransferBatchItem),
    ) => {
      setConceptItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return typeof updater === 'function' ? updater(item) : { ...item, ...updater };
        }),
      );
    },
    [],
  );

  const resetAllStatus = useCallback(() => {
    setConceptItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'pending',
        results: [],
        error: undefined,
      })),
    );
  }, []);

  const conceptImages = useMemo(
    () => conceptItems.map((item) => item.conceptImage),
    [conceptItems],
  );

  const conceptImage = useMemo(
    () => conceptItems[0]?.conceptImage ?? null,
    [conceptItems],
  );

  const activeConceptItem = useMemo(
    () => conceptItems.find((item) => item.id === selectedConceptItemId) ?? conceptItems[0] ?? null,
    [conceptItems, selectedConceptItemId],
  );

  const generatedImages = activeConceptItem?.results ?? [];

  const completedCount = useMemo(
    () => conceptItems.filter((item) => item.status === 'completed').length,
    [conceptItems],
  );

  const failedCount = useMemo(
    () => conceptItems.filter((item) => item.status === 'error').length,
    [conceptItems],
  );

  const handleConceptImagesUpload = useCallback((images: ImageFile[]) => {
    let nextItems: ClothingTransferBatchItem[] = [];

    setConceptItems((prev) => {
      nextItems = remapImageBatchItems(
        images,
        prev,
        (item) => item.conceptImage,
        createConceptItem,
      );
      return nextItems;
    });

    setSelectedConceptItemId((prev) => {
      if (nextItems.length === 0) {
        return null;
      }

      return prev && nextItems.some((item) => item.id === prev) ? prev : nextItems[0].id;
    });

    setError(null);
  }, [createConceptItem, setError]);

  const handleConceptUpload = useCallback((file: ImageFile | null) => {
    handleConceptImagesUpload(file ? [file] : []);
  }, [handleConceptImagesUpload]);

  return {
    conceptItems,
    conceptImages,
    conceptImage,
    selectedConceptItemId,
    setSelectedConceptItemId,
    activeConceptItem,
    generatedImages,
    completedCount,
    failedCount,
    createConceptItem,
    updateConceptItem,
    resetAllStatus,
    handleConceptImagesUpload,
    handleConceptUpload,
  };
};
