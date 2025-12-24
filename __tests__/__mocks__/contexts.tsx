/**
 * Context Mock Utilities for Hook Testing
 *
 * Provides reusable mock implementations for all context hooks used in the app.
 * Each mock returns sensible defaults with vi.fn() handlers for assertions.
 * Supports test-specific overrides via partial object merging.
 *
 * @example
 * // Basic usage with defaults
 * vi.mock('@/contexts/LanguageContext', () => mockUseLanguage());
 *
 * @example
 * // Override specific values for a test
 * vi.mock('@/contexts/ApiProviderContext', () => mockUseApi({
 *   googleApiKey: 'test-key',
 *   aivideoautoAccessToken: 'token-123',
 * }));
 */

import { vi } from 'vitest';
import { Feature } from '../../types';

// ============================================================================
// Type Definitions
// ============================================================================

/** Type for useLanguage hook return value */
interface LanguageContextType {
  language: 'en';
  setLanguage: ReturnType<typeof vi.fn>;
  t: ReturnType<typeof vi.fn>;
  translations: Record<string, unknown>;
}

/** Type for useImageGallery hook return value */
interface ImageGalleryContextType {
  images: Array<{ base64: string; mimeType: string }>;
  addImage: ReturnType<typeof vi.fn>;
  deleteImage: ReturnType<typeof vi.fn>;
  clearImages: ReturnType<typeof vi.fn>;
}

/** Type for useApi hook return value */
interface ApiContextType {
  googleApiKey: string | null;
  setGoogleApiKey: ReturnType<typeof vi.fn>;
  aivideoautoAccessToken: string | null;
  setAivideoautoAccessToken: ReturnType<typeof vi.fn>;
  aivideoautoImageModels: Array<{ id_base: string; model: string; name: string }>;
  setAivideoautoImageModels: ReturnType<typeof vi.fn>;
  aivideoautoVideoModels: Array<{ id_base: string; model: string; name: string }>;
  setAivideoautoVideoModels: ReturnType<typeof vi.fn>;
  imageEditModel: string;
  setImageEditModel: ReturnType<typeof vi.fn>;
  imageGenerateModel: string;
  setImageGenerateModel: ReturnType<typeof vi.fn>;
  videoGenerateModel: string;
  setVideoGenerateModel: ReturnType<typeof vi.fn>;
  textGenerateModel: string;
  setTextGenerateModel: ReturnType<typeof vi.fn>;
  getModelsForFeature: ReturnType<typeof vi.fn>;
}

/** Type for useImageViewer hook return value */
interface ImageViewerContextType {
  viewerImage: { base64: string; mimeType: string } | null;
  openViewer: ReturnType<typeof vi.fn>;
  closeViewer: ReturnType<typeof vi.fn>;
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a mock for useLanguage hook
 *
 * @param overrides - Partial overrides for default values
 * @returns Module mock object with useLanguage export
 *
 * @example
 * vi.mock('@/contexts/LanguageContext', () => mockUseLanguage({
 *   t: vi.fn((key) => `translated:${key}`),
 * }));
 */
export const mockUseLanguage = (
  overrides: Partial<LanguageContextType> = {}
): { useLanguage: () => LanguageContextType } => {
  const defaults: LanguageContextType = {
    language: 'en',
    setLanguage: vi.fn(),
    /** Default t() returns the key as-is for easy assertion */
    t: vi.fn((key: string) => key),
    translations: {},
  };

  return {
    useLanguage: () => ({
      ...defaults,
      ...overrides,
    }),
  };
};

/**
 * Creates a mock for useImageGallery hook
 *
 * @param overrides - Partial overrides for default values
 * @returns Module mock object with useImageGallery export
 *
 * @example
 * vi.mock('@/contexts/ImageGalleryContext', () => mockUseImageGallery({
 *   images: [{ base64: 'test', mimeType: 'image/png' }],
 * }));
 */
export const mockUseImageGallery = (
  overrides: Partial<ImageGalleryContextType> = {}
): { useImageGallery: () => ImageGalleryContextType } => {
  const defaults: ImageGalleryContextType = {
    images: [],
    addImage: vi.fn(),
    deleteImage: vi.fn(),
    clearImages: vi.fn(),
  };

  return {
    useImageGallery: () => ({
      ...defaults,
      ...overrides,
    }),
  };
};

/**
 * Creates a mock for useApi hook
 *
 * @param overrides - Partial overrides for default values
 * @returns Module mock object with useApi export
 *
 * @example
 * vi.mock('@/contexts/ApiProviderContext', () => mockUseApi({
 *   googleApiKey: 'test-api-key',
 *   aivideoautoAccessToken: 'test-token',
 *   aivideoautoImageModels: [{ id_base: 'model-1', model: 'model', name: 'Test' }],
 * }));
 */
export const mockUseApi = (
  overrides: Partial<ApiContextType> = {}
): { useApi: () => ApiContextType } => {
  const defaults: ApiContextType = {
    googleApiKey: null,
    setGoogleApiKey: vi.fn(),
    aivideoautoAccessToken: null,
    setAivideoautoAccessToken: vi.fn(),
    aivideoautoImageModels: [],
    setAivideoautoImageModels: vi.fn(),
    aivideoautoVideoModels: [],
    setAivideoautoVideoModels: vi.fn(),
    imageEditModel: 'gemini-2.5-flash-image',
    setImageEditModel: vi.fn(),
    imageGenerateModel: 'imagen-4.0-generate-001',
    setImageGenerateModel: vi.fn(),
    videoGenerateModel: '',
    setVideoGenerateModel: vi.fn(),
    textGenerateModel: 'gemini-2.5-pro',
    setTextGenerateModel: vi.fn(),
    /** Default returns all current models */
    getModelsForFeature: vi.fn((_feature: Feature) => ({
      imageEditModel: overrides.imageEditModel ?? 'gemini-2.5-flash-image',
      imageGenerateModel: overrides.imageGenerateModel ?? 'imagen-4.0-generate-001',
      videoGenerateModel: overrides.videoGenerateModel ?? '',
      textGenerateModel: overrides.textGenerateModel ?? 'gemini-2.5-pro',
    })),
  };

  return {
    useApi: () => ({
      ...defaults,
      ...overrides,
    }),
  };
};

/**
 * Creates a mock for useImageViewer hook
 *
 * @param overrides - Partial overrides for default values
 * @returns Module mock object with useImageViewer export
 *
 * @example
 * vi.mock('@/contexts/ImageViewerContext', () => mockUseImageViewer({
 *   viewerImage: { base64: 'preview', mimeType: 'image/png' },
 * }));
 */
export const mockUseImageViewer = (
  overrides: Partial<ImageViewerContextType> = {}
): { useImageViewer: () => ImageViewerContextType } => {
  const defaults: ImageViewerContextType = {
    viewerImage: null,
    openViewer: vi.fn(),
    closeViewer: vi.fn(),
  };

  return {
    useImageViewer: () => ({
      ...defaults,
      ...overrides,
    }),
  };
};

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Creates all context mocks with optional overrides
 *
 * @param overrides - Object with partial overrides for each context
 * @returns Object containing all mock factories
 *
 * @example
 * const mocks = createAllContextMocks({
 *   language: { t: vi.fn(() => 'custom') },
 *   api: { googleApiKey: 'key' },
 * });
 */
export const createAllContextMocks = (overrides: {
  language?: Partial<LanguageContextType>;
  imageGallery?: Partial<ImageGalleryContextType>;
  api?: Partial<ApiContextType>;
  imageViewer?: Partial<ImageViewerContextType>;
} = {}) => ({
  language: mockUseLanguage(overrides.language),
  imageGallery: mockUseImageGallery(overrides.imageGallery),
  api: mockUseApi(overrides.api),
  imageViewer: mockUseImageViewer(overrides.imageViewer),
});

/** Default mock instances for quick access in tests */
export const defaultMocks = {
  useLanguage: mockUseLanguage(),
  useImageGallery: mockUseImageGallery(),
  useApi: mockUseApi(),
  useImageViewer: mockUseImageViewer(),
};
