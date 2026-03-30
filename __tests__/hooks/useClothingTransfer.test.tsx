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
    imageEditModel: 'gemini-2.5-flash-image',
    getModelsForFeature: vi.fn(() => ({
      imageEditModel: 'gemini-2.5-flash-image',
    })),
  }),
}));

import { useClothingTransfer } from '../../src/hooks/useClothingTransfer';
import { editImage, upscaleImage } from '../../src/services/imageEditingService';

const CONCEPT_A = { base64: 'concept-a', mimeType: 'image/png' };
const CONCEPT_B = { base64: 'concept-b', mimeType: 'image/png' };
const REF_A = { base64: 'ref-a', mimeType: 'image/jpeg' };
const REF_B = { base64: 'ref-b', mimeType: 'image/jpeg' };
const RESULT_A = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B = { base64: 'result-b', mimeType: 'image/png' };
const UPSCALED = { base64: 'upscaled', mimeType: 'image/png' };

describe('useClothingTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
  });

  it('tracks multiple concept images as batch items', () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
    });

    expect(result.current.conceptItems).toHaveLength(2);
    expect(result.current.conceptImages).toEqual([CONCEPT_A, CONCEPT_B]);
    expect(result.current.selectedConceptItemId).toBe(result.current.conceptItems[0].id);
    expect(result.current.canGenerate).toBe(false);
  });

  it('sends one request per concept image with concept-first ordering', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B]);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
      result.current.handleReferenceLabel('top', result.current.referenceItems[0].id);
      result.current.addReference();
    });

    act(() => {
      result.current.handleReferenceUpload(REF_B, result.current.referenceItems[1].id);
      result.current.handleReferenceLabel('pants', result.current.referenceItems[1].id);
      result.current.setExtraPrompt('keep jewelry visible');
      result.current.setNumImages(2);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(editImage).mock.calls[0][0].images).toEqual([CONCEPT_A, REF_A, REF_B]);
    expect(vi.mocked(editImage).mock.calls[1][0].images).toEqual([CONCEPT_B, REF_A, REF_B]);

    const textParts = vi.mocked(editImage).mock.calls[0][0].interleavedParts
      ?.filter((part: { text?: string }) => part.text)
      .map((part: { text?: string }) => part.text)
      .join('\n');

    expect(textParts).toContain('DESTINATION SCENE');
    expect(textParts).toContain('SOURCE OUTFIT 1');
    expect(textParts).toContain('keep jewelry visible');
    expect(result.current.completedCount).toBe(2);
    expect(addImageMock).toHaveBeenCalledTimes(2);
  });

  it('stores per-item errors without aborting sibling concept jobs', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockRejectedValueOnce(new Error('concept failed'));

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.completedCount).toBe(1);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.conceptItems[0].status).toBe('completed');
    expect(result.current.conceptItems[1].status).toBe('error');
    expect(result.current.conceptItems[1].error).toBe('concept failed');
  });

  it('upscales a result inside a concept batch item and saves it to gallery', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    addImageMock.mockClear();
    const itemId = result.current.conceptItems[0].id;

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
    expect(result.current.conceptItems[0].results[0]).toEqual(UPSCALED);
    expect(addImageMock).toHaveBeenCalledWith(UPSCALED);
    expect(result.current.upscalingStates[`${itemId}:0`]).toBe(false);
  });

  it('addReference allows more than 2 references (unlimited)', () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.addReference();
      result.current.addReference();
      result.current.addReference();
    });

    // 1 default + 3 added = 4
    expect(result.current.referenceItems).toHaveLength(4);
  });

  it('handleRegenerateSingle regenerates only the targeted concept item', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B])
      .mockResolvedValueOnce([{ base64: 'regen-b', mimeType: 'image/png' }]);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.conceptItems[0].results).toEqual([RESULT_A]);
    expect(result.current.conceptItems[1].results).toEqual([RESULT_B]);

    const itemBId = result.current.conceptItems[1].id;

    await act(async () => {
      await result.current.handleRegenerateSingle(itemBId);
    });

    // Item A untouched, Item B regenerated
    expect(result.current.conceptItems[0].results).toEqual([RESULT_A]);
    expect(result.current.conceptItems[0].status).toBe('completed');
    expect(result.current.conceptItems[1].results).toEqual([{ base64: 'regen-b', mimeType: 'image/png' }]);
    expect(result.current.conceptItems[1].status).toBe('completed');
    expect(editImage).toHaveBeenCalledTimes(3);
  });

  it('handleRegenerateSingle is a no-op for unknown itemId', async () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleRegenerateSingle('nonexistent-id');
    });

    expect(editImage).not.toHaveBeenCalled();
  });
});
