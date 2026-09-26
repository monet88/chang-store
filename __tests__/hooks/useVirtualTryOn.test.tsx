import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';

const addImageMock = vi.hoisted(() => vi.fn());

const engineIdState = vi.hoisted(() => ({ id: 'gemini' as ImageEngineId }));

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

vi.mock('../../src/contexts/ImageEngineContext', () =>
  mockUseImageEngine({
    editImage,
    upscaleImage,
    createImageChatSession,
    model: 'gemini-2.5-flash-image',
    // Read per render, so a test can move the hook between the two studios.
    get id() {
      return engineIdState.id;
    },
  }),
);

import { createImageChatSession, editImage, upscaleImage } from '../../src/services/imageEditingService';
import { useVirtualTryOn } from '../../src/hooks/useVirtualTryOn';
import { AiScanProvider } from '../../src/contexts/AiScanContext';
import type { AiScanAnalyzer } from '../../src/contexts/AiScanContext';
import { AI_SCAN_BLOCK_HEADER } from '../../src/utils/ai-scan-blueprint';
import type { ReactNode } from 'react';
import { compositeMarkerOnImage } from '../../src/utils/imageUtils';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';
import { Feature } from '../../src/types';
import type { ImageEngineId, ImageFile } from '../../src/types';

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
    engineIdState.id = 'gemini';
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



  it('defaults each source item to clothing with an empty note and updates it by item', () => {
    const { result } = renderHook(() => useVirtualTryOn());
    const itemId = result.current.clothingItems[0].id;

    expect(result.current.clothingItems[0].sourceItemType).toBe('clothing');
    expect(result.current.clothingItems[0].sourcePrompt).toBe('');

    act(() => {
      result.current.handleSourceItemTypeChange(itemId, 'bag');
      result.current.handleSourcePromptChange(itemId, 'wide pants\nno hand   in pocket');
    });

    expect(result.current.clothingItems[0].sourceItemType).toBe('bag');
    expect(result.current.clothingItems[0].sourcePrompt).toBe('wide pants no hand in pocket');
  });

  it('caps source item notes before prompt generation', () => {
    const { result } = renderHook(() => useVirtualTryOn());
    const itemId = result.current.clothingItems[0].id;

    act(() => {
      result.current.handleSourcePromptChange(itemId, 'x'.repeat(240));
    });

    expect(result.current.clothingItems[0].sourcePrompt).toHaveLength(180);
  });

  it('passes each selected source item type into generated prompt parts', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.handleSourceItemTypeChange(result.current.clothingItems[0].id, 'bag');
      result.current.handleSourcePromptChange(result.current.clothingItems[0].id, 'yellow shoulder bag');
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const partsText = vi.mocked(editImage).mock.calls[0][0].interleavedParts?.filter((part) => part.text).map((part) => part.text).join('\n');
    expect(partsText).toContain('SOURCE ITEM #1 (bag)');
    expect(partsText).toContain('- Source item #1: bag. User note: yellow shoulder bag');
  });

  it('passes background, extra prompt, and multi-person targeting into interleaved request parts', async () => {
    vi.mocked(compositeMarkerOnImage).mockResolvedValueOnce({
      base64: 'subject-a-marked',
      mimeType: 'image/png',
    } as never);
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.handleSourceItemTypeChange(result.current.clothingItems[0].id, 'clothing');
      result.current.handleSourcePromptChange(result.current.clothingItems[0].id, '  casual linen shirt  ');
      result.current.setBackgroundPrompt('Modern Parisian balcony');
      result.current.setExtraPrompt('untucked relaxed styling');
      result.current.setIsMultiPersonMode(true);
      result.current.setMarkerPosition(MARKER);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const call = vi.mocked(editImage).mock.calls[0][0];
    expect(compositeMarkerOnImage).toHaveBeenCalledWith(SUBJECT_A, MARKER);

    const parts = call.interleavedParts ?? [];
    expect(parts[0].text).toContain('SUBJECT');
    expect(parts[1].inlineData?.data).toBe('subject-a-marked');
    expect(parts[2].text).toContain('SOURCE ITEM #1 (clothing)');
    expect(parts[3].inlineData?.data).toBe('outfit-a');

    const taskText = parts[parts.length - 1].text ?? '';
    expect(taskText).toContain('Modern Parisian balcony');
    expect(taskText).toContain('untucked relaxed styling');
    expect(taskText).toContain('- Source item #1: clothing. User note: casual linen shirt');
    expect(taskText).toContain('Modify ONLY the person with the red dot');
  });

  it('sends interleaved labels on Gemini and one indexed role map on the OpenAI-compatible lane', async () => {
    vi.mocked(editImage).mockResolvedValue([RESULT_A]);
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.handleSourcePromptChange(result.current.clothingItems[0].id, 'linen shirt');
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const geminiParts = vi.mocked(editImage).mock.calls[0][0].interleavedParts ?? [];
    expect(geminiParts[0].text).toContain('SUBJECT');
    expect(geminiParts[1].inlineData?.data).toBe('subject-a');
    expect(geminiParts[2].text).toContain('SOURCE ITEM #1 (clothing)');
    expect(geminiParts[3].inlineData?.data).toBe('outfit-a');
    expect(geminiParts[4].text).toContain('## TASK');

    engineIdState.id = 'gptImage';
    act(() => {
      // Re-render so the hook reads the new lane before generating again.
      result.current.setExtraPrompt('untucked styling');
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const flatParts = vi.mocked(editImage).mock.calls[1][0].interleavedParts ?? [];
    expect(flatParts).toHaveLength(3);
    expect(flatParts[0].text).toContain('IMAGE 1 = SUBJECT');
    expect(flatParts[0].text).toContain('IMAGE 2 = SOURCE ITEM #1 (clothing): Apply this item. User note: linen shirt');
    expect(flatParts[0].text).toContain('untucked styling');
    expect(flatParts[0].text).not.toContain('## SOURCE ITEM TYPES');
    expect(flatParts[1].inlineData?.data).toBe('subject-a');
    expect(flatParts[2].inlineData?.data).toBe('outfit-a');
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
    expect(addImageMock).toHaveBeenCalledTimes(2);
    expect(addImageMock).toHaveBeenNthCalledWith(1, RESULT_A, Feature.TryOn, 'gemini');
    expect(addImageMock).toHaveBeenNthCalledWith(2, RESULT_B, Feature.TryOn, 'gemini');
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
    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock).toHaveBeenCalledWith(RESULT_A, Feature.TryOn, 'gemini');
  });

  it('persists wardrobe mode generated results to gallery as Feature.TryOn', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setMode('wardrobe');
      result.current.wardrobe.setSubject(SUBJECT_A);
      result.current.wardrobe.addItem(result.current.wardrobe.sets[0].id);
    });

    act(() => {
      result.current.wardrobe.updateItem(
        result.current.wardrobe.sets[0].id,
        result.current.wardrobe.sets[0].items[0].id,
        { image: OUTFIT_A },
      );
    });

    await act(async () => {
      await result.current.wardrobe.generate();
    });

    expect(addImageMock).toHaveBeenCalledWith(RESULT_A, Feature.TryOn, 'gemini');
  });

  it('caps subject image request concurrency to 10 during batch generation', async () => {
    const subjectImages = Array.from({ length: 12 }, (_, index) => ({
      base64: `subject-${index}`,
      mimeType: 'image/png',
    }));
    const deferredResults = subjectImages.map(() =>
      createDeferred<Array<typeof RESULT_A>>(),
    );
    let activeRequests = 0;
    let maxActiveRequests = 0;

    vi.mocked(editImage).mockImplementation((input, _model, _config) => {
      const subjectBase64 = input.interleavedParts?.[1]?.inlineData?.data;
      const deferredIndex = subjectImages.findIndex((image) => image.base64 === subjectBase64);

      if (deferredIndex === -1) {
        throw new Error(`Unexpected subject image: ${subjectBase64}`);
      }

      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

      return deferredResults[deferredIndex].promise.finally(() => {
        activeRequests -= 1;
      });
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

    deferredResults.forEach(({ resolve }, index) => {
      resolve([{ base64: `result-${index}`, mimeType: 'image/png' }]);
    });

    await generationPromise;
    expect(maxActiveRequests).toBe(10);
    expect(vi.mocked(editImage)).toHaveBeenCalledTimes(12);
    expect(result.current.completedCount).toBe(12);
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
    addImageMock.mockClear();
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
    expect(addImageMock).not.toHaveBeenCalled();
  });

  it('upscales the targeted slot preserving sibling results and tracks inflight upscalingStates', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A, RESULT_B]);
    const deferred = createDeferred<ImageFile>();
    vi.mocked(upscaleImage).mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    addImageMock.mockClear();
    const itemId = result.current.subjectItems[0].id;
    let upscalePromise!: Promise<void>;

    act(() => {
      upscalePromise = result.current.handleUpscale(RESULT_B, 1, itemId);
    });

    expect(result.current.upscalingStates[`${itemId}:1`]).toBe(true);

    await act(async () => {
      deferred.resolve(UPSCALED);
      await upscalePromise;
    });

    expect(result.current.subjectItems[0].results).toEqual([RESULT_A, UPSCALED]);
    expect(result.current.upscalingStates[`${itemId}:1`]).toBe(false);
    expect(addImageMock).not.toHaveBeenCalled();
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

  it('keeps source uploaders when individual items change away from clothing', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.addClothingUploader();
    });
    expect(result.current.clothingItems).toHaveLength(2);

    act(() => {
      result.current.handleSourceItemTypeChange(result.current.clothingItems[1].id, 'shoes');
    });

    expect(result.current.clothingItems).toHaveLength(2);
    expect(result.current.clothingItems[1].sourceItemType).toBe('shoes');
  });

  it('adds source uploaders regardless of individual source types', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSourceItemTypeChange(result.current.clothingItems[0].id, 'bag');
      result.current.addClothingUploader();
    });

    expect(result.current.clothingItems).toHaveLength(2);
  });

  it('caps clothing uploaders at the shared outfit image limit', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.addClothingUploader();
      result.current.addClothingUploader();
      result.current.addClothingUploader();
      result.current.addClothingUploader();
    });

    expect(result.current.clothingItems).toHaveLength(4);
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

    addImageMock.mockClear();
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
    expect(addImageMock).not.toHaveBeenCalled();
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

  describe('AI Scan blueprint', () => {
    const BLUEPRINT = 'WEAVE & MATERIAL: plissé accordion pleats with a dry hand.';

    const wrapperFor =
      (analyze: AiScanAnalyzer, initialEnabled?: boolean) =>
      function AiScanWrapper({ children }: { children: ReactNode }) {
        return (
          <AiScanProvider analyze={analyze} initialEnabled={initialEnabled}>
            {children}
          </AiScanProvider>
        );
      };

    // Everything the image driver received as text, in request order.
    const textSent = (callIndex = 0) =>
      (vi.mocked(editImage).mock.calls[callIndex][0].interleavedParts ?? [])
        .filter((part) => part.text)
        .map((part) => part.text)
        .join('\n');

    beforeEach(() => {
      localStorage.clear();
    });

    it('injects the scanned blueprint into the prompt the image driver receives', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.handleSubjectImagesUpload([SUBJECT_A]);
        result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(analyze).toHaveBeenCalled();
      expect(textSent()).toContain(AI_SCAN_BLOCK_HEADER);
      expect(textSent()).toContain(BLUEPRINT);
      expect(result.current.subjectItems[0].status).toBe('completed');
    });

    it('never analyses and keeps the base prompt when the layer is switched off', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue('unused blueprint');

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper: wrapperFor(analyze, false) });

      act(() => {
        result.current.handleSubjectImagesUpload([SUBJECT_A]);
        result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(analyze).not.toHaveBeenCalled();
      expect(editImage).toHaveBeenCalledTimes(1);
      expect(textSent()).not.toContain('AI SCAN');
      expect(textSent()).toContain('## TASK');
      expect(result.current.subjectItems[0].status).toBe('completed');
    });

    it('still generates and reports no error when the analysis fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>().mockRejectedValue(new Error('analyzer down'));

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.handleSubjectImagesUpload([SUBJECT_A]);
        result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(editImage).toHaveBeenCalledTimes(1);
      expect(textSent()).not.toContain('AI SCAN');
      expect(result.current.error).toBeNull();
      expect(result.current.subjectItems[0].status).toBe('completed');
      consoleSpy.mockRestore();
    });

    it('deconstructs each subject with the garments, never another subject\'s photo', async () => {
      vi.mocked(editImage).mockResolvedValue([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>(async (image) => {
        if (image === SUBJECT_A) return 'SUBJECT A BLUEPRINT: silk satin';
        if (image === SUBJECT_B) return 'SUBJECT B BLUEPRINT: raw denim';
        return 'GARMENT BLUEPRINT: ribbed knit';
      });

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
        result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(vi.mocked(editImage)).toHaveBeenCalledTimes(2);
      // Subject A's job carries the garments it wears plus its own photo.
      expect(textSent(0)).toContain('GARMENT BLUEPRINT');
      expect(textSent(0)).toContain('SUBJECT A BLUEPRINT');
      expect(textSent(0)).not.toContain('SUBJECT B BLUEPRINT');
      // Subject B's job scans subject B, not the batch's first subject.
      expect(textSent(1)).toContain('GARMENT BLUEPRINT');
      expect(textSent(1)).toContain('SUBJECT B BLUEPRINT');
      expect(textSent(1)).not.toContain('SUBJECT A BLUEPRINT');
    });
  });
});
