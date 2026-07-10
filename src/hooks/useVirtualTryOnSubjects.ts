import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ImageFile,
  MarkerPosition,
  VirtualTryOnBatchItem,
} from '../types';
import { remapImageBatchItems } from '../utils/batch-image-session';

export interface UseVirtualTryOnSubjectsReturn {
  subjectItems: VirtualTryOnBatchItem[];
  selectedSubjectItemId: string | null;
  setSelectedSubjectItemId: (id: string | null) => void;
  activeSubjectItem: VirtualTryOnBatchItem | null;
  subjectImages: ImageFile[];
  subjectImage: ImageFile | null;
  generatedImages: ImageFile[];
  completedCount: number;
  failedCount: number;
  createSubjectItem: (image: ImageFile) => VirtualTryOnBatchItem;
  updateSubjectItem: (
    id: string,
    updater: Partial<VirtualTryOnBatchItem> | ((item: VirtualTryOnBatchItem) => VirtualTryOnBatchItem),
  ) => void;
  setSubjectItems: React.Dispatch<React.SetStateAction<VirtualTryOnBatchItem[]>>;
  handleSubjectImagesUpload: (images: ImageFile[]) => void;
  setSubjectImage: (image: ImageFile | null) => void;
  clearSubjectImages: (onClear?: () => void) => void;
  markerPosition: MarkerPosition | null;
  setMarkerPosition: (marker: MarkerPosition | null) => void;
}

/**
 * Focused hook for Virtual Try-On subject batch management.
 * Extracted to keep useVirtualTryOn under line limit and isolate batch state.
 * Owns subject item creation, selection, upload remapping, and derived counts.
 */
export const useVirtualTryOnSubjects = (
  setError: (message: string | null) => void,
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
): UseVirtualTryOnSubjectsReturn => {
  const batchIdCounter = useRef(0);
  const [subjectItems, setSubjectItems] = useState<VirtualTryOnBatchItem[]>([]);
  const [selectedSubjectItemId, setSelectedSubjectItemId] = useState<string | null>(null);
  const [markerPosition, setMarkerPosition] = useState<MarkerPosition | null>(null);

  const createSubjectItem = useCallback((image: ImageFile): VirtualTryOnBatchItem => ({
    id: `vto-${++batchIdCounter.current}`,
    subjectImage: image,
    status: 'pending',
    results: [],
  }), []);

  const updateSubjectItem = useCallback(
    (id: string, updater: Partial<VirtualTryOnBatchItem> | ((item: VirtualTryOnBatchItem) => VirtualTryOnBatchItem)) => {
      setSubjectItems((prev) =>
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

  const subjectImages = useMemo(
    () => subjectItems.map((item) => item.subjectImage),
    [subjectItems],
  );

  const subjectImage = useMemo(
    () => subjectItems[0]?.subjectImage ?? null,
    [subjectItems],
  );

  const activeSubjectItem = useMemo(
    () => subjectItems.find((item) => item.id === selectedSubjectItemId) ?? subjectItems[0] ?? null,
    [selectedSubjectItemId, subjectItems],
  );

  const generatedImages = activeSubjectItem?.results ?? [];

  const completedCount = useMemo(
    () => subjectItems.filter((item) => item.status === 'completed').length,
    [subjectItems],
  );

  const failedCount = useMemo(
    () => subjectItems.filter((item) => item.status === 'error').length,
    [subjectItems],
  );

  const handleSubjectImagesUpload = useCallback((images: ImageFile[]) => {
    // Nueva imagen = nuevo contexto, limpiar marcador obsoleto
    setMarkerPosition(null);
    let nextItems: VirtualTryOnBatchItem[] = [];

    setSubjectItems((prev) => {
      nextItems = remapImageBatchItems(images, prev, (item) => item.subjectImage, createSubjectItem);
      return nextItems;
    });

    setSelectedSubjectItemId((prev) => {
      if (nextItems.length === 0) {
        return null;
      }
      return prev && nextItems.some((item) => item.id === prev) ? prev : nextItems[0].id;
    });

    setError(null);
  }, [createSubjectItem, setError]);

  const setSubjectImage = useCallback((image: ImageFile | null) => {
    handleSubjectImagesUpload(image ? [image] : []);
  }, [handleSubjectImagesUpload]);

  const clearSubjectImages = useCallback((onClear?: () => void) => {
    setSubjectItems([]);
    setSelectedSubjectItemId(null);
    setError(null);
    setUpscalingStates({});
    onClear?.();
  }, [setError, setUpscalingStates]);

  return {
    subjectItems,
    selectedSubjectItemId,
    setSelectedSubjectItemId,
    activeSubjectItem,
    subjectImages,
    subjectImage,
    generatedImages,
    completedCount,
    failedCount,
    createSubjectItem,
    updateSubjectItem,
    setSubjectItems,
    handleSubjectImagesUpload,
    setSubjectImage,
    clearSubjectImages,
    markerPosition,
    setMarkerPosition,
  };
};
