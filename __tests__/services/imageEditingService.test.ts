/**
 * Unit Tests for imageEditingService
 *
 * Tests the unified facade that routes image/video operations to either:
 * - gemini/image.ts (Gemini API) for 'gemini-*' models
 * - aivideoautoService.ts (AIVideoAuto API) for 'aivideoauto--*' models
 *
 * Key test scenarios:
 * 1. Model routing logic based on prefix
 * 2. Missing aivideoauto token throws proper error
 * 3. Error propagation from underlying services
 * 4. Correct parameter passing to each backend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup - Must be before imports
// ============================================================================

/** Mock gemini/image.ts service */
vi.mock('../../services/gemini/image', () => ({
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

/** Mock gemini/text.ts service */
vi.mock('../../services/gemini/text', () => ({
  generateText: vi.fn(),
}));

/** Mock gemini/video.ts service */
vi.mock('../../services/gemini/video', () => ({
  generateVideo: vi.fn(),
}));

/** Mock aivideoautoService.ts */
vi.mock('../../services/aivideoautoService', () => ({
  createImage: vi.fn(),
  uploadImage: vi.fn(),
  createVideoTask: vi.fn(),
  pollForVideo: vi.fn(),
}));

/** Mock imageUtils for getImageDimensions */
vi.mock('../../utils/imageUtils', () => ({
  getImageDimensions: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
}));

// Import services after mocking
import {
  editImage,
  generateImage,
  upscaleImage,
  extractOutfitItem,
  critiqueAndRedesignOutfit,
  generateVideo,
  recreateImageWithFace,
} from '../../services/imageEditingService';
import { getImageDimensions } from '../../utils/imageUtils';
import * as geminiImageService from '../../services/gemini/image';
import * as geminiTextService from '../../services/gemini/text';
import * as geminiVideoService from '../../services/gemini/video';
import * as aivideoautoService from '../../services/aivideoautoService';

// ============================================================================
// Test Constants
// ============================================================================

/** Sample image file for tests */
const TEST_IMAGE: { base64: string; mimeType: string } = {
  base64: 'dGVzdC1pbWFnZS1kYXRh',
  mimeType: 'image/png',
};

/** Default API config with no aivideoauto token */
const DEFAULT_CONFIG = {
  aivideoautoAccessToken: null,
  onStatusUpdate: vi.fn(),
  aivideoautoVideoModels: [],
  aivideoautoImageModels: [],
};

/** Config with aivideoauto token and models */
const AIVIDEOAUTO_CONFIG = {
  aivideoautoAccessToken: 'test-token-123',
  onStatusUpdate: vi.fn(),
  aivideoautoVideoModels: [
    { id_base: 'video-model-1', model: 'video-model', name: 'Video Model 1' },
  ],
  aivideoautoImageModels: [
    { id_base: 'image-model-1', model: 'image-model', name: 'Image Model 1' },
  ],
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
      expect(aivideoautoService.createImage).not.toHaveBeenCalled();
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

  // --------------------------------------------------------------------------
  // AIVideoAuto Routing Tests
  // --------------------------------------------------------------------------

  describe('AIVideoAuto routing (aivideoauto--* models)', () => {
    /**
     * Test: Routes to aivideoautoService.createImage for aivideoauto models
     */
    it('should route to aivideoautoService.createImage for aivideoauto--* models', async () => {
      // Arrange
      const mockResult = { base64: 'aivideoauto-result', mimeType: 'image/png' };
      vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit with AIVideoAuto',
        numberOfImages: 1,
      };

      // Act
      const result = await editImage(params, 'aivideoauto--image-model-1', AIVIDEOAUTO_CONFIG);

      // Assert
      expect(aivideoautoService.createImage).toHaveBeenCalledWith(
        'test-token-123',
        expect.objectContaining({
          model: 'image-model',
          prompt: 'Edit with AIVideoAuto',
          subjects: [TEST_IMAGE],
        })
      );
      expect(geminiImageService.editImage).not.toHaveBeenCalled();
      expect(result).toEqual([mockResult]);
    });

    /**
     * Test: Throws error.api.aivideoautoAuth when token is missing
     */
    it('should throw error.api.aivideoautoAuth when aivideoauto token is null', async () => {
      // Arrange
      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit with AIVideoAuto',
      };

      // Act & Assert
      await expect(editImage(params, 'aivideoauto--model', DEFAULT_CONFIG))
        .rejects.toThrow('error.api.aivideoautoAuth');
    });

    /**
     * Test: Throws error when model ID is invalid
     */
    it('should throw error when aivideoauto model ID is invalid', async () => {
      // Arrange
      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit with AIVideoAuto',
      };

      // Act & Assert
      await expect(editImage(params, 'aivideoauto--invalid-model', AIVIDEOAUTO_CONFIG))
        .rejects.toThrow('Invalid AIVideoAuto model ID for image editing: invalid-model');
    });

    /**
     * Test: Propagates errors from aivideoauto service
     */
    it('should propagate errors from aivideoauto service', async () => {
      // Arrange
      const aivideoautoError = new Error('Tạo ảnh thất bại.');
      vi.mocked(aivideoautoService.createImage).mockRejectedValueOnce(aivideoautoError);

      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit with AIVideoAuto',
      };

      // Act & Assert
      await expect(editImage(params, 'aivideoauto--image-model-1', AIVIDEOAUTO_CONFIG))
        .rejects.toThrow('Tạo ảnh thất bại.');
    });

    /**
     * Test: Correctly maps aspect ratio to aivideoauto format
     */
    it('should map aspect ratio correctly for aivideoauto', async () => {
      // Arrange
      const mockResult = { base64: 'result', mimeType: 'image/png' };
      vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

      const params = {
        images: [TEST_IMAGE],
        prompt: 'Edit with aspect ratio',
        aspectRatio: '16:9' as const,
        numberOfImages: 1,
      };

      // Act
      await editImage(params, 'aivideoauto--image-model-1', AIVIDEOAUTO_CONFIG);

      // Assert
      expect(aivideoautoService.createImage).toHaveBeenCalledWith(
        'test-token-123',
        expect.objectContaining({
          ratio: '16_9',
        })
      );
    });

    /**
     * Test: Generates multiple images when numberOfImages > 1
     */
    it('should generate multiple images for aivideoauto when numberOfImages > 1', async () => {
      // Arrange
      const mockResult = { base64: 'result', mimeType: 'image/png' };
      vi.mocked(aivideoautoService.createImage).mockResolvedValue(mockResult);

      const params = {
        images: [TEST_IMAGE],
        prompt: 'Generate multiple',
        numberOfImages: 3,
      };

      // Act
      const result = await editImage(params, 'aivideoauto--image-model-1', AIVIDEOAUTO_CONFIG);

      // Assert
      expect(aivideoautoService.createImage).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
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

  /**
   * Test: Routes to aivideoauto for aivideoauto models (via editImage)
   */
  it('should route to aivideoauto via editImage for aivideoauto models', async () => {
    // Arrange
    const mockResult = { base64: 'generated', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

    // Act
    const result = await generateImage(
      'A beautiful sunset',
      '1:1',
      1,
      'aivideoauto--image-model-1',
      AIVIDEOAUTO_CONFIG
    );

    // Assert
    expect(aivideoautoService.createImage).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        prompt: 'A beautiful sunset',
        ratio: '1_1',
      })
    );
    expect(result).toEqual([mockResult]);
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
    expect(geminiImageService.upscaleImage).toHaveBeenCalledWith(TEST_IMAGE, '2K');
    expect(result).toEqual(mockResult);
  });

  /**
   * Test: Routes to aivideoauto editImage for aivideoauto models
   */
  it('should route to aivideoauto editImage for aivideoauto models', async () => {
    // Arrange
    const mockResult = { base64: 'upscaled', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

    // Act
    const result = await upscaleImage(TEST_IMAGE, 'aivideoauto--image-model-1', AIVIDEOAUTO_CONFIG);

    // Assert
    expect(aivideoautoService.createImage).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        prompt: expect.stringContaining('Upscale'),
        subjects: [TEST_IMAGE],
      })
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

  /**
   * Test: Routes to aivideoauto for aivideoauto models
   */
  it('should route to aivideoauto for aivideoauto models', async () => {
    // Arrange
    const mockResult = { base64: 'extracted', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

    // Act
    const result = await extractOutfitItem(
      TEST_IMAGE,
      'blue jeans',
      'aivideoauto--image-model-1',
      AIVIDEOAUTO_CONFIG
    );

    // Assert
    expect(aivideoautoService.createImage).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        prompt: expect.stringContaining('blue jeans'),
        subjects: [TEST_IMAGE],
      })
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

  /**
   * Test: Routes to aivideoauto with gemini critique for aivideoauto models
   */
  it('should use gemini for critique and aivideoauto for image for aivideoauto models', async () => {
    // Arrange
    vi.mocked(geminiTextService.generateText).mockResolvedValueOnce('AI generated critique');
    const mockImage = { base64: 'redesigned', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockImage);

    // Act
    const result = await critiqueAndRedesignOutfit(
      TEST_IMAGE,
      'luxury',
      1,
      'aivideoauto--image-model-1',
      AIVIDEOAUTO_CONFIG,
      '1:1'
    );

    // Assert
    expect(geminiTextService.generateText).toHaveBeenCalled();
    expect(aivideoautoService.createImage).toHaveBeenCalled();
    expect(result.critique).toBe('AI generated critique');
    expect(result.redesignedImages).toEqual([mockImage]);
  });
});

// ============================================================================
// Test Suite: generateVideo
// ============================================================================

describe('generateVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Routes to gemini for gemini models
   */
  it('should route to gemini/video.generateVideo for gemini models', async () => {
    // Arrange
    const mockVideoUrl = 'https://example.com/video.mp4';
    vi.mocked(geminiVideoService.generateVideo).mockResolvedValueOnce(mockVideoUrl);

    const config = {
      ...DEFAULT_CONFIG,
      onStatusUpdate: vi.fn(),
    };

    // Act
    const result = await generateVideo(
      'Create a cinematic video',
      'veo-2.0-generate-001',
      config,
      TEST_IMAGE
    );

    // Assert
    expect(geminiVideoService.generateVideo).toHaveBeenCalledWith(
      TEST_IMAGE,
      'Create a cinematic video',
      config.onStatusUpdate,
      'veo-2.0-generate-001'
    );
    expect(result).toBe(mockVideoUrl);
  });

  /**
   * Test: Throws error when reference image is missing for gemini
   */
  it('should throw error when reference image is missing for gemini', async () => {
    // Act & Assert
    await expect(
      generateVideo('Create a video', 'veo-2.0-generate-001', DEFAULT_CONFIG, null)
    ).rejects.toThrow('A reference image is mandatory for Gemini video generation.');
  });

  /**
   * Test: Routes to aivideoauto for aivideoauto models
   */
  it('should route to aivideoauto for aivideoauto--* models', async () => {
    // Arrange
    const uploadedImage = { id_base: 'uploaded-001', url: 'https://cdn.example.com/img.png' };
    vi.mocked(aivideoautoService.uploadImage).mockResolvedValueOnce(uploadedImage);
    vi.mocked(aivideoautoService.createVideoTask).mockResolvedValueOnce('video-task-001');
    vi.mocked(aivideoautoService.pollForVideo).mockResolvedValueOnce('https://cdn.example.com/video.mp4');

    // Act
    const result = await generateVideo(
      'Create a video with AIVideoAuto',
      'aivideoauto--video-model-1',
      AIVIDEOAUTO_CONFIG,
      TEST_IMAGE
    );

    // Assert
    expect(aivideoautoService.uploadImage).toHaveBeenCalledWith('test-token-123', TEST_IMAGE);
    expect(aivideoautoService.createVideoTask).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        model: 'video-model',
        prompt: 'Create a video with AIVideoAuto',
        images: [uploadedImage],
      })
    );
    expect(aivideoautoService.pollForVideo).toHaveBeenCalledWith(
      'test-token-123',
      'video-task-001',
      AIVIDEOAUTO_CONFIG.onStatusUpdate
    );
    expect(result).toBe('https://cdn.example.com/video.mp4');
  });

  /**
   * Test: Throws error.api.aivideoautoAuth when token is missing
   */
  it('should throw error.api.aivideoautoAuth when aivideoauto token is null', async () => {
    // Act & Assert
    await expect(
      generateVideo('Create a video', 'aivideoauto--video-model-1', DEFAULT_CONFIG, TEST_IMAGE)
    ).rejects.toThrow('error.api.aivideoautoAuth');
  });

  /**
   * Test: Throws error when reference image is missing for aivideoauto
   */
  it('should throw error when reference image is missing for aivideoauto', async () => {
    // Act & Assert
    await expect(
      generateVideo('Create a video', 'aivideoauto--video-model-1', AIVIDEOAUTO_CONFIG, null)
    ).rejects.toThrow('A reference image is mandatory for AIVideoAuto video generation.');
  });

  /**
   * Test: Throws error when aivideoauto model ID is invalid
   */
  it('should throw error when aivideoauto video model ID is invalid', async () => {
    // Act & Assert
    await expect(
      generateVideo('Create a video', 'aivideoauto--invalid-model', AIVIDEOAUTO_CONFIG, TEST_IMAGE)
    ).rejects.toThrow('Invalid AIVideoAuto model ID: invalid-model. Models not loaded.');
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
   * Test: Calls editImage with constructed prompt
   */
  it('should call editImage with constructed prompt and return result', async () => {
    // Arrange
    const mockResult = { base64: 'recreated', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

    // Act
    const result = await recreateImageWithFace(
      'A professional portrait in office setting',
      FACE_IMAGE,
      STYLE_IMAGE,
      'aivideoauto--image-model-1',
      AIVIDEOAUTO_CONFIG,
      '16:9'
    );

    // Assert
    expect(aivideoautoService.createImage).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        prompt: expect.stringContaining('IMAGE RECREATION WITH NEW SUBJECT'),
        subjects: [FACE_IMAGE],
      })
    );
    expect(result).toEqual(mockResult);
  });

  /**
   * Test: Uses explicit aspect ratio when provided
   */
  it('should use explicit aspect ratio when provided', async () => {
    // Arrange
    const mockResult = { base64: 'recreated', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

    // Act
    await recreateImageWithFace(
      'Test prompt',
      FACE_IMAGE,
      STYLE_IMAGE,
      'aivideoauto--image-model-1',
      AIVIDEOAUTO_CONFIG,
      '9:16'
    );

    // Assert
    expect(aivideoautoService.createImage).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        ratio: '9_16',
      })
    );
  });

  /**
   * Test: Detects aspect ratio from style image when not provided
   */
  it('should detect aspect ratio from style image when not provided', async () => {
    // Arrange
    vi.mocked(getImageDimensions).mockResolvedValueOnce({ width: 1920, height: 1080 });
    const mockResult = { base64: 'recreated', mimeType: 'image/png' };
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(mockResult);

    // Act
    await recreateImageWithFace(
      'Test prompt',
      FACE_IMAGE,
      STYLE_IMAGE,
      'aivideoauto--image-model-1',
      AIVIDEOAUTO_CONFIG
    );

    // Assert
    expect(getImageDimensions).toHaveBeenCalledWith(STYLE_IMAGE.base64, STYLE_IMAGE.mimeType);
    expect(aivideoautoService.createImage).toHaveBeenCalledWith(
      'test-token-123',
      expect.objectContaining({
        ratio: '16_9', // 1920/1080 ≈ 16:9
      })
    );
  });

  /**
   * Test: Throws error when result is empty
   */
  it('should throw error when image recreation fails', async () => {
    // Arrange - editImage returns empty array
    vi.mocked(aivideoautoService.createImage).mockResolvedValueOnce(undefined as any);

    // Act & Assert
    await expect(
      recreateImageWithFace(
        'Test prompt',
        FACE_IMAGE,
        STYLE_IMAGE,
        'aivideoauto--image-model-1',
        AIVIDEOAUTO_CONFIG
      )
    ).rejects.toThrow('Image recreation failed to produce a result.');
  });
});
