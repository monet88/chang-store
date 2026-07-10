import { useCallback, useMemo, useRef, useState } from 'react';
import { ClothingTransferReferenceItem, ImageFile } from '../types';

export interface UseClothingTransferReferencesReturn {
  referenceItems: ClothingTransferReferenceItem[];
  validReferences: ClothingTransferReferenceItem[];
  handleReferenceUpload: (file: ImageFile | null, id: number) => void;
  handleReferenceLabel: (label: string, id: number) => void;
  addReference: () => void;
  removeReference: (id: number) => void;
}

/**
 * Reference-outfit list management for Clothing Transfer, extracted to keep
 * useClothingTransfer under the line limit. Owns the reference uploader state
 * and label handlers.
 */
export const useClothingTransferReferences = (): UseClothingTransferReferencesReturn => {
  const idCounter = useRef(0);
  const [referenceItems, setReferenceItems] = useState<ClothingTransferReferenceItem[]>([
    { id: ++idCounter.current, image: null, label: '' },
  ]);

  const validReferences = useMemo(
    () => referenceItems.filter((item) => item.image !== null),
    [referenceItems],
  );

  const handleReferenceUpload = useCallback((file: ImageFile | null, id: number) => {
    setReferenceItems((items) =>
      items.map((item) => (item.id === id ? { ...item, image: file } : item)),
    );
  }, []);

  const handleReferenceLabel = useCallback((label: string, id: number) => {
    setReferenceItems((items) =>
      items.map((item) => (item.id === id ? { ...item, label } : item)),
    );
  }, []);

  const addReference = useCallback(() => {
    setReferenceItems((prev) => [...prev, { id: ++idCounter.current, image: null, label: '' }]);
  }, []);

  const removeReference = useCallback((id: number) => {
    setReferenceItems((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((item) => item.id !== id);
    });
  }, []);

  return {
    referenceItems,
    validReferences,
    handleReferenceUpload,
    handleReferenceLabel,
    addReference,
    removeReference,
  };
};
