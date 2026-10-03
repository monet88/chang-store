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
import type { ImageDriver, GenerateJob, UpscaleJob } from '../../src/services/providers/ImageDriver';
import { InMemoryImageDriverFake } from '../../src/services/providers/testing/InMemoryImageDriverFake';


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

import { flattenInterleavedParts } from '../../src/utils/flattenInterleavedParts';

export const createLegacyDriverBridge = (driver: ImageDriver, defaultModel?: string) => {
  const bridgeEditImage = async (params: any, model?: string, config?: any, signal?: AbortSignal) => {
    const interleaved = flattenInterleavedParts(params.interleavedParts);
    const prompt = interleaved ? interleaved.prompt : params.prompt || '';
    const images = interleaved ? interleaved.images : params.images || [];

    const job: GenerateJob = {
      prompt,
      images: images.length > 0 ? images : undefined,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      workflow: params.workflow,
      negativePrompt: params.negativePrompt,
      count: params.numberOfImages ?? 1,
      model: model || defaultModel,
      signal,
      onProgress: config?.onStatusUpdate,
      interleavedParts: params.interleavedParts,
    };

    return driver.generate(job);
  };

  const bridgeUpscaleImage = async (image: any, _model?: string, config?: any, quality?: any, signal?: AbortSignal) => {
    const job: UpscaleJob = {
      image,
      quality: quality === '4K' ? '4K' : '2K',
      signal,
      onProgress: config?.onStatusUpdate,
    };

    return driver.upscale(job);
  };

  return { editImage: bridgeEditImage, upscaleImage: bridgeUpscaleImage };
};

export interface MockImageDriverHandle {
  useImageDriver: () => ImageDriver;
  useOptionalImageDriver: () => ImageDriver;
  driver: InMemoryImageDriverFake;
}

export interface MockImageEngineHandle {
  useImageEngine: () => ImageEngine;
  useOptionalImageEngine: () => ImageEngine;
  useImageDriver: () => ImageDriver;
  useOptionalImageDriver: () => ImageDriver;
  driver: InMemoryImageDriverFake;
  createLegacyDriverBridge: typeof createLegacyDriverBridge;
}



/**
 * Creates a mock for useImageDriver hook backed by InMemoryImageDriverFake.
 *
 * Feature hooks migrating to the canonical ImageDriver seam consume useImageDriver().
 * Tests mocking useImageDriver() can inspect recorded calls, inject canned responses/errors,
 * defer execution, and verify domain invariants via driver.getRecordedJobs().
 */
export const mockUseImageDriver = (
  driverOrOverrides?: InMemoryImageDriverFake | Partial<ImageDriver> | { driver?: ImageDriver }
): MockImageDriverHandle => {
  let fakeInstance: InMemoryImageDriverFake;
  let driverInstance: ImageDriver;

  if (driverOrOverrides instanceof InMemoryImageDriverFake) {
    fakeInstance = driverOrOverrides;
    driverInstance = fakeInstance;
  } else if (driverOrOverrides && 'driver' in driverOrOverrides && driverOrOverrides.driver) {
    if (driverOrOverrides.driver instanceof InMemoryImageDriverFake) {
      fakeInstance = driverOrOverrides.driver;
    } else {
      fakeInstance = new InMemoryImageDriverFake();
      Object.assign(fakeInstance, driverOrOverrides.driver);
    }
    driverInstance = driverOrOverrides.driver;
  } else {
    fakeInstance = new InMemoryImageDriverFake();
    if (driverOrOverrides) {
      Object.assign(fakeInstance, driverOrOverrides);
    }
    driverInstance = fakeInstance;
  }

  return {
    useImageDriver: () => driverInstance,
    useOptionalImageDriver: () => driverInstance,
    driver: fakeInstance,
  };
};

/**
 * Creates a mock for useImageEngine — the studio-scoped image transport and UI facade.
 *
 * Retains 100% backward compatibility for tests asserting on legacy ImageEngine properties
 * (options, modelOptions, setModel, model, editImage, upscaleImage), while also exposing
 * a driver backed by InMemoryImageDriverFake, delegation methods (generate, generateOne, upscale),
 * and re-exporting useImageDriver.
 */
export const mockUseImageEngine = (
  overrides: Partial<ImageEngine> & { driver?: ImageDriver } = {}
): MockImageEngineHandle => {
  const fakeDriver =
    (overrides.driver instanceof InMemoryImageDriverFake ? overrides.driver : null) ??
    new InMemoryImageDriverFake((overrides.id as any) ?? 'gemini');

  // If the caller provided custom editImage or upscaleImage overrides (e.g. vi.fn() spies in unit tests),
  // bridge fakeDriver.generate, fakeDriver.generateOne, and fakeDriver.upscale to dispatch to them!
  if (overrides.editImage) {
    fakeDriver.generate = vi.fn(async (job: GenerateJob) => {
      (fakeDriver as any).dispatchedJobs?.push({ ...job });
      (fakeDriver as any).recordedCalls?.push({ type: 'generate', job: { ...job }, timestamp: Date.now() });
      const editParams = {
        images: (job as any).interleavedParts
          ? (job.images ?? [])
          : (job.images ?? job.references?.map((r) => r.image) ?? []),
        prompt: (job as any).interleavedParts ? '' : job.prompt,
        numberOfImages: job.count ?? 1,
        aspectRatio: job.aspectRatio,
        resolution: job.resolution,
        workflow: job.workflow,
        negativePrompt: job.negativePrompt,
        interleavedParts: (job as any).interleavedParts,
      };


      return overrides.editImage!(
        editParams as any,
        overrides.model ?? 'gemini-2.5-flash-image',
        { onStatusUpdate: job.onProgress ?? (() => {}) } as any,
      );
    }) as any;
    fakeDriver.generateOne = vi.fn(async (job: GenerateJob) => {
      const results = await fakeDriver.generate(job);
      return results[0];
    }) as any;
  }

  if (overrides.upscaleImage) {
    fakeDriver.upscale = vi.fn(async (job: UpscaleJob) => {
      (fakeDriver as any).dispatchedUpscaleJobs?.push({ ...job });
      (fakeDriver as any).recordedCalls?.push({ type: 'upscale', job: { ...job }, timestamp: Date.now() });
      return job.quality !== undefined
        ? overrides.upscaleImage!(
            job.image,
            overrides.model ?? 'gemini-2.5-flash-image',
            { onStatusUpdate: job.onProgress ?? (() => {}) } as any,
            job.quality,
          )
        : overrides.upscaleImage!(
            job.image,
            overrides.model ?? 'gemini-2.5-flash-image',
            { onStatusUpdate: job.onProgress ?? (() => {}) } as any,
          );
    }) as any;
  }

  const defaults: ImageEngine = {
    id: 'gemini',
    model: 'gemini-2.5-flash-image',
    driver: fakeDriver,
    editImage: vi.fn(),
    upscaleImage: vi.fn(),
    generate: vi.fn((job) => fakeDriver.generate(job)),
    generateOne: vi.fn((job) => fakeDriver.generateOne(job)),
    upscale: vi.fn((job) => fakeDriver.upscale(job)),
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

  const engineValue: ImageEngine = Object.defineProperties(
    { ...defaults, driver: overrides.driver ?? fakeDriver },
    Object.getOwnPropertyDescriptors(overrides),
  );

  // Keep fakeDriver.id in sync with dynamic getter on engineValue.id
  Object.defineProperty(fakeDriver, 'id', {
    get() {
      return engineValue.id;
    },
    configurable: true,
  });

  return {
    useImageEngine: () => engineValue,
    useOptionalImageEngine: () => engineValue,
    useImageDriver: () => engineValue.driver,
    useOptionalImageDriver: () => engineValue.driver,
    driver: fakeDriver,
    createLegacyDriverBridge,
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
 */
export const createAllContextMocks = (overrides: {
  language?: Partial<LanguageContextType>;
  imageGallery?: Partial<ImageGalleryContextType>;
  api?: Partial<ApiContextType>;
  imageViewer?: Partial<ImageViewerContextType>;
  imageEngine?: Partial<ImageEngine>;
  imageDriver?: InMemoryImageDriverFake | Partial<ImageDriver>;
} = {}) => ({
  language: mockUseLanguage(overrides.language),
  imageGallery: mockUseImageGallery(overrides.imageGallery),
  api: mockUseApi(overrides.api),
  imageViewer: mockUseImageViewer(overrides.imageViewer),
  imageEngine: mockUseImageEngine(overrides.imageEngine),
  imageDriver: mockUseImageDriver(overrides.imageDriver),
});

/** Default mock instances for quick access in tests */
export const defaultMocks = {
  useLanguage: mockUseLanguage(),
  useImageGallery: mockUseImageGallery(),
  useApi: mockUseApi(),
  useImageViewer: mockUseImageViewer(),
  useImageEngine: mockUseImageEngine(),
  useImageDriver: mockUseImageDriver(),
};

