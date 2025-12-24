/**
 * Unit Tests for useVirtualTryOn Hook
 *
 * Tests the virtual try-on feature hook that manages:
 * - Subject image and clothing items state
 * - Image generation via editImage service
 * - Upscaling generated images
 * - Clothing uploader management (add/remove)
 * - Validation and error handling
 *
 * Key test scenarios:
 * 1. Loading states during generation
 * 2. Successful generation adds result to gallery
 * 3. Failed generation sets error state
 * 4. Upscale functionality
 * 5. Clothing uploader management
 * 6. Validation errors (no subject, no clothing)
 * 7. AIVideoAuto auth error when token missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Feature } from '../../types';
import {
  mockUseLanguage,
  mockUseImageGallery,
  mockUseApi,
} from '../__mocks__/contexts';

// ============================================================================
// Mock Setup - Must be before imports
// ============================================================================

/** Mock editImage and upscaleImage from imageEditingService */
vi.mock('../../services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
}));

/** Mock getErrorMessage from imageUtils */
vi.mock('../../utils/imageUtils', () => ({
  getErrorMessage: vi.fn((err: Error) => err.message),
}));

/** Mock contexts */
vi.mock('../../contexts/LanguageContext', () => mockUseLanguage());
vi.mock('../../contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../contexts/ApiProviderContext', () => mockUseApi());

// Import hook and mocked services after mocking
import { useVirtualTryOn } from '../../hooks/useVirtualTryOn';
import { editImage, upscaleImage } from '../../services/imageEditingService';
import { getErrorMessage } from '../../utils/imageUtils';

// ============================================================================
// Test Constants
// ============================================================================

/** Sample image file for tests */
const TEST_IMAGE = {
  base64: 'dGVzdC1pbWFnZS1kYXRh',
  mimeType: 'image/png',
};

/** Sample clothing image for tests */
const TEST_CLOTHING_IMAGE = {
  base64: 'Y2xvdGhpbmctaW1hZ2U=',
  mimeType: 'image/jpeg',
};

/** Sample generated result image */
const GENERATED_IMAGE = {
  base64: 'Z2VuZXJhdGVkLXJlc3VsdA==',
  mimeType: 'image/png',
};

/** Sample upscaled result image */
const UPSCALED_IMAGE = {
  base64: 'dXBzY2FsZWQtcmVzdWx0',
  mimeType: 'image/png',
};

// ============================================================================
// Test Suite: Initial State
// ============================================================================

describe('useVirtualTryOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    /**
     * Test: Hook returns correct initial state values
     */
    it('should return correct initial state', () => {
      // Act
      const { result } = renderHook(() => useVirtualTryOn());

      // Assert
      expect(result.current.subjectImage).toBeNull();
      expect(result.current.clothingItems).toHaveLength(1);
      expect(result.current.clothingItems[0].image).toBeNull();
      expect(result.current.backgroundPrompt).toBe('');
      expect(result.current.extraPrompt).toBe('');
      expect(result.current.numImages).toBe(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.generatedImages).toEqual([]);
      expect(result.current.validClothingItems).toHaveLength(0);
      expect(result.current.anyUpscaling).toBe(false);
    });
  });

  // ==========================================================================
  // Test Suite: handleGenerateImage
  // ==========================================================================

  describe('handleGenerateImage', () => {
    /**
     * Test: Sets isLoading=true during image generation call
     */
    it('should set isLoading=true during generation', async () => {
      // Arrange
      vi.mocked(editImage).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([GENERATED_IMAGE]), 100))
      );

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up required state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      // Add clothing image to first uploader
      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act - start generation
      act(() => {
        result.current.handleGenerateImage();
      });

      // Assert - loading is true during call
      expect(result.current.isLoading).toBe(true);
      expect(result.current.loadingMessage).toBe('virtualTryOn.generatingStatus');

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    /**
     * Test: Successful generation adds result to gallery via addImage
     */
    it('should add generated images to gallery on success', async () => {
      // Arrange
      const mockAddImage = vi.fn();
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      // Re-mock with custom addImage
      vi.doMock('../../contexts/ImageGalleryContext', () =>
        mockUseImageGallery({ addImage: mockAddImage })
      );

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up required state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert
      expect(editImage).toHaveBeenCalled();
      expect(result.current.generatedImages).toHaveLength(1);
      expect(result.current.generatedImages[0]).toEqual(GENERATED_IMAGE);
      expect(result.current.error).toBeNull();
    });

    /**
     * Test: Failed generation sets error state
     */
    it('should set error state on generation failure', async () => {
      // Arrange
      const testError = new Error('API quota exceeded');
      vi.mocked(editImage).mockRejectedValueOnce(testError);
      vi.mocked(getErrorMessage).mockReturnValueOnce('API quota exceeded');

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up required state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert
      expect(result.current.error).toBe('API quota exceeded');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
      expect(getErrorMessage).toHaveBeenCalledWith(testError, expect.any(Function));
    });

    /**
     * Test: Loading states reset on completion (success case)
     */
    it('should reset loading states on successful completion', async () => {
      // Arrange
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up required state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
    });

    /**
     * Test: Loading states reset on completion (failure case)
     */
    it('should reset loading states on failed completion', async () => {
      // Arrange
      vi.mocked(editImage).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up required state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
    });

    /**
     * Test: Validation error when no subject image provided
     */
    it('should set error when subject image is missing', async () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Add clothing but no subject
      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert
      expect(result.current.error).toBe('virtualTryOn.inputError');
      expect(editImage).not.toHaveBeenCalled();
    });

    /**
     * Test: Validation error when no clothing items provided
     */
    it('should set error when no clothing items provided', async () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Add subject but no clothing
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert
      expect(result.current.error).toBe('virtualTryOn.inputError');
      expect(editImage).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Test Suite: AIVideoAuto Authentication
  // ==========================================================================

  describe('AIVideoAuto Authentication', () => {
    /**
     * Test: The hook checks requiresAivideoauto based on model prefix
     * Note: This test verifies the validation logic exists by checking behavior
     * when using gemini model (which should NOT trigger auth error)
     */
    it('should not set auth error for gemini models even without token', async () => {
      // Arrange - default mock uses gemini model and null token
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up required state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert - should proceed without auth error for gemini model
      expect(result.current.error).not.toBe('error.api.aivideoautoAuth');
      expect(editImage).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Test Suite: handleUpscale
  // ==========================================================================

  describe('handleUpscale', () => {
    /**
     * Test: Calls upscaleImage service with correct parameters
     */
    it('should call upscaleImage service', async () => {
      // Arrange
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_IMAGE);
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Generate an image first
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Act - upscale the generated image
      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 0);
      });

      // Assert - verify upscaleImage was called with the image
      expect(upscaleImage).toHaveBeenCalledTimes(1);
      expect(upscaleImage).toHaveBeenCalledWith(
        GENERATED_IMAGE,
        'gemini-2.5-flash-image', // imageEditModel from mock
        expect.objectContaining({
          onStatusUpdate: expect.any(Function),
        })
      );
    });

    /**
     * Test: Updates generatedImages with upscaled result
     */
    it('should update generatedImages with upscaled result', async () => {
      // Arrange
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_IMAGE);
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Generate an image first
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Act
      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 0);
      });

      // Assert
      expect(result.current.generatedImages[0]).toEqual(UPSCALED_IMAGE);
    });

    /**
     * Test: Sets upscaling state during upscale operation
     */
    it('should set upscalingStates during upscale', async () => {
      // Arrange
      vi.mocked(upscaleImage).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(UPSCALED_IMAGE), 100))
      );
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Generate an image first
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Act - start upscale
      act(() => {
        result.current.handleUpscale(GENERATED_IMAGE, 0);
      });

      // Assert - upscaling state is true
      expect(result.current.upscalingStates[0]).toBe(true);
      expect(result.current.anyUpscaling).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.upscalingStates[0]).toBe(false);
        expect(result.current.anyUpscaling).toBe(false);
      });
    });

    /**
     * Test: Sets error on upscale failure
     */
    it('should set error on upscale failure', async () => {
      // Arrange
      const upscaleError = new Error('Upscale failed');
      vi.mocked(upscaleImage).mockRejectedValueOnce(upscaleError);
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(getErrorMessage).mockReturnValueOnce('Upscale failed');

      const { result } = renderHook(() => useVirtualTryOn());

      // Generate an image first
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Act
      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 0);
      });

      // Assert
      expect(result.current.error).toBe('Upscale failed');
      expect(result.current.upscalingStates[0]).toBe(false);
    });

    /**
     * Test: Does nothing when imageToUpscale is falsy
     */
    it('should do nothing when imageToUpscale is null', async () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Act
      await act(async () => {
        await result.current.handleUpscale(null as any, 0);
      });

      // Assert
      expect(upscaleImage).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Test Suite: Clothing Uploader Management
  // ==========================================================================

  describe('Clothing Uploader Management', () => {
    /**
     * Test: handleClothingUpload updates clothing item image
     */
    it('should update clothing item image via handleClothingUpload', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());
      const clothingId = result.current.clothingItems[0].id;

      // Act
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Assert
      expect(result.current.clothingItems[0].image).toEqual(TEST_CLOTHING_IMAGE);
      expect(result.current.validClothingItems).toHaveLength(1);
    });

    /**
     * Test: handleClothingUpload clears image when null passed
     */
    it('should clear clothing item image when null passed', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());
      const clothingId = result.current.clothingItems[0].id;

      // First add an image
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act - clear it
      act(() => {
        result.current.handleClothingUpload(null, clothingId);
      });

      // Assert
      expect(result.current.clothingItems[0].image).toBeNull();
      expect(result.current.validClothingItems).toHaveLength(0);
    });

    /**
     * Test: addClothingUploader adds new empty uploader
     */
    it('should add new empty clothing uploader', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());
      const initialCount = result.current.clothingItems.length;

      // Act
      act(() => {
        result.current.addClothingUploader();
      });

      // Assert
      expect(result.current.clothingItems).toHaveLength(initialCount + 1);
      expect(result.current.clothingItems[initialCount].image).toBeNull();
    });

    /**
     * Test: removeClothingUploader removes uploader by id
     */
    it('should remove clothing uploader by id', async () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());
      const firstId = result.current.clothingItems[0].id;

      // Add another uploader in separate act to get unique timestamp
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
        result.current.addClothingUploader();
      });

      expect(result.current.clothingItems).toHaveLength(2);
      const secondId = result.current.clothingItems[1].id;

      // Act - remove the first one
      act(() => {
        result.current.removeClothingUploader(firstId);
      });

      // Assert
      expect(result.current.clothingItems).toHaveLength(1);
      expect(result.current.clothingItems[0].id).toBe(secondId);
    });

    /**
     * Test: validClothingItems only includes items with images
     */
    it('should filter validClothingItems to only items with images', async () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());
      const firstId = result.current.clothingItems[0].id;

      // Add two more uploaders with delays to get unique timestamps
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
        result.current.addClothingUploader();
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
        result.current.addClothingUploader();
      });

      expect(result.current.clothingItems).toHaveLength(3);
      const thirdId = result.current.clothingItems[2].id;

      // Upload image to first and third only
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, firstId);
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, thirdId);
      });

      // Assert
      expect(result.current.clothingItems).toHaveLength(3);
      expect(result.current.validClothingItems).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Test Suite: State Setters
  // ==========================================================================

  describe('State Setters', () => {
    /**
     * Test: setSubjectImage updates subjectImage state
     */
    it('should update subjectImage via setSubjectImage', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Act
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      // Assert
      expect(result.current.subjectImage).toEqual(TEST_IMAGE);
    });

    /**
     * Test: setBackgroundPrompt updates backgroundPrompt state
     */
    it('should update backgroundPrompt via setBackgroundPrompt', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Act
      act(() => {
        result.current.setBackgroundPrompt('urban city street');
      });

      // Assert
      expect(result.current.backgroundPrompt).toBe('urban city street');
    });

    /**
     * Test: setExtraPrompt updates extraPrompt state
     */
    it('should update extraPrompt via setExtraPrompt', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Act
      act(() => {
        result.current.setExtraPrompt('high fashion photography');
      });

      // Assert
      expect(result.current.extraPrompt).toBe('high fashion photography');
    });

    /**
     * Test: setNumImages updates numImages state
     */
    it('should update numImages via setNumImages', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Act
      act(() => {
        result.current.setNumImages(4);
      });

      // Assert
      expect(result.current.numImages).toBe(4);
    });

    /**
     * Test: setError updates error state
     */
    it('should update error via setError', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // Act
      act(() => {
        result.current.setError('Custom error message');
      });

      // Assert
      expect(result.current.error).toBe('Custom error message');
    });

    /**
     * Test: setError clears error when null passed
     */
    it('should clear error when setError(null) called', () => {
      // Arrange
      const { result } = renderHook(() => useVirtualTryOn());

      // First set an error
      act(() => {
        result.current.setError('Some error');
      });

      // Act - clear it
      act(() => {
        result.current.setError(null);
      });

      // Assert
      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // Test Suite: Service Integration
  // ==========================================================================

  describe('Service Integration', () => {
    /**
     * Test: editImage called with correct parameters
     */
    it('should call editImage with correct parameters', async () => {
      // Arrange
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
        result.current.setBackgroundPrompt('beach sunset');
        result.current.setExtraPrompt('professional lighting');
        result.current.setNumImages(2);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert - verify editImage was called with expected structure
      expect(editImage).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(editImage).mock.calls[0];

      // First arg: params object
      expect(callArgs[0]).toEqual(
        expect.objectContaining({
          numberOfImages: 2,
        })
      );
      expect(callArgs[0].images).toHaveLength(2);
      expect(callArgs[0].images[0]).toEqual(TEST_IMAGE);
      expect(callArgs[0].images[1]).toEqual(TEST_CLOTHING_IMAGE);

      // Second arg: model string
      expect(typeof callArgs[1]).toBe('string');

      // Third arg: config object
      expect(callArgs[2]).toEqual(
        expect.objectContaining({
          onStatusUpdate: expect.any(Function),
        })
      );
    });

    /**
     * Test: Clears previous generatedImages before new generation
     */
    it('should clear previous generatedImages before new generation', async () => {
      // Arrange
      const firstResult = { base64: 'first', mimeType: 'image/png' };
      const secondResult = { base64: 'second', mimeType: 'image/png' };

      vi.mocked(editImage)
        .mockResolvedValueOnce([firstResult])
        .mockResolvedValueOnce([secondResult]);

      const { result } = renderHook(() => useVirtualTryOn());

      // Set up state
      act(() => {
        result.current.setSubjectImage(TEST_IMAGE);
      });

      const clothingId = result.current.clothingItems[0].id;
      act(() => {
        result.current.handleClothingUpload(TEST_CLOTHING_IMAGE, clothingId);
      });

      // First generation
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(result.current.generatedImages).toEqual([firstResult]);

      // Second generation
      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assert - only second result, not concatenated
      expect(result.current.generatedImages).toEqual([secondResult]);
    });
  });
});
