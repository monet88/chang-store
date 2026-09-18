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
 *   antiApiKey: 'anti-key-123',
 * }));
 */

import { vi } from 'vitest';
import { Feature } from '../../src/types';
import type { ImageEngine } from '../../src/contexts/ImageEngineContext';

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
  imageEditModel: string;
  setImageEditModel: (model: string) => void;
  imageGenerateModel: string;
  setImageGenerateModel: (model: string) => void;
  textGenerateModel: string;
  setTextGenerateModel: (model: string) => void;
  cpaGatewaySettings: {
    url: string;
    apiKey: string;
  };
  setCpaGatewaySettings: (settings: { url: string; apiKey: string }) => void;
  geminiProfile: {
    id: string;
    label: string;
    baseUrl: string;
    apiKey: string;
    lane: string;
    driver: string;
    enabled: boolean;
  };
  imageProfiles: unknown[];
  activeImageProfileId: string | null;
  servedModelsVersion: number;
  saveGatewayProfiles: (profiles: unknown[]) => void;
  selectImageProfile: (id: string | null) => void;
  imageProfileForDriver: () => undefined;
  notifyServedModelsChanged: () => void;
  getModelsForFeature: (feature: Feature) => {
    imageEditModel: string;
    imageGenerateModel: string;
    textGenerateModel: string;
  };
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
 *   antiApiKey: 'test-anti-key',
 * }));
 */
export const mockUseApi = (
  overrides: Partial<ApiContextType> = {}
): { useApi: () => ApiContextType } => {
  const defaults: ApiContextType = {
    imageEditModel: 'gemini-3.1-flash-image',
    setImageEditModel: vi.fn(),
    imageGenerateModel: 'gemini-3.1-flash-image',
    setImageGenerateModel: vi.fn(),
    textGenerateModel: 'gemini-3.8-flash',
    setTextGenerateModel: vi.fn(),
    cpaGatewaySettings: {
      url: 'https://cliproxy.monet.uno',
      apiKey: '',
    },
    setCpaGatewaySettings: vi.fn(),
    imageProfiles: [],
    activeImageProfileId: null,
    servedModelsVersion: 0,
    geminiProfile: {
      id: 'cpa-default',
      label: 'Cliproxy',
      baseUrl: 'https://cliproxy.monet.uno',
      apiKey: '',
      lane: 'gemini',
      driver: 'gemini-native',
      enabled: true,
    },
    saveGatewayProfiles: vi.fn(),
    selectImageProfile: vi.fn(),
    imageProfileForDriver: () => undefined,
    notifyServedModelsChanged: vi.fn(),
    /** Default returns all current models */
    getModelsForFeature: vi.fn((_feature: Feature) => ({
      imageEditModel: overrides.imageEditModel ?? 'gemini-3.1-flash-image',
      imageGenerateModel: overrides.imageGenerateModel ?? 'gemini-3.1-flash-image',
      textGenerateModel: overrides.textGenerateModel ?? 'gemini-3.8-flash',
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

/**
 * Creates a mock for useImageEngine — the studio-scoped image transport.
 *
 * Feature hooks read their driver, model and generation options from that
 * context, so a hook or component test mocks this module instead of mounting
 * the provider (which would need the real ApiProvider).
 *
 * @example
 * vi.mock('@/contexts/ImageEngineContext', () => mockUseImageEngine({
 *   editImage: mockedEditImage,
 *   model: 'gemini-3.1-flash-image',
 * }));
 */
export const mockUseImageEngine = (
  overrides: Partial<ImageEngine> = {}
): { useImageEngine: () => ImageEngine } => {
  const defaults: ImageEngine = {
    id: 'gemini',
    model: 'gemini-2.5-flash-image',
    editImage: vi.fn(),
    upscaleImage: vi.fn(),
    createImageChatSession: vi.fn(() => ({
      sendRefinement: vi.fn(),
      getHistory: () => [],
      reset: () => {},
    })),
    modelOptions: null,
    setModel: null,
    noSelectableModel: false,
    options: null,
  };

  return {
    useImageEngine: () => ({
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
