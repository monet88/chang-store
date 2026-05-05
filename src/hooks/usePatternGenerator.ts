import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { getErrorMessage, toDataUrl } from '../utils/imageUtils';
import { createImageChatSession, ImageChatSession } from '../services/imageEditingService';
import { submitJob } from '../services/jobService';
import { buildPatternGeneratorParts, TASK_PROMPT, REFINE_CORRECTION } from '../utils/pattern-generator-prompt-builder';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { assertPayloadSizeBelowLimit, fetchJobImageResults, setSharedJobState, waitForJobCompletion } from './useJobPoll';


export function usePatternGenerator() {
  const { t } = useLanguage();
  const { imageEditModel } = useApi();
  const { addImage } = useImageGallery();

  const [referenceImages, setReferenceImages] = useState<ImageFile[]>([]);
  const [generatedPatterns, setGeneratedPatterns] = useState<ImageFile[]>([]);
  const [numImages, setNumImagesState] = useState(1);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [showTilingPreview, setShowTilingPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const chatSessionsRef = useRef<Record<number, ImageChatSession>>({});
  const isMountedRef = useRef(true);

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
  }), []);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const canGenerate = referenceImages.length > 0 && !isLoading && !isRefining;
  const canRefine = generatedPatterns.length > 0
    && generatedPatterns[selectedPatternIndex] !== undefined
    && !isRefining
    && !isLoading;
  const selectedPattern = generatedPatterns[selectedPatternIndex] ?? null;

  const setNumImages = useCallback((n: number) => {
    setNumImagesState(Math.min(4, Math.max(1, n)));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (referenceImages.length === 0) {
      setError(t('patternGenerator.inputError'));
      return;
    }

    if (isRefining) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('patternGenerator.generatingStatus'));
    setError(null);
    chatSessionsRef.current = {};
    setGeneratedPatterns([]);
    setSelectedPatternIndex(0);

    try {
      const interleavedParts = buildPatternGeneratorParts(referenceImages, TASK_PROMPT);
      const payload = {
        images: referenceImages.map((image) => toDataUrl(image)),
        numImages,
        interleavedParts,
      };
      assertPayloadSizeBelowLimit(payload);

      const submittedJob = await submitJob('pattern-generator', payload as Record<string, unknown>);
      setSharedJobState({ job: submittedJob, isPolling: true, error: null }, { ownerJobId: submittedJob.id });

      if (submittedJob.status === 'failed') {
        setSharedJobState(
          { job: submittedJob, isPolling: false, error: submittedJob.error_message || 'Job failed' },
          { ownerJobId: submittedJob.id },
        );
        throw new Error(submittedJob.error_message || 'Job failed');
      }

      const completedJob = submittedJob.status === 'completed' || submittedJob.status === 'partial'
        ? submittedJob
        : await waitForJobCompletion({
            jobId: submittedJob.id,
            onStatusUpdate: setLoadingMessage,
            shouldContinue: () => isMountedRef.current,
            ownerJobId: submittedJob.id,
          });
      setSharedJobState({ job: completedJob, isPolling: false, error: null }, { ownerJobId: submittedJob.id });

      if (completedJob.status === 'failed') {
        throw new Error(completedJob.error_message || 'Job failed');
      }

      const results = await fetchJobImageResults(submittedJob.id);
      setGeneratedPatterns(results);
      results.forEach((img) => addImage(img));
    } catch (err) {
      if (isMountedRef.current) {
        setError(getErrorMessage(err, t));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLoadingMessage('');
      }
    }
  }, [referenceImages, numImages, imageEditModel, buildImageServiceConfig, addImage, t, isRefining]);

  const handleRefine = useCallback(async () => {
    const currentImage = generatedPatterns[selectedPatternIndex];
    if (!currentImage || !refinePrompt.trim()) {
      return;
    }

    if (!chatSessionsRef.current[selectedPatternIndex]) {
      chatSessionsRef.current[selectedPatternIndex] = createImageChatSession(
        imageEditModel,
        buildImageServiceConfig(() => {}),
      );
    }

    const session = chatSessionsRef.current[selectedPatternIndex];
    setIsRefining(true);
    setLoadingMessage(t('patternGenerator.refiningStatus'));
    setError(null);

    try {
      const refined = await session.sendRefinement(
        refinePrompt.trim() + REFINE_CORRECTION,
        currentImage,
      );

      setGeneratedPatterns((prev) =>
        prev.map((img, i) => (i === selectedPatternIndex ? refined : img)),
      );
      addImage(refined);
      setRefinePrompt('');
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsRefining(false);
      setLoadingMessage('');
    }
  }, [generatedPatterns, selectedPatternIndex, refinePrompt, imageEditModel, buildImageServiceConfig, addImage, t]);

  const handleDownloadSelected = useCallback(() => {
    const image = generatedPatterns[selectedPatternIndex];
    if (!image) {
      return;
    }

    const link = document.createElement('a');
    link.href = `data:${image.mimeType};base64,${image.base64}`;
    link.download = `pattern-${selectedPatternIndex + 1}.png`;
    link.click();
  }, [generatedPatterns, selectedPatternIndex]);

  const handleDownloadAllZip = useCallback(async () => {
    if (generatedPatterns.length <= 1) {
      return;
    }

    try {
      await downloadImagesAsZip(generatedPatterns, 'pattern-generator');
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [generatedPatterns, t]);

  return {
    referenceImages,
    generatedPatterns,
    numImages,
    selectedPatternIndex,
    showTilingPreview,
    isLoading,
    loadingMessage,
    error,
    refinePrompt,
    isRefining,
    canGenerate,
    canRefine,
    selectedPattern,
    setReferenceImages,
    setNumImages,
    setSelectedPatternIndex,
    setShowTilingPreview,
    setRefinePrompt,
    setError,
    handleGenerate,
    handleRefine,
    handleDownloadSelected,
    handleDownloadAllZip,
  };
}
