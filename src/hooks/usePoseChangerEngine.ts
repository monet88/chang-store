import { useCallback } from 'react';
import { AspectRatio, ImageFile, ImageResolution } from '../types';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';
import { buildTextPosePrompt, buildReferencePosePrompt } from '../utils/pose-changer-prompt-builder';

type CameraView = 'default' | 'fullBody' | 'halfBody' | 'kneesUp';

export interface PoseImageDriver {
  editImage: typeof editImage;
  upscaleImage: typeof upscaleImage;
}

export interface UsePoseChangerEngineConfig {
  driver: PoseImageDriver;
  subjectImage: ImageFile | null;
  poseReferenceImage: ImageFile | null;
  customPosePrompt: string;
  negativePrompt: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  imageEditModel: string;
  t: (key: string, options?: any) => string;
  allPrompts: string[];
  getFramingInstruction: () => string;
  setGeneratedImages: React.Dispatch<React.SetStateAction<ImageFile[]>>;
  setUpscalingStates: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setRegeneratingStates: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setGenerationStatus: React.Dispatch<React.SetStateAction<{ active: boolean; progress: number; total: number; message: string }>>;
  setError: (e: string | null) => void;
}

export interface UsePoseChangerEngineReturn {
  handleGenerate: () => Promise<void>;
  handleRegenerateSingle: (index: number) => Promise<void>;
}

const IDLE_GENERATION_STATUS = { active: false, progress: 0, total: 0, message: '' };

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({ onStatusUpdate });

const createEditConfig = (onStatusUpdate?: (message: string) => void) =>
  buildImageServiceConfig(onStatusUpdate || (() => {}));

const performEdit = async (
  driver: PoseImageDriver,
  prompt: string,
  images: ImageFile[],
  imageEditModel: string,
  negativePrompt: string,
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  onStatus?: (message: string) => void
) => {
  const [result] = await driver.editImage(
    { images, prompt, negativePrompt, numberOfImages: 1, aspectRatio, resolution },
    imageEditModel,
    createEditConfig(onStatus),
  );
  return result;
};

export const usePoseChangerEngine = (config: UsePoseChangerEngineConfig): UsePoseChangerEngineReturn => {
  const {
    driver,
    customPosePrompt,
    subjectImage,
    poseReferenceImage,
    negativePrompt,
    aspectRatio,
    resolution,
    imageEditModel,
    t,
    allPrompts,
    getFramingInstruction,
    setGeneratedImages,
    setUpscalingStates,
    setRegeneratingStates,
    setIsLoading,
    setGenerationStatus,
    setError,
  } = config;

  const handleGenerate = useCallback(async () => {
    if (!subjectImage) {
      setError(t('pose.subjectError'));
      return;
    }

    const framingInstruction = getFramingInstruction();

    if (poseReferenceImage) {
      setError(null);
      setGeneratedImages([]);
      setRegeneratingStates({});
      setIsLoading(true);
      setGenerationStatus({ active: true, progress: 1, total: 1, message: t('pose.generatingStatusOne') });

      try {
        const result = await performEdit(driver, buildReferencePosePrompt(customPosePrompt, framingInstruction), [subjectImage, poseReferenceImage], imageEditModel, negativePrompt, aspectRatio, resolution, (message) => setGenerationStatus((prev) => ({ ...prev, message })));
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

    setError(null);
    setGeneratedImages([]);
    setRegeneratingStates({});
    setGenerationStatus({ active: true, progress: 0, total: allPrompts.length, message: '' });

    let results: ImageFile[] = [];
    for (const [index, promptText] of allPrompts.entries()) {
      setGenerationStatus((prev) => ({
        ...prev,
        progress: index + 1,
        message: t('pose.generatingStatusMultiple', { progress: index + 1, total: allPrompts.length }),
      }));

      try {
        const result = await performEdit(driver, buildTextPosePrompt(promptText, framingInstruction), [subjectImage], imageEditModel, negativePrompt, aspectRatio, resolution);
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
  }, [
    subjectImage,
    poseReferenceImage,
    customPosePrompt,
    negativePrompt,
    aspectRatio,
    resolution,
    imageEditModel,
    t,
    allPrompts,
    getFramingInstruction,
    setGeneratedImages,
    setRegeneratingStates,
    setIsLoading,
    setGenerationStatus,
    setError,
    driver,
  ]);

  const handleRegenerateSingle = useCallback(async (index: number) => {
    const promptText = allPrompts[index];
    if (!promptText || !subjectImage || poseReferenceImage) {
      await handleGenerate();
      return;
    }

    setRegeneratingStates((prev) => ({ ...prev, [index]: true }));
    setError(null);

    try {
      const result = await performEdit(driver, buildTextPosePrompt(promptText, getFramingInstruction()), [subjectImage], imageEditModel, negativePrompt, aspectRatio, resolution);
      setGeneratedImages((prev) => prev.map((image, imageIndex) => (imageIndex === index ? result : image)));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setRegeneratingStates((prev) => ({ ...prev, [index]: false }));
    }
  }, [
    customPosePrompt,
    subjectImage,
    poseReferenceImage,
    t,
    setRegeneratingStates,
    setError,
    setGeneratedImages,
    handleGenerate,
  ]);

  return {
    handleGenerate,
    handleRegenerateSingle,
  };
};
