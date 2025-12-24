/**
 * ImageViewerContext Unit Tests
 *
 * Tests for the ImageViewerProvider and useImageViewer hook.
 * Validates image viewer modal state management including:
 * - Opening image viewer with correct imageUrl
 * - Closing image viewer
 * - Navigation between gallery images (next/prev)
 * - Boundary handling (can't navigate past first/last)
 * - Navigation disabled when image not in gallery
 * - Hook usage outside provider throws error
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ImageViewerProvider, useImageViewer } from '@/contexts/ImageViewerContext';
import type { ImageFile } from '@/types';

// -----------------------------------------------------------------------------
// Mock Setup
// -----------------------------------------------------------------------------

/** Mutable array for controlling gallery images in tests */
let mockGalleryImages: ImageFile[] = [];

/**
 * Mock ImageGalleryContext to provide controlled gallery images.
 * Tests can modify mockGalleryImages to simulate different gallery states.
 */
vi.mock('@/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({ images: mockGalleryImages }),
}));

/**
 * Mock ImageModal to capture props and verify correct data flow.
 * Renders testable elements for interaction verification.
 */
vi.mock('@/components/ImageModal', () => ({
  default: vi.fn(({ imageUrl, onClose, onNext, onPrev, canNext, canPrev }) => (
    <div data-testid="image-modal">
      <span data-testid="image-url">{imageUrl}</span>
      <button data-testid="close-btn" onClick={onClose}>Close</button>
      {onNext && <button data-testid="next-btn" onClick={onNext} disabled={!canNext}>Next</button>}
      {onPrev && <button data-testid="prev-btn" onClick={onPrev} disabled={!canPrev}>Prev</button>}
      <span data-testid="can-next">{String(canNext)}</span>
      <span data-testid="can-prev">{String(canPrev)}</span>
    </div>
  )),
}));

// -----------------------------------------------------------------------------
// Test Utilities
// -----------------------------------------------------------------------------

/**
 * Wrapper component that provides ImageViewerProvider context.
 * Required for testing hooks that depend on the provider.
 */
const createWrapper = () => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ImageViewerProvider>{children}</ImageViewerProvider>;
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

/**
 * Test component that uses useImageViewer hook.
 * Renders a button to trigger openImageViewer with provided image.
 */
const TestConsumer: React.FC<{ image?: ImageFile }> = ({ image }) => {
  const { openImageViewer } = useImageViewer();
  return (
    <button
      data-testid="open-viewer-btn"
      onClick={() => image && openImageViewer(image)}
    >
      Open Viewer
    </button>
  );
};

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

describe('ImageViewerContext', () => {
  beforeEach(() => {
    // Reset gallery images before each test
    mockGalleryImages = [];
    vi.clearAllMocks();
  });

  describe('useImageViewer hook', () => {
    it('throws error when used outside ImageViewerProvider', () => {
      // Suppress console.error for cleaner test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useImageViewer());
      }).toThrow('useImageViewer must be used within an ImageViewerProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used within provider', () => {
      const { result } = renderHook(() => useImageViewer(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.openImageViewer).toBe('function');
    });
  });

  describe('initial state', () => {
    it('does not render ImageModal initially', () => {
      render(
        <ImageViewerProvider>
          <TestConsumer />
        </ImageViewerProvider>
      );

      expect(screen.queryByTestId('image-modal')).not.toBeInTheDocument();
    });
  });

  describe('openImageViewer', () => {
    it('shows modal with correct imageUrl when called', () => {
      const testImage = createMockImage('test');

      render(
        <ImageViewerProvider>
          <TestConsumer image={testImage} />
        </ImageViewerProvider>
      );

      // Initially no modal
      expect(screen.queryByTestId('image-modal')).not.toBeInTheDocument();

      // Open viewer
      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Modal should now be visible
      expect(screen.getByTestId('image-modal')).toBeInTheDocument();

      // Check correct image URL format
      const expectedUrl = `data:${testImage.mimeType};base64,${testImage.base64}`;
      expect(screen.getByTestId('image-url').textContent).toBe(expectedUrl);
    });

    it('constructs correct data URL with different mimeTypes', () => {
      const jpegImage = createMockImage('jpeg-test', 'image/jpeg');

      render(
        <ImageViewerProvider>
          <TestConsumer image={jpegImage} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      const expectedUrl = 'data:image/jpeg;base64,mock-base64-data-jpeg-test';
      expect(screen.getByTestId('image-url').textContent).toBe(expectedUrl);
    });
  });

  describe('closeImageViewer', () => {
    it('closes modal when close button clicked', () => {
      const testImage = createMockImage('test');

      render(
        <ImageViewerProvider>
          <TestConsumer image={testImage} />
        </ImageViewerProvider>
      );

      // Open viewer
      fireEvent.click(screen.getByTestId('open-viewer-btn'));
      expect(screen.getByTestId('image-modal')).toBeInTheDocument();

      // Close viewer
      fireEvent.click(screen.getByTestId('close-btn'));
      expect(screen.queryByTestId('image-modal')).not.toBeInTheDocument();
    });
  });

  describe('navigation with single image in gallery', () => {
    it('does not show navigation buttons when gallery has only one image', () => {
      const singleImage = createMockImage(1);
      mockGalleryImages = [singleImage];

      render(
        <ImageViewerProvider>
          <TestConsumer image={singleImage} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Navigation buttons should not exist (canNavigate = false when images.length <= 1)
      expect(screen.queryByTestId('next-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('prev-btn')).not.toBeInTheDocument();
    });
  });

  describe('navigation with multiple images', () => {
    it('shows navigation buttons when gallery has multiple images', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      const image3 = createMockImage(3);
      mockGalleryImages = [image1, image2, image3];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image2} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Both navigation buttons should exist for middle image
      expect(screen.getByTestId('next-btn')).toBeInTheDocument();
      expect(screen.getByTestId('prev-btn')).toBeInTheDocument();
    });

    it('navigates to next image when next button clicked', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image1} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Initially showing image1
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-1');

      // Click next
      fireEvent.click(screen.getByTestId('next-btn'));

      // Now showing image2
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-2');
    });

    it('navigates to previous image when prev button clicked', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image2} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Initially showing image2
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-2');

      // Click prev
      fireEvent.click(screen.getByTestId('prev-btn'));

      // Now showing image1
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-1');
    });

    it('can navigate through all images sequentially', () => {
      const images = [1, 2, 3, 4].map(id => createMockImage(id));
      mockGalleryImages = images;

      render(
        <ImageViewerProvider>
          <TestConsumer image={images[0]} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Navigate forward through all images
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-1');

      fireEvent.click(screen.getByTestId('next-btn'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-2');

      fireEvent.click(screen.getByTestId('next-btn'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-3');

      fireEvent.click(screen.getByTestId('next-btn'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-4');

      // Navigate backward
      fireEvent.click(screen.getByTestId('prev-btn'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-3');
    });
  });

  describe('boundary handling', () => {
    it('canPrev is false on first image', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      const image3 = createMockImage(3);
      mockGalleryImages = [image1, image2, image3];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image1} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // First image: canPrev should be false, canNext should be true
      expect(screen.getByTestId('can-prev').textContent).toBe('false');
      expect(screen.getByTestId('can-next').textContent).toBe('true');
    });

    it('canNext is false on last image', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      const image3 = createMockImage(3);
      mockGalleryImages = [image1, image2, image3];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image3} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Last image: canPrev should be true, canNext should be false
      expect(screen.getByTestId('can-prev').textContent).toBe('true');
      expect(screen.getByTestId('can-next').textContent).toBe('false');
    });

    it('middle image has both canPrev and canNext as true', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      const image3 = createMockImage(3);
      mockGalleryImages = [image1, image2, image3];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image2} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Middle image: both should be true
      expect(screen.getByTestId('can-prev').textContent).toBe('true');
      expect(screen.getByTestId('can-next').textContent).toBe('true');
    });

    it('does not navigate past first image', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image1} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Already at first image, click prev multiple times
      fireEvent.click(screen.getByTestId('prev-btn'));
      fireEvent.click(screen.getByTestId('prev-btn'));

      // Should still show first image
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-1');
    });

    it('does not navigate past last image', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image2} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Already at last image, click next multiple times
      fireEvent.click(screen.getByTestId('next-btn'));
      fireEvent.click(screen.getByTestId('next-btn'));

      // Should still show last image
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-2');
    });
  });

  describe('image not in gallery', () => {
    it('navigation is disabled when current image is not in gallery', () => {
      const galleryImage1 = createMockImage(1);
      const galleryImage2 = createMockImage(2);
      const outsideImage = createMockImage('outside');

      mockGalleryImages = [galleryImage1, galleryImage2];

      render(
        <ImageViewerProvider>
          <TestConsumer image={outsideImage} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Modal should show the outside image
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-outside');

      // Navigation buttons should not exist (viewingIndexInGallery === -1)
      expect(screen.queryByTestId('next-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('prev-btn')).not.toBeInTheDocument();
    });

    it('navigation is disabled when gallery is empty', () => {
      const testImage = createMockImage('test');
      mockGalleryImages = []; // Empty gallery

      render(
        <ImageViewerProvider>
          <TestConsumer image={testImage} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Modal should show but without navigation
      expect(screen.getByTestId('image-modal')).toBeInTheDocument();
      expect(screen.queryByTestId('next-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('prev-btn')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles opening different images sequentially', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      // Component that can switch between images
      const SwitchableConsumer: React.FC = () => {
        const { openImageViewer } = useImageViewer();
        return (
          <>
            <button data-testid="open-image-1" onClick={() => openImageViewer(image1)}>Open 1</button>
            <button data-testid="open-image-2" onClick={() => openImageViewer(image2)}>Open 2</button>
          </>
        );
      };

      render(
        <ImageViewerProvider>
          <SwitchableConsumer />
        </ImageViewerProvider>
      );

      // Open image 1
      fireEvent.click(screen.getByTestId('open-image-1'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-1');

      // Close and open image 2
      fireEvent.click(screen.getByTestId('close-btn'));
      fireEvent.click(screen.getByTestId('open-image-2'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-2');
    });

    it('handles opening new image while modal is already open', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      const SwitchableConsumer: React.FC = () => {
        const { openImageViewer } = useImageViewer();
        return (
          <>
            <button data-testid="open-image-1" onClick={() => openImageViewer(image1)}>Open 1</button>
            <button data-testid="open-image-2" onClick={() => openImageViewer(image2)}>Open 2</button>
          </>
        );
      };

      render(
        <ImageViewerProvider>
          <SwitchableConsumer />
        </ImageViewerProvider>
      );

      // Open image 1
      fireEvent.click(screen.getByTestId('open-image-1'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-1');

      // Open image 2 without closing (should switch to image 2)
      fireEvent.click(screen.getByTestId('open-image-2'));
      expect(screen.getByTestId('image-url').textContent).toContain('mock-base64-data-2');
    });

    it('provider renders children correctly', () => {
      render(
        <ImageViewerProvider>
          <div data-testid="child-element">Child Content</div>
        </ImageViewerProvider>
      );

      expect(screen.getByTestId('child-element')).toBeInTheDocument();
      expect(screen.getByTestId('child-element').textContent).toBe('Child Content');
    });

    it('two-image gallery with navigation from first to second and back', () => {
      const image1 = createMockImage(1);
      const image2 = createMockImage(2);
      mockGalleryImages = [image1, image2];

      render(
        <ImageViewerProvider>
          <TestConsumer image={image1} />
        </ImageViewerProvider>
      );

      fireEvent.click(screen.getByTestId('open-viewer-btn'));

      // Start at first, navigate to second
      expect(screen.getByTestId('can-prev').textContent).toBe('false');
      expect(screen.getByTestId('can-next').textContent).toBe('true');

      fireEvent.click(screen.getByTestId('next-btn'));

      // Now at second, canNext should be false
      expect(screen.getByTestId('can-prev').textContent).toBe('true');
      expect(screen.getByTestId('can-next').textContent).toBe('false');

      fireEvent.click(screen.getByTestId('prev-btn'));

      // Back at first
      expect(screen.getByTestId('can-prev').textContent).toBe('false');
      expect(screen.getByTestId('can-next').textContent).toBe('true');
    });
  });
});
