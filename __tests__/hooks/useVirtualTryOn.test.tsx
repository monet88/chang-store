import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
  compositeMarkerOnImage: vi.fn(),
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

let mockModelName = 'gemini-2.5-flash-image';

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: mockModelName,
    getModelsForFeature: vi.fn(() => ({
      imageEditModel: mockModelName,
    })),
  }),
}));

vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn(),
}));

import { useVirtualTryOn } from '../../src/hooks/useVirtualTryOn';
import { compositeMarkerOnImage } from '../../src/utils/imageUtils';
import { createImageChatSession, editImage, upscaleImage } from '../../src/services/imageEditingService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';

const SUBJECT_A = { base64: 'subject-a', mimeType: 'image/png' };
const SUBJECT_B = { base64: 'subject-b', mimeType: 'image/png' };
const OUTFIT_A = { base64: 'outfit-a', mimeType: 'image/jpeg' };
const OUTFIT_B = { base64: 'outfit-b', mimeType: 'image/jpeg' };
const RESULT_A = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B = { base64: 'result-b', mimeType: 'image/png' };
const UPSCALED = { base64: 'upscaled', mimeType: 'image/png' };
const REFINED = { base64: 'refined', mimeType: 'image/png' };
const MARKER = { x: 10, y: 20, relX: 0.25, relY: 0.5 };

const refineSessionMock = {
  sendRefinement: vi.fn(),
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

describe('useVirtualTryOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    mockModelName = 'gemini-2.5-flash-image';
    refineSessionMock.sendRefinement.mockReset();
  });

  it('sets input error when generate is called without required images', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(result.current.error).toBe('virtualTryOn.inputError');
    expect(editImage).not.toHaveBeenCalled();
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

    // New pattern: images=[], prompt='', interleavedParts has the subject + outfit data
    const call0 = vi.mocked(editImage).mock.calls[0][0];
    expect(call0.images).toEqual([]);
    expect(call0.prompt).toBe('');
    expect(call0.numberOfImages).toBe(2);
    expect(call0.aspectRatio).toBe('3:4');
    expect(call0.resolution).toBe('2K');
    expect(call0.interleavedParts).toBeDefined();
    // Verify subject-A's base64 is in the interleavedParts (second part = subject image)
    expect(call0.interleavedParts![1]).toHaveProperty('inlineData');
    expect(call0.interleavedParts![1].inlineData?.data).toBe('subject-a');

    const call1 = vi.mocked(editImage).mock.calls[1][0];
    expect(call1.images).toEqual([]);
    expect(call1.prompt).toBe('');
    expect(call1.interleavedParts).toBeDefined();
    // Verify subject-B's base64 is in the interleavedParts
    expect(call1.interleavedParts![1].inlineData?.data).toBe('subject-b');

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

  it('starts all subject image requests in the same run before any resolve', async () => {
    const subjectImages = Array.from({ length: 10 }, (_, index) => ({
      base64: `subject-${index}`,
      mimeType: 'image/png',
    }));
    const deferredResults = subjectImages.map(() =>
      createDeferred<Array<typeof RESULT_A>>(),
    );

    vi.mocked(editImage).mockImplementation((input, _model, _config) => {
      const subjectBase64 = input.interleavedParts?.[1]?.inlineData?.data;
      const deferredIndex = subjectImages.findIndex((image) => image.base64 === subjectBase64);

      if (deferredIndex === -1) {
        throw new Error(`Unexpected subject image: ${subjectBase64}`);
      }

      return deferredResults[deferredIndex].promise;
    });

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload(subjectImages);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    const generationPromise = act(async () => {
      await result.current.handleGenerateImage();
    });

    await vi.waitFor(() => {
      expect(editImage).toHaveBeenCalledTimes(10);
    });

    subjectImages.forEach((image, index) => {
      expect(vi.mocked(editImage).mock.calls[index][0].interleavedParts?.[1]?.inlineData?.data).toBe(image.base64);
    });

    deferredResults.forEach(({ resolve }, index) => {
      resolve([{ base64: `result-${index}`, mimeType: 'image/png' }]);
    });

    await generationPromise;
    expect(result.current.completedCount).toBe(10);
    expect(result.current.failedCount).toBe(0);
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

  it('clearSubjectImages resets all subject state', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
    });
    expect(result.current.subjectItems).toHaveLength(2);

    act(() => {
      result.current.clearSubjectImages();
    });

    expect(result.current.subjectItems).toHaveLength(0);
    expect(result.current.subjectImages).toEqual([]);
    expect(result.current.selectedSubjectItemId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('clears marker position when multi-person mode is turned off', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setMarkerPosition(MARKER);
      result.current.setIsMultiPersonMode(true);
    });

    act(() => {
      result.current.setIsMultiPersonMode(false);
    });

    expect(result.current.markerPosition).toBeNull();
    expect(result.current.isMultiPersonMode).toBe(false);
  });

  it('clears marker position when clearMarker is called', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setMarkerPosition(MARKER);
    });

    act(() => {
      result.current.clearMarker();
    });

    expect(result.current.markerPosition).toBeNull();
  });

  it('caps clothing uploaders at the shared outfit image limit', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.addClothingUploader();
      result.current.addClothingUploader();
    });

    expect(result.current.clothingItems).toHaveLength(2);
  });

  it('keeps one clothing uploader when removeClothingUploader is called with a single item', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.removeClothingUploader(result.current.clothingItems[0].id);
    });

    expect(result.current.clothingItems).toHaveLength(1);
  });

  it('removes the targeted clothing uploader when multiple uploaders exist', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.addClothingUploader();
    });

    const removableId = result.current.clothingItems[1].id;

    act(() => {
      result.current.removeClothingUploader(removableId);
    });

    expect(result.current.clothingItems).toHaveLength(1);
    expect(result.current.clothingItems.some((item) => item.id === removableId)).toBe(false);
  });

  it('handleRegenerateSingle regenerates only the targeted subject item', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B])
      .mockResolvedValueOnce([{ base64: 'regen-b', mimeType: 'image/png' }]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(result.current.subjectItems[0].results).toEqual([RESULT_A]);
    expect(result.current.subjectItems[1].results).toEqual([RESULT_B]);

    const itemBId = result.current.subjectItems[1].id;

    await act(async () => {
      await result.current.handleRegenerateSingle(itemBId);
    });

    // Item A untouched, Item B regenerated
    expect(result.current.subjectItems[0].results).toEqual([RESULT_A]);
    expect(result.current.subjectItems[0].status).toBe('completed');
    expect(result.current.subjectItems[1].results).toEqual([{ base64: 'regen-b', mimeType: 'image/png' }]);
    expect(result.current.subjectItems[1].status).toBe('completed');
    expect(editImage).toHaveBeenCalledTimes(3);
  });

  it('handleRegenerateSingle is a no-op for unknown itemId', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleRegenerateSingle('nonexistent-id');
    });

    expect(editImage).not.toHaveBeenCalled();
  });

  it('stores an item error when single-item regeneration fails', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockRejectedValueOnce(new Error('regen failed'));

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleRegenerateSingle(result.current.subjectItems[0].id);
    });

    expect(result.current.subjectItems[0].status).toBe('error');
    expect(result.current.subjectItems[0].error).toBe('regen failed');
  });

  it('composites the marker onto each subject image when multi-person mode is enabled', async () => {
    vi.mocked(compositeMarkerOnImage).mockResolvedValueOnce({
      base64: 'subject-a-marked',
      mimeType: 'image/png',
    } as never);
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.setMarkerPosition(MARKER);
      result.current.setIsMultiPersonMode(true);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(compositeMarkerOnImage).toHaveBeenCalledWith(SUBJECT_A, MARKER);
  });

  it('composites the marker during single-item regeneration when multi-person mode is enabled', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B]);
    vi.mocked(compositeMarkerOnImage)
      .mockResolvedValueOnce({ base64: 'subject-a-marked', mimeType: 'image/png' } as never)
      .mockResolvedValueOnce({ base64: 'subject-a-regen', mimeType: 'image/png' } as never);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.setMarkerPosition(MARKER);
      result.current.setIsMultiPersonMode(true);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleRegenerateSingle(result.current.subjectItems[0].id);
    });

    expect(compositeMarkerOnImage).toHaveBeenNthCalledWith(2, SUBJECT_A, MARKER);
  });

  it('sets error and resets the state when upscale fails', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(upscaleImage).mockRejectedValueOnce(new Error('upscale failed'));

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

    expect(result.current.error).toBe('upscale failed');
    expect(result.current.upscalingStates[`${itemId}:0`]).toBe(false);
  });

  it('does nothing when upscale is called without an active subject item', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    await act(async () => {
      await result.current.handleUpscale(RESULT_A, 0);
    });

    expect(upscaleImage).not.toHaveBeenCalled();
  });

  it('refines a generated image and clears the stored prompt when refinement succeeds', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);
    refineSessionMock.sendRefinement.mockResolvedValueOnce(REFINED);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const itemId = result.current.subjectItems[0].id;
    const refineKey = `${itemId}:0`;

    act(() => {
      result.current.setRefinePrompts({ [refineKey]: 'make it cleaner' });
    });

    await act(async () => {
      await result.current.handleRefine(RESULT_A, 0, itemId, 'make it cleaner');
    });

    expect(refineSessionMock.sendRefinement).toHaveBeenCalledWith('make it cleaner', RESULT_A);
    expect(result.current.subjectItems[0].results[0]).toEqual(REFINED);
    expect(result.current.refinePrompts[refineKey]).toBe('');
    expect(result.current.isRefining[refineKey]).toBe(false);
  });

  it('sets error when creating a refinement session fails', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(createImageChatSession).mockImplementation(() => {
      throw new Error('session failed');
    });

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleRefine(RESULT_A, 0, result.current.subjectItems[0].id, 'make it cleaner');
    });

    expect(result.current.error).toBe('session failed');
  });

  it('sets error and clears refining state when refinement fails after session creation', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);
    refineSessionMock.sendRefinement.mockRejectedValueOnce(new Error('refine failed'));

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const itemId = result.current.subjectItems[0].id;
    const refineKey = `${itemId}:0`;

    await act(async () => {
      await result.current.handleRefine(RESULT_A, 0, itemId, 'make it cleaner');
    });

    expect(result.current.error).toBe('refine failed');
    expect(result.current.isRefining[refineKey]).toBe(false);
  });

  it('does not create a refinement session when the prompt is blank', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleRefine(RESULT_A, 0, result.current.subjectItems[0].id, '   ');
    });

    expect(createImageChatSession).not.toHaveBeenCalled();
  });

  it('downloads all completed results as a zip', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A, RESULT_B]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleDownloadAll();
    });

    expect(downloadImagesAsZip).toHaveBeenCalledWith([RESULT_A, RESULT_B], 'try-on-batch');
  });

  it('sets error when downloading results as a zip fails', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(downloadImagesAsZip).mockRejectedValueOnce(new Error('zip failed'));

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleDownloadAll();
    });

    expect(result.current.error).toBe('zip failed');
  });

  it('skips zip download when there are no completed results', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    await act(async () => {
      await result.current.handleDownloadAll();
    });

    expect(downloadImagesAsZip).not.toHaveBeenCalled();
  });
});
