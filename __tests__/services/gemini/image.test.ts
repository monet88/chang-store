/**
 * Unit tests for services/gemini/image.ts
 *
 * Tests all 3 exported functions:
 * - editImage: Multi-image editing with Gemini
 * - generateImageFromText: Text-to-image with Gemini image models
 * - upscaleImage: 2K upscaling
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

const mockGeminiClient = {
  models: {
    generateContent: mockGenerateContent,
  },
};

const { mockIsProxyEnabled } = vi.hoisted(() => ({
  mockIsProxyEnabled: vi.fn(() => false),
}));

vi.mock('@/services/apiClient', () => ({
  getGeminiClient: vi.fn(() => mockGeminiClient),
  isProxyEnabled: mockIsProxyEnabled,
  getGeminiBaseUrl: vi.fn(() => null),
  getActiveApiKey: vi.fn(() => 'test-key'),
}));

// Import after mocking
import {
  editImage,
  generateImageFromText,
  upscaleImage,
  type EditImageParams,
} from '@/services/gemini/image';
import { isProxyEnabled } from '@/services/apiClient';

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

// ============================================================================
// Test Suites
// ============================================================================

describe('services/gemini/image.ts', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockReset();
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
      expect(result[0]).toMatchObject({
        base64: 'cmVzdWx0LWltYWdl',
        mimeType: 'image/png',
        metadata: { requestedModel: 'gemini-3.1-flash-image' },
      });
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3.1-flash-image',
          config: expect.objectContaining({
            responseModalities: ['IMAGE'], // Modality.IMAGE enum value
          }),
        })
      );
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents[0].parts[0]).toEqual({ text: 'Make it look vintage' });
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
      expect(callArgs.contents[0].parts[0]).toEqual({ text: 'Merge these images' });
      expect(callArgs.contents[0].parts).toHaveLength(3); // 2 images + 1 text
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
      expect(result.map((image) => image.base64)).toEqual(['aW1hZ2UxJA==', 'aW1hZ2UyJA==', 'aW1hZ2UzJA==']);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('dispatches edit variations in parallel', async () => {
      let resolveFirst: (response: unknown) => void = () => {};
      let resolveSecond: (response: unknown) => void = () => {};
      mockGenerateContent
        .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

      const promise = editImage({
        images: [sampleImage],
        prompt: 'Generate variations',
        numberOfImages: 2,
      });
      await Promise.resolve();

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      resolveFirst(createSuccessImageResponse('Zmlyc3Q='));
      resolveSecond(createSuccessImageResponse('c2Vjb25k'));
      const result = await promise;

      expect(result.map((image) => image.base64)).toEqual(['Zmlyc3Q=', 'c2Vjb25k']);
    });

    it('caps edit variation concurrency to three requests at a time', async () => {
      let resolveFirst: (response: unknown) => void = () => {};
      let resolveSecond: (response: unknown) => void = () => {};
      let resolveThird: (response: unknown) => void = () => {};
      let resolveFourth: (response: unknown) => void = () => {};

      mockGenerateContent
        .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveThird = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveFourth = resolve; }));

      const promise = editImage({
        images: [sampleImage],
        prompt: 'Generate capped variations',
        numberOfImages: 4,
      });
      await Promise.resolve();

      expect(mockGenerateContent).toHaveBeenCalledTimes(3);

      resolveFirst(createSuccessImageResponse('Zmlyc3Q='));
      resolveSecond(createSuccessImageResponse('c2Vjb25k'));
      resolveThird(createSuccessImageResponse('dGhpcmQ='));
      await vi.waitFor(() => {
        expect(mockGenerateContent).toHaveBeenCalledTimes(4);
      });

      resolveFourth(createSuccessImageResponse('Zm91cnRo'));
      const result = await promise;

      expect(result.map((image) => image.base64)).toEqual(['Zmlyc3Q=', 'c2Vjb25k', 'dGhpcmQ=', 'Zm91cnRo']);
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
      const textPart = callArgs.contents[0].parts.find(
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
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse('Z2VuZXJhdGVk'));

      // Act
      const result = await generateImageFromText('A sunset over mountains');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        base64: 'Z2VuZXJhdGVk',
        mimeType: 'image/png',
        metadata: { requestedModel: 'gemini-3.1-flash-image' },
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3.1-flash-image',
          contents: [{ role: 'user', parts: [{ text: 'A sunset over mountains' }] }],
          config: expect.objectContaining({
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '1:1' },
          }),
        })
      );
    });

    it('should generate multiple images when numberOfImages specified', async () => {
      // Arrange
      mockGenerateContent
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2Ux'))
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2Uy'))
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2Uz'))
        .mockResolvedValueOnce(createSuccessImageResponse('aW1hZ2U0'));

      // Act
      const result = await generateImageFromText(
        'Abstract art',
        '16:9',
        4,
        'gemini-3-pro-image'
      );

      // Assert
      expect(result).toHaveLength(4);
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-image',
          config: expect.objectContaining({
            imageConfig: { aspectRatio: '16:9' },
          }),
        })
      );
    });

    it('dispatches text-to-image variations in parallel', async () => {
      let resolveFirst: (response: unknown) => void = () => {};
      let resolveSecond: (response: unknown) => void = () => {};
      mockGenerateContent
        .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

      const promise = generateImageFromText('Abstract art', '1:1', 2);
      await Promise.resolve();

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      resolveFirst(createSuccessImageResponse('Zmlyc3Q='));
      resolveSecond(createSuccessImageResponse('c2Vjb25k'));
      const result = await promise;

      expect(result.map((image) => image.base64)).toEqual(['Zmlyc3Q=', 'c2Vjb25k']);
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());

      // Act
      await generateImageFromText(
        'Test prompt',
        '1:1',
        1,
        'gemini-3-pro-image'
      );

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-image',
        })
      );
    });

    it('should convert Default aspect ratio to 1:1', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createSuccessImageResponse());

      // Act
      await generateImageFromText('Test', 'Default');

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            imageConfig: { aspectRatio: '1:1' },
          }),
        })
      );
    });

    it('should throw error.api.noImageInParts when no images returned', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'No image' }] } }] });

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.api.noImageInParts'
      );
    });

    it('should throw error.api.noContent when content parts are missing', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({ candidates: [{ finishReason: 'STOP', content: null }] });

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.api.noContent'
      );
    });

    it('should wrap API errors with error.api.geminiFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(generateImageFromText('Test prompt')).rejects.toThrow(
        'error.api.geminiFailed:Rate limit exceeded'
      );
    });

    it('should preserve error.* prefixed errors', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
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
      expect(result).toMatchObject({
        base64: upscaledBase64,
        mimeType: 'image/png',
        metadata: { requestedModel: 'gemini-3.1-flash-image' },
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3.1-flash-image',
        })
      );
      // Verify prompt mentions upscaling
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const textPart = callArgs.contents[0].parts.find(
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
});
