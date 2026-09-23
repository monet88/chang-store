import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ImageFile } from '@/types';
import { useLocalQwenImageEngine } from '@/hooks/useLocalQwenImageEngine';
import { ImageGalleryContext, type ImageGalleryContextType } from '@/contexts/ImageGalleryContext';

const addImageMock = vi.hoisted(() => vi.fn());

// Cloud drivers to verify they are NEVER called as fallbacks
const cloudGeminiEditMock = vi.hoisted(() => vi.fn());
const cloudGeminiUpscaleMock = vi.hoisted(() => vi.fn());
const cloudGptEditMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/imageEditingService', () => ({
  editImage: cloudGeminiEditMock,
  upscaleImage: cloudGeminiUpscaleMock,
  createImageChatSession: vi.fn(),
}));

vi.mock('@/services/providers/gpt-image/gptImageService', () => ({
  editGptImage: cloudGptEditMock,
}));
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      if (key === 'studio.localQwenStatus.upscaling') return 'Upscaling image with local ComfyUI...';
      return key;
    },
  }),
}));

const ORIGINAL_IMAGE: ImageFile = {
  base64: 'original-photo-base64',
  mimeType: 'image/png',
};

const UPSCALED_BASE64 = 'upscaled-hires-base64';

describe('useLocalQwenImageEngine - Explicit Upscale without Cloud Fallback', () => {
  const desktopUpscaleMock = vi.fn();
  const desktopGenerateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    cloudGeminiEditMock.mockReset();
    cloudGeminiUpscaleMock.mockReset();
    cloudGptEditMock.mockReset();
    desktopUpscaleMock.mockReset();
    desktopGenerateMock.mockReset();

    window.desktopLocalQwen = {
      getStatus: vi.fn(),
      startServer: vi.fn(),
      stopServer: vi.fn(),
      generateImage: desktopGenerateMock,
      cancelJob: vi.fn(),
      upscaleImage: desktopUpscaleMock,
    };
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ImageGalleryContext.Provider
      value={{
        images: [],
        addImage: addImageMock,
        deleteImage: vi.fn(),
        clearImages: vi.fn(),
        getCacheMetrics: vi.fn() as unknown as ImageGalleryContextType['getCacheMetrics'],
      }}
    >
      {children}
    </ImageGalleryContext.Provider>
  );

  it('triggers explicit upscale through desktopLocalQwen bridge without premature gallery persistence', async () => {
    desktopUpscaleMock.mockResolvedValueOnce({
      ok: true,
      value: { image: UPSCALED_BASE64 },
    });

    const statusUpdates: string[] = [];
    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    let upscaled: ImageFile | undefined;
    await act(async () => {
      upscaled = await result.current.upscaleImage(
        ORIGINAL_IMAGE,
        undefined,
        { onStatusUpdate: (msg) => statusUpdates.push(msg) },
        '2K',
      );
    });

    // 1. Verify bridge called with original image base64 and 2x scale
    expect(desktopUpscaleMock).toHaveBeenCalledTimes(1);
    expect(desktopUpscaleMock).toHaveBeenCalledWith({
      image: ORIGINAL_IMAGE.base64,
      scale: 2,
    });

    // 2. Verify returned upscaled image
    expect(upscaled).toEqual({
      base64: UPSCALED_BASE64,
      mimeType: 'image/png',
    });

    // 3. Verify status updates
    expect(statusUpdates.length).toBeGreaterThan(0);
    expect(statusUpdates[0]).toContain('ComfyUI');

    // 4. Verify upscaleImage does NOT prematurely add to gallery with undefined feature,
    // preserving feature-owned gallery persistence without dedupe lockout
    expect(addImageMock).not.toHaveBeenCalled();

    // 5. Verify cloud drivers NEVER called
    expect(cloudGeminiUpscaleMock).not.toHaveBeenCalled();
    expect(cloudGeminiEditMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });

  it('uses 4x scale factor when quality is 4K', async () => {
    desktopUpscaleMock.mockResolvedValueOnce({
      ok: true,
      value: { image: '4k-upscaled-base64' },
    });

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    await act(async () => {
      await result.current.upscaleImage(
        ORIGINAL_IMAGE,
        undefined,
        undefined,
        '4K',
      );
    });

    expect(desktopUpscaleMock).toHaveBeenCalledWith({
      image: ORIGINAL_IMAGE.base64,
      scale: 4,
    });
  });

  it('returns image/png mimeType even when input image is JPEG', async () => {
    desktopUpscaleMock.mockResolvedValueOnce({
      ok: true,
      value: { image: UPSCALED_BASE64, mimeType: 'image/png' },
    });

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });
    const jpegInput: ImageFile = {
      base64: 'jpeg-photo-base64',
      mimeType: 'image/jpeg',
    };

    let upscaled: ImageFile | undefined;
    await act(async () => {
      upscaled = await result.current.upscaleImage(jpegInput, undefined, undefined, '2K');
    });

    expect(upscaled?.mimeType).toBe('image/png');
  });

  it('preserves original image intact and throws clean error on failure without calling cloud', async () => {
    desktopUpscaleMock.mockResolvedValueOnce({
      ok: false,
      error: { message: 'ComfyUI upscale failed: model not found' },
    });

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    const originalCopy: ImageFile = {
      base64: 'preserve-this-exact-data',
      mimeType: 'image/jpeg',
    };

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.upscaleImage(originalCopy, undefined as unknown as string, undefined as unknown as { onStatusUpdate: (msg: string) => void });
      } catch (err) {
        caughtError = err as Error;
      }
    });

    // 1. Error is clean local error
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toContain('ComfyUI upscale failed: model not found');

    // 2. Original image untouched
    expect(originalCopy.base64).toBe('preserve-this-exact-data');
    expect(originalCopy.mimeType).toBe('image/jpeg');

    // 3. Gallery addImage was NOT called for failed upscale
    expect(addImageMock).not.toHaveBeenCalled();

    // 4. Crucial: CLOUD DRIVERS NEVER CALLED AS FALLBACK
    expect(cloudGeminiUpscaleMock).not.toHaveBeenCalled();
    expect(cloudGeminiEditMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });

  it('throws clean error if desktop bridge is not available', async () => {
    delete window.desktopLocalQwen;

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    await act(async () => {
      await expect(
        result.current.upscaleImage(ORIGINAL_IMAGE, undefined as unknown as string, undefined as unknown as { onStatusUpdate: (msg: string) => void }),
      ).rejects.toThrow(/desktop app runtime/);
    });

    expect(cloudGeminiUpscaleMock).not.toHaveBeenCalled();
    expect(cloudGptEditMock).not.toHaveBeenCalled();
  });

  it('does NOT auto-upscale after editImage generation (explicit action only)', async () => {
    desktopGenerateMock.mockResolvedValueOnce({
      ok: true,
      value: {
        image: {
          base64: 'raw-generated-512px-image',
          mimeType: 'image/png',
        },
      },
    });

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    let generated: ImageFile[] = [];
    await act(async () => {
      generated = await result.current.editImage(
        { prompt: 'A stylish jacket', images: [] },
        'qwen-image-2.1',
        undefined as unknown as { onStatusUpdate: (msg: string) => void },
      );
    });

    // 1. generateImage called once
    expect(desktopGenerateMock).toHaveBeenCalledTimes(1);

    // 2. upscaleImage NEVER called automatically
    expect(desktopUpscaleMock).not.toHaveBeenCalled();

    // 3. Result is raw generated output
    expect(generated.length).toBe(1);
    expect(generated[0].base64).toBe('raw-generated-512px-image');
  });

  it('serializes concurrent operations (concurrency = 1)', async () => {
    let activeOperations = 0;
    let maxConcurrency = 0;

    desktopUpscaleMock.mockImplementation(async () => {
      activeOperations++;
      maxConcurrency = Math.max(maxConcurrency, activeOperations);
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 50);
      await promise;
      activeOperations--;
      return { ok: true, value: { image: 'upscaled' } };
    });

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    await act(async () => {
      // Launch two upscales concurrently
      const p1 = result.current.upscaleImage(ORIGINAL_IMAGE, undefined as unknown as string, undefined as unknown as { onStatusUpdate: (msg: string) => void });
      const p2 = result.current.upscaleImage(ORIGINAL_IMAGE, undefined as unknown as string, undefined as unknown as { onStatusUpdate: (msg: string) => void });
      await Promise.all([p1, p2]);
    });

    // Max concurrency must strictly be 1
    expect(maxConcurrency).toBe(1);
    expect(desktopUpscaleMock).toHaveBeenCalledTimes(2);
  });
});
