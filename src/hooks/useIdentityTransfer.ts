import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_IMAGE_RESOLUTION,
  Feature,
  type AspectRatio,
  type IdentityTransferBatchItem,
  type ImageFile,
  type ImageResolution,
} from '../types';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAiScan } from '../contexts/AiScanContext';
import { buildIdentityTransferParts } from '../utils/identity-transfer-prompt-builder';
import { promptFormatFor } from '../utils/promptFormat';
import { getErrorMessage } from '../utils/imageUtils';
import { loadDefaultIdentityReferences } from '../utils/identity-transfer-defaults';
import { remapImageBatchItems } from '../utils/batch-image-session';
import { runBoundedWorkers } from '../utils/run-bounded-workers';

const IDENTITY_TRANSFER_BATCH_CONCURRENCY = 4;

export const useIdentityTransfer = () => {
  const batchIdCounter = useRef(0);
  const generationInFlight = useRef(false);
  const [destinationItems, setDestinationItems] = useState<IdentityTransferBatchItem[]>([]);
  const [faceReference, setFaceReference] = useState<ImageFile | null>(null);
  const [bodyReference, setBodyReference] = useState<ImageFile | null>(null);
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { editImage, model: imageEditModel, id: engineId } = useImageEngine();
  const { addImage } = useImageGallery();
  const { t } = useLanguage();
  const { scan } = useAiScan();

  const faceReferenceOverridden = useRef(false);
  const bodyReferenceOverridden = useRef(false);

  // Pre-fill the built-in Face/Body references; a user upload wins over a
  // default that resolves later.
  useEffect(() => {
    let cancelled = false;
    void loadDefaultIdentityReferences().then(({ face, body }) => {
      if (cancelled) return;
      if (face && !faceReferenceOverridden.current) setFaceReference(face);
      if (body && !bodyReferenceOverridden.current) setBodyReference(body);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateFaceReference = useCallback((image: ImageFile | null) => {
    faceReferenceOverridden.current = true;
    setFaceReference(image);
  }, []);

  const updateBodyReference = useCallback((image: ImageFile | null) => {
    bodyReferenceOverridden.current = true;
    setBodyReference(image);
  }, []);

  const createDestinationItem = useCallback((image: ImageFile): IdentityTransferBatchItem => ({
    id: `identity-${++batchIdCounter.current}`,
    destinationImage: image,
    status: 'pending',
    results: [],
  }), []);

  const updateDestinationItem = useCallback((id: string, patch: Partial<IdentityTransferBatchItem>) => {
    setDestinationItems((items) => items.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  }, []);

  const handleDestinationImagesUpload = useCallback((images: ImageFile[]) => {
    setDestinationItems((items) => remapImageBatchItems(
      images,
      items,
      (item) => item.destinationImage,
      createDestinationItem,
    ));
    setError(null);
  }, [createDestinationItem]);

  const destinationImages = useMemo(
    () => destinationItems.map((item) => item.destinationImage),
    [destinationItems],
  );

  // What the panel's badge shows: the first destination, i.e. exactly the set
  // its own job scans. Every later destination is analyzed with its own photo at
  // generation time, so the badge never claims one photo's fabrics for another.
  const aiScanSources = useMemo(() => destinationImages.slice(0, 1), [destinationImages]);

  const generateForDestination = useCallback(async (
    item: Pick<IdentityTransferBatchItem, 'id' | 'destinationImage'>,
    refs: { face: ImageFile; body: ImageFile | null },
  ) => {
    updateDestinationItem(item.id, { status: 'processing', results: [], error: undefined });

    try {
      // One analysis per destination, over that destination's own photo: every
      // destination is an independent job, and a batch-wide blueprint would
      // describe another photo's outfit inside this prompt.
      const blueprint = await scan([item.destinationImage]);
      const interleavedParts = buildIdentityTransferParts({
        destinationImage: item.destinationImage,
        faceReference: refs.face,
        bodyReference: refs.body,
        backgroundPrompt,
        extraPrompt,
        outfitBlueprint: blueprint,
      }, promptFormatFor(engineId));
      const [result] = await editImage({
        images: [],
        prompt: '',
        numberOfImages: 1,
        aspectRatio,
        resolution,
        interleavedParts,
      }, imageEditModel, { onStatusUpdate: setLoadingMessage });

      if (!result) {
        throw new Error(t('identityTransfer.noResult'));
      }

      updateDestinationItem(item.id, { status: 'completed', results: [result], error: undefined });
      addImage(result, Feature.IdentityTransfer, engineId);
    } catch (itemError) {
      updateDestinationItem(item.id, {
        status: 'error',
        results: [],
        error: getErrorMessage(itemError, t),
      });
    }
  }, [addImage, aspectRatio, backgroundPrompt, editImage, engineId, extraPrompt, imageEditModel, resolution, scan, t, updateDestinationItem]);

  const canGenerate = destinationItems.length > 0 && faceReference !== null;

  const handleGenerate = useCallback(async () => {
    if (generationInFlight.current) return;
    if (!faceReference || destinationItems.length === 0) {
      setError(t('identityTransfer.inputError'));
      return;
    }

    generationInFlight.current = true;
    setIsLoading(true);
    setLoadingMessage(t('identityTransfer.generatingStatus'));
    setError(null);
    setDestinationItems((items) => items.map((item) => ({
      ...item,
      status: 'pending',
      results: [],
      error: undefined,
    })));

    try {
      await runBoundedWorkers(destinationItems, IDENTITY_TRANSFER_BATCH_CONCURRENCY, (item) =>
        generateForDestination(item, { face: faceReference, body: bodyReference }));
    } catch (batchError) {
      setError(getErrorMessage(batchError, t));
    } finally {
      generationInFlight.current = false;
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [bodyReference, destinationItems, faceReference, generateForDestination, t]);

  const handleRegenerateSingle = useCallback(async (itemId: string) => {
    if (generationInFlight.current) return;
    if (!faceReference) return;
    const item = destinationItems.find((candidate) => candidate.id === itemId);
    if (!item) return;

    generationInFlight.current = true;
    setError(null);
    try {
      await generateForDestination(item, { face: faceReference, body: bodyReference });
    } finally {
      generationInFlight.current = false;
    }
  }, [bodyReference, destinationItems, faceReference, generateForDestination]);

  const completedCount = useMemo(
    () => destinationItems.filter((item) => item.status === 'completed').length,
    [destinationItems],
  );
  const failedCount = useMemo(
    () => destinationItems.filter((item) => item.status === 'error').length,
    [destinationItems],
  );

  return {
    destinationItems, destinationImages, aiScanSources, faceReference, bodyReference,
    backgroundPrompt, extraPrompt, aspectRatio, resolution, isLoading,
    loadingMessage, error, canGenerate, completedCount, failedCount, imageEditModel,
    setFaceReference: updateFaceReference, setBodyReference: updateBodyReference, setBackgroundPrompt, setExtraPrompt,
    setAspectRatio, setResolution, setError, handleDestinationImagesUpload,
    handleGenerate, handleRegenerateSingle,
  };
};
