/**
 * Unit Tests for imageEditingService
 *
 * Tests the unified facade that routes image operations to the Gemini API.
 *
 * Key test scenarios:
 * 1. Correct parameter passing to Gemini backend
 * 2. Error propagation from underlying services
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup - Must be before imports
// ============================================================================

/** Mock gemini/image.ts service */
vi.mock('../../src/services/gemini/image', () => ({
  editImage: vi.fn(),
  generateImageFromText: vi.fn(),
  upscaleImage: vi.fn(),
  extractOutfitItem: vi.fn(),
  critiqueAndRedesignOutfit: vi.fn(),
  PRESET_PROMPTS: {
    casual: 'Casual prompt',
    'smart-casual': 'Smart casual prompt',
    luxury: 'Luxury prompt',
    'asian-style': 'Asian style prompt',
  },
}));



/** Mock imageUtils for getImageDimensions */
vi.mock('../../src/utils/imageUtils', () => ({
  getImageDimensions: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
}));

// Import services after mocking
import {
  editImage,
  generateImage,
  upscaleImage,
  extractOutfitItem,
  critiqueAndRedesignOutfit,
  recreateImageWithFace,
} from '../../src/services/imageEditingService';
import { getImageDimensions } from '../../src/utils/imageUtils';
import * as geminiImageService from '../../src/services/gemini/image';

// ============================================================================
// Test Constants
// ============================================================================

/** Sample image file for tests */
const TEST_IMAGE: { base64: string; mimeType: string } = {
  base64: 'dGVzdC1pbWFnZS1kYXRh',
  mimeType: 'image/png',
};

/** Default API config */
const DEFAULT_CONFIG = {
  onStatusUpdate: vi.fn(),
};



// ============================================================================
// Test Suite: editImage - Model Routing
// ============================================================================

describe('editImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Gemini Routing Tests
  // --------------------------------------------------------------------------

  describe('Gemini routing (gemini-* models)', () => {
    /**
     * Test: Routes to gemini/image.editImage for gemini models
     */
    it('should route to gemini/image.editImage for gemini-* models', async () => {
      // Arrange
      const mockResult = [{ base64: 'result', mimeType: 'image/png' }];
      vi.mocked(geminiImageService.editImage).mockResolvedValueOnce(mockResult);

      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit this image',
        numberOfImages: 1,
      };

      // Act
      const result = await editImage(params, 'gemini-2.5-flash-image', DEFAULT_CONFIG);

      // Assert
      expect(geminiImageService.editImage).toHaveBeenCalledWith({
        ...params,
        model: 'gemini-2.5-flash-image'
      });
      expect(result).toEqual(mockResult);
    });

    /**
     * Test: Propagates errors from gemini service unchanged
     */
    it('should propagate errors from gemini service', async () => {
      // Arrange
      const geminiError = new Error('error.api.safetyBlock');
      vi.mocked(geminiImageService.editImage).mockRejectedValueOnce(geminiError);

      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit this image',
      };

      // Act & Assert
      await expect(editImage(params, 'gemini-2.5-flash-image', DEFAULT_CONFIG))
        .rejects.toThrow('error.api.safetyBlock');
    });
  });
});

// ============================================================================
// Test Suite: generateImage
// ============================================================================

describe('generateImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Routes to gemini for gemini models
   */
  it('should route to gemini/image.generateImageFromText for gemini models', async () => {
    // Arrange
    const mockResult = [{ base64: 'generated', mimeType: 'image/png' }];
    vi.mocked(geminiImageService.generateImageFromText).mockResolvedValueOnce(mockResult);

    // Act
    const result = await generateImage(
      'A beautiful sunset',
      '16:9',
      1,
      'imagen-4.0-generate-001',
      DEFAULT_CONFIG
    );

    // Assert
    expect(geminiImageService.generateImageFromText).toHaveBeenCalledWith(
      'A beautiful sunset',
      '16:9',
      1,
      'imagen-4.0-generate-001'
    );
    expect(result).toEqual(mockResult);
  });
});

// ============================================================================
// Test Suite: upscaleImage
// ============================================================================

describe('upscaleImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Routes to gemini upscale for gemini models
   */
  it('should route to gemini/image.upscaleImage for gemini models', async () => {
    // Arrange
    const mockResult = { base64: 'upscaled', mimeType: 'image/png' };
    vi.mocked(geminiImageService.upscaleImage).mockResolvedValueOnce(mockResult);

    // Act
    const result = await upscaleImage(TEST_IMAGE, 'gemini-2.5-flash-image', DEFAULT_CONFIG);

    // Assert
    expect(geminiImageService.upscaleImage).toHaveBeenCalledWith(
      TEST_IMAGE,
      '2K',
      expect.stringContaining('Upscale this image to 2K resolution'),
      'gemini-2.5-flash-image',
    );
    expect(result).toEqual(mockResult);
  });
});

// ============================================================================
// Test Suite: extractOutfitItem
// ============================================================================

describe('extractOutfitItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Routes to gemini for gemini models
   */
  it('should route to gemini/image.extractOutfitItem for gemini models', async () => {
    // Arrange
    const mockResult = { base64: 'extracted', mimeType: 'image/png' };
    vi.mocked(geminiImageService.extractOutfitItem).mockResolvedValueOnce(mockResult);

    // Act
    const result = await extractOutfitItem(
      TEST_IMAGE,
      'red t-shirt',
      'gemini-2.5-flash-image',
      DEFAULT_CONFIG
    );

    // Assert
    expect(geminiImageService.extractOutfitItem).toHaveBeenCalledWith(
      TEST_IMAGE,
      'red t-shirt',
      'gemini-2.5-flash-image'
    );
    expect(result).toEqual(mockResult);
  });
});

// ============================================================================
// Test Suite: critiqueAndRedesignOutfit
// ============================================================================

describe('critiqueAndRedesignOutfit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Routes to gemini for gemini models
   */
  it('should route to gemini/image.critiqueAndRedesignOutfit for gemini models', async () => {
    // Arrange
    const mockResult = {
      critique: 'Nice outfit',
      redesignedImages: [{ base64: 'redesigned', mimeType: 'image/png' }],
    };
    vi.mocked(geminiImageService.critiqueAndRedesignOutfit).mockResolvedValueOnce(mockResult);

    // Act
    const result = await critiqueAndRedesignOutfit(
      TEST_IMAGE,
      'casual',
      1,
      'gemini-2.5-flash-image',
      DEFAULT_CONFIG,
      'Default'
    );

    // Assert
    expect(geminiImageService.critiqueAndRedesignOutfit).toHaveBeenCalledWith(
      TEST_IMAGE,
      'casual',
      1,
      'gemini-2.5-flash-image',
      'Default',
      undefined // resolution parameter (optional)
    );
    expect(result).toEqual(mockResult);
  });
});

// ============================================================================
// Test Suite: recreateImageWithFace
// ============================================================================

describe('recreateImageWithFace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Face reference image for tests */
  const FACE_IMAGE = { base64: 'ZmFjZS1kYXRh', mimeType: 'image/png' };
  /** Style reference image for tests */
  const STYLE_IMAGE = { base64: 'c3R5bGUtZGF0YQ==', mimeType: 'image/png' };

  /**
   * Test: Calls editImage with constructed prompt for gemini
   */
  it('should call gemini editImage with constructed prompt', async () => {
    // Arrange
    const mockResult = { base64: 'recreated-gemini', mimeType: 'image/png' };
    vi.mocked(geminiImageService.editImage).mockResolvedValueOnce([mockResult]);

    // Act
    const result = await recreateImageWithFace(
      'A professional portrait in office setting',
      FACE_IMAGE,
      STYLE_IMAGE,
      'gemini-2.5-flash-image',
      DEFAULT_CONFIG,
      '16:9'
    );

    // Assert
    expect(geminiImageService.editImage).toHaveBeenCalledWith({
      images: [FACE_IMAGE],
      prompt: expect.stringContaining('IMAGE RECREATION WITH NEW SUBJECT'),
      numberOfImages: 1,
      aspectRatio: '16:9',
      resolution: undefined,
      model: 'gemini-2.5-flash-image',
    });
    expect(result).toEqual(mockResult);
  });

  /**
   * Test: Detects aspect ratio from style image when not provided
   */
  it('should detect aspect ratio from style image when not provided', async () => {
    // Arrange
    vi.mocked(getImageDimensions).mockResolvedValueOnce({ width: 1920, height: 1080 });
    const mockResult = { base64: 'recreated', mimeType: 'image/png' };
    vi.mocked(geminiImageService.editImage).mockResolvedValueOnce([mockResult]);

    // Act
    await recreateImageWithFace(
      'Test prompt',
      FACE_IMAGE,
      STYLE_IMAGE,
      'gemini-2.5-flash-image',
      DEFAULT_CONFIG
    );

    // Assert
    expect(getImageDimensions).toHaveBeenCalledWith(STYLE_IMAGE.base64, STYLE_IMAGE.mimeType);
    expect(geminiImageService.editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: '16:9', // 1920/1080 ≈ 16:9
      })
    );
  });

  /**
   * Test: Throws error when result is empty
   */
  it('should throw error when image recreation fails', async () => {
    // Arrange - editImage returns empty array
    vi.mocked(geminiImageService.editImage).mockResolvedValueOnce([]);

    // Act & Assert
    await expect(
      recreateImageWithFace(
        'Test prompt',
        FACE_IMAGE,
        STYLE_IMAGE,
        'gemini-2.5-flash-image',
        DEFAULT_CONFIG
      )
    ).rejects.toThrow('Image recreation failed to produce a result.');
  });

  /**
   * Test: Passes resolution through to gemini editImage
   */
  it('should pass resolution to gemini editImage when provided', async () => {
    // Arrange
    const mockResult = { base64: 'recreated-gemini', mimeType: 'image/png' };
    vi.mocked(geminiImageService.editImage).mockResolvedValueOnce([mockResult]);

    // Act
    const result = await recreateImageWithFace(
      'Test prompt',
      FACE_IMAGE,
      STYLE_IMAGE,
      'gemini-2.5-flash-image',
      DEFAULT_CONFIG,
      '16:9',
      '4K'
    );

    // Assert
    expect(geminiImageService.editImage).toHaveBeenCalledWith({
      images: [FACE_IMAGE],
      prompt: expect.stringContaining('IMAGE RECREATION WITH NEW SUBJECT'),
      numberOfImages: 1,
      aspectRatio: '16:9',
      resolution: '4K',
      model: 'gemini-2.5-flash-image',
    });
    expect(result).toEqual(mockResult);
  });
});
