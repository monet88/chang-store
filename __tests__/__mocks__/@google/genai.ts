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
 */
export const GoogleGenAI = vi.fn().mockImplementation(() => ({
  models: {
    /** Mock for text/multimodal content generation */
    generateContent: vi.fn(),
  },
}));
