/**
 * Mock module for @google/genai SDK
 *
 * Provides vi.fn() mocks for all GoogleGenAI methods used in the codebase.
 * Used for unit testing services that depend on Google Generative AI.
 */
import { vi } from 'vitest';

/**
 * Mocked GoogleGenAI class constructor
 *
 * Returns a mock instance with stubbed methods for:
 * - models.generateContent - Text/multimodal content generation
 * - models.generateImages - Image generation (Imagen)
 * - models.generateVideos - Video generation (Veo)
 * - operations.getVideosOperation - Video operation status polling
 */
export const GoogleGenAI = vi.fn().mockImplementation(() => ({
  models: {
    /** Mock for text/multimodal content generation */
    generateContent: vi.fn(),
    /** Mock for image generation (Imagen models) */
    generateImages: vi.fn(),
    /** Mock for video generation (Veo models) */
    generateVideos: vi.fn(),
  },
  operations: {
    /** Mock for polling video generation operation status */
    getVideosOperation: vi.fn(),
  },
}));
