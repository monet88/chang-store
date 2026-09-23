import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ImageFile } from '@/types';
import { useLocalQwenImageEngine, cancelQueuedLocalQwenJobs } from '@/hooks/useLocalQwenImageEngine';
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

  it('cooperatively cancels queued batch jobs without running them, while later fresh jobs run normally', async () => {
    const executionLog: string[] = [];
    let resolveJob1: () => void = () => {};

    desktopUpscaleMock.mockImplementation(async (params: { image: string }) => {
      if (params.image === 'job-1') {
        executionLog.push('job-1-started');
        const { promise, resolve } = Promise.withResolvers<void>();
        resolveJob1 = resolve;
        await promise;
        executionLog.push('job-1-finished');
        return { ok: true, value: { image: 'upscaled-1' } };
      }
      if (params.image === 'job-2') {
        executionLog.push('job-2-started');
        return { ok: true, value: { image: 'upscaled-2' } };
      }
      if (params.image === 'job-3') {
        executionLog.push('job-3-started');
        return { ok: true, value: { image: 'upscaled-3' } };
      }
      if (params.image === 'job-fresh') {
        executionLog.push('job-fresh-started');
        return { ok: true, value: { image: 'upscaled-fresh' } };
      }
      return { ok: true, value: { image: 'upscaled-default' } };
    });

    const { result } = renderHook(() => useLocalQwenImageEngine(), { wrapper });

    let p1: Promise<ImageFile>;
    let p2: Promise<ImageFile>;
    let p3: Promise<ImageFile>;

    // Enqueue 3 batch jobs in sequence
    p1 = result.current.upscaleImage({ base64: 'job-1', mimeType: 'image/png' }, undefined, undefined);
    p2 = result.current.upscaleImage({ base64: 'job-2', mimeType: 'image/png' }, undefined, undefined);
    p3 = result.current.upscaleImage({ base64: 'job-3', mimeType: 'image/png' }, undefined, undefined);

    // Give microtasks time so job 1 enters execution and job 2 and 3 are waiting in queue
    await act(async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 10);
      await promise;
    });

    expect(executionLog).toEqual(['job-1-started']);

    // Cancel batch while job 1 is in-flight
    cancelQueuedLocalQwenJobs();
    const p2Caught = p2.catch((e: Error) => e);
    const p3Caught = p3.catch((e: Error) => e);

    // Complete job 1
    await act(async () => {
      resolveJob1();
      await p1;
    });

    // Queued jobs 2 and 3 must reject with cancellation error
    const err2 = (await p2Caught) as Error;
    const err3 = (await p3Caught) as Error;
    expect(err2.message).toBe('Local Qwen generation was cancelled.');
    expect(err3.message).toBe('Local Qwen generation was cancelled.');
    // Notice: job-2 and job-3 never called desktopUpscaleMock!
    expect(executionLog).toEqual(['job-1-started', 'job-1-finished']);

    // Later fresh user job enqueued after cancel runs normally
    let freshResult: ImageFile | undefined;
    await act(async () => {
      freshResult = await result.current.upscaleImage({ base64: 'job-fresh', mimeType: 'image/png' }, undefined, undefined);
    });

    expect(freshResult?.base64).toBe('upscaled-fresh');
    expect(executionLog).toEqual(['job-1-started', 'job-1-finished', 'job-fresh-started']);
  });
});
