import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
}));

vi.mock('../../src/services/textService', () => ({
  generatePoseDescription: vi.fn(),
  analyzeOutfitBlueprint: vi.fn(),
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
import { AiScanProvider } from '../../src/contexts/AiScanContext';
import { editImage, upscaleImage } from '../../src/services/imageEditingService';
import { generatePoseDescription } from '../../src/services/textService';

import type { ImageFile } from '../../src/types';

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

  it('keeps existing generated images when regenerate falls back with no prompts', async () => {
    const SECOND_GENERATED_IMAGE = { base64: 'generated-second', mimeType: 'image/png' };
    vi.mocked(editImage)
      .mockResolvedValueOnce([GENERATED_IMAGE])
      .mockResolvedValueOnce([SECOND_GENERATED_IMAGE]);
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
    expect(editImage).toHaveBeenCalledTimes(2);
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

  describe('AI Scan blueprint', () => {
    const renderWithAiScan = (
      analyze: (image: ImageFile) => Promise<string>,
      initialEnabled: boolean,
    ) =>
      renderHook(() => usePoseChanger(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AiScanProvider analyze={analyze} initialEnabled={initialEnabled}>
            {children}
          </AiScanProvider>
        ),
      });

    it('hands the subject-derived blueprint to the image service in the text path', async () => {
      const analyze = vi.fn(async (image: ImageFile) =>
        image === SUBJECT_IMAGE ? 'SUBJECT BLUEPRINT MARKER: dry wool gabardine.' : 'OTHER',
      );
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderWithAiScan(analyze, true);

      act(() => {
        result.current.setSubjectImage(SUBJECT_IMAGE);
        result.current.handleConfirmSelection(['standing tall']);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const prompt = vi.mocked(editImage).mock.calls[0][0].prompt;
      expect(prompt).toContain('SUBJECT BLUEPRINT MARKER: dry wool gabardine.');
      expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION');
    });

    it('scans the subject image, never the pose reference, in the reference path', async () => {
      const analyze = vi.fn(async (image: ImageFile) =>
        image === SUBJECT_IMAGE ? 'SUBJECT BLUEPRINT MARKER' : 'POSE REFERENCE MARKER',
      );
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderWithAiScan(analyze, true);

      act(() => {
        result.current.setSubjectImage(SUBJECT_IMAGE);
        result.current.handlePoseReferenceUpload(POSE_REFERENCE_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const prompt = vi.mocked(editImage).mock.calls[0][0].prompt;
      expect(prompt).toContain('SUBJECT BLUEPRINT MARKER');
      expect(prompt).not.toContain('POSE REFERENCE MARKER');
    });

    it('hands the blueprint to the single-pose regeneration as well', async () => {
      const analyze = vi.fn(async () => 'REGEN BLUEPRINT MARKER');
      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE])
        .mockResolvedValueOnce([{ base64: 'regenerated-image', mimeType: 'image/png' }]);
      const { result } = renderWithAiScan(analyze, true);

      act(() => {
        result.current.setSubjectImage(SUBJECT_IMAGE);
        result.current.handleConfirmSelection(['standing tall']);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleRegenerateSingle(0);
      });

      expect(vi.mocked(editImage).mock.calls[1][0].prompt).toContain('REGEN BLUEPRINT MARKER');
    });

    it('skips the analysis entirely when the layer is toggled off', async () => {
      const analyze = vi.fn(async () => 'SUBJECT BLUEPRINT MARKER');
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderWithAiScan(analyze, false);

      act(() => {
        result.current.setSubjectImage(SUBJECT_IMAGE);
        result.current.handleConfirmSelection(['standing tall']);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(analyze).not.toHaveBeenCalled();
      expect(vi.mocked(editImage).mock.calls[0][0].prompt).not.toContain('AI SCAN');
    });
  });
});
