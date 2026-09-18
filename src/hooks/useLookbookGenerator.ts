import { useCallback, useMemo, useState } from 'react';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { getErrorMessage } from '../utils/imageUtils';
import { generateClothingDescription } from '../services/textService';
import { useLookbookDraft } from './useLookbookDraft';
import {
  useLookbookGeneration,
  GeminiImageDriver,
  LookbookSet,
} from './useLookbookGeneration';
import { useLookbookRefinement } from './useLookbookRefinement';
import { useLookbookResultActions } from './useLookbookResultActions';

export type { LookbookSet };

/**
 * Orchestrator for Lookbook generation. Owns UI-level state (loading, error,
 * aspect ratio, resolution, variation count, output tab, upscaling) and the
 * text-based clothing description handler. Composes focused sub-hooks for form
 * draft, image generation engine, refinement, and result actions. Public
 * return surface is identical to the pre-split hook so the component needs zero
 * changes.
 */
export const useLookbookGenerator = () => {
  const { formState, updateForm, handleClearForm } = useLookbookDraft();

  const [generatedLookbook, setGeneratedLookbook] = useState<LookbookSet | null>(null);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isGeneratingCloseUp, setIsGeneratingCloseUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variationCount, setVariationCount] = useState<number>(2);
  const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'variations' | 'closeup'>('main');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const { t } = useLanguage();
  const { textGenerateModel } = useApi();
  const { editImage, upscaleImage, createImageChatSession, model: imageEditModel } = useImageEngine();

  // Driver over the studio-scoped engine; tests can inject a mock.
  const driver = useMemo<GeminiImageDriver>(
    () => ({ editImage, upscaleImage, createImageChatSession: createImageChatSession ?? undefined }),
    [editImage, upscaleImage, createImageChatSession],
  );

  const buildImageServiceConfig = useCallback(
    (onStatusUpdate: (message: string) => void) => ({ onStatusUpdate }),
    [],
  );

  const refinement = useLookbookRefinement({
    driver,
    generatedLookbook,
    setGeneratedLookbook,
    imageEditModel,
    buildImageServiceConfig,
    setError,
    t,
  });

  const generation = useLookbookGeneration({
    driver,
    formState,
    generatedLookbook,
    setGeneratedLookbook,
    aspectRatio,
    resolution,
    variationCount,
    imageEditModel,
    buildImageServiceConfig,
    onMainImageGenerated: refinement.onMainImageGenerated,
    setIsLoading,
    setLoadingMessage,
    setError,
    setIsGeneratingVariations,
    setIsGeneratingCloseUp,
    setActiveOutputTab,
    t,
  });

  const resultActions = useLookbookResultActions({
    driver,
    generatedLookbook,
    setGeneratedLookbook,
    imageEditModel,
    buildImageServiceConfig,
    upscalingStates,
    setUpscalingStates,
    setError,
    t,
  });

  const handleGenerateDescription = useCallback(async () => {
    const firstImage = formState.clothingImages.find((item) => item.image)?.image;
    if (!firstImage) {
      setError(t('lookbook.descriptionError'));
      return;
    }
    setIsGeneratingDescription(true);
    setError(null);
    try {
      const description = await generateClothingDescription(firstImage, textGenerateModel);
      updateForm({ clothingDescription: description });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [formState.clothingImages, t, updateForm, textGenerateModel, setError]);

  return {
    formState,
    updateForm,
    handleClearForm,
    handleSelectVersion: refinement.handleSelectVersion,
    generatedLookbook,
    isLoading,
    loadingMessage,
    isGeneratingDescription,
    isGeneratingVariations,
    isGeneratingCloseUp,
    error,
    setError,
    variationCount,
    setVariationCount,
    activeOutputTab,
    setActiveOutputTab,
    upscalingStates,
    handleGenerateDescription,
    handleGenerate: generation.handleGenerate,
    handleUpscale: resultActions.handleUpscale,
    handleGenerateVariations: generation.handleGenerateVariations,
    handleGenerateCloseUp: generation.handleGenerateCloseUp,
    chatSession: refinement.chatSession,
    refinementHistory: refinement.refinementHistory,
    isRefining: refinement.isRefining,
    handleRefineImage: refinement.handleRefineImage,
    handleResetRefinement: refinement.handleResetRefinement,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    refinementVersions: refinement.refinementVersions,
    setRefinementVersions: refinement.setRefinementVersions,
    selectedVersionIndex: refinement.selectedVersionIndex,
    setSelectedVersionIndex: refinement.setSelectedVersionIndex,
    originalImageRef: refinement.originalImageRef,
    imageEditModel,
    handleDownloadAll: resultActions.handleDownloadAll,
  };
};
