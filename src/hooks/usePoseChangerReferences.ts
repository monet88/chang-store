/**
 * Pose input / references state hook.
 *
 * Owns subject image, pose reference, library poses, camera framing,
 * aspect/resolution, negative prompt, and related setters.
 * Extracted to keep usePoseChanger under the line limit.
 */

import { useState, useMemo } from 'react';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getEnglishFramingInstruction } from '../utils/framingInstructions';

type CameraView = 'default' | 'fullBody' | 'halfBody' | 'kneesUp';

interface CameraViewOption {
  key: CameraView;
  label: string;
}

export interface UsePoseChangerReferencesReturn {
  subjectImage: ImageFile | null;
  setSubjectImage: (image: ImageFile | null) => void;
  poseReferenceImage: ImageFile | null;
  customPosePrompt: string;
  selectedLibraryPoses: string[];
  negativePrompt: string;
  setNegativePrompt: (prompt: string) => void;
  cameraView: CameraView;
  setCameraView: (view: CameraView) => void;
  cameraViewOptions: CameraViewOption[];
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  allPrompts: string[];
  totalPrompts: number;
  getFramingInstruction: () => string;
  handlePoseReferenceUpload: (file: ImageFile | null) => void;
  handleCustomPosePromptChange: (prompt: string) => void;
  handleConfirmSelection: (poses: string[]) => void;
}

export const usePoseChangerReferences = (): UsePoseChangerReferencesReturn => {
  const [subjectImage, setSubjectImage] = useState<ImageFile | null>(null);
  const [poseReferenceImage, setPoseReferenceImage] = useState<ImageFile | null>(null);
  const [customPosePrompt, setCustomPosePrompt] = useState('');
  const [selectedLibraryPoses, setSelectedLibraryPoses] = useState<string[]>([]);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cameraView, setCameraView] = useState<CameraView>('fullBody');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const { t } = useLanguage();

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

  const getFramingInstruction = () => getEnglishFramingInstruction(cameraView);

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

  return {
    subjectImage,
    setSubjectImage,
    poseReferenceImage,
    customPosePrompt,
    selectedLibraryPoses,
    negativePrompt,
    setNegativePrompt,
    cameraView,
    setCameraView,
    cameraViewOptions,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    allPrompts,
    totalPrompts,
    getFramingInstruction,
    handlePoseReferenceUpload,
    handleCustomPosePromptChange,
    handleConfirmSelection,
  };
};
