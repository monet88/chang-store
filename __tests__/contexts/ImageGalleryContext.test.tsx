/**
 * ImageGalleryContext Unit Tests
 *
 * Tests for the ImageGalleryProvider and useImageGallery hook.
 * Validates image gallery state management including:
 * - Adding images with duplicate prevention
 * - Gallery size limit enforcement (max 20 images)
 * - Deleting images by base64 identifier
 * - Clearing all images
 * - Hook usage outside provider throws error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ImageGalleryProvider, useImageGallery } from '@/contexts/ImageGalleryContext';
import { GoogleDriveProvider } from '@/contexts/GoogleDriveContext';
import { ImageFile } from '@/types';

// -----------------------------------------------------------------------------
// Test Utilities
// -----------------------------------------------------------------------------

/**
 * Wrapper component that provides ImageGalleryProvider context.
 * Required for testing hooks that depend on the provider.
 * Includes GoogleDriveProvider since ImageGalleryContext depends on it.
 */
const createWrapper = () => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <GoogleDriveProvider>
        <ImageGalleryProvider>{children}</ImageGalleryProvider>
      </GoogleDriveProvider>
    );
  };
};

/**
 * Creates a mock ImageFile for testing.
 * @param id - Unique identifier appended to base64 string
 * @param mimeType - Optional MIME type (default: image/png)
 */
const createMockImage = (id: string | number, mimeType = 'image/png'): ImageFile => ({
  base64: `mock-base64-data-${id}`,
  mimeType,
});

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

describe('ImageGalleryContext', () => {
  /**
   * Reset imageCache singleton before each test for isolation.
   * imageCache is a module-level singleton that persists across tests,
   * causing state accumulation if not cleared.
   */
  beforeEach(() => {
    // Clear the singleton imageCache by accessing internal state
    const { result } = renderHook(() => useImageGallery(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.clearImages();
    });
  });

  describe('useImageGallery hook', () => {
    it('throws error when used outside ImageGalleryProvider', () => {
      // Suppress console.error for cleaner test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useImageGallery());
      }).toThrow('useImageGallery must be used within an ImageGalleryProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used within provider', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.images).toEqual([]);
      expect(typeof result.current.addImage).toBe('function');
      expect(typeof result.current.deleteImage).toBe('function');
      expect(typeof result.current.clearImages).toBe('function');
    });
  });

  describe('addImage', () => {
    it('adds a new image and increases images.length by 1', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const mockImage = createMockImage(1);

      act(() => {
        result.current.addImage(mockImage);
      });

      expect(result.current.images).toHaveLength(1);
      // Use toMatchObject to ignore metadata fields (createdAt, feature)
      expect(result.current.images[0]).toMatchObject(mockImage);
    });

    it('adds images to the front of the array (newest first)', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const image1 = createMockImage(1);
      const image2 = createMockImage(2);

      act(() => {
        result.current.addImage(image1);
        result.current.addImage(image2);
      });

      expect(result.current.images).toHaveLength(2);
      expect(result.current.images[0]).toMatchObject(image2); // newest first
      expect(result.current.images[1]).toMatchObject(image1);
    });

    it('does not add duplicate image with same base64', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const mockImage = createMockImage(1);

      act(() => {
        result.current.addImage(mockImage);
        result.current.addImage(mockImage); // duplicate
      });

      expect(result.current.images).toHaveLength(1);
    });

    it('does not add duplicate even with different mimeType but same base64', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const image1: ImageFile = { base64: 'same-base64', mimeType: 'image/png' };
      const image2: ImageFile = { base64: 'same-base64', mimeType: 'image/jpeg' };

      act(() => {
        result.current.addImage(image1);
        result.current.addImage(image2); // same base64, different mimeType
      });

      expect(result.current.images).toHaveLength(1);
      expect(result.current.images[0].mimeType).toBe('image/png'); // original preserved
    });

    it('allows images with same mimeType but different base64', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const image1 = createMockImage(1, 'image/png');
      const image2 = createMockImage(2, 'image/png');

      act(() => {
        result.current.addImage(image1);
        result.current.addImage(image2);
      });

      expect(result.current.images).toHaveLength(2);
    });

    it('enforces gallery size limit of 20 images', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      // Add 25 images
      act(() => {
        for (let i = 1; i <= 25; i++) {
          result.current.addImage(createMockImage(i));
        }
      });

      expect(result.current.images).toHaveLength(20);
    });

    it('keeps newest images when limit exceeded (FIFO eviction)', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      // Add 22 images
      act(() => {
        for (let i = 1; i <= 22; i++) {
          result.current.addImage(createMockImage(i));
        }
      });

      // Newest (22) should be first, oldest kept (3) should be last
      expect(result.current.images[0].base64).toBe('mock-base64-data-22');
      expect(result.current.images[19].base64).toBe('mock-base64-data-3');
      // Oldest (1, 2) should be evicted
      expect(result.current.images.some(img => img.base64 === 'mock-base64-data-1')).toBe(false);
      expect(result.current.images.some(img => img.base64 === 'mock-base64-data-2')).toBe(false);
    });

    it('images.length never exceeds 20 even with rapid additions', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      // Add 100 images rapidly
      act(() => {
        for (let i = 1; i <= 100; i++) {
          result.current.addImage(createMockImage(i));
        }
      });

      expect(result.current.images.length).toBeLessThanOrEqual(20);
      expect(result.current.images).toHaveLength(20);
    });
  });

  describe('deleteImage', () => {
    it('removes image by base64 identifier', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const image1 = createMockImage(1);
      const image2 = createMockImage(2);

      act(() => {
        result.current.addImage(image1);
        result.current.addImage(image2);
      });

      expect(result.current.images).toHaveLength(2);

      act(() => {
        result.current.deleteImage(image1.base64);
      });

      expect(result.current.images).toHaveLength(1);
      expect(result.current.images[0]).toMatchObject(image2);
    });

    it('does nothing when deleting non-existent base64', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const mockImage = createMockImage(1);

      act(() => {
        result.current.addImage(mockImage);
      });

      act(() => {
        result.current.deleteImage('non-existent-base64');
      });

      expect(result.current.images).toHaveLength(1);
      expect(result.current.images[0]).toMatchObject(mockImage);
    });

    it('deletes from empty array without error', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.images).toHaveLength(0);

      act(() => {
        result.current.deleteImage('any-base64');
      });

      expect(result.current.images).toHaveLength(0);
    });

    it('deletes correct image when multiple images present', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const images = [1, 2, 3, 4, 5].map(id => createMockImage(id));

      act(() => {
        images.forEach(img => result.current.addImage(img));
      });

      // Delete middle image (3)
      act(() => {
        result.current.deleteImage(images[2].base64);
      });

      expect(result.current.images).toHaveLength(4);
      expect(result.current.images.some(img => img.base64 === images[2].base64)).toBe(false);
    });
  });

  describe('clearImages', () => {
    it('sets images to empty array', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      // Add some images
      act(() => {
        result.current.addImage(createMockImage(1));
        result.current.addImage(createMockImage(2));
        result.current.addImage(createMockImage(3));
      });

      expect(result.current.images).toHaveLength(3);

      act(() => {
        result.current.clearImages();
      });

      expect(result.current.images).toEqual([]);
      expect(result.current.images).toHaveLength(0);
    });

    it('clears empty array without error', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.images).toHaveLength(0);

      act(() => {
        result.current.clearImages();
      });

      expect(result.current.images).toEqual([]);
    });

    it('allows adding images after clearing', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      // Add, clear, add again
      act(() => {
        result.current.addImage(createMockImage(1));
        result.current.clearImages();
        result.current.addImage(createMockImage(2));
      });

      expect(result.current.images).toHaveLength(1);
      expect(result.current.images[0].base64).toBe('mock-base64-data-2');
    });
  });

  describe('combined operations', () => {
    it('handles add, delete, clear sequence correctly', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      // Add images
      act(() => {
        result.current.addImage(createMockImage(1));
        result.current.addImage(createMockImage(2));
      });
      expect(result.current.images).toHaveLength(2);

      // Delete one
      act(() => {
        result.current.deleteImage('mock-base64-data-1');
      });
      expect(result.current.images).toHaveLength(1);

      // Add more
      act(() => {
        result.current.addImage(createMockImage(3));
        result.current.addImage(createMockImage(4));
      });
      expect(result.current.images).toHaveLength(3);

      // Clear all
      act(() => {
        result.current.clearImages();
      });
      expect(result.current.images).toHaveLength(0);
    });

    it('re-adding deleted image is allowed', () => {
      const { result } = renderHook(() => useImageGallery(), {
        wrapper: createWrapper(),
      });

      const mockImage = createMockImage(1);

      act(() => {
        result.current.addImage(mockImage);
      });
      expect(result.current.images).toHaveLength(1);

      act(() => {
        result.current.deleteImage(mockImage.base64);
      });
      expect(result.current.images).toHaveLength(0);

      act(() => {
        result.current.addImage(mockImage);
      });
      expect(result.current.images).toHaveLength(1);
    });
  });
});
