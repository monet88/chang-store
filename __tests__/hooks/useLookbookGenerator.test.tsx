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
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Feature, ImageFile } from '../../src/types';
import {
  mockUseLanguage,
  mockUseImageGallery,
  mockUseApi,
  mockUseImageEngine,
} from '../__mocks__/contexts';

const addImageMock = vi.hoisted(() => vi.fn());

// ============================================================================
// Mock Setup - Must be before imports
// ============================================================================

/** Mock editImage, upscaleImage, and createImageChatSession from imageEditingService */
vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

/** Mock generateClothingDescription from textService */
vi.mock('../../src/services/textService', () => ({
  generateClothingDescription: vi.fn(),
}));

/** Mock getErrorMessage from imageUtils */
vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((err: Error) => err.message),
}));

/** Mock ZIP download helper */
vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn(),
}));

/** Mock contexts */
vi.mock('../../src/contexts/LanguageContext', () => mockUseLanguage());
vi.mock('../../src/contexts/ImageGalleryContext', () => mockUseImageGallery({ addImage: addImageMock }));
vi.mock('../../src/contexts/ApiProviderContext', () => mockUseApi());
// The hook takes its transport from the studio-scoped engine (issue #152
// Decision 3), so the same service spies feed the engine mock.
vi.mock('../../src/contexts/ImageEngineContext', () => mockUseImageEngine({
  editImage,
  upscaleImage,
  createImageChatSession,
  model: 'gemini-3.1-flash-image',
}));

/** Mock prompts */
vi.mock('../../src/components/LookbookGenerator.prompts', () => ({
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

// Import hook and mocked services after mocking. The service spies must be
// initialized before the hook module loads, because that load runs the
// ImageEngineContext factory above.
import {
  createImageChatSession,
  editImage,
  upscaleImage,
} from '../../src/services/imageEditingService';
import { generateClothingDescription } from '../../src/services/textService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';
import { useLookbookGenerator } from '../../src/hooks/useLookbookGenerator';
import { AiScanProvider, type AiScanAnalyzer } from '../../src/contexts/AiScanContext';
import { AI_SCAN_BLOCK_HEADER } from '../../src/utils/ai-scan-blueprint';
import type { ReactNode } from 'react';

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

const REFINED_IMAGE = {
  base64: 'cmVmaW5lZC1pbWFnZQ==',
  mimeType: 'image/png',
};

const VARIATION_IMAGE = {
  base64: 'dmFyaWF0aW9uLWltYWdl',
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
  const refineSessionMock = {
    sendRefinement: vi.fn(),
    getHistory: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    refineSessionMock.sendRefinement.mockReset();
    refineSessionMock.getHistory.mockReset();
    refineSessionMock.reset.mockReset();
    refineSessionMock.getHistory.mockReturnValue([]);
    addImageMock.mockReset();
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
        clothingImages: [{ id: '123', image: TEST_CLOTHING_IMAGE }],
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

    /**
     * Test: Hook handles localStorage access errors gracefully
     */
    it('should fallback when localStorage.getItem throws', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { result } = renderHook(() => useLookbookGenerator());

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
     * Test: localStorage persists only lightweight draft fields (no image binaries)
     */
    it('should persist lightweight draft without image binaries', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingDescription: 'New desc',
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
          fabricTextureImage: TEST_FABRIC_IMAGE,
        });
      });

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      }, { timeout: 3000 });

      const calls = mockLocalStorage.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      const [, serializedDraft] = lastCall as [string, string];
      const parsedDraft = JSON.parse(serializedDraft);

      expect(parsedDraft.clothingDescription).toBe('New desc');
      expect(parsedDraft.clothingSlotCount).toBe(1);
      expect(parsedDraft.clothingImages).toBeUndefined();
      expect(parsedDraft.fabricTextureImage).toBeUndefined();
      expect(serializedDraft).not.toContain(TEST_CLOTHING_IMAGE.base64);
      expect(serializedDraft).not.toContain(TEST_FABRIC_IMAGE.base64);
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerateDescription();
      });

      expect(generateClothingDescription).toHaveBeenCalledWith(
        TEST_CLOTHING_IMAGE,
        'gemini-3.8-flash',
      );
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
     * Test: Successfully generates main lookbook image
     */
    it('should generate main lookbook image successfully', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
      expect(addImageMock).toHaveBeenCalledWith(GENERATED_IMAGE, Feature.Lookbook, 'gemini');
    });
    /**
     * Test: Handles generation error
     */
    it('should handle generation error', async () => {
      vi.mocked(editImage).mockRejectedValueOnce(new Error('Generation failed'));
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.error).toBe('Generation failed');
      expect(result.current.isLoading).toBe(false);
      expect(addImageMock).not.toHaveBeenCalled();
    });
    /**
     * Test: Shows loading state during generation
     */
    it('should show loading state during generation', async () => {
      let resolvePromise: (value: ImageFile[]) => void;
      vi.mocked(editImage).mockImplementation(
        () => new Promise<ImageFile[]>((resolve) => { resolvePromise = resolve; })
      );
      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      let generatePromise: Promise<void>;
      act(() => {
        generatePromise = result.current.handleGenerate();
      });

      expect(result.current.isLoading).toBe(true);

      // Generation now awaits the AI Scan pre-pass before it reaches the driver.
      await waitFor(() => {
        expect(editImage).toHaveBeenCalled();
      });

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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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

      const mainCall = vi.mocked(editImage).mock.calls[0][0];
      expect(mainCall.prompt).toContain('REFERENCE EVIDENCE & RECONCILIATION');
      expect(mainCall.numberOfImages).toBe(1);

      const variationCall = vi.mocked(editImage).mock.calls[1][0];
      expect(variationCall.prompt).toContain('TASK: PRODUCT LOOKBOOK VARIATION SHOT');
      expect(variationCall.prompt).toContain('No collages, grids, split images, multi-panel layouts, or contact sheets');
      expect(variationCall.prompt).not.toContain('Generate 2 professional variations');
      expect(variationCall.numberOfImages).toBe(2);
      expect(addImageMock).toHaveBeenCalledWith(variation1, Feature.Lookbook, 'gemini');
      expect(addImageMock).toHaveBeenCalledWith(variation2, Feature.Lookbook, 'gemini');
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleGenerateCloseUp();
      });

      expect(result.current.isGeneratingCloseUp).toBe(false);

      const closeupCalls = vi.mocked(editImage).mock.calls.slice(1);
      expect(closeupCalls.length).toBeGreaterThanOrEqual(1);
      expect(closeupCalls[0][0].prompt).toContain('DETAIL CLOSE-UP');
      expect(closeupCalls[0][0].numberOfImages).toBe(1);
      expect(addImageMock).toHaveBeenCalledWith(closeup1, Feature.Lookbook, 'gemini');
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
      expect(addImageMock).toHaveBeenCalledWith(UPSCALED_IMAGE, Feature.Lookbook, 'gemini');
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
  // Test Suite: Refinement, Version Selection, and Download
  // ============================================================================

  describe('Refinement, Version Selection, and Download', () => {
    it('restores saved clothing slot count from localStorage draft state', () => {
      const savedDraft = {
        clothingSlotCount: 3,
        fabricTexturePrompt: 'silk',
        clothingDescription: 'A blue dress',
        lookbookStyle: 'mannequin',
        garmentType: 'one-piece',
        foldedPresentationType: 'boxed',
        mannequinBackgroundStyle: 'minimalistShowroom',
        negativePrompt: 'wrinkles',
        productShotSubType: 'ghost-mannequin',
        includeAccessories: true,
        includeFootwear: false,
      };
      mockLocalStorage.getItem.mockImplementation((key: string) => (
        key === DRAFT_STORAGE_KEY ? JSON.stringify(savedDraft) : null
      ));

      const { result } = renderHook(() => useLookbookGenerator());

      expect(result.current.formState.clothingImages).toHaveLength(3);
      expect(result.current.formState.fabricTextureImage).toBeNull();
      expect(result.current.formState.includeAccessories).toBe(true);
    });

    it('refines generated lookbook image and tracks refinement history', async () => {
      refineSessionMock.sendRefinement.mockResolvedValueOnce(REFINED_IMAGE);
      refineSessionMock.getHistory.mockReturnValueOnce([{ prompt: 'make it sharper', timestamp: 123 }]);
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleRefineImage('make it sharper');
      });

      expect(createImageChatSession).toHaveBeenCalledWith(
        'gemini-3.1-flash-image',
        expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
      );
      expect(refineSessionMock.sendRefinement).toHaveBeenCalledWith('make it sharper', GENERATED_IMAGE);
      expect(result.current.generatedLookbook?.main).toEqual(REFINED_IMAGE);
      expect(result.current.refinementVersions).toHaveLength(1);
      expect(result.current.selectedVersionIndex).toBe(0);
      expect(result.current.refinementHistory).toEqual([{ prompt: 'make it sharper', timestamp: 123 }]);
      expect(result.current.isRefining).toBe(false);
    });

    it('selects refined and original versions while clearing derivative outputs', async () => {
      refineSessionMock.sendRefinement.mockResolvedValueOnce(REFINED_IMAGE);
      refineSessionMock.getHistory.mockReturnValue([]);
      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE])
        .mockResolvedValueOnce([VARIATION_IMAGE]);
      vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleGenerateVariations();
      });

      await act(async () => {
        await result.current.handleRefineImage('make it sharper');
      });

      expect(result.current.generatedLookbook?.variations).toEqual([]);

      act(() => {
        result.current.handleSelectVersion(-1);
      });

      expect(result.current.generatedLookbook?.main).toEqual(GENERATED_IMAGE);
      expect(result.current.selectedVersionIndex).toBe(-1);

      act(() => {
        result.current.handleSelectVersion(0);
      });

      expect(result.current.generatedLookbook?.main).toEqual(REFINED_IMAGE);
      expect(result.current.selectedVersionIndex).toBe(0);
    });

    it('resets refinement session and history', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      act(() => {
        result.current.setRefinementVersions([{ image: REFINED_IMAGE, prompt: 'older', timestamp: 1 }]);
      });

      act(() => {
        result.current.handleResetRefinement();
      });

      expect(refineSessionMock.reset).toHaveBeenCalledTimes(1);
      expect(result.current.refinementHistory).toEqual([]);
      expect(result.current.chatSession).toBeDefined();
    });

    it('sets error when refine is requested without an active session', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      await act(async () => {
        await result.current.handleRefineImage('make it sharper');
      });

      expect(result.current.error).toBe('lookbook.refineError');
    });

    it('downloads all generated lookbook images as a zip', async () => {
      const closeupImage = { base64: 'Y2xvc2V1cA==', mimeType: 'image/png' };
      vi.mocked(editImage)
        .mockResolvedValueOnce([GENERATED_IMAGE])
        .mockResolvedValueOnce([VARIATION_IMAGE])
        .mockResolvedValue([closeupImage]);
      vi.mocked(downloadImagesAsZip).mockResolvedValueOnce(undefined);
      vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleGenerateVariations();
      });

      await act(async () => {
        await result.current.handleGenerateCloseUp();
      });

      await act(async () => {
        await result.current.handleDownloadAll();
      });

      expect(downloadImagesAsZip).toHaveBeenCalledWith(
        [GENERATED_IMAGE, VARIATION_IMAGE, closeupImage, closeupImage, closeupImage],
        'lookbook-batch',
      );
    });

    it('sets error when lookbook zip download fails', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      vi.mocked(downloadImagesAsZip).mockRejectedValueOnce(new Error('zip failed'));
      vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);

      const { result } = renderHook(() => useLookbookGenerator());

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      await act(async () => {
        await result.current.handleDownloadAll();
      });

      expect(result.current.error).toBe('zip failed');
    });

    it('skips lookbook zip download when no images exist', async () => {
      const { result } = renderHook(() => useLookbookGenerator());

      await act(async () => {
        await result.current.handleDownloadAll();
      });

      expect(downloadImagesAsZip).not.toHaveBeenCalled();
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
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
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
            { id: '1', image: image1 },
            { id: '2', image: image2 },
            { id: '3', image: image3 },
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
            { id: '1', image: TEST_CLOTHING_IMAGE },
            { id: '2', image: null },
            { id: '3', image: null },
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

  // ============================================================================
  // Test Suite: AI Scan Blueprint
  // ============================================================================

  describe('AI Scan blueprint', () => {
    const BLUEPRINT = 'WEAVE & MATERIAL: plissé accordion pleats on a dry silk hand.';

    const wrapperFor =
      (analyze: AiScanAnalyzer, initialEnabled?: boolean) =>
      function AiScanWrapper({ children }: { children: ReactNode }) {
        return (
          <AiScanProvider analyze={analyze} initialEnabled={initialEnabled}>
            {children}
          </AiScanProvider>
        );
      };

    /** The prompt each driver call carried, in request order. */
    const promptSent = (callIndex = 0) => vi.mocked(editImage).mock.calls[callIndex][0].prompt;

    beforeEach(() => {
      localStorage.clear();
    });

    it('injects the scanned blueprint into the main prompt the driver receives', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.updateForm({ clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }] });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(analyze).toHaveBeenCalled();
      expect(promptSent()).toContain(AI_SCAN_BLOCK_HEADER);
      expect(promptSent()).toContain(BLUEPRINT);
      expect(result.current.generatedLookbook?.main).toEqual(GENERATED_IMAGE);
    });

    it('carries the same blueprint into variations and every close-up', async () => {
      vi.mocked(editImage).mockResolvedValue([GENERATED_IMAGE]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }],
          fabricTextureImage: TEST_FABRIC_IMAGE,
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });
      await act(async () => {
        await result.current.handleGenerateVariations();
      });
      await act(async () => {
        await result.current.handleGenerateCloseUp();
      });

      // Main, one variations request (2 images), then the three close-up shots.
      expect(vi.mocked(editImage).mock.calls).toHaveLength(5);
      expect(promptSent(1)).toContain(BLUEPRINT);
      [2, 3, 4].forEach((callIndex) => {
        expect(promptSent(callIndex)).toContain(AI_SCAN_BLOCK_HEADER);
        expect(promptSent(callIndex)).toContain(BLUEPRINT);
      });
      // One analysis per source image serves the whole run — a fresh scan per
      // handler would analyse 6 times.
      expect(analyze).toHaveBeenCalledTimes(2);
    });

    it('never analyses and keeps the base prompt when the layer is switched off', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue('unused blueprint');
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper: wrapperFor(analyze, false) });

      act(() => {
        result.current.updateForm({ clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }] });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(analyze).not.toHaveBeenCalled();
      expect(promptSent()).not.toContain('AI SCAN');
      expect(promptSent()).toContain('REFERENCE EVIDENCE & RECONCILIATION');
      expect(result.current.generatedLookbook?.main).toEqual(GENERATED_IMAGE);
    });

    it('still generates the image when the analysis fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const analyze = vi.fn<AiScanAnalyzer>().mockRejectedValue(new Error('analyzer down'));
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.updateForm({ clothingImages: [{ id: '1', image: TEST_CLOTHING_IMAGE }] });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(analyze).toHaveBeenCalled();
      expect(promptSent()).not.toContain('AI SCAN');
      expect(result.current.error).toBeNull();
      expect(result.current.generatedLookbook?.main).toEqual(GENERATED_IMAGE);
      consoleSpy.mockRestore();
    });

    it('scans the fabric texture image even when the clothing list fills the scan limit', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([GENERATED_IMAGE]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.updateForm({
          clothingImages: [1, 2, 3, 4, 5].map((index) => ({
            id: String(index),
            image: { base64: `garment-${index}`, mimeType: 'image/png' },
          })),
          fabricTextureImage: TEST_FABRIC_IMAGE,
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Three garments and the reserved slot for the texture swatch, in form
      // order: the fabric must not be crowded out of its own analysis.
      expect(analyze.mock.calls.map(([image]) => image.base64)).toEqual([
        'garment-1',
        'garment-2',
        'garment-3',
        TEST_FABRIC_IMAGE.base64,
      ]);
      expect(promptSent()).toContain(BLUEPRINT);
    });

    it('keeps the main image\'s blueprint for variations and close-ups after the form moves on', async () => {
      const outfitA = { base64: 'outfit-a', mimeType: 'image/png' };
      const outfitB = { base64: 'outfit-b', mimeType: 'image/png' };
      vi.mocked(editImage).mockResolvedValue([GENERATED_IMAGE]);
      const analyze = vi.fn<AiScanAnalyzer>(async (image) => `BLUEPRINT OF ${image.base64}`);
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper: wrapperFor(analyze) });

      act(() => {
        result.current.updateForm({ clothingImages: [{ id: '1', image: outfitA }] });
      });
      await act(async () => {
        await result.current.handleGenerate();
      });

      // The user keeps editing the form towards another outfit.
      act(() => {
        result.current.updateForm({ clothingImages: [{ id: '1', image: outfitB }] });
      });

      await act(async () => {
        await result.current.handleGenerateVariations();
      });
      await act(async () => {
        await result.current.handleGenerateCloseUp();
      });

      // Derived shots belong to the generated main, not to the current form.
      [1, 2, 3, 4].forEach((callIndex) => {
        expect(promptSent(callIndex)).toContain(`BLUEPRINT OF ${outfitA.base64}`);
        expect(promptSent(callIndex)).not.toContain(outfitB.base64);
      });
      expect(analyze).toHaveBeenCalledTimes(1);
    });
  });
});
