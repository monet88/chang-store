import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
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
    localApiBaseUrl: null,
    localApiKey: null,
    antiApiBaseUrl: null,
    antiApiKey: null,
    getModelsForFeature: vi.fn(() => ({
      imageEditModel: 'gemini-2.5-flash-image',
    })),
  }),
}));

import { useVirtualTryOn } from '../../src/hooks/useVirtualTryOn';
import { editImage, upscaleImage } from '../../src/services/imageEditingService';

const SUBJECT_A = { base64: 'subject-a', mimeType: 'image/png' };
const SUBJECT_B = { base64: 'subject-b', mimeType: 'image/png' };
const OUTFIT_A = { base64: 'outfit-a', mimeType: 'image/jpeg' };
const OUTFIT_B = { base64: 'outfit-b', mimeType: 'image/jpeg' };
const RESULT_A = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B = { base64: 'result-b', mimeType: 'image/png' };
const UPSCALED = { base64: 'upscaled', mimeType: 'image/png' };

describe('useVirtualTryOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
  });

  it('tracks multiple subject images as batch items', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
    });

    expect(result.current.subjectItems).toHaveLength(2);
    expect(result.current.subjectImages).toEqual([SUBJECT_A, SUBJECT_B]);
    expect(result.current.selectedSubjectItemId).toBe(result.current.subjectItems[0].id);
    expect(result.current.canGenerate).toBe(false);
  });

  it('runs one try-on request per subject image with shared outfit inputs', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.addClothingUploader();
    });

    act(() => {
      result.current.handleClothingUpload(OUTFIT_B, result.current.clothingItems[1].id);
      result.current.setNumImages(2);
      result.current.setAspectRatio('3:4');
      result.current.setResolution('2K');
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(editImage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(editImage).mock.calls[0][0]).toEqual(expect.objectContaining({
      images: [SUBJECT_A, OUTFIT_A, OUTFIT_B],
      numberOfImages: 2,
      aspectRatio: '3:4',
      resolution: '2K',
    }));
    expect(vi.mocked(editImage).mock.calls[1][0]).toEqual(expect.objectContaining({
      images: [SUBJECT_B, OUTFIT_A, OUTFIT_B],
    }));

    expect(result.current.completedCount).toBe(2);
    expect(result.current.failedCount).toBe(0);
    expect(result.current.subjectItems[0].status).toBe('completed');
    expect(result.current.subjectItems[1].status).toBe('completed');
    expect(result.current.subjectItems[0].results).toEqual([RESULT_A]);
    expect(result.current.subjectItems[1].results).toEqual([RESULT_B]);
  });

  it('keeps successful items when one batch item fails', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockRejectedValueOnce(new Error('subject failed'));

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(result.current.completedCount).toBe(1);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.subjectItems[0].status).toBe('completed');
    expect(result.current.subjectItems[1].status).toBe('error');
    expect(result.current.subjectItems[1].error).toBe('subject failed');
  });

  it('upscales a result inside the selected batch item', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const itemId = result.current.subjectItems[0].id;

    await act(async () => {
      await result.current.handleUpscale(RESULT_A, 0, itemId);
    });

    expect(upscaleImage).toHaveBeenCalledWith(
      RESULT_A,
      'gemini-2.5-flash-image',
      expect.objectContaining({
        onStatusUpdate: expect.any(Function),
      }),
    );
    expect(result.current.subjectItems[0].results[0]).toEqual(UPSCALED);
    expect(result.current.upscalingStates[`${itemId}:0`]).toBe(false);
  });
});
