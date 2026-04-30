
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  DEFAULT_IMAGE_RESOLUTION,
  Feature,
  ImageFile,
  ImageResolution,
  MarkerPosition,
  VirtualTryOnBatchItem,
  VirtualTryOnClothingItem,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage, compositeMarkerOnImage } from '../utils/imageUtils';
// import { editImage } from '../services/imageEditingService';  // migrated to job pipeline
// TODO: migrate upscale/refine to job pipeline
import { upscaleImage, createImageChatSession, type ImageChatSession } from '../services/imageEditingService';
import { submitJob, getJobResults, downloadJobResultBlob, type Job, type JobResult } from '../services/jobService';
import { buildVirtualTryOnParts } from '../utils/virtual-try-on-prompt-builder';
import { remapImageBatchItems } from '../utils/batch-image-session';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { setSharedJobState } from './useJobPoll';

const MAX_SHARED_OUTFIT_IMAGES = 2;
const getUpscaleStateKey = (itemId: string, index: number) => `${itemId}:${index}`;
const POLL_INTERVAL_MS = 3000;

async function waitForJobCompletion(jobId: string, onStatus: (msg: string) => void): Promise<Job> {
  const { pollJob } = await import('../services/jobService');
  while (true) {
    try {
      const job = await pollJob(jobId);
      setSharedJobState({
        job,
        isPolling: job.status === 'queued' || job.status === 'running',
        error: job.status === 'failed' ? job.error_message || 'Job failed' : null,
      });
      onStatus(`Job ${job.status}...`);
      if (job.status === 'completed' || job.status === 'partial' || job.status === 'failed') {
        return job;
      }
    } catch (error) {
      setSharedJobState({ isPolling: false, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function fetchJobImageResults(jobId: string): Promise<ImageFile[]> {
  const { results } = await getJobResults(jobId);
  const outputs = results.filter(r => r.kind === 'output');
  const images: ImageFile[] = [];
  for (const r of outputs) {
    const base64 = await downloadJobResultBlob(r.blob_path);
    images.push({ base64, mimeType: r.mime_type });
  }
  return images;
}

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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [isLoading, setIsLoading] = useState(false);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Estado de modo multi-persona para selección de objetivo en imágenes con múltiples personas
  const [isMultiPersonMode, setIsMultiPersonModeState] = useState<boolean>(false);
  const [markerPosition, setMarkerPosition] = useState<MarkerPosition | null>(null);

  // Refine state — per image slot: key = `itemId:index`
  const chatSessionsRef = useRef<Record<string, ImageChatSession>>({});
  const [refinePrompts, setRefinePrompts] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState<Record<string, boolean>>({});

  const { t } = useLanguage();
  const { imageEditModel } = useApi();

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
  }), []);

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

  // Cuando se desactiva el modo multi-persona, limpiar el marcador automáticamente
  const setIsMultiPersonMode = useCallback((value: boolean) => {
    setIsMultiPersonModeState(value);
    if (!value) {
      setMarkerPosition(null);
    }
  }, []);

  // Limpia el marcador sin cambiar el modo
  const clearMarker = useCallback(() => {
    setMarkerPosition(null);
  }, []);

  const handleSubjectImagesUpload = useCallback((images: ImageFile[]) => {
    // Nueva imagen = nuevo contexto, limpiar marcador obsoleto
    setMarkerPosition(null);
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

  const clearSubjectImages = useCallback(() => {
    setSubjectItems([]);
    setSelectedSubjectItemId(null);
    setError(null);
    setUpscalingStates({});
    chatSessionsRef.current = {};
    setRefinePrompts({});
    setIsRefining({});
    setAspectRatio('3:4');
    setResolution(DEFAULT_IMAGE_RESOLUTION);
  }, []);

  const handleGenerateImage = useCallback(async () => {
    if (!canGenerate) {
      setError(t('virtualTryOn.inputError'));
      return;
    }


    const outfitImages = validClothingItems.map((item) => item.image as ImageFile);
    const jobs: { id: string; subjectImage: ImageFile }[] = subjectItems.map((item) => ({
      id: item.id,
      subjectImage: item.subjectImage,
    }));
    const batchConcurrency = jobs.length;

    setIsLoading(true);
    setLoadingMessage(t('virtualTryOn.generatingStatus'));
    setError(null);
    setUpscalingStates({});
    // Reset refine sessions so new results get fresh conversation context
    chatSessionsRef.current = {};
    setRefinePrompts({});
    setIsRefining({});
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
        batchConcurrency,
        async (job) => {
          updateSubjectItem(job.id, {
            status: 'processing',
            error: undefined,
            results: [],
          });

          try {
            let finalSubjectImage = job.subjectImage;
            if (isMultiPersonMode && markerPosition) {
              finalSubjectImage = await compositeMarkerOnImage(job.subjectImage, markerPosition);
            }

            const interleavedParts = buildVirtualTryOnParts({
              subjectImage: finalSubjectImage,
              clothingImages: outfitImages,
              extraPrompt,
              backgroundPrompt,
              isMultiPersonMode: isMultiPersonMode && markerPosition !== null,
            });

            const payload = {
              personImage: finalSubjectImage.base64,
              garmentImages: outfitImages.map(img => img.base64),
              backgroundPrompt,
              extraPrompt,
              numImages,
              aspectRatio,
              resolution,
              isMultiPersonMode: isMultiPersonMode && markerPosition !== null,
              interleavedParts,
            };

            const submittedJob = await submitJob('try-on', payload as Record<string, unknown>);
            setSharedJobState({ job: submittedJob, isPolling: true, error: null });
            const completedJob = await waitForJobCompletion(submittedJob.id, setLoadingMessage);
            setSharedJobState({
              job: completedJob,
              isPolling: false,
              error: completedJob.status === 'failed' ? completedJob.error_message || 'Job failed' : null,
            });

            if (completedJob.status === 'failed') {
              throw new Error(completedJob.error_message || 'Job failed');
            }

            const results = await fetchJobImageResults(submittedJob.id);

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
    canGenerate,
    extraPrompt,
    numImages,
    resolution,
    subjectItems,
    t,
    updateSubjectItem,
    validClothingItems,
    isMultiPersonMode,
    markerPosition,
  ]);

  const handleRegenerateSingle = useCallback(async (itemId: string) => {
    const targetItem = subjectItems.find((item) => item.id === itemId);
    if (!targetItem || validClothingItems.length === 0) return;

    const outfitImages = validClothingItems.map((item) => item.image as ImageFile);

    // Reset only this item
    updateSubjectItem(itemId, { status: 'processing', results: [], error: undefined });
    setError(null);

    // Clear refine sessions for this item
    Object.keys(chatSessionsRef.current).forEach((key) => {
      if (key.startsWith(`${itemId}:`)) delete chatSessionsRef.current[key];
    });

    try {
      let finalSubjectImage = targetItem.subjectImage;
      if (isMultiPersonMode && markerPosition) {
        finalSubjectImage = await compositeMarkerOnImage(targetItem.subjectImage, markerPosition);
      }

      const interleavedParts = buildVirtualTryOnParts({
        subjectImage: finalSubjectImage,
        clothingImages: outfitImages,
        extraPrompt,
        backgroundPrompt,
        isMultiPersonMode: isMultiPersonMode && markerPosition !== null,
      });

      const payload = {
        personImage: finalSubjectImage.base64,
        garmentImages: outfitImages.map(img => img.base64),
        backgroundPrompt,
        extraPrompt,
        numImages,
        aspectRatio,
        resolution,
        isMultiPersonMode: isMultiPersonMode && markerPosition !== null,
        interleavedParts,
      };

      const submittedJob = await submitJob('try-on', payload as Record<string, unknown>);
      const completedJob = await waitForJobCompletion(submittedJob.id, setLoadingMessage);

      if (completedJob.status === 'failed') {
        throw new Error(completedJob.error_message || 'Job failed');
      }

      const results = await fetchJobImageResults(submittedJob.id);

      updateSubjectItem(itemId, { status: 'completed', results, error: undefined });
    } catch (err) {
      updateSubjectItem(itemId, { status: 'error', results: [], error: getErrorMessage(err, t) });
    }
  }, [
    aspectRatio,
    backgroundPrompt,
    extraPrompt,
    numImages,
    resolution,
    subjectItems,
    t,
    updateSubjectItem,
    validClothingItems,
    isMultiPersonMode,
    markerPosition,
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
        buildImageServiceConfig(() => { }),
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

  const handleRefine = useCallback(async (imageToRefine: ImageFile, index: number, itemId: string, prompt: string) => {
    const key = `${itemId}:${index}`;
    if (!prompt.trim()) return;

    // Get or create a chat session for this specific image slot
    if (!chatSessionsRef.current[key]) {
      try {
        chatSessionsRef.current[key] = createImageChatSession(
          imageEditModel,
          buildImageServiceConfig(() => { }),
        );
      } catch (sessionErr) {
        setError(getErrorMessage(sessionErr, t));
        return;
      }
    }
    const session = chatSessionsRef.current[key];

    setIsRefining((prev) => ({ ...prev, [key]: true }));
    setError(null);

    try {
      const refined = await session.sendRefinement(prompt, imageToRefine);

      updateSubjectItem(itemId, (item) => ({
        ...item,
        results: item.results.map((img, i) => (i === index ? refined : img)),
      }));

      // Clear the prompt after successful refinement
      setRefinePrompts((prev) => ({ ...prev, [key]: '' }));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsRefining((prev) => ({ ...prev, [key]: false }));
    }
  }, [buildImageServiceConfig, imageEditModel, t, updateSubjectItem]);

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

  const handleDownloadAll = useCallback(async () => {
    const successItems = subjectItems.filter((item) => item.status === 'completed' && item.results && item.results.length > 0);
    if (successItems.length === 0) return;
    
    // We need all the generated images
    const allResults = successItems.flatMap(item => item.results);
    if (allResults.length === 0) return;

    try {
      await downloadImagesAsZip(allResults, `${Feature.TryOn}-batch`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [subjectItems, t]);

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
    clearSubjectImages,
    handleGenerateImage,
    handleRegenerateSingle,
    handleUpscale,
    handleRefine,
    handleClothingUpload,
    addClothingUploader,
    removeClothingUploader,
    handleDownloadAll,
    anyUpscaling,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    // Multi-person marker state
    isMultiPersonMode,
    setIsMultiPersonMode,
    markerPosition,
    setMarkerPosition,
    clearMarker,
  };
};
