import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  createImageChatSession: vi.fn(),
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
import { editImage, createImageChatSession } from '../../src/services/imageEditingService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';
import { REFINE_CORRECTION } from '../../src/utils/pattern-generator-prompt-builder';

const REFERENCE_IMAGE = { base64: 'reference-image', mimeType: 'image/png' };
const GENERATED_PATTERN_A = { base64: 'generated-a', mimeType: 'image/png' };
const GENERATED_PATTERN_B = { base64: 'generated-b', mimeType: 'image/png' };
const REFINED_PATTERN = { base64: 'refined-pattern', mimeType: 'image/png' };

describe('usePatternGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
  });

  it('sets inputError and does NOT call editImage when referenceImages is empty', async () => {
    const { result } = renderHook(() => usePatternGenerator());

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('patternGenerator.inputError');
    expect(editImage).not.toHaveBeenCalled();
  });

  it('calls editImage with correct params when referenceImages has items', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A]);
    const { result } = renderHook(() => usePatternGenerator());

    act(() => {
      result.current.setReferenceImages([REFERENCE_IMAGE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).toHaveBeenCalledWith(
      {
        images: [REFERENCE_IMAGE],
        prompt: '',
        numberOfImages: 1,
        aspectRatio: '1:1',
        resolution: '4K',
        interleavedParts: expect.any(Array),
      },
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
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
    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A, GENERATED_PATTERN_B]);
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

  it('sets error and resets isLoading when editImage rejects', async () => {
    vi.mocked(editImage).mockRejectedValueOnce(new Error('generation failed'));
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

    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A]);
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

    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A]);
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
    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A, GENERATED_PATTERN_B]);
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
    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A]);
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
      sendRefinement: vi.fn().mockImplementation(
        () => new Promise<never>(() => {}),
      ),
    };

    vi.mocked(editImage).mockResolvedValueOnce([GENERATED_PATTERN_A]);
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
