import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';
import { Feature } from '@/types';
import type { ImageFile } from '@/types';
import { useClothingTransfer } from '@/hooks/useClothingTransfer';

const addImageMock = vi.hoisted(() => vi.fn());
const localQwenEditImageMock = vi.hoisted(() => vi.fn());
const localQwenUpscaleMock = vi.hoisted(() => vi.fn());

// Cloud drivers to verify they are NEVER called as fallbacks
const cloudGeminiEditMock = vi.hoisted(() => vi.fn());
const cloudGptEditMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/imageEditingService', () => ({
  editImage: cloudGeminiEditMock,
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('@/services/providers/gpt-image/gptImageService', () => ({
  editGptImage: cloudGptEditMock,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    images: [],
    addImage: addImageMock,
    deleteImage: vi.fn(),
    clearImages: vi.fn(),
  }),
}));

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'qwen-image-2.1',
    textGenerateModel: 'gemini-2.5-flash',
    getModelsForFeature: vi.fn(() => ({ imageEditModel: 'qwen-image-2.1' })),
  }),
}));

vi.mock('@/contexts/ImageEngineContext', () =>
  mockUseImageEngine({
    id: 'localQwen',
    model: 'qwen-image-2.1',
    editImage: localQwenEditImageMock,
    upscaleImage: localQwenUpscaleMock,
    createImageChatSession: null,
    modelOptions: null,
    setModel: null,
    noSelectableModel: false,
    options: null,
  }),
);

const CONCEPT_1: ImageFile = { base64: 'concept-image-1', mimeType: 'image/png' };
const CONCEPT_2: ImageFile = { base64: 'concept-image-2', mimeType: 'image/png' };
const CONCEPT_3: ImageFile = { base64: 'concept-image-3', mimeType: 'image/png' };

const GARMENT_TOP: ImageFile = { base64: 'garment-top-data', mimeType: 'image/jpeg' };
const GARMENT_SKIRT: ImageFile = { base64: 'garment-skirt-data', mimeType: 'image/jpeg' };

const RESULT_IMAGE_1: ImageFile = { base64: 'rendered-qwen-ct-1', mimeType: 'image/png' };
const RESULT_IMAGE_2: ImageFile = { base64: 'rendered-qwen-ct-2', mimeType: 'image/png' };

describe('useClothingTransfer with Local Qwen Image Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    localQwenEditImageMock.mockReset();
    cloudGeminiEditMock.mockReset();
    cloudGptEditMock.mockReset();

    localQwenEditImageMock.mockResolvedValue([RESULT_IMAGE_1]);
  });

  it('selects Qwen prompt family and never Gemini or GPT prompt format', async () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_1]);
      result.current.handleReferenceUpload(GARMENT_TOP, result.current.referenceItems[0].id);
      result.current.handleReferenceLabel('silk blouse', result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);

    const callArgs = localQwenEditImageMock.mock.calls[0];
    const params = callArgs[0];
    const model = callArgs[1];

    expect(model).toBe('qwen-image-2.1');

    const parts = params.interleavedParts;
    expect(parts).toBeDefined();
    expect(parts.length).toBeGreaterThanOrEqual(2);

    const promptText = parts[0].text;
    // Must use Qwen Clothing Transfer specification
    expect(promptText).toContain('QWEN CLOTHING TRANSFER SPECIFICATION');
    expect(promptText).toContain('image_1: DESTINATION SCENE');
    expect(promptText).toContain('image_2: SOURCE OUTFIT 1');
    expect(promptText).toContain('silk blouse');

    // Must NOT contain Gemini or GPT wording
    expect(promptText).not.toContain('/* CLOTHING_TRANSFER_CONFIG */');
    expect(promptText).not.toContain('DESTINATION SCENE OWNS THE ENVIRONMENT AND COMPOSITION');
  });

  it('enforces deterministic reference ordering: destination first (image_1), then garments in order (image_2..N)', async () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_1]);
      result.current.handleReferenceUpload(GARMENT_TOP, result.current.referenceItems[0].id);
      result.current.handleReferenceLabel('blouse', result.current.referenceItems[0].id);
      result.current.addReference();
    });

    act(() => {
      const secondRefId = result.current.referenceItems[1].id;
      result.current.handleReferenceUpload(GARMENT_SKIRT, secondRefId);
      result.current.handleReferenceLabel('skirt', secondRefId);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
    const parts = localQwenEditImageMock.mock.calls[0][0].interleavedParts;

    // Part 0: prompt text
    expect(parts[0].text).toBeDefined();

    // Part 1: destination concept scene first (image_1)
    expect(parts[1].inlineData?.data).toBe('concept-image-1');

    // Part 2: garment top second (image_2)
    expect(parts[2].inlineData?.data).toBe('garment-top-data');

    // Part 3: garment skirt third (image_3)
    expect(parts[3].inlineData?.data).toBe('garment-skirt-data');
  });

  it('enforces serial execution (concurrency: 1) when generating multiple concept images', async () => {
    let activeGenerations = 0;
    let maxConcurrentGenerations = 0;

    localQwenEditImageMock.mockImplementation(async () => {
      activeGenerations++;
      maxConcurrentGenerations = Math.max(maxConcurrentGenerations, activeGenerations);
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 25);
      await promise;
      activeGenerations--;
      return [RESULT_IMAGE_1];
    });

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_1, CONCEPT_2, CONCEPT_3]);
      result.current.handleReferenceUpload(GARMENT_TOP, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(3);
    // Crucial requirement: Local Qwen concurrency MUST be strictly 1
    expect(maxConcurrentGenerations).toBe(1);
  });

  it('tags generated results in Gallery with localQwen engine tag', async () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_1]);
      result.current.handleReferenceUpload(GARMENT_TOP, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock).toHaveBeenCalledWith(RESULT_IMAGE_1, Feature.ClothingTransfer, 'localQwen');
  });

  it('regenerate-one preserves sibling results and routes through Local Qwen', async () => {
    vi.mocked(localQwenEditImageMock)
      .mockResolvedValueOnce([RESULT_IMAGE_1])
      .mockResolvedValueOnce([RESULT_IMAGE_2]);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_1, CONCEPT_2]);
      result.current.handleReferenceUpload(GARMENT_TOP, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.conceptItems[0].results).toEqual([RESULT_IMAGE_1]);
    expect(result.current.conceptItems[1].results).toEqual([RESULT_IMAGE_2]);

    const regenImage: ImageFile = { base64: 'regenerated-qwen-concept-2', mimeType: 'image/png' };
    vi.mocked(localQwenEditImageMock).mockResolvedValueOnce([regenImage]);

    const item2Id = result.current.conceptItems[1].id;

    await act(async () => {
      await result.current.handleRegenerateSingle(item2Id);
    });

    // Sibling item 1 is preserved untouched
    expect(result.current.conceptItems[0].results).toEqual([RESULT_IMAGE_1]);
    expect(result.current.conceptItems[0].status).toBe('completed');

    // Targeted item 2 was regenerated through Local Qwen
    expect(result.current.conceptItems[1].results).toEqual([regenImage]);
    expect(result.current.conceptItems[1].status).toBe('completed');

    // Gallery tagged with localQwen for both initial and regenerated items
    expect(addImageMock).toHaveBeenCalledWith(regenImage, Feature.ClothingTransfer, 'localQwen');

    // Total calls to localQwen is 3 (2 initial + 1 regen)
    expect(localQwenEditImageMock).toHaveBeenCalledTimes(3);

    // Verify 3rd call used Qwen prompt specification
    const regenPromptParts = localQwenEditImageMock.mock.calls[2][0].interleavedParts;
    expect(regenPromptParts[0].text).toContain('QWEN CLOTHING TRANSFER SPECIFICATION');

    // Cloud drivers remain completely untouched
    expect(cloudGeminiEditMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });

  it('handles errors locally and NEVER falls back to cloud drivers', async () => {
    localQwenEditImageMock.mockRejectedValue(new Error('ComfyUI server out of memory (VRAM full)'));

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_1]);
      result.current.handleReferenceUpload(GARMENT_TOP, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    // Concept item status is error with local message
    expect(result.current.conceptItems[0].status).toBe('error');
    expect(result.current.conceptItems[0].error).toContain('ComfyUI server out of memory');

    // Cloud drivers MUST NEVER be called
    expect(cloudGeminiEditMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });
});
