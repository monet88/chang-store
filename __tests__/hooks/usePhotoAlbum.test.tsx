import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageFile, Job, JobResult } from '../../src/types';
import { DEFAULT_IMAGE_RESOLUTION } from '../../src/types';

const submitJobMock = vi.fn();
const pollJobMock = vi.fn();
const getJobResultsMock = vi.fn();
const downloadJobResultBlobMock = vi.fn();

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

vi.mock('../../src/services/jobService', () => ({
  submitJob: (...args: unknown[]) => submitJobMock(...args),
  pollJob: (...args: unknown[]) => pollJobMock(...args),
  getJobResults: (...args: unknown[]) => getJobResultsMock(...args),
  downloadJobResultBlob: (...args: unknown[]) => downloadJobResultBlobMock(...args),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

import { usePhotoAlbum } from '../../src/hooks/usePhotoAlbum';

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

function makeJob(id: string, status: Job['status'] = 'completed', errorMessage: string | null = null): Job {
  return {
    id,
    user_id: 'demo',
    feature: 'photo-album',
    status,
    idempotency_key: `key-${id}`,
    input_payload_json: {},
    workflow_run_id: null,
    progress_total: 1,
    progress_done: status === 'completed' ? 1 : 0,
    created_at: '2026-01-01T00:00:00.000Z',
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: status === 'completed' ? '2026-01-01T00:00:01.000Z' : null,
    error_code: errorMessage ? 'FAILED' : null,
    error_message: errorMessage,
  };
}

function makeResult(jobId: string, blobPath: string, mimeType = 'image/png'): JobResult {
  return {
    id: `${jobId}-${blobPath}`,
    job_id: jobId,
    kind: 'output',
    blob_path: blobPath,
    mime_type: mimeType,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('usePhotoAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(submitJobMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Please select at least one pose.');
  });

  it('generates all selected poses with full-model prompt details', async () => {
    submitJobMock
      .mockResolvedValueOnce(makeJob('job-1'))
      .mockResolvedValueOnce(makeJob('job-2'));
    getJobResultsMock
      .mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] })
      .mockResolvedValueOnce({ job: makeJob('job-2'), results: [makeResult('job-2', 'blob-2')] });
    downloadJobResultBlobMock
      .mockResolvedValueOnce(GENERATED_POSE_ONE.base64)
      .mockResolvedValueOnce(GENERATED_POSE_TWO.base64);

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

    expect(submitJobMock).toHaveBeenCalledTimes(2);
    expect(submitJobMock.mock.calls[0]?.[0]).toBe('photo-album');
    expect(submitJobMock.mock.calls[0]?.[1]).toMatchObject({
      images: [ORIGINAL_IMAGE.base64],
      aspectRatio: '9:16',
      resolution: DEFAULT_IMAGE_RESOLUTION,
    });
    expect(submitJobMock.mock.calls[0]?.[1]?.prompt).toContain('Source Image');
    expect(submitJobMock.mock.calls[0]?.[1]?.prompt).toContain('Standing straight, facing camera, arms relaxed');
    expect(submitJobMock.mock.calls[0]?.[1]?.prompt).toContain('A minimalist photography studio.');
    expect(submitJobMock.mock.calls[0]?.[1]?.prompt).toContain('Long Straight Black');
    expect(submitJobMock.mock.calls[0]?.[1]?.prompt).toContain('Fair Smooth');
    expect(submitJobMock.mock.calls[0]?.[1]?.prompt).toContain('Keep the styling soft');
    expect(submitJobMock.mock.calls[1]?.[1]?.prompt).toContain('Standing confidently, one hand on hip');
    expect(result.current.generatedImages).toEqual([
      { ...GENERATED_POSE_ONE, pose: 'pose_1' },
      { ...GENERATED_POSE_TWO, pose: 'pose_2' },
    ]);
    expect(result.current.generationProgress).toEqual({ progress: 2, total: 2 });
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps earlier generated poses when later pose fails', async () => {
    submitJobMock
      .mockResolvedValueOnce(makeJob('job-1'))
      .mockRejectedValueOnce(new Error('pose generation exploded'));
    getJobResultsMock.mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] });
    downloadJobResultBlobMock.mockResolvedValueOnce(GENERATED_POSE_ONE.base64);

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

  it('includes camera framing and background directives in prompt', async () => {
    submitJobMock.mockResolvedValueOnce(makeJob('job-1'));
    getJobResultsMock.mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] });
    downloadJobResultBlobMock.mockResolvedValueOnce(GENERATED_POSE_ONE.base64);

    const { result } = renderHook(() => usePhotoAlbum());

    act(() => {
      result.current.setOriginalPhoto(ORIGINAL_IMAGE);
      result.current.setSelectedPoses(['pose_1']);
      result.current.setCameraView('fullBody');
      result.current.setBackground('studioMirrorChair');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    const prompt = submitJobMock.mock.calls[0]?.[1]?.prompt as string;
    expect(prompt).toContain('Full body framing');
    expect(prompt).toContain('A minimalist photography studio.');
    expect(prompt).not.toContain('Keep the original background');
  });

  it('uses face and outfit references in face-and-outfit mode', async () => {
    submitJobMock.mockResolvedValueOnce(makeJob('job-1'));
    getJobResultsMock.mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] });
    downloadJobResultBlobMock.mockResolvedValueOnce(GENERATED_POSE_ONE.base64);

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

    const payload = submitJobMock.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      images: [FACE_IMAGE.base64, OUTFIT_IMAGE.base64],
    });
    expect(payload.prompt).toContain('Face Reference');
    expect(payload.prompt).toContain('Outfit Image');
    expect(payload.prompt).toContain("model's face, hair, and skin tone");
  });

  it('clears images and resets state on handleStartOver', async () => {
    submitJobMock.mockResolvedValueOnce(makeJob('job-1'));
    getJobResultsMock.mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] });
    downloadJobResultBlobMock.mockResolvedValueOnce(GENERATED_POSE_ONE.base64);

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
    submitJobMock
      .mockResolvedValueOnce(makeJob('job-1'))
      .mockRejectedValueOnce(new Error('regenerate failed'));
    getJobResultsMock.mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] });
    downloadJobResultBlobMock.mockResolvedValueOnce(GENERATED_POSE_ONE.base64);

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

  it('uses face and outfit references when regenerating a pose', async () => {
    submitJobMock
      .mockResolvedValueOnce(makeJob('job-1'))
      .mockResolvedValueOnce(makeJob('job-2'));
    getJobResultsMock
      .mockResolvedValueOnce({ job: makeJob('job-1'), results: [makeResult('job-1', 'blob-1')] })
      .mockResolvedValueOnce({ job: makeJob('job-2'), results: [makeResult('job-2', 'blob-2')] });
    downloadJobResultBlobMock
      .mockResolvedValueOnce(GENERATED_POSE_ONE.base64)
      .mockResolvedValueOnce(REGENERATED_POSE_ONE.base64);

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

    expect(submitJobMock.mock.calls[0]?.[1]).toMatchObject({
      images: [FACE_IMAGE.base64, OUTFIT_IMAGE.base64],
    });
    expect(submitJobMock.mock.calls[1]?.[1]).toMatchObject({
      images: [FACE_IMAGE.base64, OUTFIT_IMAGE.base64],
    });
    expect(result.current.generatedImages).toEqual([
      { ...REGENERATED_POSE_ONE, pose: 'pose_1' },
    ]);
    expect(result.current.regeneratingStates.pose_1).toBe(false);
  });
});
