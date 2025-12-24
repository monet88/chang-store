/**
 * Unit tests for services/gemini/text.ts
 *
 * Tests all 7 exported functions:
 * - generateText: Text generation with optional model
 * - generateImageDescription: Image description for fashion photoshoot
 * - generateClothingDescription: Clothing item analysis
 * - generatePoseDescription: Pose analysis for AI recreation
 * - analyzeOutfit: Outfit analysis returning AnalyzedItem[]
 * - generateStylePromptFromImage: Style prompt generation from reference image
 * - analyzeScene: Scene analysis for video generation
 *
 * Mock setup:
 * - Mocks getGeminiClient from apiClient
 * - Creates mock responses with proper Gemini API structure
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ImageFile, AnalyzedItem } from '@/types';

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

/** Mock getGeminiClient to return our mock client */
vi.mock('@/services/apiClient', () => ({
  getGeminiClient: vi.fn(() => mockGeminiClient),
}));

// Import after mocking
import {
  generateText,
  generateImageDescription,
  generateClothingDescription,
  generatePoseDescription,
  analyzeOutfit,
  generateStylePromptFromImage,
  analyzeScene,
} from '@/services/gemini/text';

// ============================================================================
// Test Fixtures
// ============================================================================

/** Sample image for testing */
const sampleImage: ImageFile = {
  base64: 'dGVzdC1pbWFnZS1kYXRh', // base64 encoded "test-image-data"
  mimeType: 'image/png',
};

/**
 * Creates a successful generateContent response with text
 * @param text - The text content to return
 */
function createSuccessTextResponse(text: string) {
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
    text: undefined,
  };
}

/**
 * Creates a response with empty/null text
 */
function createNoTextResponse() {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text: '' }],
        },
      },
    ],
    text: undefined,
  };
}

/**
 * Creates a JSON response (for analyzeOutfit)
 * @param data - The JSON data to stringify
 */
function createJsonResponse(data: unknown) {
  const jsonText = JSON.stringify(data);
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text: jsonText }],
        },
      },
    ],
    text: jsonText,
  };
}

/**
 * Creates a JSON response wrapped in markdown code block
 * @param data - The JSON data to stringify
 */
function createMarkdownJsonResponse(data: unknown) {
  const jsonText = '```json\n' + JSON.stringify(data) + '\n```';
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text: jsonText }],
        },
      },
    ],
    text: jsonText,
  };
}

/** Sample valid analyzed items for outfit analysis */
const sampleAnalyzedItems: AnalyzedItem[] = [
  {
    item: 'White T-Shirt',
    description: 'A classic white cotton t-shirt with crew neck',
    possibleBrands: ['Uniqlo', 'H&M', 'Zara'],
  },
  {
    item: 'Blue Jeans',
    description: 'Slim-fit blue denim jeans with light wash',
    possibleBrands: ["Levi's", 'Diesel', 'G-Star'],
  },
];

// ============================================================================
// Test Suites
// ============================================================================

describe('services/gemini/text.ts', () => {
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
  // generateText Tests
  // ==========================================================================
  describe('generateText', () => {
    it('should successfully generate text with default model', async () => {
      // Arrange
      const expectedText = 'This is the generated response.';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse(expectedText)
      );

      // Act
      const result = await generateText('Generate a greeting');

      // Assert
      expect(result).toBe(expectedText);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro',
          contents: 'Generate a greeting',
          config: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 32768 },
          }),
        })
      );
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('Response')
      );

      // Act
      await generateText('Prompt', 'gemini-2.5-flash');

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
    });

    it('should trim whitespace from response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('  Response with whitespace  \n')
      );

      // Act
      const result = await generateText('Prompt');

      // Assert
      expect(result).toBe('Response with whitespace');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('SAFETY')
      );

      // Act & Assert
      await expect(generateText('Inappropriate prompt')).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock when no candidates returned', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(generateText('Prompt')).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on SAFETY finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('SAFETY')
      );

      // Act & Assert
      await expect(generateText('Prompt')).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on RECITATION finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('RECITATION')
      );

      // Act & Assert
      await expect(generateText('Copyrighted content')).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on OTHER finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('OTHER')
      );

      // Act & Assert
      await expect(generateText('Prompt')).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.noText when response has no text', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(generateText('Prompt')).rejects.toThrow('error.api.noText');
    });

    it('should wrap unknown errors with error.api.geminiFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(new Error('Network timeout'));

      // Act & Assert
      await expect(generateText('Prompt')).rejects.toThrow(
        'error.api.geminiFailed:Network timeout'
      );
    });

    it('should preserve error.* prefixed errors', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
        new Error('error.api.quotaExceeded')
      );

      // Act & Assert
      await expect(generateText('Prompt')).rejects.toThrow(
        'error.api.quotaExceeded'
      );
    });
  });

  // ==========================================================================
  // generateImageDescription Tests
  // ==========================================================================
  describe('generateImageDescription', () => {
    it('should successfully generate image description', async () => {
      // Arrange
      const expectedDescription =
        'A bright studio setting with soft diffused lighting.';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse(expectedDescription)
      );

      // Act
      const result = await generateImageDescription(sampleImage);

      // Assert
      expect(result).toBe(expectedDescription);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
      // Verify image part was included
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents.parts).toHaveLength(2); // image + text
      expect(callArgs.contents.parts[0].inlineData).toEqual({
        data: sampleImage.base64,
        mimeType: sampleImage.mimeType,
      });
    });

    it('should trim whitespace from description', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('  Description with spaces  ')
      );

      // Act
      const result = await generateImageDescription(sampleImage);

      // Assert
      expect(result).toBe('Description with spaces');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('HARM')
      );

      // Act & Assert
      await expect(generateImageDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(generateImageDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on SAFETY finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('SAFETY')
      );

      // Act & Assert
      await expect(generateImageDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.noTextDescription when no description', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(generateImageDescription(sampleImage)).rejects.toThrow(
        'error.api.noTextDescription'
      );
    });

    it('should wrap unknown errors with error.api.descriptionFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      // Act & Assert
      await expect(generateImageDescription(sampleImage)).rejects.toThrow(
        'error.api.descriptionFailed:Connection refused'
      );
    });
  });

  // ==========================================================================
  // generateClothingDescription Tests
  // ==========================================================================
  describe('generateClothingDescription', () => {
    it('should successfully generate clothing description', async () => {
      // Arrange
      const expectedDescription =
        'A silk blouse with floral pattern in navy blue.';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse(expectedDescription)
      );

      // Act
      const result = await generateClothingDescription(sampleImage);

      // Assert
      expect(result).toBe(expectedDescription);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
    });

    it('should trim whitespace from description', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('\n  Trimmed description  \n')
      );

      // Act
      const result = await generateClothingDescription(sampleImage);

      // Assert
      expect(result).toBe('Trimmed description');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('SAFETY')
      );

      // Act & Assert
      await expect(generateClothingDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(generateClothingDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on RECITATION finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('RECITATION')
      );

      // Act & Assert
      await expect(generateClothingDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.noText when no description', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(generateClothingDescription(sampleImage)).rejects.toThrow(
        'error.api.noText'
      );
    });

    it('should wrap unknown errors with error.api.clothingDescriptionFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
        new Error('API rate limited')
      );

      // Act & Assert
      await expect(generateClothingDescription(sampleImage)).rejects.toThrow(
        'error.api.clothingDescriptionFailed:API rate limited'
      );
    });
  });

  // ==========================================================================
  // generatePoseDescription Tests
  // ==========================================================================
  describe('generatePoseDescription', () => {
    it('should successfully generate pose description', async () => {
      // Arrange
      const expectedDescription =
        'Standing with arms crossed, head tilted slightly.';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse(expectedDescription)
      );

      // Act
      const result = await generatePoseDescription(sampleImage);

      // Assert
      expect(result).toBe(expectedDescription);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
    });

    it('should trim whitespace from description', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('  Pose description  ')
      );

      // Act
      const result = await generatePoseDescription(sampleImage);

      // Assert
      expect(result).toBe('Pose description');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('OTHER')
      );

      // Act & Assert
      await expect(generatePoseDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(generatePoseDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.safetyBlock on OTHER finish reason', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSafetyBlockResponse('OTHER')
      );

      // Act & Assert
      await expect(generatePoseDescription(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.noTextDescription when no description', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(generatePoseDescription(sampleImage)).rejects.toThrow(
        'error.api.noTextDescription'
      );
    });

    it('should wrap unknown errors with error.api.poseDescriptionFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(new Error('Service down'));

      // Act & Assert
      await expect(generatePoseDescription(sampleImage)).rejects.toThrow(
        'error.api.poseDescriptionFailed:Service down'
      );
    });
  });

  // ==========================================================================
  // analyzeOutfit Tests
  // ==========================================================================
  describe('analyzeOutfit', () => {
    it('should successfully parse valid JSON response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createJsonResponse(sampleAnalyzedItems)
      );

      // Act
      const result = await analyzeOutfit(sampleImage);

      // Assert
      expect(result).toEqual(sampleAnalyzedItems);
      expect(result).toHaveLength(2);
      expect(result[0].item).toBe('White T-Shirt');
      expect(result[0].possibleBrands).toContain('Uniqlo');
    });

    it('should use gemini-2.5-flash model', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createJsonResponse(sampleAnalyzedItems)
      );

      // Act
      await analyzeOutfit(sampleImage);

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
          config: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        })
      );
    });

    it('should clean markdown code block wrapper from JSON', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createMarkdownJsonResponse(sampleAnalyzedItems)
      );

      // Act
      const result = await analyzeOutfit(sampleImage);

      // Assert
      expect(result).toEqual(sampleAnalyzedItems);
    });

    it('should throw error.api.noContent when no text response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.noContent'
      );
    });

    it('should throw error.api.invalidAnalysis when response is not an array', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createJsonResponse({ item: 'Not an array' })
      );

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.invalidAnalysis'
      );
    });

    it('should throw error.api.invalidAnalysis when item field is missing', async () => {
      // Arrange
      const invalidItems = [
        {
          description: 'Missing item field',
          possibleBrands: ['Brand1'],
        },
      ];
      mockGenerateContent.mockResolvedValueOnce(createJsonResponse(invalidItems));

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.invalidAnalysis'
      );
    });

    it('should throw error.api.invalidAnalysis when description field is missing', async () => {
      // Arrange
      const invalidItems = [
        {
          item: 'Shirt',
          possibleBrands: ['Brand1'],
        },
      ];
      mockGenerateContent.mockResolvedValueOnce(createJsonResponse(invalidItems));

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.invalidAnalysis'
      );
    });

    it('should throw error.api.invalidAnalysis when possibleBrands field is missing', async () => {
      // Arrange
      const invalidItems = [
        {
          item: 'Shirt',
          description: 'A nice shirt',
        },
      ];
      mockGenerateContent.mockResolvedValueOnce(createJsonResponse(invalidItems));

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.invalidAnalysis'
      );
    });

    it('should throw when JSON is malformed', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: 'not valid json {' }] },
          },
        ],
        text: 'not valid json {',
      });

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.analysisFailed:'
      );
    });

    it('should handle empty array response', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createJsonResponse([]));

      // Act
      const result = await analyzeOutfit(sampleImage);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should wrap unknown errors with error.api.analysisFailed prefix', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.analysisFailed:Unexpected error'
      );
    });

    it('should preserve error.* prefixed errors', async () => {
      // Arrange
      mockGenerateContent.mockRejectedValueOnce(
        new Error('error.api.quotaExceeded')
      );

      // Act & Assert
      await expect(analyzeOutfit(sampleImage)).rejects.toThrow(
        'error.api.quotaExceeded'
      );
    });
  });

  // ==========================================================================
  // generateStylePromptFromImage Tests
  // ==========================================================================
  describe('generateStylePromptFromImage', () => {
    it('should successfully generate style prompt with default model', async () => {
      // Arrange
      const expectedPrompt =
        'A photorealistic portrait in a softly lit studio with warm tones.';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse(expectedPrompt)
      );

      // Act
      const result = await generateStylePromptFromImage(sampleImage);

      // Assert
      expect(result).toBe(expectedPrompt);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro',
          config: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 32768 },
          }),
        })
      );
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('Style prompt')
      );

      // Act
      await generateStylePromptFromImage(sampleImage, 'gemini-2.5-flash');

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
    });

    it('should trim whitespace from prompt', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('  Style prompt with spaces  ')
      );

      // Act
      const result = await generateStylePromptFromImage(sampleImage);

      // Assert
      expect(result).toBe('Style prompt with spaces');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('SAFETY')
      );

      // Act & Assert
      await expect(
        generateStylePromptFromImage(sampleImage)
      ).rejects.toThrow('error.api.safetyBlock');
    });

    it('should throw error.api.noContent when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(
        generateStylePromptFromImage(sampleImage)
      ).rejects.toThrow('error.api.noContent');
    });

    it('should throw error.api.noTextDescription when no text', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(
        generateStylePromptFromImage(sampleImage)
      ).rejects.toThrow('error.api.noTextDescription');
    });

    it('should propagate errors without additional wrapping', async () => {
      // Arrange: This function doesn't wrap errors
      mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(
        generateStylePromptFromImage(sampleImage)
      ).rejects.toThrow('Network error');
    });
  });

  // ==========================================================================
  // analyzeScene Tests
  // ==========================================================================
  describe('analyzeScene', () => {
    it('should successfully analyze scene with default model', async () => {
      // Arrange
      const expectedAnalysis =
        'A garden setting with soft natural light during golden hour.';
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse(expectedAnalysis)
      );

      // Act
      const result = await analyzeScene(sampleImage);

      // Assert
      expect(result).toBe(expectedAnalysis);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro',
          config: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 32768 },
          }),
        })
      );
    });

    it('should use custom model when provided', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('Scene analysis')
      );

      // Act
      await analyzeScene(sampleImage, 'gemini-2.5-flash');

      // Assert
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
    });

    it('should include image part in request', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('Analysis')
      );

      // Act
      await analyzeScene(sampleImage);

      // Assert
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.contents.parts[0].inlineData).toEqual({
        data: sampleImage.base64,
        mimeType: sampleImage.mimeType,
      });
    });

    it('should trim whitespace from analysis', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createSuccessTextResponse('\n  Scene analysis text  \n')
      );

      // Act
      const result = await analyzeScene(sampleImage);

      // Assert
      expect(result).toBe('Scene analysis text');
    });

    it('should throw error.api.safetyBlock on promptFeedback block', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(
        createPromptBlockedResponse('HARM')
      );

      // Act & Assert
      await expect(analyzeScene(sampleImage)).rejects.toThrow(
        'error.api.safetyBlock'
      );
    });

    it('should throw error.api.noContent when no candidates', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoCandidatesResponse());

      // Act & Assert
      await expect(analyzeScene(sampleImage)).rejects.toThrow(
        'error.api.noContent'
      );
    });

    it('should throw error.api.noTextDescription when no text', async () => {
      // Arrange
      mockGenerateContent.mockResolvedValueOnce(createNoTextResponse());

      // Act & Assert
      await expect(analyzeScene(sampleImage)).rejects.toThrow(
        'error.api.noTextDescription'
      );
    });

    it('should propagate errors without additional wrapping', async () => {
      // Arrange: This function doesn't wrap errors
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      // Act & Assert
      await expect(analyzeScene(sampleImage)).rejects.toThrow(
        'Service unavailable'
      );
    });
  });
});
