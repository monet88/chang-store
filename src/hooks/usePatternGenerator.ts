import { useCallback, useRef, useState } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { getErrorMessage } from '../utils/imageUtils';
import { createImageChatSession, editImage, generateImage, ImageChatSession } from '../services/imageEditingService';
import { buildPatternGeneratorParts, REFINE_CORRECTION, TASK_PROMPT, TEXT_ONLY_TASK_PROMPT } from '../utils/pattern-generator-prompt-builder';
import { downloadImagesAsZip } from '../utils/zipDownload';

export function usePatternGenerator() {
  const { t } = useLanguage();
  const { imageEditModel, imageGenerateModel } = useApi();
  const { addImage } = useImageGallery();

  const [referenceImages, setReferenceImages] = useState<ImageFile[]>([]);
  const [generatedPatterns, setGeneratedPatterns] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImagesState] = useState(1);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [showTilingPreview, setShowTilingPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const chatSessionsRef = useRef<Record<number, ImageChatSession>>({});

  const handleStatusUpdate = useCallback(
    (message: string) => {
      if (message.startsWith('warning:fallback:')) {
        const fallbackModel = message.replace('warning:fallback:', '');
        setWarningMessage(t('patternGenerator.fallbackWarning', { model: fallbackModel }));
        return;
      }

      setLoadingMessage(message);
    },
    [t],
  );

  const buildImageServiceConfig = useCallback(
    (onStatusUpdate: (message: string) => void) => ({
      onStatusUpdate,
    }),
    [],
  );

  const canGenerate = (!isLoading && !isRefining)
    && (referenceImages.length > 0 || prompt.trim().length > 0);
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
    if (referenceImages.length === 0 && trimmedPrompt.length === 0) {
      setError(t('patternGenerator.inputError'));
      return;
    }

    if (isRefining) {
      return;
    }

    setLoadingMessage(t('patternGenerator.generatingStatus'));
    setWarningMessage(null);
    setError(null);
    chatSessionsRef.current = {};
    setGeneratedPatterns([]);
    setSelectedPatternIndex(0);

    try {
      const results = referenceImages.length > 0
        ? await editImage(
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
        )
        : await generateImage(
          trimmedPrompt ? `${TEXT_ONLY_TASK_PROMPT}\n\n${trimmedPrompt}` : TEXT_ONLY_TASK_PROMPT,
          '1:1',
          numImages,
          imageGenerateModel,
          buildImageServiceConfig(handleStatusUpdate),
        );

      setGeneratedPatterns(results);
      results.forEach((img) => addImage(img));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [referenceImages, prompt, numImages, imageEditModel, imageGenerateModel, buildImageServiceConfig, handleStatusUpdate, addImage, t, isRefining]);

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
    prompt,
    numImages,
    selectedPatternIndex,
    showTilingPreview,
    isLoading,
    loadingMessage,
    warningMessage,
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
