import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GalleryImageFile } from '@/types';

const { getAllImagesMock, saveAllImagesMock } = vi.hoisted(() => ({
  getAllImagesMock: vi.fn(),
  saveAllImagesMock: vi.fn(),
}));

vi.mock('@/utils/galleryDB', () => ({
  galleryDB: {
    getAllImages: getAllImagesMock,
    saveAllImages: saveAllImagesMock,
  },
}));

import { useGalleryPersistence } from '@/hooks/useGalleryPersistence';

describe('useGalleryPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates cache and state from IndexedDB images', async () => {
    const savedImages = [
      {
        base64: 'persisted-image',
        mimeType: 'image/png',
        feature: 'clothing-transfer',
        engine: 'gptImage',
        createdAt: '2026-04-29T00:00:00.000Z',
      },
    ] as unknown as GalleryImageFile[];
    const hydratedImages: GalleryImageFile[] = [
      {
        base64: 'persisted-image',
        mimeType: 'image/png',
        feature: 'clothing-transfer',
        engine: 'gptImage',
        createdAt: new Date('2026-04-29T00:00:00.000Z'),
      },
    ];

    getAllImagesMock.mockResolvedValueOnce(savedImages);

    const imageCache = {
      hydrate: vi.fn(),
      getAll: vi.fn(() => hydratedImages),
    };
    const setImages = vi.fn();

    const { result } = renderHook(() =>
      useGalleryPersistence(imageCache as never, setImages),
    );

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(imageCache.hydrate).toHaveBeenCalledWith([
      expect.objectContaining({
        feature: 'clothing-transfer',
        engine: 'gptImage',
        createdAt: expect.any(Date),
      }),
    ]);
    expect(setImages).toHaveBeenCalledWith(hydratedImages);
  });

  it('persists gallery snapshots through galleryDB', async () => {
    getAllImagesMock.mockResolvedValueOnce([]);
    saveAllImagesMock.mockResolvedValueOnce(undefined);

    const imageCache = {
      hydrate: vi.fn(),
      getAll: vi.fn(() => []),
    };
    const setImages = vi.fn();
    const images: GalleryImageFile[] = [
      {
        base64: 'to-save',
        mimeType: 'image/png',
        feature: 'try-on',
        engine: 'gemini',
        createdAt: new Date('2026-04-29T00:00:00.000Z'),
      },
    ];

    const { result } = renderHook(() =>
      useGalleryPersistence(imageCache as never, setImages),
    );

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    await act(async () => {
      await result.current.persistGallery(images);
    });

    expect(saveAllImagesMock).toHaveBeenCalledWith(images);
  });
});
