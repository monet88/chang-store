import { useMemo, useState } from 'react';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generatePoseDescription } from '../services/textService';
import { getErrorMessage } from '../utils/imageUtils';

type CameraView = 'default' | 'fullBody' | 'halfBody' | 'kneesUp';

interface GenerationStatus {
  active: boolean;
  progress: number;
  total: number;
  message: string;
}

interface CameraViewOption {
  key: CameraView;
  label: string;
}

export interface UsePoseChangerReturn {
  subjectImage: ImageFile | null;
  setSubjectImage: (image: ImageFile | null) => void;
  poseReferenceImage: ImageFile | null;
  customPosePrompt: string;
  selectedLibraryPoses: string[];
  generatedImages: ImageFile[];
  upscalingStates: Record<number, boolean>;
  regeneratingStates: Record<number, boolean>;
  isLoading: boolean;
  isGeneratingPoseDescription: boolean;
  generationStatus: GenerationStatus;
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

const IDLE_GENERATION_STATUS: GenerationStatus = { active: false, progress: 0, total: 0, message: '' };

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
  onStatusUpdate,
});

const buildTextPosePrompt = (promptText: string, framingInstruction: string): string => `
  **Task**: Photorealistically change the pose of a model based on a text description, while perfectly preserving the model, their clothing, and the background.
  **Source Image**: Contains the model and their clothing.
  **New Pose Description**: "${promptText}".
  **CRITICAL RULES**:
  1.  **Analyze Clothing**: First, analyze the clothing in the Source Image to understand its type (e.g., dress, jeans, blouse), fabric properties (e.g., silk, denim, cotton), and fit (e.g., loose, tight, structured).
  2.  **Preserve Identity**: The model's identity (face, hair, body shape), their entire outfit (design, color, texture), and the entire background from the Source Image MUST be preserved with 100% accuracy.
  3.  **Apply New Pose**: Re-render the model in a new, physically plausible pose that accurately matches the **New Pose Description**.
  4.  **Realistic Draping**: This is the most important step. Re-drape the *exact same* clothing onto the model in their new pose. The draping must be physically accurate, showing how the specific fabric would naturally fold, stretch, and hang based on the new body position and gravity. The fit must remain consistent with the original garment.
  5.  **Camera Framing**: ${framingInstruction}
  **Final Goal**: A high-resolution (2K), photorealistic image.
`.trim();

const buildReferencePosePrompt = (customPosePrompt: string, framingInstruction: string): string => `
  **Task**: Photorealistically transfer the pose from a 'Pose Reference Image' onto the model in a 'Subject Image', while perfectly preserving the model, their clothing, and the background.
  **Image Roles**:
  -   **First Image ('Subject Image')**: Contains the model, clothing, and background to be preserved.
  -   **Second Image ('Pose Reference Image')**: Provides the target pose.
  **CRITICAL RULES**:
  1.  **Extract Pose**: Analyze the 'Pose Reference Image' to understand the exact body position.
  2.  **Preserve Subject, Clothing, and Background**: The model's identity, their entire outfit, and the entire background from the 'Subject Image' MUST be preserved with 100% accuracy.
  3.  **Apply Pose**: Re-render the model from the 'Subject Image' in the exact pose extracted from the 'Pose Reference Image'.
  4.  **Photorealistic Integration**: The model's body must be anatomically correct, clothing redraped realistically, and lighting must match.
  5.  **Camera Framing**: ${framingInstruction}
  ${customPosePrompt.trim() ? `**Additional Text Instruction**: While applying the pose from the reference image, also incorporate this detail: "${customPosePrompt.trim()}".` : ''}
  **Strict Negative Constraints**: DO NOT copy clothing, background, or identity from the 'Pose Reference Image'.
  **Final Goal**: A high-resolution (2K), photorealistic image where the model from the 'Subject Image' is now in the pose from the 'Pose Reference Image'.
`.trim();

export const usePoseChanger = (): UsePoseChangerReturn => {
  const [subjectImage, setSubjectImage] = useState<ImageFile | null>(null);
  const [poseReferenceImage, setPoseReferenceImage] = useState<ImageFile | null>(null);
  const [customPosePrompt, setCustomPosePrompt] = useState('');
  const [selectedLibraryPoses, setSelectedLibraryPoses] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<ImageFile[]>([]);
  const [upscalingStates, setUpscalingStates] = useState<Record<number, boolean>>({});
  const [regeneratingStates, setRegeneratingStates] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPoseDescription, setIsGeneratingPoseDescription] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(IDLE_GENERATION_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cameraView, setCameraView] = useState<CameraView>('fullBody');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const { t } = useLanguage();
  const { imageEditModel, textGenerateModel } = useApi();

  const allPrompts = useMemo(
    () => [...selectedLibraryPoses, ...(customPosePrompt.trim() ? [customPosePrompt.trim()] : [])],
    [customPosePrompt, selectedLibraryPoses],
  );
  const totalPrompts = allPrompts.length;

  const cameraViewOptions: CameraViewOption[] = [
    { key: 'default', label: t('cameraView.options.default') },
    { key: 'fullBody', label: t('cameraView.options.fullBody') },
    { key: 'halfBody', label: t('cameraView.options.halfBody') },
    { key: 'kneesUp', label: t('cameraView.options.kneesUp') },
  ];

  const getFramingInstruction = () => {
    if (cameraView === 'default') {
      return 'Use default framing provided by the model.';
    }

    const instructionKey = `framingInstructions.${cameraView}`;
    return t(instructionKey) || 'Use default framing provided by the model.';
  };

  const generateImageForPrompt = async (sourceImage: ImageFile, promptText: string, framingInstruction: string) => {
    const prompt = buildTextPosePrompt(promptText, framingInstruction);
    const [result] = await editImage(
      {
        images: [sourceImage],
        prompt,
        negativePrompt,
        numberOfImages: 1,
        aspectRatio,
        resolution,
      },
      imageEditModel,
      buildImageServiceConfig(() => {}),
    );

    return result;
  };

  const handleGeneratePoseDescription = async () => {
    if (!poseReferenceImage) {
      setError(t('pose.poseReferenceMissingError'));
      return;
    }

    setIsGeneratingPoseDescription(true);
    setError(null);

    try {
      const description = await generatePoseDescription(poseReferenceImage, textGenerateModel);
      setCustomPosePrompt(description);
      setPoseReferenceImage(null);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingPoseDescription(false);
    }
  };

  const handleGenerate = async () => {
    if (!subjectImage) {
      setError(t('pose.subjectError'));
      return;
    }

    setError(null);
    setGeneratedImages([]);
    setRegeneratingStates({});

    const framingInstruction = getFramingInstruction();

    if (poseReferenceImage) {
      setIsLoading(true);
      setGenerationStatus({ active: true, progress: 1, total: 1, message: t('pose.generatingStatusOne') });

      try {
        const [result] = await editImage(
          {
            images: [subjectImage, poseReferenceImage],
            prompt: buildReferencePosePrompt(customPosePrompt, framingInstruction),
            negativePrompt,
            numberOfImages: 1,
            aspectRatio,
            resolution,
          },
          imageEditModel,
          buildImageServiceConfig((message) => setGenerationStatus((prev) => ({ ...prev, message }))),
        );
        setGeneratedImages([result]);
      } catch (err) {
        setError(getErrorMessage(err, t));
      } finally {
        setIsLoading(false);
        setGenerationStatus(IDLE_GENERATION_STATUS);
      }

      return;
    }

    if (allPrompts.length === 0) {
      setError(t('pose.promptError'));
      return;
    }

    setGenerationStatus({ active: true, progress: 0, total: allPrompts.length, message: '' });

    let results: ImageFile[] = [];
    for (const [index, promptText] of allPrompts.entries()) {
      setGenerationStatus((prev) => ({
        ...prev,
        progress: index + 1,
        message: t('pose.generatingStatusMultiple', { progress: index + 1, total: allPrompts.length }),
      }));

      try {
        const result = await generateImageForPrompt(subjectImage, promptText, framingInstruction);
        results = [...results, result];
        setGeneratedImages(results);
      } catch (err) {
        setError(t('pose.batchError', {
          index: index + 1,
          total: allPrompts.length,
          prompt: promptText.substring(0, 30),
          error: getErrorMessage(err, t),
        }));
        setGenerationStatus(IDLE_GENERATION_STATUS);
        return;
      }
    }

    setGenerationStatus(IDLE_GENERATION_STATUS);
  };

  const handleRegenerateSingle = async (index: number) => {
    const promptText = allPrompts[index];
    if (!promptText || !subjectImage || poseReferenceImage) {
      await handleGenerate();
      return;
    }

    setRegeneratingStates((prev) => ({ ...prev, [index]: true }));
    setError(null);

    try {
      const result = await generateImageForPrompt(subjectImage, promptText, getFramingInstruction());
      setGeneratedImages((prev) => prev.map((image, imageIndex) => (imageIndex === index ? result : image)));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setRegeneratingStates((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handleUpscale = async (imageToUpscale: ImageFile, index: number) => {
    setUpscalingStates((prev) => ({ ...prev, [index]: true }));
    setError(null);

    try {
      const result = await upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => {}),
      );
      setGeneratedImages((prev) => prev.map((image, imageIndex) => (imageIndex === index ? result : image)));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setUpscalingStates((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handlePoseReferenceUpload = (file: ImageFile | null) => {
    setPoseReferenceImage(file);
    if (file) {
      setSelectedLibraryPoses([]);
    }
  };

  const handleCustomPosePromptChange = (prompt: string) => {
    setCustomPosePrompt(prompt);
    if (poseReferenceImage) {
      setPoseReferenceImage(null);
    }
  };

  const handleConfirmSelection = (poses: string[]) => {
    setSelectedLibraryPoses(poses);
    if (poses.length > 0) {
      setPoseReferenceImage(null);
    }
  };

  const anyLoading = isLoading
    || generationStatus.active
    || isGeneratingPoseDescription
    || Object.values(upscalingStates).some(Boolean)
    || Object.values(regeneratingStates).some(Boolean);
  const isGenerateDisabled = anyLoading || !subjectImage || (!poseReferenceImage && totalPrompts === 0);
  const buttonText = (() => {
    if (isLoading) return t('pose.generatingOne');
    if (generationStatus.active) return t('pose.generatingMultiple', { progress: generationStatus.progress, total: generationStatus.total });
    if (poseReferenceImage) return t('pose.generateButton');
    if (totalPrompts > 1) return t('pose.generateMultipleButton', { count: totalPrompts });
    if (totalPrompts === 1) return t('pose.generateOneButton');
    return t('pose.generateButton');
  })();

  return {
    subjectImage,
    setSubjectImage,
    poseReferenceImage,
    customPosePrompt,
    selectedLibraryPoses,
    generatedImages,
    upscalingStates,
    regeneratingStates,
    isLoading,
    isGeneratingPoseDescription,
    generationStatus,
    error,
    negativePrompt,
    setNegativePrompt,
    cameraView,
    setCameraView,
    cameraViewOptions,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    imageEditModel,
    isGenerateDisabled,
    buttonText,
    handleCustomPosePromptChange,
    handleGeneratePoseDescription,
    handleGenerate,
    handleRegenerateSingle,
    handleUpscale,
    handlePoseReferenceUpload,
    handleConfirmSelection,
    clearError: () => setError(null),
  };
};
