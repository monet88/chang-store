import { useCallback, useEffect, useRef, useState } from 'react';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
// import { editImage } from '../services/imageEditingService';
import { submitJob, pollJob, getJobResults, downloadJobResultBlob } from '../services/jobService';
import { getErrorMessage } from '../utils/imageUtils';
import { setSharedJobState } from './useJobPoll';
import { PHOTO_ALBUM_POSES, PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';

export type GenerationMode = 'fullModel' | 'faceAndOutfit';

export interface GeneratedAlbumImage extends ImageFile {
  pose: string;
}

interface UsePhotoAlbumParams {
  transferredImage?: ImageFile;
  onTransferConsumed?: () => void;
}

export const usePhotoAlbum = ({ transferredImage, onTransferConsumed }: UsePhotoAlbumParams = {}) => {
  const { t } = useLanguage();
  const { imageEditModel } = useApi();

  const [mode, setMode] = useState<GenerationMode>('fullModel');
  const [originalPhoto, setOriginalPhoto] = useState<ImageFile | null>(null);
  const [faceImage, setFaceImage] = useState<ImageFile | null>(null);
  const [outfitImage, setOutfitImage] = useState<ImageFile | null>(null);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  const [cameraView, setCameraView] = useState<string>('fullBody');
  const [frame, setFrame] = useState('none');
  const [background, setBackground] = useState('none');
  const [selectedPoses, setSelectedPoses] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [hairStyle, setHairStyle] = useState('long_straight_black');
  const [skinTone, setSkinTone] = useState('fair_smooth');

  const [generatedImages, setGeneratedImages] = useState<GeneratedAlbumImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [regeneratingStates, setRegeneratingStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState({ progress: 0, total: 0 });
  const consumedTransferredImageRef = useRef<ImageFile | undefined>(undefined);

  const POSE_LABELS: Record<string, string> = t('photoAlbum.poseLabels', { returnObjects: true });
  const POSES: string[] = PHOTO_ALBUM_POSES.map((pose) => pose.id);
  const FRAMES: Record<string, string> = t('photoAlbum.frames', { returnObjects: true });
  const BACKGROUND_LABELS: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
  const BACKGROUND_PROMPTS = PHOTO_ALBUM_BACKGROUNDS.reduce((acc, curr) => {
    acc[curr.id] = curr.prompt;
    return acc;
  }, {} as Record<string, string>);
  const HAIR_STYLES: Record<string, string> = t('photoAlbum.hairStyles', { returnObjects: true });
  const SKIN_TONES: Record<string, string> = t('photoAlbum.skinTones', { returnObjects: true });

  useEffect(() => {
    if (!transferredImage) {
      consumedTransferredImageRef.current = undefined;
      return;
    }

    if (consumedTransferredImageRef.current === transferredImage) {
      return;
    }

    consumedTransferredImageRef.current = transferredImage;
    setOutfitImage(transferredImage);
    setMode('faceAndOutfit');
    onTransferConsumed?.();
  }, [onTransferConsumed, transferredImage]);

  const handleStartOver = () => {
    setGeneratedImages([]);
    setError(null);
    setIsLoading(false);
    setAspectRatio('9:16');
    setResolution(DEFAULT_IMAGE_RESOLUTION);
  };

  const waitForJob = useCallback(async (jobId: string) => {
    while (true) {
      const j = await pollJob(jobId);
      setSharedJobState({
        job: j,
        isPolling: j.status === 'queued' || j.status === 'running',
        error: j.status === 'failed' ? j.error_message || 'Job failed' : null,
      });
      if (j.status === 'completed' || j.status === 'partial') return j;
      if (j.status === 'failed') throw new Error(j.error_message || 'Job failed');
      await new Promise(r => setTimeout(r, 2000));
    }
  }, []);

  const fetchJobImages = useCallback(async (jobId: string): Promise<ImageFile[]> => {
    const { results } = await getJobResults(jobId);
    const outputs = results.filter(r => r.kind === 'output');
    const images: ImageFile[] = [];
    for (const r of outputs) {
      const b64 = await downloadJobResultBlob(r.blob_path);
      images.push({ base64: b64, mimeType: r.mime_type });
    }
    return images;
  }, []);

  const generateImageForPose = useCallback(async (pose: string): Promise<GeneratedAlbumImage> => {
    const imagesForApi: ImageFile[] = [];
    let imageRolesPrompt = '';

    if (mode === 'fullModel' && originalPhoto) {
      imagesForApi.push(originalPhoto);
      imageRolesPrompt = "**Image Role**: The provided image ('Source Image') contains the model, their outfit, footwear, and potentially a background. Your task is to extract the model, their clothing, and footwear, then place them in a new scene.";
    } else if (mode === 'faceAndOutfit' && faceImage && outfitImage) {
      imagesForApi.push(faceImage, outfitImage);
      imageRolesPrompt = "**Image Roles**:\n- **Image 1 ('Face Reference')**: Provides the model's face, hair, and skin tone. This is the source of truth for identity.\n- **Image 2 ('Outfit Image')**: Provides the clothing and footwear to be worn by the model.";
    }

    const framingInstruction = cameraView !== 'default'
      ? t(`framingInstructions.${cameraView}`)
      : 'Use default framing provided by the model.';

    const prompt = `
# INSTRUCTION: CREATE PHOTO ALBUM IMAGE

## 1. IMAGE ROLES
${imageRolesPrompt}

## 2. CRITICAL RULES (MUST FOLLOW)
- **Identity Preservation**: Flawlessly preserve the person’s facial features, hairstyle, and skin tone from the reference image. The resemblance must be perfect.
- **Outfit Application**:
    - If using 'Face Reference' and 'Outfit Image', dress the model in the complete outfit and footwear from the 'Outfit Image'. Preserve the outfit and footwear design, color, texture, and fit with 100% accuracy.
    - If using a single 'Source Image', use the outfit and footwear the model is already wearing. Ensure the footwear matches the original image exactly.
- **New Pose**: The model's new pose MUST be: "${PHOTO_ALBUM_POSES.find((photoAlbumPose) => photoAlbumPose.id === pose)?.prompt || pose}".
- **Model Details**:
    - **Hair Style**: ${HAIR_STYLES[hairStyle]}
    - **Skin Tone**: ${SKIN_TONES[skinTone]}
    - **Footwear**: ${t('photoAlbum.footwearInstructions')}

## 3. SCENE COMPOSITION
- **Background**: ${background !== 'none' ? `Place the model in the following environment: "${BACKGROUND_PROMPTS[background]}"` : 'Keep the original background from the source image if possible, or create a simple, neutral studio background if one is not present.'}
- **Camera & Framing**: The shot must adhere to this framing: "${framingInstruction}".
- **Frame/Border**: ${frame !== 'none' ? `Apply a '${FRAMES[frame]}' style frame or border around the final image.` : 'Do not add any frame or border.'}

## 4. ADDITIONAL NOTES
${additionalNotes ? `- Also incorporate this instruction: "${additionalNotes}"` : '- No additional notes.'}

## 5. FINAL OUTPUT
Generate a single, hyper-realistic, 2K resolution, professional-grade fashion photograph that perfectly combines all the above elements.
    `.trim();

    const newJob = await submitJob('photo-album', {
      images: imagesForApi.map(img => img.base64),
      prompt,
      aspectRatio,
      resolution,
    });
    setSharedJobState({ job: newJob, isPolling: true, error: null });

    if (newJob.status === 'failed') {
      setSharedJobState({ job: newJob, isPolling: false, error: newJob.error_message || 'Job failed' });
      throw new Error(newJob.error_message || 'Job failed');
    }

    let completedJob = newJob;
    if (newJob.status !== 'completed' && newJob.status !== 'partial') {
      completedJob = await waitForJob(newJob.id);
    }
    setSharedJobState({ job: completedJob, isPolling: false, error: null });

    const outputImages = await fetchJobImages(newJob.id);
    if (outputImages.length === 0) {
      throw new Error('No output image generated');
    }

    return { ...outputImages[0], pose };
  }, [aspectRatio, resolution, mode, originalPhoto, faceImage, outfitImage, cameraView, hairStyle, skinTone, background, frame, additionalNotes, t, waitForJob, fetchJobImages]);

  const getModeInputError = () => {
    if (mode === 'fullModel' && !originalPhoto) {
      return t('photoAlbum.error.noPhoto');
    }
    if (mode === 'faceAndOutfit' && (!faceImage || !outfitImage)) {
      return t('photoAlbum.error.noFaceOrOutfit');
    }

    return null;
  };

  const handleGenerate = async () => {
    const inputError = getModeInputError();
    if (inputError) {
      setError(inputError);
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

  const handleRegenerateSingle = async (pose: string) => {
    const inputError = getModeInputError();
    if (inputError) {
      setError(inputError);
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
    t,
    imageEditModel,

    mode,
    setMode,
    originalPhoto,
    setOriginalPhoto,
    faceImage,
    setFaceImage,
    outfitImage,
    setOutfitImage,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    cameraView,
    setCameraView,
    frame,
    setFrame,
    background,
    setBackground,
    selectedPoses,
    setSelectedPoses,
    additionalNotes,
    setAdditionalNotes,
    hairStyle,
    setHairStyle,
    skinTone,
    setSkinTone,
    generatedImages,
    isLoading,
    regeneratingStates,
    error,
    generationStatus,
    generationProgress,

    POSE_LABELS,
    POSES,
    FRAMES,
    BACKGROUND_LABELS,
    HAIR_STYLES,
    SKIN_TONES,

    handleStartOver,
    handleGenerate,
    handleRegenerateSingle,
    clearError: () => setError(null),
  };
};
