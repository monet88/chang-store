import { useCallback, useMemo, useState } from 'react';
import {
  AspectRatio,
  ClothingTransferMode,
  DEFAULT_IMAGE_RESOLUTION,
  Feature,
  ImageFile,
  ImageResolution,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useImageRefinement } from './useImageRefinement';
import { useClothingTransferReferences } from './useClothingTransferReferences';
import { useClothingTransferConcepts } from './useClothingTransferConcepts';
import { useClothingTransferEngine, ClothingTransferImageDriver } from './useClothingTransferEngine';
import { useClothingTransferResultActions } from './useClothingTransferResultActions';
import { useClothingTransferEComPack } from './useClothingTransferEComPack';
import { useGeneratedResultActions } from './useGeneratedResultActions';

/**
 * Orchestrator for Clothing Transfer. Owns UI-level state (prompts, settings,
 * loading/error) and composes focused sub-hooks for references, concepts,
 * generation engine, and result actions. Public return surface is identical to
 * the pre-split hook so the component needs zero changes.
 */
export const useClothingTransfer = () => {
  const [mode, setMode] = useState<ClothingTransferMode>('classic');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});

  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { editImage, upscaleImage, model: imageEditModel, id: engineId } = useImageEngine();
  const { textGenerateModel } = useApi();

  const refinement = useImageRefinement({ imageEditModel, setError, t });
  const { refinePrompts, setRefinePrompts, isRefining } = refinement;

  const references = useClothingTransferReferences();
  const concepts = useClothingTransferConcepts({ setError });

  // Default driver wraps the real Gemini service; tests can inject a mock.
  const driver = useMemo<ClothingTransferImageDriver>(
    () => ({ editImage, upscaleImage }),
    [editImage, upscaleImage],
  );

  const buildImageServiceConfig = useCallback(
    (onStatusUpdate: (message: string) => void) => ({ onStatusUpdate }),
    [],
  );

  const canGenerate = concepts.conceptItems.length > 0 && references.validReferences.length > 0;
  const anyUpscaling = useMemo(
    () => Object.values(upscalingStates).some(Boolean),
    [upscalingStates],
  );

  const engine = useClothingTransferEngine({
    driver,
    concepts,
    validReferences: references.validReferences,
    extraPrompt,
    numImages,
    aspectRatio,
    resolution,
    imageEditModel,
    canGenerate,
    refinement,
    buildImageServiceConfig,
    addImage,
    engineId,
    setIsLoading,
    setLoadingMessage,
    setError,
    setUpscalingStates,
    t,
  });

  const resultActions = useClothingTransferResultActions({
    driver,
    concepts,
    imageEditModel,
    refinement,
    buildImageServiceConfig,
    addImage,
    engineId,
    setError,
    setUpscalingStates,
    t,
  });

  const ecomPackCore = useClothingTransferEComPack({
    driver,
    aspectRatio,
    resolution,
    numImages,
    imageEditModel,
    textGenerateModel,
    engineId,
    extraPrompt,
    addImage,
    setError,
    t,
  });

  const ecomPackResultAdapter = useMemo(() => ({
    commitResult: (itemId: string, index: number, image: ImageFile) => {
      ecomPackCore.commitPackResult(itemId, index, image);
      addImage(image, Feature.ClothingTransfer, engineId);
    },
    collectDownloadableResults: () => ecomPackCore.packItems
      .filter((item) => item.status === 'completed' && item.results.length > 0)
      .flatMap((item) => item.results),
    collectDownloadableEntryPaths: () => ecomPackCore.packItems
      .filter((item) => item.status === 'completed' && item.results.length > 0)
      .flatMap((item) =>
        item.results.map((_, index) => `${item.category}/${item.id}-${index + 1}.jpg`),
      ),
  }), [ecomPackCore.commitPackResult, ecomPackCore.packItems, addImage, engineId]);

  const ecomPackResultActions = useGeneratedResultActions({
    driver,
    adapter: ecomPackResultAdapter,
    imageEditModel,
    refinement,
    buildImageServiceConfig,
    setError,
    setUpscalingStates,
    downloadName: 'clothing-transfer-ecom-pack',
    t,
  });

  const ecomPack = useMemo(() => ({
    ...ecomPackCore,
    ...ecomPackResultActions,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    upscalingStates,
  }), [
    ecomPackCore,
    ecomPackResultActions,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    upscalingStates,
  ]);

  return {
    mode,
    setMode,
    ecomPack,
    referenceItems: references.referenceItems,
    conceptItems: concepts.conceptItems,
    conceptImages: concepts.conceptImages,
    conceptImage: concepts.conceptImage,
    selectedConceptItemId: concepts.selectedConceptItemId,
    setSelectedConceptItemId: concepts.setSelectedConceptItemId,
    activeConceptItem: concepts.activeConceptItem,
    extraPrompt,
    numImages,
    aspectRatio,
    resolution,
    isLoading,
    loadingMessage,
    error,
    generatedImages: concepts.generatedImages,
    upscalingStates,
    setExtraPrompt,
    setNumImages,
    setAspectRatio,
    setResolution,
    setError,
    handleReferenceUpload: references.handleReferenceUpload,
    handleReferenceLabel: references.handleReferenceLabel,
    addReference: references.addReference,
    removeReference: references.removeReference,
    handleConceptUpload: concepts.handleConceptUpload,
    handleConceptImagesUpload: concepts.handleConceptImagesUpload,
    handleGenerate: engine.handleGenerate,
    handleRegenerateSingle: engine.handleRegenerateSingle,
    handleUpscale: resultActions.handleUpscale,
    handleRefine: resultActions.handleRefine,
    handleDownloadAll: resultActions.handleDownloadAll,
    validReferences: references.validReferences,
    anyUpscaling,
    completedCount: concepts.completedCount,
    failedCount: concepts.failedCount,
    canGenerate,
    engineId,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
  };
};
