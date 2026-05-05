import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  createImageChatSession: vi.fn(),
}));

vi.mock('../../src/services/jobService', () => ({
  submitJob: vi.fn(),
  pollJob: vi.fn(),
  getJobResults: vi.fn(),
  downloadJobResultBlob: vi.fn(),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../src/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    images: [],
    addImage: addImageMock,
    deleteImage: vi.fn(),
    clearImages: vi.fn(),
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
    getModelsForFeature: vi.fn(() => ({ imageEditModel: 'gemini-2.5-flash-image' })),
  }),
}));

vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn(),
}));

import { usePatternGenerator } from '../../src/hooks/usePatternGenerator';
import { createImageChatSession } from '../../src/services/imageEditingService';
import { submitJob, getJobResults, downloadJobResultBlob } from '../../src/services/jobService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';
import { REFINE_CORRECTION } from '../../src/utils/pattern-generator-prompt-builder';

const REFERENCE_IMAGE = { base64: 'reference-image', mimeType: 'image/png' };
const GENERATED_PATTERN_A = { base64: 'generated-a', mimeType: 'image/png' };
const GENERATED_PATTERN_B = { base64: 'generated-b', mimeType: 'image/png' };
const REFINED_PATTERN = { base64: 'refined-pattern', mimeType: 'image/png' };

const COMPLETED_JOB = {
  id: 'job-pattern-1',
  status: 'completed',
  error_message: null,
};

describe('usePatternGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    vi.mocked(submitJob).mockResolvedValue(COMPLETED_JOB as never);
    vi.mocked(getJobResults).mockResolvedValue({
      results: [{ kind: 'output', blob_path: 'jobs/pattern-1', mime_type: 'image/png' }],
    } as never);
    vi.mocked(downloadJobResultBlob).mockResolvedValue(GENERATED_PATTERN_A.base64);
  });

  it('sets inputError and does NOT call submitJob when referenceImages is empty', async () => {
    const { result } = renderHook(() => usePatternGenerator());

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('patternGenerator.inputError');
    expect(submitJob).not.toHaveBeenCalled();
  });

  it('calls submitJob with correct payload when referenceImages has items', async () => {
    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(submitJob).toHaveBeenCalledWith(
      'pattern-generator',
      expect.objectContaining({
        images: [REFERENCE_IMAGE.base64],
        numImages: 1,
        interleavedParts: expect.any(Array),
      }),
    );
  });

  it('numImages is clamped between 1 and 4', () => {
    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setNumImages(0);
    });
    expect(result.current.numImages).toBe(1);

    act(() => {
      result.current.setNumImages(5);
    });
    expect(result.current.numImages).toBe(4);
  });

  it('adds each generated image to gallery', async () => {
    vi.mocked(getJobResults).mockResolvedValueOnce({
      results: [
        { kind: 'output', blob_path: 'jobs/pattern-a', mime_type: 'image/png' },
        { kind: 'output', blob_path: 'jobs/pattern-b', mime_type: 'image/png' },
      ],
    } as never);
    vi.mocked(downloadJobResultBlob)
      .mockResolvedValueOnce(GENERATED_PATTERN_A.base64)
      .mockResolvedValueOnce(GENERATED_PATTERN_B.base64);

    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
      result.current.setNumImages(2);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(addImageMock).toHaveBeenCalledTimes(2);
    expect(addImageMock).toHaveBeenNthCalledWith(1, GENERATED_PATTERN_A);
    expect(addImageMock).toHaveBeenNthCalledWith(2, GENERATED_PATTERN_B);
  });

  it('sets error and resets isLoading when submitJob rejects', async () => {
    vi.mocked(submitJob).mockRejectedValueOnce(new Error('generation failed'));
    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('generation failed');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingMessage).toBe('');
  });

  it('handleRefine creates a chat session and replaces the selected pattern', async () => {
    const refineSessionMock = {
      sendRefinement: vi.fn().mockResolvedValueOnce(REFINED_PATTERN),
    };

    vi.mocked(createImageChatSession).mockReturnValueOnce(refineSessionMock as never);

    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    act(() => {
      result.current.setRefinePrompt('Make it bolder');
    });

    await act(async () => {
      await result.current.handleRefine();
    });

    expect(createImageChatSession).toHaveBeenCalledWith(
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
    expect(result.current.generatedPatterns[0]).toEqual(REFINED_PATTERN);
  });

  it('handleRefine appends REFINE_CORRECTION to the prompt', async () => {
    const refineSessionMock = {
      sendRefinement: vi.fn().mockResolvedValueOnce(REFINED_PATTERN),
    };

    vi.mocked(createImageChatSession).mockReturnValueOnce(refineSessionMock as never);

    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    act(() => {
      result.current.setRefinePrompt('Add thinner lines');
    });

    await act(async () => {
      await result.current.handleRefine();
    });

    expect(refineSessionMock.sendRefinement).toHaveBeenCalledWith(
      `Add thinner lines${REFINE_CORRECTION}`,
      GENERATED_PATTERN_A,
    );
  });

  it('handleDownloadSelected does nothing when no pattern is selected', () => {
    const { result } = renderHook(() => usePatternGenerator());
    const createElementSpy = vi.spyOn(document, 'createElement');

    act(() => {
      result.current.handleDownloadSelected();
    });

    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it('handleDownloadAllZip calls downloadImagesAsZip when 2+ patterns exist', async () => {
    vi.mocked(getJobResults).mockResolvedValueOnce({
      results: [
        { kind: 'output', blob_path: 'jobs/pattern-a', mime_type: 'image/png' },
        { kind: 'output', blob_path: 'jobs/pattern-b', mime_type: 'image/png' },
      ],
    } as never);
    vi.mocked(downloadJobResultBlob)
      .mockResolvedValueOnce(GENERATED_PATTERN_A.base64)
      .mockResolvedValueOnce(GENERATED_PATTERN_B.base64);

    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
      result.current.setNumImages(2);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleDownloadAllZip();
    });

    expect(downloadImagesAsZip).toHaveBeenCalledWith(
      [GENERATED_PATTERN_A, GENERATED_PATTERN_B],
      'pattern-generator',
    );
  });

  it('handleDownloadAllZip does NOT call downloadImagesAsZip when only 1 pattern', async () => {
    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleDownloadAllZip();
    });

    expect(downloadImagesAsZip).not.toHaveBeenCalled();
  });

  it('canGenerate is false while a refinement is in progress', async () => {
    const refineSessionMock = {
      sendRefinement: vi.fn().mockImplementation(() => new Promise<never>(() => {})),
    };

    vi.mocked(createImageChatSession).mockReturnValueOnce(refineSessionMock as never);

    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    act(() => {
      result.current.setRefinePrompt('Make it bolder');
    });

    act(() => {
      void result.current.handleRefine();
    });

    expect(result.current.isRefining).toBe(true);
    expect(result.current.canGenerate).toBe(false);
  });
});
