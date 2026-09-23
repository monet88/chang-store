import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';
import { Feature } from '@/types';
import type { ImageFile } from '@/types';
import { useIdentityTransfer } from '@/hooks/useIdentityTransfer';
import { AiScanProvider, type AiScanAnalyzer } from '@/contexts/AiScanContext';
import { AI_SCAN_BLOCK_HEADER } from '@/utils/ai-scan-blueprint';

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
    language: 'en',
  }),
}));

vi.mock('@/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    addImage: addImageMock,
    images: [],
    deleteImage: vi.fn(),
    clearImages: vi.fn(),
    getCacheMetrics: vi.fn(),
  }),
}));

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    isConfigured: true,
  }),
}));

const defaultsMock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/utils/identity-transfer-defaults', () => ({
  loadDefaultIdentityReferences: defaultsMock.load,
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
    noSelectableModel: true,
    options: null,
  }),
);

const DESTINATION_1: ImageFile = { base64: 'dest-image-1', mimeType: 'image/png' };
const DESTINATION_2: ImageFile = { base64: 'dest-image-2', mimeType: 'image/png' };
const DESTINATION_3: ImageFile = { base64: 'dest-image-3', mimeType: 'image/png' };

const FACE_REF: ImageFile = { base64: 'face-reference-data', mimeType: 'image/jpeg' };
const BODY_REF: ImageFile = { base64: 'body-reference-data', mimeType: 'image/jpeg' };

const RESULT_1: ImageFile = { base64: 'result-image-1', mimeType: 'image/png' };
const RESULT_2: ImageFile = { base64: 'result-image-2', mimeType: 'image/png' };
const RESULT_3: ImageFile = { base64: 'result-image-3', mimeType: 'image/png' };

const scanWrapper = (analyze: AiScanAnalyzer, enabled: boolean) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AiScanProvider analyze={analyze} initialEnabled={enabled}>
        {children}
      </AiScanProvider>
    );
  };

describe('useIdentityTransfer with Local Qwen Image Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    localQwenEditImageMock.mockReset();
    cloudGeminiEditMock.mockReset();
    cloudGptEditMock.mockReset();
    defaultsMock.load.mockResolvedValue({ face: null, body: null });

    localQwenEditImageMock.mockResolvedValue([RESULT_1]);
  });

  it('selects Qwen prompt family and never Gemini or GPT prompt format', async () => {
    const { result } = renderHook(() => useIdentityTransfer());

    expect(result.current.engineId).toBe('localQwen');

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1]);
      result.current.setFaceReference(FACE_REF);
      result.current.setBodyReference(BODY_REF);
      result.current.setBackgroundPrompt('dramatic sunset skyline');
      result.current.setExtraPrompt('gentle smile');
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
    expect(parts.length).toBe(4);

    const promptText = parts[0].text;
    // Must use Qwen Identity Transfer specification
    expect(promptText).toContain('QWEN IDENTITY TRANSFER SPECIFICATION');
    expect(promptText).toContain('image_1: Destination image');
    expect(promptText).toContain('image_2: Face reference');
    expect(promptText).toContain('image_3: Body reference');
    expect(promptText).toContain('IDENTITY & FACIAL REALISM');
    expect(promptText).toContain('facial geometry');
    expect(promptText).toContain('skin tone');
    expect(promptText).toContain('hair texture');
    expect(promptText).toContain('SCENE, POSE & LIGHTING PRESERVATION');
    expect(promptText).toContain('Replace the background entirely with: "dramatic sunset skyline"');
    expect(promptText).toContain('gentle smile');

    // Must NOT contain Gemini or GPT wording
    expect(promptText).not.toContain('DESTINATION IMAGE: Authority for pose');
    expect(promptText).not.toContain('IMAGE 1 = DESTINATION IMAGE:');
  });

  it('enforces deterministic reference ordering: destination first (image_1), face (image_2), body (image_3)', async () => {
    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1]);
      result.current.setFaceReference(FACE_REF);
      result.current.setBodyReference(BODY_REF);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
    const parts = localQwenEditImageMock.mock.calls[0][0].interleavedParts;

    // Part 0: prompt text
    expect(parts[0].text).toBeDefined();

    // Part 1: destination image first (image_1)
    expect(parts[1].inlineData?.data).toBe('dest-image-1');

    // Part 2: face reference second (image_2)
    expect(parts[2].inlineData?.data).toBe('face-reference-data');

    // Part 3: body reference third (image_3)
    expect(parts[3].inlineData?.data).toBe('body-reference-data');
  });

  it('omits body reference image when bodyReference is null', async () => {
    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1]);
      result.current.setFaceReference(FACE_REF);
      result.current.setBodyReference(null);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
    const parts = localQwenEditImageMock.mock.calls[0][0].interleavedParts;

    expect(parts).toHaveLength(3);
    expect(parts[1].inlineData?.data).toBe('dest-image-1');
    expect(parts[2].inlineData?.data).toBe('face-reference-data');
    expect(parts[0].text).toContain('No body reference provided');
    expect(parts[0].text).not.toContain('image_3: Body reference');
  });

  it('enforces serial execution (concurrency: 1) when generating multiple destination items', async () => {
    let activeGenerations = 0;
    let maxConcurrentGenerations = 0;

    localQwenEditImageMock.mockImplementation(async () => {
      activeGenerations++;
      maxConcurrentGenerations = Math.max(maxConcurrentGenerations, activeGenerations);
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 25);
      await promise;
      activeGenerations--;
      return [RESULT_1];
    });

    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1, DESTINATION_2, DESTINATION_3]);
      result.current.setFaceReference(FACE_REF);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(localQwenEditImageMock).toHaveBeenCalledTimes(3);
    // Crucial requirement: Local Qwen concurrency MUST be strictly 1
    expect(maxConcurrentGenerations).toBe(1);
    expect(result.current.completedCount).toBe(3);
  });

  it('isolates AI Scan blueprint per destination photo', async () => {
    const analyze = vi.fn<AiScanAnalyzer>(async (image) =>
      image === DESTINATION_1 ? 'BLUEPRINT DESTINATION 1: silk dress' : 'BLUEPRINT DESTINATION 2: linen suit',
    );
    localQwenEditImageMock
      .mockResolvedValueOnce([RESULT_1])
      .mockResolvedValueOnce([RESULT_2]);

    const { result } = renderHook(() => useIdentityTransfer(), {
      wrapper: scanWrapper(analyze, true),
    });

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1, DESTINATION_2]);
      result.current.setFaceReference(FACE_REF);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(analyze).toHaveBeenCalledTimes(2);

    const firstCallParts = localQwenEditImageMock.mock.calls[0][0].interleavedParts;
    const secondCallParts = localQwenEditImageMock.mock.calls[1][0].interleavedParts;

    const firstPrompt = firstCallParts[0].text ?? '';
    const secondPrompt = secondCallParts[0].text ?? '';

    expect(firstPrompt).toContain(AI_SCAN_BLOCK_HEADER);
    expect(firstPrompt).toContain('BLUEPRINT DESTINATION 1: silk dress');
    expect(firstPrompt).not.toContain('BLUEPRINT DESTINATION 2');

    expect(secondPrompt).toContain(AI_SCAN_BLOCK_HEADER);
    expect(secondPrompt).toContain('BLUEPRINT DESTINATION 2: linen suit');
    expect(secondPrompt).not.toContain('BLUEPRINT DESTINATION 1');
  });

  it('supports handleRegenerateSingle and preserves sibling results', async () => {
    localQwenEditImageMock
      .mockResolvedValueOnce([RESULT_1])
      .mockResolvedValueOnce([RESULT_2]);

    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1, DESTINATION_2]);
      result.current.setFaceReference(FACE_REF);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.destinationItems[0].results).toEqual([RESULT_1]);
    expect(result.current.destinationItems[1].results).toEqual([RESULT_2]);
    expect(result.current.completedCount).toBe(2);

    const REGEN_RESULT_1: ImageFile = { base64: 'regen-result-1', mimeType: 'image/png' };
    localQwenEditImageMock.mockResolvedValueOnce([REGEN_RESULT_1]);

    await act(async () => {
      await result.current.handleRegenerateSingle(result.current.destinationItems[0].id);
    });

    // Destination 1 updated to regenerated result
    expect(result.current.destinationItems[0].results).toEqual([REGEN_RESULT_1]);
    expect(result.current.destinationItems[0].status).toBe('completed');

    // Sibling Destination 2 preserved untouched
    expect(result.current.destinationItems[1].results).toEqual([RESULT_2]);
    expect(result.current.destinationItems[1].status).toBe('completed');
  });

  it('tags generated results in Gallery with localQwen engine tag', async () => {
    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1]);
      result.current.setFaceReference(FACE_REF);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock).toHaveBeenCalledWith(RESULT_1, Feature.IdentityTransfer, 'localQwen');
  });

  it('handles errors locally and NEVER falls back to cloud drivers', async () => {
    localQwenEditImageMock.mockRejectedValue(new Error('ComfyUI server out of memory (CUDA OOM)'));

    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_1]);
      result.current.setFaceReference(FACE_REF);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    // Destination item status is error with local message
    expect(result.current.destinationItems[0].status).toBe('error');
    expect(result.current.destinationItems[0].error).toContain('ComfyUI server out of memory');

    // Cloud drivers MUST NEVER be called
    expect(cloudGeminiEditMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });
});
