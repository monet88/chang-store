import { useCallback, useRef, useState } from 'react';
import { Feature, ImageFile } from '../types';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { getErrorMessage } from '../utils/imageUtils';
import { createImageChatSession, editImage, ImageChatSession } from '../services/imageEditingService';
import { buildPatternGeneratorParts, REFINE_CORRECTION, TASK_PROMPT } from '../utils/pattern-generator-prompt-builder';
import { downloadImagesAsZip } from '../utils/zipDownload';

export function usePatternGenerator() {
  const { t } = useLanguage();
  const { imageEditModel } = useApi();
  const { addImage } = useImageGallery();
  const { id: engineId } = useImageEngine();

  const [referenceImages, setReferenceImages] = useState<ImageFile[]>([]);
  const [generatedPatterns, setGeneratedPatterns] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImagesState] = useState(1);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [showTilingPreview, setShowTilingPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const chatSessionsRef = useRef<Record<number, ImageChatSession>>({});
  const isGeneratingRef = useRef(false);

  const handleStatusUpdate = useCallback((message: string) => {
    setLoadingMessage(message);
  }, []);

  const buildImageServiceConfig = useCallback(
    (onStatusUpdate: (message: string) => void) => ({
      onStatusUpdate,
    }),
    [],
  );

  const canGenerate = (!isLoading && !isRefining)
    && referenceImages.length > 0;
  const canRefine = generatedPatterns.length > 0
    && generatedPatterns[selectedPatternIndex] !== undefined
    && !isRefining
    && !isLoading;
  const selectedPattern = generatedPatterns[selectedPatternIndex] ?? null;

  const setNumImages = useCallback((n: number) => {
    setNumImagesState(Math.min(4, Math.max(1, n)));
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (referenceImages.length === 0) {
      setError(t('patternGenerator.inputError'));
      return;
    }

    if (isRefining || isGeneratingRef.current) {
      return;
    }

    isGeneratingRef.current = true;
    setLoadingMessage(t('patternGenerator.generatingStatus'));
    setIsLoading(true);
    setError(null);
    chatSessionsRef.current = {};
    setGeneratedPatterns([]);
    setSelectedPatternIndex(0);

    try {
      const results = await editImage(
        {
          images: referenceImages,
          prompt: '',
          numberOfImages: numImages,
          aspectRatio: '1:1',
          resolution: '4K',
          interleavedParts: buildPatternGeneratorParts(referenceImages, trimmedPrompt ? `${TASK_PROMPT}\n\n${trimmedPrompt}` : TASK_PROMPT),
        },
        imageEditModel,
        buildImageServiceConfig(handleStatusUpdate),
      );

      setGeneratedPatterns(results);
      results.forEach((img) => addImage(img, Feature.PatternGenerator, engineId));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      isGeneratingRef.current = false;
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [referenceImages, prompt, numImages, imageEditModel, buildImageServiceConfig, handleStatusUpdate, addImage, engineId, t, isRefining]);

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
      addImage(refined, Feature.PatternGenerator, engineId);
      setRefinePrompt('');
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsRefining(false);
      setLoadingMessage('');
    }
  }, [generatedPatterns, selectedPatternIndex, refinePrompt, imageEditModel, buildImageServiceConfig, addImage, engineId, t]);

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
    prompt,
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
    setPrompt,
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
