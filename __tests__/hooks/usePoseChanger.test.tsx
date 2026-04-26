import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
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
import { editImage, upscaleImage } from '../../src/services/imageEditingService';
import { generatePoseDescription } from '../../src/services/textService';

const SUBJECT_IMAGE = { base64: 'subject-image', mimeType: 'image/png' };
const POSE_REFERENCE_IMAGE = { base64: 'pose-reference', mimeType: 'image/jpeg' };
const GENERATED_IMAGE = { base64: 'generated-image', mimeType: 'image/png' };
const UPSCALED_IMAGE = { base64: 'upscaled-image', mimeType: 'image/png' };

describe('usePoseChanger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('uses the reference-image path when a pose reference is present', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
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

    expect(editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [SUBJECT_IMAGE, POSE_REFERENCE_IMAGE],
        negativePrompt: 'blurry',
        numberOfImages: 1,
        aspectRatio: '1:1',
        resolution: '4K',
      }),
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
    expect(vi.mocked(editImage).mock.calls[0][0].prompt).toContain(
      "Pose Reference Image",
    );
    expect(vi.mocked(editImage).mock.calls[0][0].prompt).toContain(
      'keep the left arm raised',
    );
    expect(result.current.generatedImages).toEqual([GENERATED_IMAGE]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.generationStatus.active).toBe(false);
  });

  it('upscales only the selected generated image and resets its loading state', async () => {
    const SECOND_GENERATED_IMAGE = { base64: 'generated-second', mimeType: 'image/png' };
    vi.mocked(editImage)
      .mockResolvedValueOnce([GENERATED_IMAGE])
      .mockResolvedValueOnce([SECOND_GENERATED_IMAGE]);
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
