
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  DEFAULT_IMAGE_RESOLUTION,
  Feature,
  ImageFile,
  ImageResolution,
  VirtualTryOnBatchItem,
  VirtualTryOnClothingItem,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { buildVirtualTryOnPrompt } from '../utils/virtual-try-on-prompt-builder';
import { remapImageBatchItems } from '../utils/batch-image-session';
import { runBoundedWorkers } from '../utils/run-bounded-workers';

const MAX_SHARED_OUTFIT_IMAGES = 2;
const BATCH_CONCURRENCY = 3;
const getUpscaleStateKey = (itemId: string, index: number) => `${itemId}:${index}`;

export const useVirtualTryOn = () => {
  const clothingIdCounter = useRef(0);
  const batchIdCounter = useRef(0);
  const [subjectItems, setSubjectItems] = useState<VirtualTryOnBatchItem[]>([]);
  const [selectedSubjectItemId, setSelectedSubjectItemId] = useState<string | null>(null);
  const [clothingItems, setClothingItems] = useState<VirtualTryOnClothingItem[]>([
    { id: ++clothingIdCounter.current, image: null },
  ]);
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [isLoading, setIsLoading] = useState(false);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { t } = useLanguage();
  const { localApiBaseUrl, localApiKey, antiApiBaseUrl, antiApiKey, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.TryOn);

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    localApiBaseUrl,
    localApiKey,
    antiApiBaseUrl,
    antiApiKey,
  }), [antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey]);

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

  const validClothingItems = useMemo(
    () => clothingItems.filter((item) => item.image !== null),
    [clothingItems],
  );

  const anyUpscaling = useMemo(
    () => Object.values(upscalingStates).some(Boolean),
    [upscalingStates],
  );

  const completedCount = useMemo(
    () => subjectItems.filter((item) => item.status === 'completed').length,
    [subjectItems],
  );

  const failedCount = useMemo(
    () => subjectItems.filter((item) => item.status === 'error').length,
    [subjectItems],
  );

  const canGenerate = subjectItems.length > 0 && validClothingItems.length > 0;

  const handleSubjectImagesUpload = useCallback((images: ImageFile[]) => {
    let nextItems: VirtualTryOnBatchItem[] = [];

    setSubjectItems((prev) => {
      nextItems = remapImageBatchItems(
        images,
        prev,
        (item) => item.subjectImage,
        createSubjectItem,
      );
      return nextItems;
    });

    setSelectedSubjectItemId((prev) => {
      if (nextItems.length === 0) {
        return null;
      }

      return prev && nextItems.some((item) => item.id === prev) ? prev : nextItems[0].id;
    });

    setError(null);
  }, [createSubjectItem]);

  const setSubjectImage = useCallback((image: ImageFile | null) => {
    handleSubjectImagesUpload(image ? [image] : []);
  }, [handleSubjectImagesUpload]);

  const handleGenerateImage = useCallback(async () => {
    if (!canGenerate) {
      setError(t('virtualTryOn.inputError'));
      return;
    }

    const outfitImages = validClothingItems.map((item) => item.image as ImageFile);
    const prompt = buildVirtualTryOnPrompt({
      subjectImageCount: 1, // We process jobs per item, so it's 1 subject per request
      clothingImageCount: validClothingItems.length,
      backgroundPrompt,
      extraPrompt,
      numImages,
    });
    const jobs = subjectItems.map((item) => ({
      id: item.id,
      subjectImage: item.subjectImage,
    }));

    setIsLoading(true);
    setLoadingMessage(t('virtualTryOn.generatingStatus'));
    setError(null);
    setUpscalingStates({});
    setSubjectItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'pending',
        results: [],
        error: undefined,
      })),
    );

    try {
      await runBoundedWorkers(
        jobs,
        BATCH_CONCURRENCY,
        async (job) => {
          updateSubjectItem(job.id, {
            status: 'processing',
            error: undefined,
            results: [],
          });

          try {
            const results = await editImage(
              {
                images: [job.subjectImage, ...outfitImages],
                prompt,
                numberOfImages: numImages,
                aspectRatio,
                resolution,
              },
              imageEditModel,
              buildImageServiceConfig(setLoadingMessage),
            );

            updateSubjectItem(job.id, {
              status: 'completed',
              results,
              error: undefined,
            });
          } catch (itemError) {
            updateSubjectItem(job.id, {
              status: 'error',
              results: [],
              error: getErrorMessage(itemError, t),
            });
          }
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [
    aspectRatio,
    backgroundPrompt,
    buildImageServiceConfig,
    canGenerate,
    extraPrompt,
    imageEditModel,
    numImages,
    resolution,
    subjectItems,
    t,
    updateSubjectItem,
    validClothingItems,
  ]);

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, index: number, itemId?: string) => {
    const targetItemId = itemId ?? activeSubjectItem?.id;
    if (!imageToUpscale || !targetItemId) {
      return;
    }

    const stateKey = getUpscaleStateKey(targetItemId, index);
    setUpscalingStates((prev) => ({ ...prev, [stateKey]: true }));
    setError(null);

    try {
      const result = await upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => {}),
      );

      updateSubjectItem(targetItemId, (item) => ({
        ...item,
        results: item.results.map((image, resultIndex) => (
          resultIndex === index ? result : image
        )),
      }));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [stateKey]: false }));
    }
  }, [activeSubjectItem?.id, buildImageServiceConfig, imageEditModel, t, updateSubjectItem]);

  const handleClothingUpload = useCallback((file: ImageFile | null, id: number) => {
    setClothingItems((items) =>
      items.map((item) => (item.id === id ? { ...item, image: file } : item)),
    );
  }, []);

  const addClothingUploader = useCallback(() => {
    setClothingItems((prev) => {
      if (prev.length >= MAX_SHARED_OUTFIT_IMAGES) {
        return prev;
      }

      return [...prev, { id: ++clothingIdCounter.current, image: null }];
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
    subjectItems,
    subjectImages,
    selectedSubjectItemId,
    setSelectedSubjectItemId,
    activeSubjectItem,
    subjectImage,
    setSubjectImage,
    handleSubjectImagesUpload,
    clothingItems,
    backgroundPrompt,
    setBackgroundPrompt,
    extraPrompt,
    setExtraPrompt,
    numImages,
    setNumImages,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    isLoading,
    upscalingStates,
    loadingMessage,
    error,
    setError,
    generatedImages,
    validClothingItems,
    completedCount,
    failedCount,
    canGenerate,
    handleGenerateImage,
    handleUpscale,
    handleClothingUpload,
    addClothingUploader,
    removeClothingUploader,
    anyUpscaling,
    imageEditModel,
  };
};
