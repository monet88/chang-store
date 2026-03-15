/**
 * Unit Tests for useClothingTransfer Hook
 *
 * Tests the clothing transfer feature hook that manages:
 * - Reference images and concept image state
 * - Image generation via editImage service
 * - Upscaling generated images
 * - Reference uploader management (add/remove)
 * - Validation and error handling
 *
 * Key test scenarios:
 * 1. Validation guards (no refs, no concept)
 * 2. Image ordering contract (concept FIRST, refs AFTER)
 * 3. Successful generation adds result to gallery
 * 4. Failed generation sets error state
 * 5. Upscale functionality
 * 6. Reference uploader management
 * 7. buildClothingTransferPrompt accuracy
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
import { useClothingTransfer } from '../../hooks/useClothingTransfer';
import { editImage, upscaleImage } from '../../services/imageEditingService';
import { getErrorMessage } from '../../utils/imageUtils';

// ============================================================================
// Test Constants
// ============================================================================

/** Sample reference image for tests */
const TEST_REFERENCE_1 = {
  base64: 'cmVmLTEtaW1hZ2UtZGF0YQ==',
  mimeType: 'image/png',
};

/** Sample second reference image for tests */
const TEST_REFERENCE_2 = {
  base64: 'cmVmLTItaW1hZ2UtZGF0YQ==',
  mimeType: 'image/jpeg',
};

/** Sample concept image (styled photo) for tests */
const TEST_CONCEPT_IMAGE = {
  base64: 'Y29uY2VwdC1pbWFnZS1kYXRh',
  mimeType: 'image/png',
};

/** Sample generated result image */
const GENERATED_IMAGE = {
  base64: 'Z2VuZXJhdGVkLWNsb3RoaW5nLXJlc3VsdA==',
  mimeType: 'image/png',
};

/** Sample upscaled result image */
const UPSCALED_IMAGE = {
  base64: 'dXBzY2FsZWQtY2xvdGhpbmctcmVzdWx0',
  mimeType: 'image/png',
};

// ============================================================================
// Test Suite: Initial State
// ============================================================================

describe('useClothingTransfer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    /**
     * Test: Hook returns correct initial state values
     */
    it('should return correct initial state', () => {
      // Act
      const { result } = renderHook(() => useClothingTransfer());

      // Assert
      expect(result.current.referenceItems).toHaveLength(1);
      expect(result.current.referenceItems[0].image).toBeNull();
      expect(result.current.conceptImage).toBeNull();
      expect(result.current.extraPrompt).toBe('');
      expect(result.current.numImages).toBe(1);
      expect(result.current.aspectRatio).toBe('Default');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.generatedImages).toEqual([]);
      expect(result.current.validReferences).toHaveLength(0);
      expect(result.current.anyUpscaling).toBe(false);
    });
  });

  // ==========================================================================
  // Test Suite: Validation Guards
  // ==========================================================================

  describe('Validation Guards', () => {
    /**
     * Test: Validation guard - no refs + no concept → error set, editImage NOT called
     */
    it('should set error when no references and no concept image', async () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert
      expect(result.current.error).toBe('clothingTransfer.inputError');
      expect(editImage).not.toHaveBeenCalled();
    });

    /**
     * Test: Validation guard - refs but no concept → error set
     */
    it('should set error when references exist but no concept image', async () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

      // Add reference image
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert
      expect(result.current.error).toBe('clothingTransfer.inputError');
      expect(editImage).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Test Suite: Image Ordering Contract
  // ==========================================================================

  describe('Image Ordering Contract', () => {
    /**
     * Test: Image ordering contract - verify editImage receives [concept_first, ref_1...ref_N]
     */
    it('should pass images to editImage in correct order: concept first, references after', async () => {
      // Arrange
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useClothingTransfer());

      // Add first reference
      const refId1 = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId1);
      });

      // Add second reference
      act(() => {
        result.current.addReference();
      });

      const refId2 = result.current.referenceItems[1].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_2, refId2);
      });

      // Add concept image
      act(() => {
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert - verify correct order: [concept, ref1, ref2]
      const callArgs = vi.mocked(editImage).mock.calls[0];
      const imagesParam = callArgs[0].images;

      expect(imagesParam).toHaveLength(3);
      expect(imagesParam[0]).toEqual(TEST_CONCEPT_IMAGE);
      expect(imagesParam[1]).toEqual(TEST_REFERENCE_1);
      expect(imagesParam[2]).toEqual(TEST_REFERENCE_2);
    });
  });

  // ==========================================================================
  // Test Suite: handleGenerate
  // ==========================================================================

  describe('handleGenerate', () => {
    /**
     * Test: Sets isLoading=true during generation call
     */
    it('should set isLoading=true during generation', async () => {
      // Arrange
      vi.mocked(editImage).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([GENERATED_IMAGE]), 100))
      );

      const { result } = renderHook(() => useClothingTransfer());

      // Set up required state
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      // Act - start generation
      act(() => {
        result.current.handleGenerate();
      });

      // Assert - loading is true during call
      expect(result.current.isLoading).toBe(true);
      expect(result.current.loadingMessage).toBe('clothingTransfer.generatingStatus');

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    /**
     * Test: Successful generation sets generatedImages and calls addImage
     */
    it('should add generated images to gallery on success', async () => {
      // Arrange
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useClothingTransfer());

      // Set up required state
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
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

      const { result } = renderHook(() => useClothingTransfer());

      // Set up required state
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert
      expect(result.current.error).toBe('API quota exceeded');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
      expect(getErrorMessage).toHaveBeenCalledWith(testError, expect.any(Function));
    });

    /**
     * Test: Loading states reset on successful completion
     */
    it('should reset loading states on successful completion', async () => {
      // Arrange
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useClothingTransfer());

      // Set up required state
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
    });

    /**
     * Test: buildClothingTransferPrompt - correct prompt with N refs + extra instructions
     */
    it('should build correct prompt with multiple references and extra instructions', async () => {
      // Arrange
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useClothingTransfer());

      // Add two references
      const refId1 = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId1);
      });

      act(() => {
        result.current.addReference();
      });

      const refId2 = result.current.referenceItems[1].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_2, refId2);
      });

      // Set concept and extra prompt
      act(() => {
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
        result.current.setExtraPrompt('high fashion photography, studio lighting');
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert - check the interleaved parts contain correct content
      const callArgs = vi.mocked(editImage).mock.calls[0];
      const parts = callArgs[0].interleavedParts;

      // interleavedParts should exist and contain text parts with expected content
      expect(parts).toBeDefined();
      const textContent = parts!.filter((p: any) => p.text).map((p: any) => p.text).join('\n');

      expect(textContent).toContain('DESTINATION SCENE');
      expect(textContent).toContain('SOURCE OUTFIT');
      expect(textContent).toContain('Replace all clothing in the DESTINATION SCENE');
      expect(textContent).toContain('high fashion photography, studio lighting');
    });

    /**
     * Test: Multiple images generated and all added to gallery
     */
    it('should handle multiple generated images and add all to gallery', async () => {
      // Arrange
      const result2 = { base64: 'result-2', mimeType: 'image/png' };
      const result3 = { base64: 'result-3', mimeType: 'image/png' };

      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE, result2, result3]);

      const { result } = renderHook(() => useClothingTransfer());

      // Set up required state
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
        result.current.setNumImages(3);
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert
      expect(result.current.generatedImages).toHaveLength(3);
      expect(result.current.generatedImages).toEqual([GENERATED_IMAGE, result2, result3]);
    });
  });

  // ==========================================================================
  // Test Suite: handleUpscale
  // ==========================================================================

  describe('handleUpscale', () => {
    /**
     * Test: Calls upscaleImage service with correct parameters
     */
    it('should call upscaleImage service with correct parameters', async () => {
      // Arrange
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_IMAGE);
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);

      const { result } = renderHook(() => useClothingTransfer());

      // Generate an image first
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Act - upscale the generated image
      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 0);
      });

      // Assert
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

      const { result } = renderHook(() => useClothingTransfer());

      // Generate an image first
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
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

      const { result } = renderHook(() => useClothingTransfer());

      // Generate an image first
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
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
      const upscaleError = new Error('Upscale service error');
      vi.mocked(upscaleImage).mockRejectedValueOnce(upscaleError);
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(getErrorMessage).mockReturnValueOnce('Upscale service error');

      const { result } = renderHook(() => useClothingTransfer());

      // Generate an image first
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Act
      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 0);
      });

      // Assert
      expect(result.current.error).toBe('Upscale service error');
      expect(result.current.upscalingStates[0]).toBe(false);
    });

    /**
     * Test: Does nothing when imageToUpscale is falsy
     */
    it('should do nothing when imageToUpscale is null', async () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

      // Act
      await act(async () => {
        await result.current.handleUpscale(null as any, 0);
      });

      // Assert
      expect(upscaleImage).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Test Suite: Reference Management
  // ==========================================================================

  describe('Reference Management', () => {
    /**
     * Test: handleReferenceUpload updates reference item image
     */
    it('should update reference item image via handleReferenceUpload', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());
      const refId = result.current.referenceItems[0].id;

      // Act
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
      });

      // Assert
      expect(result.current.referenceItems[0].image).toEqual(TEST_REFERENCE_1);
      expect(result.current.validReferences).toHaveLength(1);
    });

    /**
     * Test: handleReferenceUpload clears image when null passed
     */
    it('should clear reference item image when null passed', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());
      const refId = result.current.referenceItems[0].id;

      // First add an image
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
      });

      // Act - clear it
      act(() => {
        result.current.handleReferenceUpload(null, refId);
      });

      // Assert
      expect(result.current.referenceItems[0].image).toBeNull();
      expect(result.current.validReferences).toHaveLength(0);
    });

    /**
     * Test: addReference adds new empty item
     */
    it('should add new empty reference item', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());
      const initialCount = result.current.referenceItems.length;

      // Act
      act(() => {
        result.current.addReference();
      });

      // Assert
      expect(result.current.referenceItems).toHaveLength(initialCount + 1);
      expect(result.current.referenceItems[initialCount].image).toBeNull();
    });

    /**
     * Test: removeReference removes item by id
     */
    it('should remove reference item by id', async () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());
      const firstId = result.current.referenceItems[0].id;

      // Add another reference with delay to ensure unique ids
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
        result.current.addReference();
      });

      expect(result.current.referenceItems).toHaveLength(2);
      const secondId = result.current.referenceItems[1].id;

      // Act - remove the first one
      act(() => {
        result.current.removeReference(firstId);
      });

      // Assert
      expect(result.current.referenceItems).toHaveLength(1);
      expect(result.current.referenceItems[0].id).toBe(secondId);
    });

    /**
     * Test: validReferences only includes items with images
     */
    it('should filter validReferences to only items with images', async () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());
      const firstId = result.current.referenceItems[0].id;

      // Add two more references with delays to get unique ids
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
        result.current.addReference();
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
        result.current.addReference();
      });

      expect(result.current.referenceItems).toHaveLength(3);
      const thirdId = result.current.referenceItems[2].id;

      // Upload image to first and third only
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, firstId);
        result.current.handleReferenceUpload(TEST_REFERENCE_2, thirdId);
      });

      // Assert
      expect(result.current.referenceItems).toHaveLength(3);
      expect(result.current.validReferences).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Test Suite: State Setters
  // ==========================================================================

  describe('State Setters', () => {
    /**
     * Test: setExtraPrompt updates extraPrompt state
     */
    it('should update extraPrompt via setExtraPrompt', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

      // Act
      act(() => {
        result.current.setExtraPrompt('high fashion, studio lighting');
      });

      // Assert
      expect(result.current.extraPrompt).toBe('high fashion, studio lighting');
    });

    /**
     * Test: setNumImages updates numImages state
     */
    it('should update numImages via setNumImages', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

      // Act
      act(() => {
        result.current.setNumImages(4);
      });

      // Assert
      expect(result.current.numImages).toBe(4);
    });

    /**
     * Test: setAspectRatio updates aspectRatio state
     */
    it('should update aspectRatio via setAspectRatio', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

      // Act
      act(() => {
        result.current.setAspectRatio('16:9');
      });

      // Assert
      expect(result.current.aspectRatio).toBe('16:9');
    });

    /**
     * Test: setError updates error state
     */
    it('should update error via setError', () => {
      // Arrange
      const { result } = renderHook(() => useClothingTransfer());

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
      const { result } = renderHook(() => useClothingTransfer());

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

      const { result } = renderHook(() => useClothingTransfer());

      // Set up state with custom values
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
        result.current.setExtraPrompt('professional styling');
        result.current.setNumImages(2);
        result.current.setAspectRatio('1:1');
      });

      // Act
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert - verify editImage was called with expected structure
      expect(editImage).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(editImage).mock.calls[0];

      // First arg: params object
      expect(callArgs[0]).toEqual(
        expect.objectContaining({
          numberOfImages: 2,
          aspectRatio: '1:1',
        })
      );
      expect(callArgs[0].images).toHaveLength(2);
      expect(callArgs[0].images[0]).toEqual(TEST_CONCEPT_IMAGE);
      expect(callArgs[0].images[1]).toEqual(TEST_REFERENCE_1);
      // Prompt is empty since content goes through interleavedParts
      expect(callArgs[0].prompt).toBe('');
      // interleavedParts should contain the extra instructions
      const textContent = callArgs[0].interleavedParts!.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
      expect(textContent).toContain('professional styling');

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

      const { result } = renderHook(() => useClothingTransfer());

      // Set up state
      const refId = result.current.referenceItems[0].id;
      act(() => {
        result.current.handleReferenceUpload(TEST_REFERENCE_1, refId);
        result.current.handleConceptUpload(TEST_CONCEPT_IMAGE);
      });

      // First generation
      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.generatedImages).toEqual([firstResult]);

      // Second generation
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Assert - only second result, not concatenated
      expect(result.current.generatedImages).toEqual([secondResult]);
    });
  });
});
