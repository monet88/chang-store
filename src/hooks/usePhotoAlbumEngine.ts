import type { Dispatch, SetStateAction } from 'react';

import { AspectRatio, ImageFile, ImageResolution } from '../types';
import { editImage } from '../services/imageEditingService';
import type { ImageDriver, GenerateJob, ReferenceRoleImage } from '../services/providers/ImageDriver';
import { getErrorMessage } from '../utils/imageUtils';
import { buildPhotoAlbumPrompt } from '../utils/photo-album-prompt-builder';
import { PHOTO_ALBUM_POSES } from '../utils/photoAlbumConfig';
import { getEnglishFramingInstruction } from '../utils/framingInstructions';

/**
 * Image driver seam for Photo Album generation.
 * Accepts canonical ImageDriver or legacy driver for test compatibility.
 */
export type PhotoAlbumImageDriver = ImageDriver | {
  editImage?: typeof editImage;
  generate?: (job: GenerateJob) => Promise<ImageFile[]>;
  generateOne?: (job: GenerateJob) => Promise<ImageFile>;
};

type GenerationMode = 'fullModel' | 'faceAndOutfit';

interface GeneratedAlbumImage extends ImageFile {
  pose: string;
}

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
  onStatusUpdate,
});

export interface UsePhotoAlbumEngineConfig {
  driver: PhotoAlbumImageDriver;
  mode: GenerationMode;
  originalPhoto: ImageFile | null;
  faceImage: ImageFile | null;
  outfitImage: ImageFile | null;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  cameraView: string;
  selectedPoses: string[];
  hairStyleLabel: string;
  skinToneLabel: string;
  frameLabel: string;
  backgroundInstruction: string;
  footwearInstruction: string;
  additionalNotesInstruction: string;
  imageEditModel: string;
  t: (key: string, options?: any) => string;
  setGeneratedImages: Dispatch<SetStateAction<GeneratedAlbumImage[]>>;
  setIsLoading: (value: boolean) => void;
  setRegeneratingStates: Dispatch<SetStateAction<Record<string, boolean>>>;
  setError: (e: string | null) => void;
  setGenerationStatus: Dispatch<SetStateAction<string>>;
  setGenerationProgress: Dispatch<SetStateAction<{ progress: number; total: number }>>;
}

export interface UsePhotoAlbumEngineReturn {
  handleGenerate: () => Promise<void>;
  handleRegenerateSingle: (pose: string) => Promise<void>;
}

/**
 * Photo Album generation engine.
 *
 * Owns generateImageForPose, handleGenerate (batch over selected poses),
 * and handleRegenerateSingle. Receives current state values + setters + driver.
 * Keeps usePhotoAlbum (orchestrator) under the 200 LOC limit and provides a
 * driver seam for direct unit tests with mocks.
 */
export const usePhotoAlbumEngine = (config: UsePhotoAlbumEngineConfig): UsePhotoAlbumEngineReturn => {
  const {
    driver,
    mode,
    originalPhoto,
    faceImage,
    outfitImage,
    aspectRatio,
    resolution,
    cameraView,
    selectedPoses,
    hairStyleLabel,
    skinToneLabel,
    frameLabel,
    backgroundInstruction,
    footwearInstruction,
    additionalNotesInstruction,
    imageEditModel,
    t,
    setGeneratedImages,
    setIsLoading,
    setRegeneratingStates,
    setError,
    setGenerationStatus,
    setGenerationProgress,
  } = config;

  const generateImageForPose = async (pose: string): Promise<GeneratedAlbumImage> => {
    const imagesForApi: ImageFile[] = [];
    let imageRolesPrompt = '';

    if (mode === 'fullModel' && originalPhoto) {
      imagesForApi.push(originalPhoto);
      imageRolesPrompt = "**Image Role**: The provided image ('Source Image') contains the model, their outfit, footwear, and potentially a background. Your task is to extract the model, their clothing, and footwear, then place them in a new scene.";
    } else if (mode === 'faceAndOutfit' && faceImage && outfitImage) {
      imagesForApi.push(faceImage, outfitImage);
      imageRolesPrompt = "**Image Roles**:\n- **Image 1 ('Face Reference')**: Provides the model's face, hair, and skin tone. This is the source of truth for identity.\n- **Image 2 ('Outfit Image')**: Provides the clothing and footwear to be worn by the model.";
    }

    const framingInstruction = getEnglishFramingInstruction(cameraView);

    const prompt = buildPhotoAlbumPrompt({
      imageRolesPrompt,
      framingInstruction,
      poseInstruction: PHOTO_ALBUM_POSES.find((photoAlbumPose) => photoAlbumPose.id === pose)?.prompt || pose,
      hairStyle: hairStyleLabel,
      skinTone: skinToneLabel,
      footwearInstruction,
      backgroundInstruction,
      frameInstruction: frameLabel,
      additionalNotesInstruction,
    });

    const references: ReferenceRoleImage[] = [];
    if (mode === 'fullModel' && originalPhoto) {
      references.push({ image: originalPhoto, role: 'subject', label: 'full-model' });
    } else if (mode === 'faceAndOutfit' && faceImage && outfitImage) {
      references.push(
        { image: faceImage, role: 'subject', label: 'face-reference' },
        { image: outfitImage, role: 'garment', label: 'outfit-reference' },
      );
    }

    let result: ImageFile;
    if (typeof (driver as any).generateOne === 'function') {
      result = await (driver as any).generateOne({
        images: imagesForApi,
        prompt,
        references,
        aspectRatio,
        resolution,
        workflow: 'photo-album',
        model: imageEditModel,
        onProgress: setGenerationStatus,
      });
    } else if (typeof (driver as any).generate === 'function') {
      const results = await (driver as any).generate({
        images: imagesForApi,
        prompt,
        references,
        count: 1,
        aspectRatio,
        resolution,
        workflow: 'photo-album',
        model: imageEditModel,
        onProgress: setGenerationStatus,
      });
      result = results[0];
    } else {
      const [res] = await (driver as any).editImage(
        { images: imagesForApi, prompt, numberOfImages: 1, aspectRatio, resolution },
        imageEditModel,
        buildImageServiceConfig(setGenerationStatus),
      );
      result = res;
    }

    return { ...result, pose };
  };

  const validateModeInputs = (): boolean => {
    if (mode === 'fullModel' && !originalPhoto) {
      setError(t('photoAlbum.error.noPhoto'));
      return false;
    }
    if (mode === 'faceAndOutfit' && (!faceImage || !outfitImage)) {
      setError(t('photoAlbum.error.noFaceOrOutfit'));
      return false;
    }
    return true;
  };

  const handleGenerate = async (): Promise<void> => {
    if (!validateModeInputs()) {
      return;
    }
    if (selectedPoses.length === 0) {
      setError(t('photoAlbum.error.noPose'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setRegeneratingStates({});

    const POSES: string[] = PHOTO_ALBUM_POSES.map((pose) => pose.id);
    const posesToGenerate = POSES.filter((pose) => selectedPoses.includes(pose));
    const total = posesToGenerate.length;
    setGenerationProgress({ progress: 0, total });

    const newImages: GeneratedAlbumImage[] = [];

    for (const [index, pose] of posesToGenerate.entries()) {
      setGenerationStatus(t('photoAlbum.generatingStatus', { progress: index + 1, total }));
      setGenerationProgress({ progress: index + 1, total });

      try {
        const result = await generateImageForPose(pose);
        newImages.push(result);
        setGeneratedImages([...newImages]);
      } catch (err) {
        setError(t('photoAlbum.error.generationFailed', { pose, error: getErrorMessage(err, t) }));
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);
  };

  const handleRegenerateSingle = async (pose: string): Promise<void> => {
    if (!validateModeInputs()) {
      return;
    }
    setRegeneratingStates((prev) => ({ ...prev, [pose]: true }));
    setError(null);

    try {
      const regeneratedImage = await generateImageForPose(pose);
      setGeneratedImages((prev) => prev.map((image) => (image.pose === pose ? regeneratedImage : image)));
    } catch (err) {
      setError(t('photoAlbum.error.generationFailed', { pose, error: getErrorMessage(err, t) }));
    } finally {
      setRegeneratingStates((prev) => ({ ...prev, [pose]: false }));
    }
  };

  return {
    handleGenerate,
    handleRegenerateSingle,
  };
};
