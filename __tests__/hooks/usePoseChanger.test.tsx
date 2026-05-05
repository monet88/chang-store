import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/imageEditingService', () => ({
  upscaleImage: vi.fn(),
}));

vi.mock('../../src/services/jobService', () => ({
  submitJob: vi.fn(),
  pollJob: vi.fn(),
  getJobResults: vi.fn(),
  downloadJobResultBlob: vi.fn(),
}));

vi.mock('../../src/services/textService', () => ({
  generatePoseDescription: vi.fn(),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => (
      params ? `${key}:${JSON.stringify(params)}` : key
    ),
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
    textGenerateModel: 'gemini-2.5-pro',
  }),
}));

import { usePoseChanger } from '../../src/hooks/usePoseChanger';
import { upscaleImage } from '../../src/services/imageEditingService';
import { submitJob, getJobResults, downloadJobResultBlob } from '../../src/services/jobService';
import { generatePoseDescription } from '../../src/services/textService';

const SUBJECT_IMAGE = { base64: 'subject-image', mimeType: 'image/png' };
const POSE_REFERENCE_IMAGE = { base64: 'pose-reference', mimeType: 'image/jpeg' };
const GENERATED_IMAGE = { base64: 'generated-image', mimeType: 'image/png' };
const SECOND_GENERATED_IMAGE = { base64: 'generated-second', mimeType: 'image/png' };
const UPSCALED_IMAGE = { base64: 'upscaled-image', mimeType: 'image/png' };

const createCompletedJob = (id: string) => ({
  id,
  status: 'completed',
  error_message: null,
});

describe('usePoseChanger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitJob).mockResolvedValue(createCompletedJob('job-default') as never);
    vi.mocked(getJobResults).mockResolvedValue({
      results: [{ kind: 'output', blob_path: 'jobs/pose-default', mime_type: 'image/png' }],
    } as never);
    vi.mocked(downloadJobResultBlob).mockResolvedValue(GENERATED_IMAGE.base64);
  });

  it('generates a pose description from the uploaded reference image', async () => {
    vi.mocked(generatePoseDescription).mockResolvedValueOnce('one hand on hip');
    const { result } = renderHook(() => usePoseChanger());

    act(() => {
      result.current.handlePoseReferenceUpload(POSE_REFERENCE_IMAGE);
    });

    await act(async () => {
      await result.current.handleGeneratePoseDescription();
    });

    expect(generatePoseDescription).toHaveBeenCalledWith(
      POSE_REFERENCE_IMAGE,
      'gemini-2.5-pro',
    );
    expect(result.current.customPosePrompt).toBe('one hand on hip');
    expect(result.current.poseReferenceImage).toBeNull();
    expect(result.current.isGeneratingPoseDescription).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('uses the reference-image job path when a pose reference is present', async () => {
    vi.mocked(submitJob).mockResolvedValueOnce(createCompletedJob('job-ref') as never);
    vi.mocked(getJobResults).mockResolvedValueOnce({
      results: [{ kind: 'output', blob_path: 'jobs/pose-ref', mime_type: 'image/png' }],
    } as never);
    vi.mocked(downloadJobResultBlob).mockResolvedValueOnce(GENERATED_IMAGE.base64);

    const { result } = renderHook(() => usePoseChanger());

    act(() => {
      result.current.setSubjectImage(SUBJECT_IMAGE);
      result.current.handleCustomPosePromptChange('keep the left arm raised');
      result.current.setNegativePrompt('blurry');
      result.current.setAspectRatio('1:1');
      result.current.setResolution('4K');
      result.current.handlePoseReferenceUpload(POSE_REFERENCE_IMAGE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(submitJob).toHaveBeenCalledWith(
      'pose',
      expect.objectContaining({
        subjectImage: `data:${SUBJECT_IMAGE.mimeType};base64,${SUBJECT_IMAGE.base64}`,
        poseReferenceImage: `data:${POSE_REFERENCE_IMAGE.mimeType};base64,${POSE_REFERENCE_IMAGE.base64}`,
        negativePrompt: 'blurry',
        aspectRatio: '1:1',
        resolution: '4K',
        model: 'gemini-2.5-flash-image',
      }),
    );
    expect((vi.mocked(submitJob).mock.calls[0]?.[1] as { prompt: string }).prompt).toContain('Pose Reference Image');
    expect((vi.mocked(submitJob).mock.calls[0]?.[1] as { prompt: string }).prompt).toContain('keep the left arm raised');
    expect(result.current.generatedImages).toEqual([GENERATED_IMAGE]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.generationStatus.active).toBe(false);
  });

  it('keeps existing generated images when regenerate falls back with no prompts', async () => {
    vi.mocked(submitJob)
      .mockResolvedValueOnce(createCompletedJob('job-1') as never)
      .mockResolvedValueOnce(createCompletedJob('job-2') as never);

    vi.mocked(getJobResults)
      .mockResolvedValueOnce({
        results: [{ kind: 'output', blob_path: 'jobs/pose-1', mime_type: 'image/png' }],
      } as never)
      .mockResolvedValueOnce({
        results: [{ kind: 'output', blob_path: 'jobs/pose-2', mime_type: 'image/png' }],
      } as never);

    vi.mocked(downloadJobResultBlob)
      .mockResolvedValueOnce(GENERATED_IMAGE.base64)
      .mockResolvedValueOnce(SECOND_GENERATED_IMAGE.base64);

    const { result } = renderHook(() => usePoseChanger());

    act(() => {
      result.current.setSubjectImage(SUBJECT_IMAGE);
      result.current.handleConfirmSelection(['standing pose', 'walking pose']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    act(() => {
      result.current.handleConfirmSelection([]);
    });

    await act(async () => {
      await result.current.handleRegenerateSingle(0);
    });

    expect(result.current.generatedImages).toEqual([
      GENERATED_IMAGE,
      SECOND_GENERATED_IMAGE,
    ]);
    expect(result.current.error).toBe('pose.promptError');
    expect(submitJob).toHaveBeenCalledTimes(2);
  });

  it('upscales only the selected generated image and resets its loading state', async () => {
    vi.mocked(submitJob)
      .mockResolvedValueOnce(createCompletedJob('job-1') as never)
      .mockResolvedValueOnce(createCompletedJob('job-2') as never);

    vi.mocked(getJobResults)
      .mockResolvedValueOnce({
        results: [{ kind: 'output', blob_path: 'jobs/pose-1', mime_type: 'image/png' }],
      } as never)
      .mockResolvedValueOnce({
        results: [{ kind: 'output', blob_path: 'jobs/pose-2', mime_type: 'image/png' }],
      } as never);

    vi.mocked(downloadJobResultBlob)
      .mockResolvedValueOnce(GENERATED_IMAGE.base64)
      .mockResolvedValueOnce(SECOND_GENERATED_IMAGE.base64);

    vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_IMAGE);

    const { result } = renderHook(() => usePoseChanger());

    act(() => {
      result.current.setSubjectImage(SUBJECT_IMAGE);
      result.current.handleConfirmSelection(['standing pose', 'walking pose']);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleUpscale(GENERATED_IMAGE, 0);
    });

    expect(upscaleImage).toHaveBeenCalledWith(
      GENERATED_IMAGE,
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
    expect(result.current.generatedImages).toEqual([
      UPSCALED_IMAGE,
      SECOND_GENERATED_IMAGE,
    ]);
    expect(result.current.upscalingStates[0]).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
