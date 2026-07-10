import { useEffect, useMemo, useRef, useState } from 'react';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import { PHOTO_ALBUM_POSES, PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';

import {
  usePhotoAlbumEngine,
  type PhotoAlbumImageDriver,
} from './usePhotoAlbumEngine';

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
  const FRAMES: Record<string, string> = t('photoAlbum.frames', { returnObjects: true });
  const BACKGROUND_LABELS: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
  const HAIR_STYLES: Record<string, string> = t('photoAlbum.hairStyles', { returnObjects: true });
  const SKIN_TONES: Record<string, string> = t('photoAlbum.skinTones', { returnObjects: true });

  // Default driver from real service; tests can inject a mock here.
  const driver = useMemo<PhotoAlbumImageDriver>(() => ({ editImage }), []);

  const engine = usePhotoAlbumEngine({
    driver,
    mode,
    originalPhoto,
    faceImage,
    outfitImage,
    aspectRatio,
    resolution,
    cameraView,
    selectedPoses,
    hairStyleLabel: HAIR_STYLES[hairStyle],
    skinToneLabel: SKIN_TONES[skinTone],
    frameLabel: frame !== 'none'
      ? `Apply a '${FRAMES[frame]}' style frame or border around the final image.`
      : 'Do not add any frame or border.',
    backgroundInstruction: background !== 'none'
      ? `Place the model in the following environment: "${PHOTO_ALBUM_BACKGROUNDS.find(b => b.id === background)?.prompt}"`
      : 'Keep the original background from the source image if possible, or create a simple, neutral studio background if one is not present.',
    footwearInstruction: t('photoAlbum.footwearInstructions'),
    additionalNotesInstruction: additionalNotes
      ? `- Also incorporate this instruction: "${additionalNotes}"`
      : '- No additional notes.',
    imageEditModel,
    t,
    setGeneratedImages,
    setIsLoading,
    setRegeneratingStates,
    setError,
    setGenerationStatus,
    setGenerationProgress,
  });

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

  const handleGenerate = engine.handleGenerate;

  const handleRegenerateSingle = engine.handleRegenerateSingle;

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
    POSES: PHOTO_ALBUM_POSES.map((pose) => pose.id),
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

// Re-export driver type for consumers/tests (matches pose-changer pattern)
export type { PhotoAlbumImageDriver } from './usePhotoAlbumEngine';
