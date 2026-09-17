/**
 * Unit tests for utils/galleryDB.ts
 *
 * Tests the IndexedDB-backed gallery persistence wrapper.
 * All operations use idb-keyval under the hood, so tests
 * verify correct key generation, data marshalling, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const { getMock, setMock, delMock, clearMock, keysMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  delMock: vi.fn(),
  clearMock: vi.fn(),
  keysMock: vi.fn(),
}));

vi.mock('idb-keyval', () => ({
  get: getMock,
  set: setMock,
  del: delMock,
  clear: clearMock,
  keys: keysMock,
}));

import { galleryDB } from '@/utils/galleryDB';
import type { GalleryImageFile } from '@/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_IMAGE: GalleryImageFile = {
  base64: 'dGVzdC1pbWFnZS1kYXRh',
  mimeType: 'image/png',
  createdAt: new Date('2026-04-29T00:00:00.000Z'),
};

const OTHER_IMAGE: GalleryImageFile = {
  base64: 'b3RoZXItaW1hZ2UtZGF0YQ==',
  mimeType: 'image/jpeg',
  createdAt: new Date('2026-04-30T00:00:00.000Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('galleryDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // getAllImages
  // --------------------------------------------------------------------------

  describe('getAllImages', () => {
    it('returns images from IndexedDB', async () => {
      const savedImages: GalleryImageFile[] = [TEST_IMAGE, OTHER_IMAGE];
      getMock.mockResolvedValueOnce(savedImages);

      const result = await galleryDB.getAllImages();

      expect(getMock).toHaveBeenCalledWith('chang-store-gallery-images');
      expect(result).toEqual(savedImages);
    });

    it('returns empty array when no images stored', async () => {
      getMock.mockResolvedValueOnce(undefined);

      const result = await galleryDB.getAllImages();

      expect(result).toEqual([]);
    });

    it('returns empty array on IndexedDB error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getMock.mockRejectedValueOnce(new Error('IndexedDB unavailable'));

      const result = await galleryDB.getAllImages();

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // saveAllImages
  // --------------------------------------------------------------------------

  describe('saveAllImages', () => {
    it('saves images array to IndexedDB', async () => {
      const images: GalleryImageFile[] = [TEST_IMAGE, OTHER_IMAGE];

      await galleryDB.saveAllImages(images);

      expect(setMock).toHaveBeenCalledWith('chang-store-gallery-images', images);
    });

    it('logs error when set fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setMock.mockRejectedValueOnce(new Error('write failed'));

      await galleryDB.saveAllImages([TEST_IMAGE]);

      // Should not throw
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save gallery to IndexedDB:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // saveImage
  // --------------------------------------------------------------------------

  describe('saveImage', () => {
    it('uses the first 32 chars of base64 as key', async () => {
      await galleryDB.saveImage(TEST_IMAGE);

      expect(setMock).toHaveBeenCalledWith(
        `img_${TEST_IMAGE.base64.substring(0, 32)}`,
        TEST_IMAGE,
      );
    });

    it('logs error when save fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setMock.mockRejectedValueOnce(new Error('set failed'));

      await galleryDB.saveImage(TEST_IMAGE);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save image to IndexedDB:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // deleteImage
  // --------------------------------------------------------------------------

  describe('deleteImage', () => {
    it('removes the image matching the base64 prefix', async () => {
      getMock.mockResolvedValueOnce([TEST_IMAGE, OTHER_IMAGE]);

      await galleryDB.deleteImage(TEST_IMAGE.base64.substring(0, 32));

      expect(setMock).toHaveBeenCalledWith('chang-store-gallery-images', [OTHER_IMAGE]);
    });

    it('keeps images that do not match the key', async () => {
      getMock.mockResolvedValueOnce([TEST_IMAGE, OTHER_IMAGE]);

      await galleryDB.deleteImage('non-existent-key');

      expect(setMock).toHaveBeenCalledWith('chang-store-gallery-images', [TEST_IMAGE, OTHER_IMAGE]);
    });

    it('handles read failure gracefully via getAllImages error path', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getMock.mockRejectedValueOnce(new Error('read error'));

      // deleteImage calls getAllImages internally, which catches the error
      // and returns [], so the delete catch block never runs
      await galleryDB.deleteImage(TEST_IMAGE.base64.substring(0, 32));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get gallery from IndexedDB:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // clearAll
  // --------------------------------------------------------------------------

  describe('clearAll', () => {
    it('deletes the gallery store key', async () => {
      await galleryDB.clearAll();

      expect(delMock).toHaveBeenCalledWith('chang-store-gallery-images');
    });

    it('handles clear failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      delMock.mockRejectedValueOnce(new Error('clear failed'));

      await galleryDB.clearAll();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear IndexedDB gallery:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
