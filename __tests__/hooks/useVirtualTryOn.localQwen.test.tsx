import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';
import { Feature } from '@/types';
import type { ImageFile } from '@/types';
import { useVirtualTryOn } from '@/hooks/useVirtualTryOn';
import { useLocalQwenImageEngine } from '@/hooks/useLocalQwenImageEngine';
import { saveLocalQwenSettings } from '@/config/localQwenSettings';

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
  ImageGalleryContext: {
    Consumer: ({ children }: { children: (val: unknown) => unknown }) => children(null),
    Provider: ({ children }: { children: unknown }) => children,
  },
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

const SUBJECT_1: ImageFile = { base64: 'subject-image-1', mimeType: 'image/png' };
const SUBJECT_2: ImageFile = { base64: 'subject-image-2', mimeType: 'image/png' };
const SUBJECT_3: ImageFile = { base64: 'subject-image-3', mimeType: 'image/png' };

const GARMENT_TOP: ImageFile = { base64: 'garment-top-data', mimeType: 'image/jpeg' };
const GARMENT_SKIRT: ImageFile = { base64: 'garment-skirt-data', mimeType: 'image/jpeg' };

const RESULT_IMAGE: ImageFile = { base64: 'rendered-qwen-vto', mimeType: 'image/png' };
const UPSCALED_IMAGE: ImageFile = { base64: 'upscaled-qwen-vto', mimeType: 'image/png' };

describe('useVirtualTryOn with Local Qwen Image Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    localQwenEditImageMock.mockReset();
    cloudGeminiEditMock.mockReset();
    cloudGptEditMock.mockReset();

    localQwenEditImageMock.mockResolvedValue([RESULT_IMAGE]);
  });

  it('selects Qwen prompt family and never Gemini or GPT prompt format', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setSubjectImage(SUBJECT_1);
      result.current.handleClothingUpload(GARMENT_TOP, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);

    const callArgs = localQwenEditImageMock.mock.calls[0];
    const params = callArgs[0];
    const model = callArgs[1];

    expect(model).toBe('qwen-image-2.1');

    const parts = params.interleavedParts;
    expect(parts).toBeDefined();
    expect(parts.length).toBeGreaterThanOrEqual(3);

    const promptText = parts[0].text;
    // Must use Qwen VTO specification
    expect(promptText).toContain('QWEN VIRTUAL TRY-ON SPECIFICATION');
    expect(promptText).toContain('image_1: Primary model/subject');
    expect(promptText).toContain('image_2: Source clothing item');

    // Must NOT contain Gemini or GPT wording
    expect(promptText).not.toContain('/* VIRTUAL_TRY_ON_CONFIG */');
    expect(promptText).not.toContain('SUBJECT: The person/model to dress.');
  });

  it('enforces deterministic reference ordering: subject first (image_1), then garments (image_2..N)', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setSubjectImage(SUBJECT_1);
      const firstId = result.current.clothingItems[0].id;
      result.current.handleClothingUpload(GARMENT_TOP, firstId);
      result.current.addClothingUploader();
    });

    act(() => {
      const secondId = result.current.clothingItems[1].id;
      result.current.handleClothingUpload(GARMENT_SKIRT, secondId);
    });
    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
    const parts = localQwenEditImageMock.mock.calls[0][0].interleavedParts;

    // Part 0: prompt text
    expect(parts[0].text).toBeDefined();

    // Part 1: subject image first (image_1)
    expect(parts[1].inlineData?.data).toBe('subject-image-1');

    // Part 2: garment top second (image_2)
    expect(parts[2].inlineData?.data).toBe('garment-top-data');

    // Part 3: garment skirt third (image_3)
    expect(parts[3].inlineData?.data).toBe('garment-skirt-data');
  });

  it('enforces serial execution (concurrency: 1) when generating multiple subjects', async () => {
    let activeGenerations = 0;
    let maxConcurrentGenerations = 0;

    localQwenEditImageMock.mockImplementation(async () => {
      activeGenerations++;
      maxConcurrentGenerations = Math.max(maxConcurrentGenerations, activeGenerations);
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 25);
      await promise;
      activeGenerations--;
      return [RESULT_IMAGE];
    });

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_1, SUBJECT_2, SUBJECT_3]);
      result.current.handleClothingUpload(GARMENT_TOP, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(3);
    // Crucial requirement: Local Qwen concurrency MUST be strictly 1
    expect(maxConcurrentGenerations).toBe(1);
  });

  it('tags generated results in Gallery with localQwen engine tag', async () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setSubjectImage(SUBJECT_1);
      result.current.handleClothingUpload(GARMENT_TOP, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock).toHaveBeenCalledWith(RESULT_IMAGE, Feature.TryOn, 'localQwen');
  });

  it('persists an upscaled VTO result once as Feature.TryOn under the Local Qwen engine', async () => {
    localQwenUpscaleMock.mockResolvedValueOnce(UPSCALED_IMAGE);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setSubjectImage(SUBJECT_1);
      result.current.handleClothingUpload(GARMENT_TOP, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    addImageMock.mockClear();
    const itemId = result.current.subjectItems[0].id;

    await act(async () => {
      await result.current.handleUpscale(RESULT_IMAGE, 0, itemId);
    });

    // Slot replaced by the upscaled asset
    expect(result.current.subjectItems[0].results[0]).toEqual(UPSCALED_IMAGE);
    // Saved exactly once, tagged with the owning feature and active engine
    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock).toHaveBeenCalledWith(UPSCALED_IMAGE, Feature.TryOn, 'localQwen');
  });

  it('handles errors locally and NEVER falls back to cloud drivers', async () => {
    localQwenEditImageMock.mockRejectedValue(new Error('ComfyUI server out of memory (VRAM full)'));

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setSubjectImage(SUBJECT_1);
      result.current.handleClothingUpload(GARMENT_TOP, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    // Subject item status is error with local message
    expect(result.current.subjectItems[0].status).toBe('error');
    expect(result.current.subjectItems[0].error).toContain('ComfyUI server out of memory');

    // Cloud drivers MUST NEVER be called
    expect(cloudGeminiEditMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });

  describe('useLocalQwenImageEngine driver implementation', () => {
    beforeEach(() => {
      localStorage.clear();
      saveLocalQwenSettings({
        resolution: 768,
        steps: 20,
        cfg: 1.5,
        sampler: 'DPM++ 2M',
        scheduler: 'Karras',
      });
    });

    it('snapshots settings at job start and calls desktop bridge generateImage', async () => {
      const bridgeGenerateMock = vi.fn().mockResolvedValue({
        ok: true,
        value: {
          image: {
            base64: 'local-desktop-rendered-image',
            mimeType: 'image/png',
          },
        },
      });

      (window as unknown as { desktopLocalQwen: unknown }).desktopLocalQwen = {
        getStatus: vi.fn(),
        startServer: vi.fn(),
        stopServer: vi.fn(),
        generateImage: bridgeGenerateMock,
      };

      const { result } = renderHook(() => useLocalQwenImageEngine());

      expect(result.current.id).toBe('localQwen');
      expect(result.current.model).toBe('qwen-image-2.1');
      expect(result.current.createImageChatSession).toBeNull();
      expect(result.current.options).toBeNull();

      const editResult = await result.current.editImage(
        {
          images: [SUBJECT_1],
          prompt: 'Local Qwen try-on test prompt',
          numberOfImages: 1,
        },
        'qwen-image-2.1',
        undefined as unknown as { onStatusUpdate: (msg: string) => void },
      );

      expect(bridgeGenerateMock).toHaveBeenCalledTimes(1);
      const passedParams = bridgeGenerateMock.mock.calls[0][0];

      expect(passedParams.prompt).toBe('Local Qwen try-on test prompt');
      expect(passedParams.resolution).toBe(768);
      expect(passedParams.steps).toBe(20);
      expect(passedParams.cfg).toBe(1.5);
      expect(passedParams.sampler).toBe('DPM++ 2M');
      expect(passedParams.scheduler).toBe('Karras');

      expect(editResult).toEqual([
        {
          base64: 'local-desktop-rendered-image',
          mimeType: 'image/png',
        },
      ]);
    });
  });
});
