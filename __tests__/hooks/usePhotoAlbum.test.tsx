import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageFile } from '../../src/types';

const editImageMock = vi.fn();

const poseLabels = {
  pose_1: 'Pose 1',
  pose_2: 'Pose 2',
};

const frames = {
  none: 'None',
  editorial: 'Editorial Frame',
};

const backgroundLabels = {
  none: 'None',
  studioMirrorChair: 'Studio Mirror Chair',
};

const hairStyles = {
  long_straight_black: 'Long Straight Black',
};

const skinTones = {
  fair_smooth: 'Fair Smooth',
};

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'photoAlbum.poseLabels' && params?.returnObjects) return poseLabels;
      if (key === 'photoAlbum.frames' && params?.returnObjects) return frames;
      if (key === 'photoAlbum.backgroundLabels' && params?.returnObjects) return backgroundLabels;
      if (key === 'photoAlbum.hairStyles' && params?.returnObjects) return hairStyles;
      if (key === 'photoAlbum.skinTones' && params?.returnObjects) return skinTones;
      if (key === 'photoAlbum.footwearInstructions') return 'Keep original footwear';
      if (key === 'framingInstructions.fullBody') return 'Full body framing';
      if (key === 'photoAlbum.generatingStatus') return `Generating ${params?.progress}/${params?.total}`;
      if (key === 'photoAlbum.error.noPhoto') return 'Please upload the original photo.';
      if (key === 'photoAlbum.error.noFaceOrOutfit') return 'Please upload both a face and an outfit image.';
      if (key === 'photoAlbum.error.noPose') return 'Please select at least one pose.';
      if (key === 'photoAlbum.error.generationFailed') return `${params?.pose}:${params?.error}`;
      return key;
    },
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
  }),
}));

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: (...args: unknown[]) => editImageMock(...args),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

import { usePhotoAlbum } from '../../src/hooks/usePhotoAlbum';
import { DEFAULT_IMAGE_RESOLUTION } from '../../src/types';

const ORIGINAL_IMAGE: ImageFile = {
  base64: 'b3JpZ2luYWw=',
  mimeType: 'image/png',
};

const FACE_IMAGE: ImageFile = {
  base64: 'ZmFjZQ==',
  mimeType: 'image/png',
};

const OUTFIT_IMAGE: ImageFile = {
  base64: 'b3V0Zml0',
  mimeType: 'image/png',
};

const GENERATED_POSE_ONE: ImageFile = {
  base64: 'cG9zZS0x',
  mimeType: 'image/png',
};

const GENERATED_POSE_TWO: ImageFile = {
  base64: 'cG9zZS0y',
  mimeType: 'image/png',
};

const REGENERATED_POSE_ONE: ImageFile = {
  base64: 'cG9zZS0xLW5ldw==',
  mimeType: 'image/png',
};

describe('usePhotoAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editImageMock.mockReset();
  });

  it('consumes transferred outfit image once, then allows it to be consumed again after reset', () => {
    const consumed = vi.fn();
    const transferredImage: ImageFile = { base64: 'dHJhbnNmZXJyZWQ=', mimeType: 'image/png' };

    const { result, rerender } = renderHook(
      ({ image, onTransferConsumed }: { image?: ImageFile; onTransferConsumed?: () => void }) =>
        usePhotoAlbum({ transferredImage: image, onTransferConsumed }),
      {
        initialProps: {
          image: transferredImage,
          onTransferConsumed: () => consumed('first'),
        },
      },
    );

    expect(result.current.mode).toBe('faceAndOutfit');
    expect(result.current.outfitImage).toEqual(transferredImage);
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(consumed).toHaveBeenCalledWith('first');

    rerender({ image: transferredImage, onTransferConsumed: () => consumed('second') });
    expect(consumed).toHaveBeenCalledTimes(1);

    rerender({ image: undefined, onTransferConsumed: () => consumed('reset') });
    rerender({ image: transferredImage, onTransferConsumed: () => consumed('third') });

    expect(consumed).toHaveBeenCalledTimes(2);
    expect(consumed).toHaveBeenLastCalledWith('third');
  });

  it('requires at least one selected pose before generation', async () => {
    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Please select at least one pose.');
  });

  it('generates all selected poses with the full-model prompt details', async () => {
    editImageMock
      .mockResolvedValueOnce([GENERATED_POSE_ONE])
      .mockResolvedValueOnce([GENERATED_POSE_TWO]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1', 'pose_2']);
      result.current.setBackground('studioMirrorChair');
      result.current.setFrame('editorial');
      result.current.setAdditionalNotes('Keep the styling soft');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock).toHaveBeenCalledTimes(2);
    expect(editImageMock.mock.calls[0]?.[0]).toMatchObject({
      images: [ORIGINAL_IMAGE],
      numberOfImages: 1,
      aspectRatio: '9:16',
      resolution: DEFAULT_IMAGE_RESOLUTION,
    });
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain("Source Image");
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('Standing straight, facing camera, arms relaxed');
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('A minimalist photography studio.');
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('Long Straight Black');
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('Fair Smooth');
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('Keep the styling soft');
    expect(editImageMock.mock.calls[1]?.[0]?.prompt).toContain('Standing confidently, one hand on hip');
    expect(result.current.generatedImages).toEqual([
      { ...GENERATED_POSE_ONE, pose: 'pose_1' },
      { ...GENERATED_POSE_TWO, pose: 'pose_2' },
    ]);
    expect(result.current.generationProgress).toEqual({ progress: 2, total: 2 });
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps earlier generated poses when a later pose fails', async () => {
    editImageMock
      .mockResolvedValueOnce([GENERATED_POSE_ONE])
      .mockRejectedValueOnce(new Error('pose generation exploded'));

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1', 'pose_2']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.generatedImages).toEqual([
      { ...GENERATED_POSE_ONE, pose: 'pose_1' },
    ]);
    expect(result.current.error).toBe('pose_2:pose generation exploded');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns mode-specific error for fullModel without original photo', async () => {
    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setSelectedPoses(['pose_1']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Please upload the original photo.');
  });

  it('returns mode-specific error for faceAndOutfit without face or outfit', async () => {
    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setMode('faceAndOutfit');
      result.current.setSelectedPoses(['pose_1']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Please upload both a face and an outfit image.');
  });

  it('includes camera view framing instruction in prompt when not default', async () => {
    editImageMock.mockResolvedValueOnce([GENERATED_POSE_ONE]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
      result.current.setCameraView('halfBody');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock).toHaveBeenCalledTimes(1);
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('For half-body shots, crop tightly at the thigh/hip level');
  });

  it('inserts background prompt when background is not none', async () => {
    editImageMock.mockResolvedValueOnce([GENERATED_POSE_ONE]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
      result.current.setBackground('studioMirrorChair');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('A minimalist photography studio.');
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).not.toContain('Keep the original background');
  });

  it('keeps original background language when background is none', async () => {
    editImageMock.mockResolvedValueOnce([GENERATED_POSE_ONE]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
      result.current.setBackground('none');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('Keep the original background');
  });

  it('shows faceAndOutfit image roles when regenerating in that mode', async () => {
    editImageMock.mockResolvedValueOnce([GENERATED_POSE_ONE]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setMode('faceAndOutfit');
      result.current.setFaceImage(FACE_IMAGE);
      result.current.setOutfitImage(OUTFIT_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    const prompt = editImageMock.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain('Face Reference');
    expect(prompt).toContain('Outfit Image');
    expect(prompt).toContain("model's face, hair, and skin tone");
  });

  it('clears images and resets state on handleStartOver', async () => {
    editImageMock.mockResolvedValueOnce([GENERATED_POSE_ONE]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.generatedImages).toHaveLength(1);

    act(() => {
      result.current.handleStartOver();
    });

    expect(result.current.generatedImages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.aspectRatio).toBe('9:16');
  });

  it('handles regenerate failure without losing previous images', async () => {
    editImageMock
      .mockResolvedValueOnce([GENERATED_POSE_ONE])
      .mockRejectedValueOnce(new Error('regenerate failed'));

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.generatedImages).toEqual([{ ...GENERATED_POSE_ONE, pose: 'pose_1' }]);

    await act(async () => {
      await result.current.handleRegenerateSingle('pose_1');
    });

    expect(result.current.generatedImages).toEqual([{ ...GENERATED_POSE_ONE, pose: 'pose_1' }]);
    expect(result.current.error).toBe('pose_1:regenerate failed');
    expect(result.current.regeneratingStates.pose_1).toBe(false);
  });

  it('uses face and outfit references when regenerating a pose in face-and-outfit mode', async () => {
    editImageMock
      .mockResolvedValueOnce([GENERATED_POSE_ONE])
      .mockResolvedValueOnce([REGENERATED_POSE_ONE]);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setMode('faceAndOutfit');
      result.current.setFaceImage(FACE_IMAGE);
      result.current.setOutfitImage(OUTFIT_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleRegenerateSingle('pose_1');
    });

    expect(editImageMock.mock.calls[0]?.[0]).toMatchObject({
      images: [FACE_IMAGE, OUTFIT_IMAGE],
      numberOfImages: 1,
    });
    expect(editImageMock.mock.calls[0]?.[0]?.prompt).toContain('Face Reference');
    expect(editImageMock.mock.calls[1]?.[0]).toMatchObject({
      images: [FACE_IMAGE, OUTFIT_IMAGE],
      numberOfImages: 1,
    });
    expect(result.current.generatedImages).toEqual([
      { ...REGENERATED_POSE_ONE, pose: 'pose_1' },
    ]);
    expect(result.current.regeneratingStates.pose_1).toBe(false);
  });
});