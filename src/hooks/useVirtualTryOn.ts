import { useCallback, useMemo, useState } from 'react';
import { useVirtualTryOnClothing } from './useVirtualTryOnClothing';
import {
  AspectRatio,
  DEFAULT_IMAGE_RESOLUTION,
  ImageFile,
  ImageResolution,
  VirtualTryOnMode,
} from '../types';
import { useWardrobeMode } from './useWardrobeMode';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { aiScanSourceSet } from '../utils/ai-scan-blueprint';
import { detectImageAspectRatio } from '../utils/imageAspectRatio';
import { useImageRefinement } from './useImageRefinement';
import { useVirtualTryOnSubjects } from './useVirtualTryOnSubjects';
import { useVirtualTryOnEngine, VirtualTryOnImageDriver } from './useVirtualTryOnEngine';
import { useVirtualTryOnResultActions } from './useVirtualTryOnResultActions';

export const useVirtualTryOn = () => {
  const [mode, setMode] = useState<VirtualTryOnMode>('multi-model');
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

  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { editImage, upscaleImage, model: imageEditModel, id: engineId } = useImageEngine();

  // Refine lifecycle (chat sessions + per-slot state) lives in a shared deep
  // module; slot key = `itemId:index`.
  const refinement = useImageRefinement({ imageEditModel, setError, t });
  const { isRefining, refinePrompts, setRefinePrompts } = refinement;

  const wardrobe = useWardrobeMode({
    imageEditModel,
    numImages,
    aspectRatio,
    resolution,
    isParentGenerating: isLoading,
    addImage,
    engineId,
  });

  const isAnyGenerating = isLoading || wardrobe.isGenerating;

  // Clothing/reference list management extracted for size + future engine test seam
  const clothing = useVirtualTryOnClothing();

  // Subject batch management extracted to its own focused hook.
  const subjects = useVirtualTryOnSubjects(setError, setUpscalingStates);

  const handleSubjectImagesUpload = useCallback((images: ImageFile[]) => {
    subjects.handleSubjectImagesUpload(images);
    if (images[0]) {
      void detectImageAspectRatio(images[0]).then((detected) => {
        setAspectRatio(detected);
      });
    }
  }, [subjects]);

  const setSubjectImage = useCallback((image: ImageFile | null) => {
    subjects.setSubjectImage(image);
    if (image) {
      void detectImageAspectRatio(image).then((detected) => {
        setAspectRatio(detected);
      });
    }
  }, [subjects]);

  // Default driver comes from the studio-scoped image engine; tests can inject a mock.
  const driver = useMemo<VirtualTryOnImageDriver>(() => ({ editImage, upscaleImage }), [editImage, upscaleImage]);

  const buildImageServiceConfig = useCallback(
    (onStatusUpdate: (message: string) => void) => ({ onStatusUpdate }),
    [],
  );

  const canGenerate = subjects.subjectItems.length > 0 && clothing.validClothingItems.length > 0;

  // Source set the AI Scan panel displays: the target garments, then the first
  // subject photo. Each subject job scans its own set at generation time, and
  // the first subject's set is the one the panel previews.
  const aiScanSources = useMemo(
    () => aiScanSourceSet(
      clothing.validClothingItems.map((item) => item.image),
      subjects.subjectItems.map((item) => item.subjectImage),
    ),
    [clothing.validClothingItems, subjects.subjectItems],
  );

  // Cuando se desactiva el modo multi-persona, limpiar el marcador automáticamente
  const setIsMultiPersonMode = useCallback((value: boolean) => {
    setIsMultiPersonModeState(value);
    if (!value) {
      subjects.setMarkerPosition(null);
    }
  }, [subjects.setMarkerPosition]);

  // Limpia el marcador sin cambiar el modo
  const clearMarker = useCallback(() => {
    subjects.setMarkerPosition(null);
  }, [subjects.setMarkerPosition]);

  const clearSubjectImages = useCallback(() => {
    subjects.clearSubjectImages(() => {
      refinement.resetSessions();
      setAspectRatio('3:4');
      setResolution(DEFAULT_IMAGE_RESOLUTION);
    });
  }, [subjects, refinement]);

  const engine = useVirtualTryOnEngine({
    driver,
    subjects,
    validClothingItems: clothing.validClothingItems,
    isMultiPersonMode,
    backgroundPrompt,
    extraPrompt,
    numImages,
    aspectRatio,
    resolution,
    imageEditModel,
    canGenerate,
    isWardrobeGenerating: wardrobe.isGenerating,
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

  const resultActions = useVirtualTryOnResultActions({
    driver,
    subjects,
    imageEditModel,
    refinement,
    buildImageServiceConfig,
    setError,
    setUpscalingStates,
    t,
    addImage,
    engineId,
  });

  const anyUpscaling = useMemo(
    () => Object.values(upscalingStates).some(Boolean),
    [upscalingStates],
  );

  return {
    mode,
    setMode,
    isAnyGenerating,
    wardrobe,
    subjectItems: subjects.subjectItems,
    subjectImages: subjects.subjectImages,
    selectedSubjectItemId: subjects.selectedSubjectItemId,
    setSelectedSubjectItemId: subjects.setSelectedSubjectItemId,
    activeSubjectItem: subjects.activeSubjectItem,
    subjectImage: subjects.subjectImage,
    setSubjectImage,
    handleSubjectImagesUpload,
    clothingItems: clothing.clothingItems,
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
    generatedImages: subjects.generatedImages,
    validClothingItems: clothing.validClothingItems,
    aiScanSources,
    completedCount: subjects.completedCount,
    failedCount: subjects.failedCount,
    canGenerate,
    clearSubjectImages,
    handleGenerateImage: engine.handleGenerateImage,
    handleRegenerateSingle: engine.handleRegenerateSingle,
    handleUpscale: resultActions.handleUpscale,
    handleRefine: resultActions.handleRefine,
    handleClothingUpload: clothing.handleClothingUpload,
    handleSourceItemTypeChange: clothing.handleSourceItemTypeChange,
    handleSourcePromptChange: clothing.handleSourcePromptChange,
    addClothingUploader: clothing.addClothingUploader,
    removeClothingUploader: clothing.removeClothingUploader,
    detectingItemIds: clothing.detectingItemIds,
    isAutoDetectingAll: clothing.isAutoDetectingAll,
    autoDetectItemType: clothing.autoDetectItemType,
    autoDetectAllItemTypes: clothing.autoDetectAllItemTypes,
    handleDownloadAll: resultActions.handleDownloadAll,
    anyUpscaling,
    engineId,
    imageEditModel,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    isMultiPersonMode,
    setIsMultiPersonMode,
    markerPosition: subjects.markerPosition,
    setMarkerPosition: subjects.setMarkerPosition,
    clearMarker,
  };
};
