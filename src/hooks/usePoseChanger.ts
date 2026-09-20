/**
 * Pose Changer Hook (orchestrator)
 *
 * Composes references state and generation engine.
 * Builds the default Gemini image driver; future tests can inject mocks.
 * Public return surface is preserved exactly so PoseChanger.tsx needs zero changes.
 */

import { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generatePoseDescription } from '../services/textService';
import { getErrorMessage } from '../utils/imageUtils';
import {
  usePoseChangerReferences,
} from './usePoseChangerReferences';
import {
  usePoseChangerEngine,
  type PoseImageDriver,
} from './usePoseChangerEngine';
import {
  usePoseChangerResultActions,
} from './usePoseChangerResultActions';

// Re-export for backward compat if any external imports the type from here
export type { PoseImageDriver } from './usePoseChangerEngine';

import type { ImageFile, AspectRatio, ImageResolution } from '../types';

type CameraView = 'default' | 'fullBody' | 'halfBody' | 'kneesUp';

interface CameraViewOption {
  key: CameraView;
  label: string;
}

export interface UsePoseChangerReturn {
  subjectImage: ImageFile | null;
  setSubjectImage: (image: ImageFile | null) => void;
  /** Subject-owned sources the AI Scan layer scans and the panel displays. */
  aiScanSources: ImageFile[];
  poseReferenceImage: ImageFile | null;
  customPosePrompt: string;
  selectedLibraryPoses: string[];
  generatedImages: ImageFile[];
  upscalingStates: Record<number, boolean>;
  regeneratingStates: Record<number, boolean>;
  isLoading: boolean;
  isGeneratingPoseDescription: boolean;
  generationStatus: { active: boolean; progress: number; total: number; message: string };
  error: string | null;
  negativePrompt: string;
  setNegativePrompt: (prompt: string) => void;
  cameraView: CameraView;
  setCameraView: (view: CameraView) => void;
  cameraViewOptions: CameraViewOption[];
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  imageEditModel: string;
  isGenerateDisabled: boolean;
  buttonText: string;
  handleCustomPosePromptChange: (prompt: string) => void;
  handleGeneratePoseDescription: () => Promise<void>;
  handleGenerate: () => Promise<void>;
  handleRegenerateSingle: (index: number) => Promise<void>;
  handleUpscale: (imageToUpscale: ImageFile, index: number) => Promise<void>;
  handlePoseReferenceUpload: (file: ImageFile | null) => void;
  handleConfirmSelection: (poses: string[]) => void;
  clearError: () => void;
}

const IDLE_GENERATION_STATUS = { active: false, progress: 0, total: 0, message: '' };

export const usePoseChanger = (): UsePoseChangerReturn => {
  const { t } = useLanguage();
  const { imageEditModel, textGenerateModel } = useApi();

  // UI/loading state owned by orchestrator
  const [generatedImages, setGeneratedImages] = useState<ImageFile[]>([]);
  const [upscalingStates, setUpscalingStates] = useState<Record<number, boolean>>({});
  const [regeneratingStates, setRegeneratingStates] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPoseDescription, setIsGeneratingPoseDescription] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(IDLE_GENERATION_STATUS);
  const [error, setError] = useState<string | null>(null);

  const refs = usePoseChangerReferences();

  // The garment lives on the subject photo; the pose reference is a pose donor
  // only, so it is never scanned. Stable identity keeps the panel's pre-scan and
  // the generation-time scan on the same cached analysis.
  const aiScanSources = useMemo(
    () => (refs.subjectImage ? [refs.subjectImage] : []),
    [refs.subjectImage],
  );

  // Default driver from real service; tests inject mock here
  const driver = useMemo<PoseImageDriver>(() => ({ editImage, upscaleImage }), []);

  const engine = usePoseChangerEngine({
    driver,
    subjectImage: refs.subjectImage,
    poseReferenceImage: refs.poseReferenceImage,
    customPosePrompt: refs.customPosePrompt,
    negativePrompt: refs.negativePrompt,
    aspectRatio: refs.aspectRatio,
    resolution: refs.resolution,
    imageEditModel,
    aiScanSources,
    t,
    allPrompts: refs.allPrompts,
    getFramingInstruction: refs.getFramingInstruction,
    setGeneratedImages,
    setUpscalingStates,
    setRegeneratingStates,
    setIsLoading,
    setGenerationStatus,
    setError,
  });

  const actions = usePoseChangerResultActions({
    driver,
    imageEditModel,
    t,
    setGeneratedImages,
    setUpscalingStates,
    setError,
  });

  const handleGeneratePoseDescription = useCallback(async () => {
    if (!refs.poseReferenceImage) {
      setError(t('pose.poseReferenceMissingError'));
      return;
    }

    setIsGeneratingPoseDescription(true);
    setError(null);

    try {
      const description = await generatePoseDescription(refs.poseReferenceImage, textGenerateModel);
      refs.handleCustomPosePromptChange(description);
      refs.handlePoseReferenceUpload(null);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingPoseDescription(false);
    }
  }, [refs, textGenerateModel, t]);

  const anyLoading =
    isLoading ||
    generationStatus.active ||
    isGeneratingPoseDescription ||
    Object.values(upscalingStates).some(Boolean) ||
    Object.values(regeneratingStates).some(Boolean);

  const isGenerateDisabled =
    anyLoading || !refs.subjectImage || (!refs.poseReferenceImage && refs.totalPrompts === 0);

  const buttonText = (() => {
    if (isLoading) return t('pose.generatingOne');
    if (generationStatus.active)
      return t('pose.generatingMultiple', { progress: generationStatus.progress, total: generationStatus.total });
    if (refs.poseReferenceImage) return t('pose.generateButton');
    if (refs.totalPrompts > 1) return t('pose.generateMultipleButton', { count: refs.totalPrompts });
    if (refs.totalPrompts === 1) return t('pose.generateOneButton');
    return t('pose.generateButton');
  })();

  return {
    // from references
    subjectImage: refs.subjectImage,
    setSubjectImage: refs.setSubjectImage,
    aiScanSources,
    poseReferenceImage: refs.poseReferenceImage,
    customPosePrompt: refs.customPosePrompt,
    negativePrompt: refs.negativePrompt,
    setNegativePrompt: refs.setNegativePrompt,
    selectedLibraryPoses: refs.selectedLibraryPoses,
    setCameraView: refs.setCameraView,
    cameraView: refs.cameraView,
    cameraViewOptions: refs.cameraViewOptions,
    aspectRatio: refs.aspectRatio,
    setAspectRatio: refs.setAspectRatio,
    resolution: refs.resolution,
    setResolution: refs.setResolution,
    // local + computed
    generatedImages,
    upscalingStates,
    regeneratingStates,
    isLoading,
    isGeneratingPoseDescription,
    generationStatus,
    error,
    imageEditModel,
    isGenerateDisabled,
    buttonText,
    // handlers
    handleCustomPosePromptChange: refs.handleCustomPosePromptChange,
    handleGeneratePoseDescription,
    handleGenerate: engine.handleGenerate,
    handleRegenerateSingle: engine.handleRegenerateSingle,
    handleUpscale: actions.handleUpscale,
    handlePoseReferenceUpload: refs.handlePoseReferenceUpload,
    handleConfirmSelection: refs.handleConfirmSelection,
    clearError: () => setError(null),
  };
};
