import { useCallback, useRef } from 'react';
import { AspectRatio, ImageFile, ImageResolution } from '../types';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { useAiScan } from '../contexts/AiScanContext';
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
  /** Subject-owned source images the AI Scan layer deconstructs. */
  aiScanSources: ImageFile[];
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
    aiScanSources,
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

  const { scan } = useAiScan();

  // The scan runs before the first image request, so the busy state has to be
  // established first: otherwise Generate stays clickable for the whole
  // analysis and a second click starts a duplicate run. The ref guard closes
  // the gap the disabled button cannot see (two clicks in the same tick).
  const generationInFlight = useRef(false);

  const handleGenerate = useCallback(async () => {
    if (generationInFlight.current) return;
    if (!subjectImage) {
      setError(t('pose.subjectError'));
      return;
    }

    if (poseReferenceImage) {
      generationInFlight.current = true;
      setError(null);
      setGeneratedImages([]);
      setRegeneratingStates({});
      setIsLoading(true);
      setGenerationStatus({ active: true, progress: 1, total: 1, message: t('pose.generatingStatusOne') });

      try {
        const blueprint = (await scan(aiScanSources)) ?? '';
        const framingInstruction = getFramingInstruction();
        const result = await performEdit(driver, buildReferencePosePrompt(customPosePrompt, framingInstruction, blueprint), [subjectImage, poseReferenceImage], imageEditModel, negativePrompt, aspectRatio, resolution, (message) => setGenerationStatus((prev) => ({ ...prev, message })));
        setGeneratedImages([result]);
      } catch (err) {
        setError(getErrorMessage(err, t));
      } finally {
        generationInFlight.current = false;
        setIsLoading(false);
        setGenerationStatus(IDLE_GENERATION_STATUS);
      }
      return;
    }

    if (allPrompts.length === 0) {
      setError(t('pose.promptError'));
      return;
    }

    generationInFlight.current = true;
    setError(null);
    setGeneratedImages([]);
    setRegeneratingStates({});
    setGenerationStatus({ active: true, progress: 0, total: allPrompts.length, message: '' });

    try {
      const blueprint = (await scan(aiScanSources)) ?? '';
      const framingInstruction = getFramingInstruction();

      let results: ImageFile[] = [];
      for (const [index, promptText] of allPrompts.entries()) {
        setGenerationStatus((prev) => ({
          ...prev,
          progress: index + 1,
          message: t('pose.generatingStatusMultiple', { progress: index + 1, total: allPrompts.length }),
        }));

        try {
          const result = await performEdit(driver, buildTextPosePrompt(promptText, framingInstruction, blueprint), [subjectImage], imageEditModel, negativePrompt, aspectRatio, resolution);
          results = [...results, result];
          setGeneratedImages(results);
        } catch (err) {
          setError(t('pose.batchError', {
            index: index + 1,
            total: allPrompts.length,
            prompt: promptText.substring(0, 30),
            error: getErrorMessage(err, t),
          }));
          return;
        }
      }
    } finally {
      generationInFlight.current = false;
      setGenerationStatus(IDLE_GENERATION_STATUS);
    }
  }, [
    subjectImage,
    poseReferenceImage,
    customPosePrompt,
    negativePrompt,
    aspectRatio,
    resolution,
    imageEditModel,
    aiScanSources,
    scan,
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
      const blueprint = (await scan(aiScanSources)) ?? '';
      const result = await performEdit(driver, buildTextPosePrompt(promptText, getFramingInstruction(), blueprint), [subjectImage], imageEditModel, negativePrompt, aspectRatio, resolution);
      setGeneratedImages((prev) => prev.map((image, imageIndex) => (imageIndex === index ? result : image)));
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setRegeneratingStates((prev) => ({ ...prev, [index]: false }));
    }
  }, [
    allPrompts,
    subjectImage,
    poseReferenceImage,
    driver,
    imageEditModel,
    aiScanSources,
    scan,
    negativePrompt,
    aspectRatio,
    resolution,
    getFramingInstruction,
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
