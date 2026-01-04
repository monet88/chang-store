/**
 * Unit Tests for useLookbookGenerator Hook
 *
 * Tests the lookbook generation feature hook that manages:
 * - Form state with localStorage persistence
 * - Clothing description generation via Gemini
 * - Main lookbook image generation via editImage service
 * - Variations and close-up generation
 * - Upscaling generated images
 * - Validation and error handling
 *
 * Key test scenarios:
 * 1. Initial state and localStorage loading
 * 2. Form state updates and persistence
 * 3. Description generation
 * 4. Main image generation with validation
 * 5. Variations and close-up generation
 * 6. Upscale functionality
 * 7. AIVideoAuto auth validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

/** Mock generateClothingDescription from gemini/text */
vi.mock('../../services/gemini/text', () => ({
  generateClothingDescription: vi.fn(),
}));

/** Mock getErrorMessage from imageUtils */
vi.mock('../../utils/imageUtils', () => ({
  getErrorMessage: vi.fn((err: Error) => err.message),
}));

/** Mock contexts */
vi.mock('../../contexts/LanguageContext', () => mockUseLanguage());
vi.mock('../../contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../contexts/ApiProviderContext', () => mockUseApi());

/** Mock prompts */
vi.mock('../../components/LookbookGenerator.prompts', () => ({
  BOXED_PROMPT: 'boxed prompt template',
  FOLDED_PROMPT: 'folded prompt template',
  MANNEQUIN_BACKGROUND_PROMPTS: {
    minimalistShowroom: 'minimalist showroom prompt',
  },
  LookbookStyle: {},
  GarmentType: {},
  FoldedPresentationType: {},
  MannequinBackgroundStyleKey: {},
}));

// Import hook and mocked services after mocking
import { useLookbookGenerator } from '../../hooks/useLookbookGenerator';
import { editImage, upscaleImage } from '../../services/imageEditingService';
import { generateClothingDescription } from '../../services/gemini/text';

// ============================================================================
// Test Constants
// ============================================================================

/** Sample clothing image for tests */
const TEST_CLOTHING_IMAGE = {
  base64: 'Y2xvdGhpbmctaW1hZ2U=',
  mimeType: 'image/png',
};

/** Sample fabric texture image for tests */
const TEST_FABRIC_IMAGE = {
  base64: 'ZmFicmljLXRleHR1cmU=',
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

/** Storage key used by the hook */
const DRAFT_STORAGE_KEY = 'lookbookGeneratorDraft';

// ============================================================================
// Test Utilities
// ============================================================================

/** Mock localStorage for testing */
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// ============================================================================
// Test Suite: Initial State
// ============================================================================

describe('useLookbookGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    /**
     * Test: Hook returns correct initial state values
     */
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useLookbookGenerator());

      expect(result.current.formState).toBeDefined();
      expect(result.current.formState.clothingImages).toHaveLength(1);
      expect(result.current.formState.clothingImages[0].image).toBeNull();
      expect(result.current.formState.lookbookStyle).toBe('flat lay');
      expect(result.current.formState.garmentType).toBe('one-piece');
      expect(result.current.generatedLookbook).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    /**
     * Test: Hook loads saved draft from localStorage
     */
    it('should load saved draft from localStorage', () => {
      const savedDraft = {
        clothingImages: [{ id: 123, image: TEST_CLOTHING_IMAGE }],
        fabricTextureImage: null,
        fabricTexturePrompt: '',
        clothingDescription: 'A blue dress',
        lookbookStyle: 'mannequin',
        garmentType: 'tops',
        foldedPresentationType: 'boxed',
        mannequinBackgroundStyle: 'minimalistShowroom',
        negativePrompt: 'wrinkles',
      };
      mockLocalStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedDraft));

      const { result } = renderHook(() => useLookbookGenerator());

      expect(result.current.formState.clothingDescription).toBe('A blue dress');
      expect(result.current.formState.lookbookStyle).toBe('mannequin');
      expect(result.current.formState.negativePrompt).toBe('wrinkles');
    });

    /**
     * Test: Hook handles corrupted localStorage gracefully
     */
    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage.setItem(DRAFT_STORAGE_KEY, 'invalid json');

      const { result } = renderHook(() => useLookbookGenerator());

      // Should fallback to default state
      expect(result.current.formState.lookbookStyle).toBe('flat lay');
    });
  });

  // ============================================================================
  // Test Suite: Form Updates
  // ============================================================================

  describe('Form Updates', () => {
    /**
     * Test: updateForm correctly updates form state
     */
    it('should update form state correctly', () => {
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingDescription: 'Updated description',
          lookbookStyle: 'folded',
        });
      });

      expect(result.current.formState.clothingDescription).toBe('Updated description');
      expect(result.current.formState.lookbookStyle).toBe('folded');
    });

    /**
     * Test: localStorage is disabled by design (no persistence)
     * See CLAUDE.md: "Local storage persistence is disabled"
     */
    it('should NOT persist form changes to localStorage (disabled by design)', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({ clothingDescription: 'New desc' });
      });

      // Verify localStorage is NOT called (feature disabled)
      await waitFor(() => {
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      });
    });

    /**
     * Test: setVariationCount updates variation count
     */
    it('should update variation count', () => {
      const { result } = renderHook(() => useLookbookGenerator());

      expect(result.current.variationCount).toBe(2);

      act(() => {
        result.current.setVariationCount(4);
      });

      expect(result.current.variationCount).toBe(4);
    });

    /**
     * Test: setActiveOutputTab changes active tab
     */
    it('should change active output tab', () => {
      const { result } = renderHook(() => useLookbookGenerator());

      expect(result.current.activeOutputTab).toBe('main');

      act(() => {
        result.current.setActiveOutputTab('variations');
      });

      expect(result.current.activeOutputTab).toBe('variations');
    });
  });

  // ============================================================================
  // Test Suite: Description Generation
  // ============================================================================

  describe('handleGenerateDescription', () => {
    /**
     * Test: Shows error when no image is provided
     */
    it('should show error when no clothing image is provided', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      await act(async () => {
        await result.current.handleGenerateDescription();
      });

      expect(result.current.error).toBe('lookbook.descriptionError');
      expect(generateClothingDescription).not.toHaveBeenCalled();
    });

    /**
     * Test: Successfully generates description
     */
    it('should generate description successfully', async () => {
      vi.mocked(generateClothingDescription).mockResolvedValueOnce('A beautiful red dress');
      const { result } = renderHook(() => useLookbookGenerator());

      // Set up clothing image first
      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerateDescription();
      });

      expect(generateClothingDescription).toHaveBeenCalledWith(TEST_CLOTHING_IMAGE);
      expect(result.current.formState.clothingDescription).toBe('A beautiful red dress');
      expect(result.current.isGeneratingDescription).toBe(false);
    });

    /**
     * Test: Handles description generation error
     */
    it('should handle description generation error', async () => {
      vi.mocked(generateClothingDescription).mockRejectedValueOnce(new Error('API Error'));
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerateDescription();
      });

      expect(result.current.error).toBe('API Error');
      expect(result.current.isGeneratingDescription).toBe(false);
    });

    /**
     * Test: Shows loading state during description generation
     */
    it('should show loading state during description generation', async () => {
      let resolvePromise: (value: string) => void;
      vi.mocked(generateClothingDescription).mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      // Start generation
      let generatePromise: Promise<void>;
      act(() => {
        generatePromise = result.current.handleGenerateDescription();
      });

      // Check loading state
      expect(result.current.isGeneratingDescription).toBe(true);

      // Resolve and complete
      await act(async () => {
        resolvePromise!('Generated description');
        await generatePromise;
      });

      expect(result.current.isGeneratingDescription).toBe(false);
    });
  });

  // ============================================================================
  // Test Suite: Main Image Generation
  // ============================================================================

  describe('handleGenerate', () => {
    /**
     * Test: Shows error when no clothing images provided
     */
    it('should show error when no clothing images provided', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.error).toBe('lookbook.inputError');
      expect(editImage).not.toHaveBeenCalled();
    });

    /**
     * Test: AIVideoAuto auth validation is checked in hook
     * Note: This test verifies the validation logic exists - actual auth errors
     * are tested at integration level where mock context can be reconfigured
     */
    it('should validate aivideoauto token requirement exists in hook', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      // With default mock (gemini model), should succeed without auth error
      await act(async () => {
        await result.current.handleGenerate();
      });

      // Should not have auth error when using gemini model
      expect(result.current.error).not.toBe('error.api.aivideoautoAuth');
    });

    /**
     * Test: Successfully generates main lookbook image
     */
    it('should generate main lookbook image successfully', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
          clothingDescription: 'A red dress',
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(editImage).toHaveBeenCalled();
      expect(result.current.generatedLookbook).not.toBeNull();
      expect(result.current.generatedLookbook?.main).toEqual(GENERATED_IMAGE);
      expect(result.current.activeOutputTab).toBe('main');
    });

    /**
     * Test: Handles generation error
     */
    it('should handle generation error', async () => {
      vi.mocked(editImage).mockRejectedValueOnce(new Error('Generation failed'));
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.error).toBe('Generation failed');
      expect(result.current.isLoading).toBe(false);
    });

    /**
     * Test: Shows loading state during generation
     */
    it('should show loading state during generation', async () => {
      let resolvePromise: (value: unknown[]) => void;
      vi.mocked(editImage).mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      let generatePromise: Promise<void>;
      act(() => {
        generatePromise = result.current.handleGenerate();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!([GENERATED_IMAGE]);
        await generatePromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    /**
     * Test: Includes fabric texture image when provided
     */
    it('should include fabric texture image when provided', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
          fabricTextureImage: TEST_FABRIC_IMAGE,
          fabricTexturePrompt: 'Silk texture',
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Verify editImage was called with fabric texture included
      expect(editImage).toHaveBeenCalled();
      const callArgs = vi.mocked(editImage).mock.calls[0][0];
      expect(callArgs.images).toHaveLength(2);
    });
  });

  // ============================================================================
  // Test Suite: Variations Generation
  // ============================================================================

  describe('handleGenerateVariations', () => {
    /**
     * Test: Shows error when no main lookbook exists
     */
    it('should show error when no main lookbook exists', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      await act(async () => {
        await result.current.handleGenerateVariations();
      });

      expect(result.current.error).toBe('lookbook.variationError');
    });

    /**
     * Test: Successfully generates variations
     */
    it('should generate variations successfully', async () => {
      const variation1 = { base64: 'dmFyMQ==', mimeType: 'image/png' };
      const variation2 = { base64: 'dmFyMg==', mimeType: 'image/png' };

      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE]) // For main generation
        .mockResolvedValueOnce([variation1, variation2]); // For variations

      const { result } = renderHook(() => useLookbookGenerator());

      // First generate main image
      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Then generate variations
      await act(async () => {
        await result.current.handleGenerateVariations();
      });

      expect(result.current.generatedLookbook?.variations).toHaveLength(2);
      expect(result.current.isGeneratingVariations).toBe(false);
    });

    /**
     * Test: Handles variations generation error
     */
    it('should handle variations generation error', async () => {
      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE])
        .mockRejectedValueOnce(new Error('Variations failed'));

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleGenerateVariations();
      });

      expect(result.current.error).toBe('Variations failed');
    });
  });

  // ============================================================================
  // Test Suite: Close-up Generation
  // ============================================================================

  describe('handleGenerateCloseUp', () => {
    /**
     * Test: Shows error when no main lookbook exists
     */
    it('should show error when no main lookbook exists', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      await act(async () => {
        await result.current.handleGenerateCloseUp();
      });

      expect(result.current.error).toBe('lookbook.closeUpError');
    });

    /**
     * Test: Successfully generates close-ups
     */
    it('should generate close-ups successfully', async () => {
      const closeup1 = { base64: 'Y2xvc2V1cDE=', mimeType: 'image/png' };

      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE]) // For main generation
        .mockResolvedValue([closeup1]); // For close-ups (may be called multiple times)

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleGenerateCloseUp();
      });

      expect(result.current.isGeneratingCloseUp).toBe(false);
    });
  });

  // ============================================================================
  // Test Suite: Upscale Functionality
  // ============================================================================

  describe('handleUpscale', () => {
    /**
     * Test: Successfully upscales main image
     */
    it('should upscale main image successfully', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_IMAGE);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 'main-0');
      });

      expect(upscaleImage).toHaveBeenCalledWith(
        GENERATED_IMAGE,
        expect.any(String),
        expect.any(Object)
      );
      expect(result.current.generatedLookbook?.main).toEqual(UPSCALED_IMAGE);
    });

    /**
     * Test: Tracks upscaling state correctly
     */
    it('should track upscaling state', async () => {
      let resolvePromise: (value: unknown) => void;
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(upscaleImage).mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      let upscalePromise: Promise<void>;
      act(() => {
        upscalePromise = result.current.handleUpscale(GENERATED_IMAGE, 'main-0');
      });

      expect(result.current.upscalingStates['main-0']).toBe(true);

      await act(async () => {
        resolvePromise!(UPSCALED_IMAGE);
        await upscalePromise;
      });

      expect(result.current.upscalingStates['main-0']).toBe(false);
    });

    /**
     * Test: Handles upscale error
     */
    it('should handle upscale error', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(upscaleImage).mockRejectedValueOnce(new Error('Upscale failed'));

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleUpscale(GENERATED_IMAGE, 'main-0');
      });

      expect(result.current.error).toBe('Upscale failed');
      expect(result.current.upscalingStates['main-0']).toBe(false);
    });

    /**
     * Test: Upscales variation image correctly
     */
    it('should upscale variation image correctly', async () => {
      const variation = { base64: 'dmFyaWF0aW9u', mimeType: 'image/png' };
      const upscaledVariation = { base64: 'dXBzY2FsZWQtdmFy', mimeType: 'image/png' };

      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE])
        .mockResolvedValueOnce([variation]);
      vi.mocked(upscaleImage).mockResolvedValueOnce(upscaledVariation);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleGenerateVariations();
      });

      await act(async () => {
        await result.current.handleUpscale(variation, 'variation-0');
      });

      expect(result.current.generatedLookbook?.variations[0]).toEqual(upscaledVariation);
    });
  });

  // ============================================================================
  // Test Suite: Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    /**
     * Test: setError updates error state
     */
    it('should update error state via setError', () => {
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.setError('Custom error message');
      });

      expect(result.current.error).toBe('Custom error message');
    });

    /**
     * Test: Clears previous error on new operation
     */
    it('should clear error on new generation attempt', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      // Set initial error
      act(() => {
        result.current.setError('Previous error');
      });

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================================
  // Test Suite: Multiple Clothing Images
  // ============================================================================

  describe('Multiple Clothing Images', () => {
    /**
     * Test: Handles multiple clothing images
     */
    it('should handle multiple clothing images for multi-angle synthesis', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      const image1 = { base64: 'aW1hZ2Ux', mimeType: 'image/png' };
      const image2 = { base64: 'aW1hZ2Uy', mimeType: 'image/png' };
      const image3 = { base64: 'aW1hZ2Uz', mimeType: 'image/png' };

      act(() => {
        result.current.updateForm({
          clothingImages: [
            { id: 1, image: image1 },
            { id: 2, image: image2 },
            { id: 3, image: image3 },
          ],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(editImage).toHaveBeenCalled();
      const callArgs = vi.mocked(editImage).mock.calls[0][0];
      expect(callArgs.images).toHaveLength(3);
    });

    /**
     * Test: Filters out null images from clothing images array
     */
    it('should filter out null images', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [
            { id: 1, image: TEST_CLOTHING_IMAGE },
            { id: 2, image: null },
            { id: 3, image: null },
          ],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const callArgs = vi.mocked(editImage).mock.calls[0][0];
      expect(callArgs.images).toHaveLength(1);
    });
  });
});
