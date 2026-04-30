import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ImageFile } from '../../src/types';

const testImage: ImageFile = { base64: 'model-image', mimeType: 'image/png' };
const usePhotoAlbumMock = vi.fn();

vi.mock('../../src/hooks/usePhotoAlbum', () => ({
  usePhotoAlbum: (...args: unknown[]) => usePhotoAlbumMock(...args),
}));

vi.mock('../../src/components/ImageUploader', () => ({
  default: ({ id, title, onImageUpload }: { id: string; title: string; onImageUpload: (image: ImageFile) => void }) => (
    <button type="button" onClick={() => onImageUpload(testImage)}>
      {title}::{id}
    </button>
  ),
}));

vi.mock('../../src/components/Spinner', () => ({
  default: () => <div>spinner</div>,
  ErrorDisplay: ({ title, message }: { title: string; message: string }) => <div>{title}:{message}</div>,
  ProgressBar: ({ progress, total }: { progress: number; total: number }) => <div>{progress}/{total}</div>,
}));

vi.mock('../../src/components/HoverableImage', () => ({
  default: ({ altText, onRegenerate }: { altText: string; onRegenerate?: () => void }) => (
    <div>
      <span>{altText}</span>
      {onRegenerate && (
        <button type="button" aria-label={`regenerate-${altText}`} onClick={onRegenerate}>
          regenerate
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../src/components/ImageOptionsPanel', () => ({
  default: () => <div>image-options</div>,
}));

vi.mock('../../src/components/shared/ResultPlaceholder', () => ({
  default: ({ description }: { description: string }) => <div>{description}</div>,
}));

import { PhotoAlbumCreator } from '../../src/components/PhotoAlbumCreator';

describe('PhotoAlbumCreator component', () => {
  const setMode = vi.fn();
  const setOriginalPhoto = vi.fn();
  const setFaceImage = vi.fn();
  const setOutfitImage = vi.fn();
  const setAspectRatio = vi.fn();
  const setResolution = vi.fn();
  const setFrame = vi.fn();
  const setBackground = vi.fn();
  const setSelectedPoses = vi.fn();
  const setAdditionalNotes = vi.fn();
  const setHairStyle = vi.fn();
  const setSkinTone = vi.fn();
  const handleStartOver = vi.fn();
  const handleGenerate = vi.fn();
  const handleRegenerateSingle = vi.fn();
  const clearError = vi.fn();

  const buildHookState = (overrides: Record<string, unknown> = {}) => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'photoAlbum.generateButton') return `Generate (${params?.count})`;
      if (key === 'photoAlbum.outputTitle') return 'Album Output';
      if (key === 'photoAlbum.startOver') return 'Start Over';
      if (key === 'photoAlbum.description') return 'Description';
      if (key === 'photoAlbum.title') return 'Create Photo Album';
      if (key === 'photoAlbum.choosePoses') return 'Choose Poses';
      if (key === 'photoAlbum.selectAll') return 'Select All';
      if (key === 'photoAlbum.clearSelection') return 'Clear Selection';
      if (key === 'photoAlbum.addons') return 'Add-ons';
      if (key === 'photoAlbum.chooseHair') return 'Hair';
      if (key === 'photoAlbum.chooseFrame') return 'Frame';
      if (key === 'photoAlbum.chooseBackground') return 'Background';
      if (key === 'photoAlbum.additionalNotes') return 'Notes';
      if (key === 'photoAlbum.additionalNotesPlaceholder') return 'Notes placeholder';
      if (key === 'photoAlbum.originalPhoto') return 'Original Photo';
      if (key === 'photoAlbum.faceImage') return 'Face Image';
      if (key === 'photoAlbum.outfitImage') return 'Outfit Image';
      if (key === 'photoAlbum.mode.fullModel') return 'Full Model';
      if (key === 'photoAlbum.mode.faceAndOutfit') return 'Face and Outfit';
      if (key === 'common.generationFailed') return 'Generation Failed';
      if (key === 'photoAlbum.outputPanelDescription') return 'Empty output';
      return key;
    },
    imageEditModel: 'gemini-2.5-flash-image',
    mode: 'fullModel',
    setMode,
    originalPhoto: null,
    setOriginalPhoto,
    faceImage: null,
    setFaceImage,
    outfitImage: null,
    setOutfitImage,
    aspectRatio: '9:16',
    setAspectRatio,
    resolution: '2K',
    setResolution,
    frame: 'none',
    setFrame,
    background: 'none',
    setBackground,
    selectedPoses: ['pose_1', 'pose_2'],
    setSelectedPoses,
    additionalNotes: '',
    setAdditionalNotes,
    hairStyle: 'long_straight_black',
    setHairStyle,
    skinTone: 'fair_smooth',
    setSkinTone,
    generatedImages: [],
    isLoading: false,
    regeneratingStates: {},
    error: null,
    generationStatus: '',
    generationProgress: { progress: 0, total: 0 },
    POSE_LABELS: { pose_1: 'Pose 1', pose_2: 'Pose 2' },
    POSES: ['pose_1', 'pose_2'],
    FRAMES: { none: 'None' },
    BACKGROUND_LABELS: { none: 'None' },
    HAIR_STYLES: { long_straight_black: 'Long Straight Black' },
    SKIN_TONES: { fair_smooth: 'Fair Smooth' },
    handleStartOver,
    handleGenerate,
    handleRegenerateSingle,
    clearError,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    usePhotoAlbumMock.mockReturnValue(buildHookState());
  });

  it('renders shell and triggers generate action', async () => {
    const user = userEvent.setup();
    render(<PhotoAlbumCreator />);

    expect(screen.getByText('Create Photo Album')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate (2)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate (2)' }));
    expect(handleGenerate).toHaveBeenCalledTimes(1);
  });

  it('switches modes through hook setter', async () => {
    const user = userEvent.setup();
    render(<PhotoAlbumCreator />);

    await user.click(screen.getByRole('button', { name: 'Face and Outfit' }));
    expect(setMode).toHaveBeenCalledWith('faceAndOutfit');
  });

  it('calls regenerate handler for selected pose result', async () => {
    const user = userEvent.setup();
    usePhotoAlbumMock.mockReturnValueOnce(buildHookState({
      generatedImages: [{ base64: 'album-1', mimeType: 'image/png', pose: 'pose_1' }],
      selectedPoses: ['pose_1'],
    }));

    render(<PhotoAlbumCreator />);
    await user.click(screen.getByRole('button', { name: 'regenerate-Pose 1' }));
    expect(handleRegenerateSingle).toHaveBeenCalledWith('pose_1');
  });

  it('calls start over action when results exist', async () => {
    const user = userEvent.setup();
    usePhotoAlbumMock.mockReturnValueOnce(buildHookState({
      generatedImages: [{ base64: 'album-1', mimeType: 'image/png', pose: 'pose_1' }],
      selectedPoses: ['pose_1'],
    }));

    render(<PhotoAlbumCreator />);
    await user.click(screen.getByRole('button', { name: 'Start Over' }));
    expect(handleStartOver).toHaveBeenCalledTimes(1);
  });
});
