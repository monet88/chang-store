import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  ClothingTransferBatchItem,
  ClothingTransferReferenceItem,
  DEFAULT_IMAGE_RESOLUTION,
  Feature,
  ImageFile,
  ImageResolution,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { getErrorMessage } from '../utils/imageUtils';
// import { editImage } from '../services/imageEditingService';  // migrated to job pipeline
// TODO: migrate upscale/refine to job pipeline
import { upscaleImage, createImageChatSession, type ImageChatSession } from '../services/imageEditingService';
import { submitJob, getJobResults, downloadJobResultBlob, type Job, type JobResult } from '../services/jobService';
import { buildClothingTransferParts } from '../utils/clothing-transfer-prompt-builder';
import { remapImageBatchItems } from '../utils/batch-image-session';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { setSharedJobState } from './useJobPoll';

const getUpscaleStateKey = (itemId: string, index: number) => `${itemId}:${index}`;
const POLL_INTERVAL_MS = 3000;

async function waitForJobCompletion(jobId: string, onStatus: (msg: string) => void, activeJobIds?: Set<string>): Promise<Job> {
  const { pollJob } = await import('../services/jobService');
  while (true) {
    try {
      const job = await pollJob(jobId);
      const isTerminal = job.status === 'completed' || job.status === 'partial' || job.status === 'failed';
      if (isTerminal) {
        activeJobIds?.delete(jobId);
      }
      setSharedJobState({
        job,
        isPolling: activeJobIds ? activeJobIds.size > 0 : !isTerminal,
        error: job.status === 'failed' ? job.error_message || 'Job failed' : null,
      });
      onStatus(`Job ${job.status}...`);
      if (isTerminal) {
        return job;
      }
    } catch (error) {
      activeJobIds?.delete(jobId);
      setSharedJobState({ isPolling: activeJobIds ? activeJobIds.size > 0 : false, error: error instanceof Error ? error.message : String(error) });
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

export function useClothingTransfer() {
  const idCounter = useRef(0);
  const batchIdCounter = useRef(0);
  const [referenceItems, setReferenceItems] = useState<ClothingTransferReferenceItem[]>([
    { id: ++idCounter.current, image: null, label: '' },
  ]);
  const [conceptItems, setConceptItems] = useState<ClothingTransferBatchItem[]>([]);
  const [selectedConceptItemId, setSelectedConceptItemId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});

  // Refine state — per image slot: key = `itemId:index`
  const chatSessionsRef = useRef<Record<string, ImageChatSession>>({});
  const [refinePrompts, setRefinePrompts] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState<Record<string, boolean>>({});

  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { imageEditModel } = useApi();

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
  }), []);

  const createConceptItem = useCallback((image: ImageFile): ClothingTransferBatchItem => ({
    id: `ct-${++batchIdCounter.current}`,
    conceptImage: image,
    status: 'pending',
    results: [],
  }), []);

  const updateConceptItem = useCallback(
    (id: string, updater: Partial<ClothingTransferBatchItem> | ((item: ClothingTransferBatchItem) => ClothingTransferBatchItem)) => {
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

  const validReferences = useMemo(
    () => referenceItems.filter((item) => item.image !== null),
    [referenceItems],
  );

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

  const anyUpscaling = useMemo(
    () => Object.values(upscalingStates).some(Boolean),
    [upscalingStates],
  );

  const completedCount = useMemo(
    () => conceptItems.filter((item) => item.status === 'completed').length,
    [conceptItems],
  );

  const failedCount = useMemo(
    () => conceptItems.filter((item) => item.status === 'error').length,
    [conceptItems],
  );

  const canGenerate = conceptItems.length > 0 && validReferences.length > 0;

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
  }, [createConceptItem]);

  const handleConceptUpload = useCallback((file: ImageFile | null) => {
    handleConceptImagesUpload(file ? [file] : []);
  }, [handleConceptImagesUpload]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      setError(t('clothingTransfer.inputError'));
      return;
    }

    const refsWithImages = validReferences.map((item) => ({
      image: item.image as ImageFile,
      label: item.label,
    }));
    const referenceImages = refsWithImages.map((item) => item.image);
    const jobs: { id: string; conceptImage: ImageFile }[] = conceptItems.map((item) => ({
      id: item.id,
      conceptImage: item.conceptImage,
    }));
    const batchConcurrency = jobs.length;
    const activeJobIds = new Set<string>();

    setIsLoading(true);
    setLoadingMessage(t('clothingTransfer.generatingStatus'));
    setError(null);
    setUpscalingStates({});
    // Reset refine sessions so new results get fresh conversation context
    chatSessionsRef.current = {};
    setRefinePrompts({});
    setIsRefining({});
    setConceptItems((prev) =>
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
          updateConceptItem(job.id, {
            status: 'processing',
            error: undefined,
            results: [],
          });

          try {
            const interleavedParts = buildClothingTransferParts(
              job.conceptImage,
              refsWithImages,
              extraPrompt.trim(),
            );

            const payload = {
              conceptImage: job.conceptImage.base64,
              referenceImages: referenceImages.map(img => img.base64),
              referenceLabels: refsWithImages.map(ref => ref.label),
              extraPrompt,
              numImages,
              aspectRatio,
              resolution,
              interleavedParts,
            };

            const submittedJob = await submitJob('clothing-transfer', payload as Record<string, unknown>);
            activeJobIds.add(submittedJob.id);
            setSharedJobState({ job: submittedJob, isPolling: true, error: null });
            const completedJob = await waitForJobCompletion(submittedJob.id, setLoadingMessage, activeJobIds);

            if (completedJob.status === 'failed') {
              throw new Error(completedJob.error_message || 'Job failed');
            }

            const results = await fetchJobImageResults(submittedJob.id);

            updateConceptItem(job.id, {
              status: 'completed',
              results,
              error: undefined,
            });
            results.forEach((image) => addImage(image));
          } catch (itemError) {
            updateConceptItem(job.id, {
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
    addImage,
    aspectRatio,
    canGenerate,
    conceptItems,
    extraPrompt,
    numImages,
    resolution,
    t,
    updateConceptItem,
    validReferences,
  ]);

  const handleRegenerateSingle = useCallback(async (itemId: string) => {
    const targetItem = conceptItems.find((item) => item.id === itemId);
    if (!targetItem || validReferences.length === 0) return;

    const refsWithImages = validReferences.map((item) => ({
      image: item.image as ImageFile,
      label: item.label,
    }));
    const referenceImages = refsWithImages.map((item) => item.image);

    updateConceptItem(itemId, { status: 'processing', results: [], error: undefined });
    setError(null);

    Object.keys(chatSessionsRef.current).forEach((key) => {
      if (key.startsWith(`${itemId}:`)) delete chatSessionsRef.current[key];
    });

    try {
      const interleavedParts = buildClothingTransferParts(
        targetItem.conceptImage,
        refsWithImages,
        extraPrompt.trim(),
      );

      const payload = {
        conceptImage: targetItem.conceptImage.base64,
        referenceImages: referenceImages.map(img => img.base64),
        referenceLabels: refsWithImages.map(ref => ref.label),
        extraPrompt,
        numImages,
        aspectRatio,
        resolution,
        interleavedParts,
      };

      const submittedJob = await submitJob('clothing-transfer', payload as Record<string, unknown>);
      const completedJob = await waitForJobCompletion(submittedJob.id, setLoadingMessage);

      if (completedJob.status === 'failed') {
        throw new Error(completedJob.error_message || 'Job failed');
      }

      const results = await fetchJobImageResults(submittedJob.id);

      updateConceptItem(itemId, { status: 'completed', results, error: undefined });
      results.forEach((image) => addImage(image));
    } catch (err) {
      updateConceptItem(itemId, { status: 'error', results: [], error: getErrorMessage(err, t) });
    }
  }, [
    addImage,
    aspectRatio,
    conceptItems,
    extraPrompt,
    numImages,
    resolution,
    t,
    updateConceptItem,
    validReferences,
  ]);

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, index: number, itemId?: string) => {
    const targetItemId = itemId ?? activeConceptItem?.id;
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

      updateConceptItem(targetItemId, (item) => ({
        ...item,
        results: item.results.map((image, resultIndex) => (
          resultIndex === index ? result : image
        )),
      }));
      addImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [stateKey]: false }));
    }
  }, [activeConceptItem?.id, addImage, buildImageServiceConfig, imageEditModel, t, updateConceptItem]);

  const handleRefine = useCallback(async (imageToRefine: ImageFile, index: number, itemId: string, prompt: string) => {
    const key = `${itemId}:${index}`;
    if (!prompt.trim()) return;

    if (!chatSessionsRef.current[key]) {
      chatSessionsRef.current[key] = createImageChatSession(imageEditModel, buildImageServiceConfig(() => {}));
    }
    const session = chatSessionsRef.current[key];

    setIsRefining((prev) => ({ ...prev, [key]: true }));
    setError(null);

    try {
      const refined = await session.sendRefinement(prompt, imageToRefine);

      updateConceptItem(itemId, (item) => ({
        ...item,
        results: item.results.map((img, i) => (i === index ? refined : img)),
      }));
      addImage(refined);
      setRefinePrompts((prev) => ({ ...prev, [key]: '' }));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsRefining((prev) => ({ ...prev, [key]: false }));
    }
  }, [addImage, buildImageServiceConfig, imageEditModel, t, updateConceptItem]);

  const handleDownloadAll = useCallback(async () => {
    const successItems = conceptItems.filter((item) => item.status === 'completed' && item.results && item.results.length > 0);
    if (successItems.length === 0) return;
    
    // We need all the generated images
    const allResults = successItems.flatMap(item => item.results);
    if (allResults.length === 0) return;

    try {
      await downloadImagesAsZip(allResults, `${Feature.ClothingTransfer}-batch`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [conceptItems, t]);

  return {
    referenceItems,
    conceptItems,
    conceptImages,
    conceptImage,
    selectedConceptItemId,
    setSelectedConceptItemId,
    activeConceptItem,
    extraPrompt,
    numImages,
    aspectRatio,
    resolution,
    isLoading,
    loadingMessage,
    error,
    generatedImages,
    upscalingStates,
    setExtraPrompt,
    setNumImages,
    setAspectRatio,
    setResolution,
    setError,
    handleReferenceUpload,
    handleReferenceLabel,
    addReference,
    removeReference,
    handleConceptUpload,
    handleConceptImagesUpload,
    handleGenerate,
    handleRegenerateSingle,
    handleUpscale,
    handleRefine,
    handleDownloadAll,
    validReferences,
    anyUpscaling,
    completedCount,
    failedCount,
    canGenerate,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
  };
}
