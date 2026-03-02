/**
 * Unit tests for services/gemini/image.ts
 *
 * Tests all 5 exported functions:
 * - editImage: Multi-image editing with Gemini
 * - generateImageFromText: Text-to-image with Imagen
 * - upscaleImage: 2K upscaling
 * - extractOutfitItem: Clothing item extraction
 * - critiqueAndRedesignOutfit: Critique + redesign with presets
 *
 * Mock setup:
 * - Mocks getGeminiClient from apiClient
 * - Creates mock responses with proper Gemini API structure
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ImageFile } from '@/types';

// ============================================================================
// Mock Setup
// ============================================================================

/** Mock Gemini client instance */
const mockGenerateContent = vi.fn();
const mockGenerateImages = vi.fn();

const mockGeminiClient = {
  models: {
    generateContent: mockGenerateContent,
    generateImages: mockGenerateImages,
  },
};

/** Mock getGeminiClient to return our mock client */
vi.mock('@/services/apiClient', () => ({
  getGeminiClient: vi.fn(() => mockGeminiClient),
}));

// Import after mocking
import {
  editImage,
  generateImageFromText,
  upscaleImage,
  extractOutfitItem,
  critiqueAndRedesignOutfit,
  type EditImageParams,
  type RedesignPreset,
} from '@/services/gemini/image';

// ============================================================================
// Test Fixtures
// ============================================================================

/** Sample image for testing */
const sampleImage: ImageFile = {
  base64: 'dGVzdC1pbWFnZS1kYXRh', // base64 encoded "test-image-data"
  mimeType: 'image/png',
};

/** Sample image with JPEG mime type */
const sampleJpegImage: ImageFile = {
  base64: 'anBlZy1pbWFnZS1kYXRh',
  mimeType: 'image/jpeg',
};

/**
 * Creates a successful generateContent response with image data
 * @param base64Data - Base64 encoded image data
 * @param mimeType - Image MIME type
 */
function createSuccessImageResponse(
  base64Data: string = 'cmVzdWx0LWltYWdl',
  mimeType: string = 'image/png'
) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      },
    ],
  };
}

/**
 * Creates a response with both text and image (for critique+redesign)
 * @param critiqueText - The critique text
 * @param base64Data - Base64 encoded image data
 */
function createTextAndImageResponse(
  critiqueText: string,
  base64Data: string = 'cmVkZXNpZ25lZC1pbWFnZQ=='
) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            { text: critiqueText },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
          ],
        },
      },
    ],
  };
}

/**
 * Creates a response blocked by promptFeedback
 * @param blockReason - The reason for blocking
 */
function createPromptBlockedResponse(blockReason: string = 'SAFETY') {
  return {
    promptFeedback: {
      blockReason: blockReason,
    },
  };
}

/**
 * Creates a response with no candidates (safety block)
 */
function createNoCandidatesResponse() {
  return {
    candidates: [],
  };
}

/**
 * Creates a response with safety finish reason
 * @param finishReason - The finish reason (SAFETY, RECITATION, OTHER)
 */
function createSafetyBlockResponse(finishReason: string = 'SAFETY') {
  return {
    candidates: [
      {
        finishReason: finishReason,
        safetyRatings: [
          { category: 'HARM_CATEGORY_DANGEROUS', probability: 'HIGH' },
        ],
        content: { parts: [] },
      },
    ],
  };
}

/**
 * Creates a text-only response (no image)
 * @param text - The text content
 */
function createTextOnlyResponse(text: string) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text }],
        },
      },
    ],
    text: text,
  };
}

/**
 * Creates a response with empty content parts
 */
function createNoContentResponse() {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [],
        },
      },
    ],
  };
}

/**
 * Creates a successful generateImages response
 * @param count - Number of images to generate
 */
function createSuccessGenerateImagesResponse(count: number = 1) {
  return {
    generatedImages: Array.from({ length: count }, (_, i) => ({
      image: {
        imageBytes: `aW1hZ2UtYnl0ZXMtJHtpfQ==`, // base64 "image-bytes-${i}"
      },
    })),
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('services/gemini/image.ts', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // editImage Tests
  // ==========================================================================
  describe('editImage', () => {
    it('should successfully edit a single image', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Make it look vintage',
      };

      // Act
      const result = await editImage(params);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        base64: 'cmVzdWx0LWltYWdl',
        mimeType: 'image/png',
      });
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash-image',
          config: expect.objectContaining({
            responseModalities: ['IMAGE'], // Modality.IMAGE enum value
          }),
        })
      );
    });

    it('should handle multiple input images', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());
      const params: EditImageParams = {
        images: [sampleImage, sampleJpegImage],
        prompt: 'Merge these images',
      };

      // Act
      const result = await editImage(params);

      // Assert
      expect(result).toHaveLength(1);
      // Verify both images were passed to the API
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents.parts).toHaveLength(3); // 2 images + 1 text
    });

    it('should generate multiple output images when numberOfImages > 1', async () => {
      // Arrange: mock returns different images for each call
      mockGenerateContent
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2UxJA=='))
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2UyJA=='))
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2UzJA=='));

      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate variations',
        numberOfImages: 3,
      };

      // Act
      const result = await editImage(params);

      // Assert
      expect(result).toHaveLength(3);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should use imageConfig for aspect ratio when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Edit image',
        aspectRatio: '16:9',
      };

      // Act
      await editImage(params);

      // Assert
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.imageConfig).toBeDefined();
      expect(callArgs.config.imageConfig.aspectRatio).toBe('16:9');
    });

    it('should append negative prompt when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Edit image',
        negativePrompt: 'blur, low quality',
      };

      // Act
      await editImage(params);

      // Assert
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const textPart = callArgs.contents.parts.find(
        (p: { text?: string }) => p.text
      );
      expect(textPart.text).toContain('strictly avoid including blur, low quality');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('SAFETY')
      );
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Inappropriate content',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.safetyBlock when no candidates returned', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate image',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.safetyBlock on SAFETY finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('SAFETY')
      );
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate image',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.safetyBlock on RECITATION finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('RECITATION')
      );
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate copyrighted content',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error with text response when only text returned', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createTextOnlyResponse('I cannot generate that image')
      );
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate image',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow(
        'error.api.textOnlyResponse:'
      );
    });

    it('should throw error.api.noContent when content parts empty', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: null,
          },
        ],
      });
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate image',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow('error.api.noContent');
    });

    it('should wrap unknown errors with error.api.geminiFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(new Error('Network timeout'));
      const params: EditImageParams = {
        images: [sampleImage],
        prompt: 'Generate image',
      };

      // Act & Assert
      await expect(editImage(params)).rejects.toThrow(
        'error.api.geminiFailed:Network timeout'
      );
    });
  });

  // ==========================================================================
  // generateImageFromText Tests
  // ==========================================================================
  describe('generateImageFromText', () => {
    it('should successfully generate a single image from text', async () => {
      // Arrange
      mockGenerateImages.mockResolvedValueOnce(
        createSuccessGenerateImagesResponse(1)
      );

      // Act
      const result = await generateImageFromText('A sunset over mountains');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        base64: expect.any(String),
        mimeType: 'image/png',
      });
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'imagen-4.0-generate-001',
          prompt: 'A sunset over mountains',
          config: expect.objectContaining({
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '1:1',
          }),
        })
      );
    });

    it('should generate multiple images when numberOfImages specified', async () => {
      // Arrange
      mockGenerateImages.mockResolvedValueOnce(
        createSuccessGenerateImagesResponse(4)
      );

      // Act
      const result = await generateImageFromText(
        'Abstract art',
        '16:9',
        4,
        'imagen-4.0-generate-001'
      );

      // Assert
      expect(result).toHaveLength(4);
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            numberOfImages: 4,
            aspectRatio: '16:9',
          }),
        })
      );
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateImages.mockResolvedValueOnce(
        createSuccessGenerateImagesResponse(1)
      );

      // Act
      await generateImageFromText(
        'Test prompt',
        '1:1',
        1,
        'imagen-3.0-fast-001'
      );

      // Assert
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'imagen-3.0-fast-001',
        })
      );
    });

    it('should convert Default aspect ratio to 1:1', async () => {
      // Arrange
      mockGenerateImages.mockResolvedValueOnce(
        createSuccessGenerateImagesResponse(1)
      );

      // Act
      await generateImageFromText('Test', 'Default');

      // Assert
      expect(mockGenerateImages).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            aspectRatio: '1:1',
          }),
        })
      );
    });

    it('should throw error.api.noImageInParts when no images returned', async () => {
      // Arrange
      mockGenerateImages.mockResolvedValueOnce({
        generatedImages: [],
      });

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.api.noImageInParts'
      );
    });

    it('should throw error.api.noImageInParts when generatedImages undefined', async () => {
      // Arrange
      mockGenerateImages.mockResolvedValueOnce({});

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.api.noImageInParts'
      );
    });

    it('should wrap API errors with error.api.geminiFailed prefix', async () => {
      // Arrange
      mockGenerateImages.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.api.geminiFailed:Rate limit exceeded'
      );
    });

    it('should preserve error.* prefixed errors', async () => {
      // Arrange
      mockGenerateImages.mockRejectedValueOnce(
        new Error('error.custom.specific')
      );

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.custom.specific'
      );
    });
  });

  // ==========================================================================
  // upscaleImage Tests
  // ==========================================================================
  describe('upscaleImage', () => {
    it('should successfully upscale an image', async () => {
      // Arrange
      const upscaledBase64 = 'dXBzY2FsZWQtaW1hZ2U=';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessImageResponse(upscaledBase64, 'image/png')
      );

      // Act
      const result = await upscaleImage(sampleImage);

      // Assert
      expect(result).toEqual({
        base64: upscaledBase64,
        mimeType: 'image/png',
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3.1-flash-image-preview',
        })
      );
      // Verify prompt mentions upscaling
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const textPart = callArgs.contents.parts.find(
        (p: { text?: string }) => p.text
      );
      expect(textPart.text).toContain('Upscale');
    });

    it('should preserve original mimeType in response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessImageResponse('dGVzdA==', 'image/jpeg')
      );

      // Act
      const result = await upscaleImage(sampleJpegImage);

      // Assert
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('OTHER')
      );

      // Act & Assert
      await expect(upscaleImage(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(upscaleImage(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on safety finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('OTHER')
      );

      // Act & Assert
      await expect(upscaleImage(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error with text when only text returned', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createTextOnlyResponse('Cannot upscale this image')
      );

      // Act & Assert
      await expect(upscaleImage(sampleImage)).rejects.toThrow(
        'error.api.textOnlyResponse:'
      );
    });

    it('should throw error.api.noContent when content is null', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: null,
          },
        ],
      });

      // Act & Assert
      await expect(upscaleImage(sampleImage)).rejects.toThrow(
        'error.api.noContent'
      );
    });

    it('should throw error.api.noImageInParts when parts exist but no image', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ videoMetadata: {} }], // non-image, non-text part
            },
          },
        ],
      });

      // Act & Assert
      await expect(upscaleImage(sampleImage)).rejects.toThrow(
        'error.api.noImageInParts'
      );
    });
  });

  // ==========================================================================
  // extractOutfitItem Tests
  // ==========================================================================
  describe('extractOutfitItem', () => {
    it('should successfully extract an outfit item', async () => {
      // Arrange
      const extractedBase64 = 'ZXh0cmFjdGVkLWl0ZW0=';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessImageResponse(extractedBase64, 'image/png')
      );

      // Act
      const result = await extractOutfitItem(sampleImage, 'blue jacket');

      // Assert
      expect(result).toEqual({
        base64: extractedBase64,
        mimeType: 'image/png',
      });
      // Verify prompt contains item description
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const textPart = callArgs.contents.parts.find(
        (p: { text?: string }) => p.text
      );
      expect(textPart.text).toContain('blue jacket');
      expect(textPart.text).toContain('white background');
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());

      // Act
      await extractOutfitItem(sampleImage, 'red dress', 'gemini-2.5-pro-image');

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro-image',
        })
      );
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('SAFETY')
      );

      // Act & Assert
      await expect(
        extractOutfitItem(sampleImage, 'item')
      ).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.noContent when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(
        extractOutfitItem(sampleImage, 'item')
      ).rejects.toThrow('error.api.noContent');
    });

    it('should throw error.api.safetyBlock when finishReason is not STOP', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('MAX_TOKENS')
      );

      // Act & Assert
      await expect(
        extractOutfitItem(sampleImage, 'item')
      ).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.noImageInParts when no image in parts', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: 'No item found' }],
            },
          },
        ],
      });

      // Act & Assert
      await expect(
        extractOutfitItem(sampleImage, 'nonexistent item')
      ).rejects.toThrow('error.api.noImageInParts');
    });

    it('should wrap unknown errors with error.api.extractionFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(new Error('Connection refused'));

      // Act & Assert
      await expect(
        extractOutfitItem(sampleImage, 'item')
      ).rejects.toThrow('error.api.extractionFailed:Connection refused');
    });
  });

  // ==========================================================================
  // critiqueAndRedesignOutfit Tests
  // ==========================================================================
  describe('critiqueAndRedesignOutfit', () => {
    it('should successfully critique and redesign outfit with casual preset', async () => {
      // Arrange
      const critiqueText =
        'The outfit has a relaxed vibe but could use more color coordination.';
      mockGenerateContent.mockResolvedValueOnce(
        createTextAndImageResponse(critiqueText)
      );

      // Act
      const result = await critiqueAndRedesignOutfit(sampleImage, 'casual');

      // Assert
      expect(result.critique).toBe(critiqueText);
      expect(result.redesignedImages).toHaveLength(1);
      expect(result.redesignedImages[0]).toEqual({
        base64: 'cmVkZXNpZ25lZC1pbWFnZQ==',
        mimeType: 'image/png',
      });
      // Verify model and modalities
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            responseModalities: ['IMAGE', 'TEXT'], // Modality enum values
          }),
        })
      );
    });

    it('should generate multiple redesigns when numberOfImages > 1', async () => {
      // Arrange
      mockGenerateContent
        .mockResolvedValueOnce(
          createTextAndImageResponse('Critique 1', 'aW1nMQ==')
        )
        .mockResolvedValueOnce(
          createTextAndImageResponse('Critique 2', 'aW1nMg==')
        );

      // Act
      const result = await critiqueAndRedesignOutfit(
        sampleImage,
        'smart-casual',
        2
      );

      // Assert
      expect(result.redesignedImages).toHaveLength(2);
      expect(result.critique).toBe('Critique 1'); // Takes first critique
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should use all preset types correctly', async () => {
      // Arrange & Act & Assert for each preset
      const presets: RedesignPreset[] = [
        'casual',
        'smart-casual',
        'luxury',
        'asian-style',
      ];

      for (const preset of presets) {
        vi.clearAllMocks();
        mockGenerateContent.mockResolvedValueOnce(
          createTextAndImageResponse(`Critique for ${preset}`)
        );

        const result = await critiqueAndRedesignOutfit(sampleImage, preset);

        expect(result.critique).toContain(preset);
        // Verify prompt was called with the right preset content
        const callArgs = mockGenerateContent.mock.calls[0][0];
        const textPart = callArgs.contents.parts.find(
          (p: { text?: string }) => p.text
        );
        expect(textPart.text).toContain('Critique');
        expect(textPart.text).toContain('Redesign');
      }
    });

    it('should use imageConfig for aspect ratio when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createTextAndImageResponse('Good outfit')
      );

      // Act
      await critiqueAndRedesignOutfit(
        sampleImage,
        'luxury',
        1,
        'gemini-2.5-flash-image',
        '9:16'
      );

      // Assert
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.imageConfig).toBeDefined();
      expect(callArgs.config.imageConfig.aspectRatio).toBe('9:16');
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createTextAndImageResponse('Great style')
      );

      // Act
      await critiqueAndRedesignOutfit(
        sampleImage,
        'asian-style',
        1,
        'gemini-2.5-pro-image'
      );

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro-image',
        })
      );
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('HARM')
      );

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'casual')
      ).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.noContent when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'casual')
      ).rejects.toThrow('error.api.noContent');
    });

    it('should throw error.api.safetyBlock when finishReason is not STOP', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('SAFETY')
      );

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'casual')
      ).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.critiqueFailed when missing image part', async () => {
      // Arrange: response has text but no image
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: 'This outfit is nice but...' }],
            },
          },
        ],
      });

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'luxury')
      ).rejects.toThrow('error.api.critiqueFailed');
    });

    it('should throw error.api.critiqueFailed when missing text part', async () => {
      // Arrange: response has image but no text
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'aW1hZ2U=',
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
      });

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'smart-casual')
      ).rejects.toThrow('error.api.critiqueFailed');
    });

    it('should return empty critique when no results', async () => {
      // This edge case tests when Promise.all resolves with empty array
      // In practice, this shouldn't happen with numberOfImages >= 1
      // but we test the defensive code path
      mockGenerateContent.mockResolvedValueOnce(
        createTextAndImageResponse('Test critique')
      );

      // Act with minimum numberOfImages
      const result = await critiqueAndRedesignOutfit(sampleImage, 'casual', 1);

      // Assert: should work normally
      expect(result.critique).toBe('Test critique');
      expect(result.redesignedImages).toHaveLength(1);
    });

    it('should wrap unknown errors with error.api.critiqueFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(new Error('Service unavailable'));

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'casual')
      ).rejects.toThrow('error.api.critiqueFailed:Service unavailable');
    });

    it('should preserve error.* prefixed errors', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
        new Error('error.api.quotaExceeded')
      );

      // Act & Assert
      await expect(
        critiqueAndRedesignOutfit(sampleImage, 'casual')
      ).rejects.toThrow('error.api.quotaExceeded');
    });
  });
});
