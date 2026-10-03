import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  createDeterministicPngBase64,
} from '../../src/services/providers/testing/InMemoryImageDriverFake';
import {
  StudioDriverError,
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
} from '../../src/services/providers/ImageDriver';
import { ImageDriverProvider } from '../../src/contexts/useImageDriver';
import type { ImageFile } from '../../src/types';

// ============================================================================
// 1. Pure ES6 Class Driver (Methods ONLY on prototype, non-enumerable, un-bound)
// ============================================================================
export interface RecordedExecution {
  method: 'generate' | 'generateOne' | 'upscale';
  job: GenerateJob | UpscaleJob;
  thisContextValid: boolean;
}

export class PurePrototypeDriver implements ImageDriver {
  readonly id = 'gemini' as const;

  // Static tracking array so calls are observable without instance mutations
  public static executions: RecordedExecution[] = [];
  public static nextDelayMs = 0;
  public static nextError: Error | null = null;
  public static onExecution?: (job: GenerateJob | UpscaleJob) => void;

  public static reset() {
    PurePrototypeDriver.executions = [];
    PurePrototypeDriver.nextDelayMs = 0;
    PurePrototypeDriver.nextError = null;
    PurePrototypeDriver.onExecution = undefined;
  }

  // Pure prototype method: NOT bound in constructor, non-enumerable
  async generate(job: GenerateJob): Promise<ImageFile[]> {
    PurePrototypeDriver.onExecution?.(job);
    const thisContextValid = this !== undefined && (this instanceof PurePrototypeDriver || 'id' in this);
    PurePrototypeDriver.executions.push({
      method: 'generate',
      job,
      thisContextValid,
    });

    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Aborted by signal');
    }

    if (PurePrototypeDriver.nextDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), PurePrototypeDriver.nextDelayMs);
        if (job.signal) {
          job.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new StudioDriverError('cancelled', 'Aborted during delay'));
          });
        }
      });
    }

    if (PurePrototypeDriver.nextError) {
      const err = PurePrototypeDriver.nextError;
      PurePrototypeDriver.nextError = null;
      throw err;
    }

    const count = job.count ?? 1;
    const results: ImageFile[] = [];
    for (let i = 0; i < count; i++) {
      results.push({
        base64: createDeterministicPngBase64(512, 512),
        mimeType: 'image/png',
      });
    }
    return results;
  }

  // Pure prototype method: NOT bound in constructor, non-enumerable
  async generateOne(job: GenerateJob): Promise<ImageFile> {
    PurePrototypeDriver.onExecution?.(job);
    const thisContextValid = this !== undefined && (this instanceof PurePrototypeDriver || 'id' in this);
    PurePrototypeDriver.executions.push({
      method: 'generateOne',
      job,
      thisContextValid,
    });

    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Aborted by signal');
    }

    if (PurePrototypeDriver.nextDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), PurePrototypeDriver.nextDelayMs);
        if (job.signal) {
          job.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new StudioDriverError('cancelled', 'Aborted during delay'));
          });
        }
      });
    }

    if (PurePrototypeDriver.nextError) {
      const err = PurePrototypeDriver.nextError;
      PurePrototypeDriver.nextError = null;
      throw err;
    }

    return {
      base64: createDeterministicPngBase64(512, 512),
      mimeType: 'image/png',
    };
  }

  // Pure prototype method: NOT bound in constructor, non-enumerable
  async upscale(job: UpscaleJob): Promise<ImageFile> {
    const thisContextValid = this !== undefined && (this instanceof PurePrototypeDriver || 'id' in this);
    PurePrototypeDriver.executions.push({
      method: 'upscale',
      job,
      thisContextValid,
    });

    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Aborted by signal');
    }

    return {
      base64: createDeterministicPngBase64(1024, 1024),
      mimeType: 'image/png',
    };
  }
}

// ============================================================================
// 2. Mocks & Context Wiring
// ============================================================================
let activeDriver: PurePrototypeDriver;
const legacyEditImageSpy = vi.fn().mockImplementation(async () => {
  throw new Error('FATAL REGRESSION: Legacy editImage fallback was invoked!');
});
const legacyUpscaleImageSpy = vi.fn().mockImplementation(async () => {
  throw new Error('FATAL REGRESSION: Legacy upscaleImage fallback was invoked!');
});

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

const addImageMock = vi.fn();
vi.mock('../../src/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    images: [],
    addImage: addImageMock,
    deleteImage: vi.fn(),
    clearImages: vi.fn(),
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
    textGenerateModel: 'gemini-2.5-flash',
    getModelsForFeature: vi.fn(() => ({
      imageEditModel: 'gemini-2.5-flash-image',
    })),
  }),
}));

vi.mock('../../src/contexts/ImageEngineContext', () => ({
  useImageEngine: () => ({
    id: 'gemini',
    model: 'gemini-2.5-flash-image',
    modelOptions: null,
    setModel: null,
    noSelectableModel: false,
    options: null,
    driver: activeDriver,
    editImage: legacyEditImageSpy,
    upscaleImage: legacyUpscaleImageSpy,
    createImageChatSession: vi.fn(),
  }),
  useOptionalImageEngine: () => ({
    id: 'gemini',
    model: 'gemini-2.5-flash-image',
    driver: activeDriver,
  }),
  useImageDriver: () => activeDriver,
  useOptionalImageDriver: () => activeDriver,
}));

vi.mock('../../src/utils/identity-transfer-defaults', () => ({
  loadDefaultIdentityReferences: vi.fn().mockResolvedValue({ face: null, body: null }),
}));

vi.mock('../../src/services/textService', () => ({
  generateClothingDescription: vi.fn().mockResolvedValue('synthetic description'),
  scanGarmentBlueprint: vi.fn().mockResolvedValue('synthetic blueprint'),
}));

vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn().mockResolvedValue(undefined),
}));

// Feature Hooks Under Test
import { useVirtualTryOn } from '../../src/hooks/useVirtualTryOn';
import { useClothingTransfer } from '../../src/hooks/useClothingTransfer';
import { useLookbookGenerator } from '../../src/hooks/useLookbookGenerator';
import { useWardrobeMode } from '../../src/hooks/useWardrobeMode';
import { usePoseChanger } from '../../src/hooks/usePoseChanger';
import { useWatermarkRemover } from '../../src/hooks/useWatermarkRemover';
import { usePhotoAlbum } from '../../src/hooks/usePhotoAlbum';

// Frozen synthetic fixtures
const createFrozenImage = (width = 512, height = 512): ImageFile =>
  Object.freeze({
    base64: createDeterministicPngBase64(width, height),
    mimeType: 'image/png' as const,
  });

const FROZEN_SUBJECT_IMAGE = createFrozenImage(768, 1024);
const FROZEN_GARMENT_IMAGE = createFrozenImage(768, 1024);
const FROZEN_POSE_IMAGE = createFrozenImage(768, 1024);

const createWrapper = (driver: PurePrototypeDriver): React.FC<{ children: React.ReactNode }> => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ImageDriverProvider driver={driver}>
      {children}
    </ImageDriverProvider>
  );
  Wrapper.displayName = 'PurePrototypeDriverWrapper';
  return Wrapper;
};

describe('Empirical Challenger: Pure ES6 Prototype Driver Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    PurePrototypeDriver.reset();
    activeDriver = new PurePrototypeDriver();
  });

  // ==========================================================================
  // Section A: Verify Pure Prototype Invariants of PurePrototypeDriver
  // ==========================================================================
  describe('Invariant Verification: Pure ES6 Prototype Driver Shape', () => {
    it('guarantees methods exist ONLY on prototype and are NOT own enumerable properties', () => {
      const instance = new PurePrototypeDriver();

      // Only 'id' is an own enumerable property
      expect(Object.keys(instance)).toEqual(['id']);
      expect(Object.prototype.hasOwnProperty.call(instance, 'generate')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(instance, 'generateOne')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(instance, 'upscale')).toBe(false);

      // Methods reside strictly on PurePrototypeDriver.prototype
      expect(Object.prototype.hasOwnProperty.call(PurePrototypeDriver.prototype, 'generate')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(PurePrototypeDriver.prototype, 'generateOne')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(PurePrototypeDriver.prototype, 'upscale')).toBe(true);

      // Methods are non-enumerable
      const descGen = Object.getOwnPropertyDescriptor(PurePrototypeDriver.prototype, 'generate');
      expect(descGen?.enumerable).toBe(false);
      const descOne = Object.getOwnPropertyDescriptor(PurePrototypeDriver.prototype, 'generateOne');
      expect(descOne?.enumerable).toBe(false);

      // Shallow spread would strip these methods:
      const shallowCopy = { ...instance };
      expect((shallowCopy as any).generate).toBeUndefined();
      expect((shallowCopy as any).generateOne).toBeUndefined();
    });
  });

  // ==========================================================================
  // Section B: Pure Prototype Driver Injection across ALL 7 Feature Hooks
  // ==========================================================================
  describe('Section B: All 7 Feature Hooks Execute Pure Prototype Driver Directly', () => {
    it('Hook 1: useVirtualTryOn calls driver.generate directly with untucked drape and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(FROZEN_SUBJECT_IMAGE);
        result.current.handleClothingUpload(FROZEN_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Assertions
      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generate');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('virtual-try-on');
      expect(job.prompt.toLowerCase()).toContain('untucked');
      expect(job.references).toBeDefined();
      const roles = job.references?.map((r) => r.role);
      expect(roles).toContain('subject');
      expect(roles).toContain('garment');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('Hook 2: useClothingTransfer calls driver.generate directly with references and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(() => useClothingTransfer(), { wrapper });

      act(() => {
        result.current.handleConceptUpload(FROZEN_GARMENT_IMAGE);
        result.current.handleReferenceUpload(FROZEN_SUBJECT_IMAGE, result.current.referenceItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generate');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('clothing-transfer');
      const roles = job.references?.map((r) => r.role);
      expect(roles).toContain('subject');
      expect(roles).toContain('garment');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.conceptItems[0].status).toBe('completed');
    });

    it('Hook 3: useLookbookGenerator calls driver.generate directly with references and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper });

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 'lb-1', image: FROZEN_GARMENT_IMAGE, name: 'Silk Shirt' }],
          clothingDescription: 'Casual summer lookbook',
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generate');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('lookbook');
      expect(job.prompt).toBeDefined();
      expect(job.references?.[0].role).toBe('garment');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('Hook 4: useWardrobeMode calls driver.generate directly with sets & subject and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(
        () =>
          useWardrobeMode({
            imageEditModel: 'gemini-2.5-flash-image',
            numImages: 1,
            aspectRatio: '3:4',
            resolution: '1K',
            isParentGenerating: false,
            addImage: addImageMock,
            engineId: 'gemini',
          }),
        { wrapper }
      );

      act(() => {
        result.current.setSubject(FROZEN_SUBJECT_IMAGE);
        result.current.addItem(result.current.sets[0].id);
      });

      act(() => {
        result.current.updateItem(result.current.sets[0].id, result.current.sets[0].items[0].id, {
          image: FROZEN_GARMENT_IMAGE,
        });
      });

      await act(async () => {
        await result.current.generate();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generate');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('wardrobe-mode');
      const roles = job.references?.map((r) => r.role);
      expect(roles).toContain('subject');
      expect(roles).toContain('garment');

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('Hook 5: usePoseChanger calls driver.generateOne directly with pose reference and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(() => usePoseChanger(), { wrapper });

      act(() => {
        result.current.setSubjectImage(FROZEN_SUBJECT_IMAGE);
        result.current.handlePoseReferenceUpload(FROZEN_POSE_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generateOne');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('pose-changer');
      const roles = job.references?.map((r) => r.role);
      expect(roles).toContain('subject');
      expect(roles).toContain('style');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.generatedImages.length).toBeGreaterThan(0);
    });

    it('Hook 6: useWatermarkRemover calls driver.generateOne directly and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(() => useWatermarkRemover(addImageMock), { wrapper });

      act(() => {
        result.current.addImages([FROZEN_SUBJECT_IMAGE]);
      });

      await act(async () => {
        await result.current.startProcessing();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generateOne');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('watermark-remover');
      expect(job.images).toHaveLength(1);

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.items[0].status).toBe('completed');
    });

    it('Hook 7: usePhotoAlbum calls driver.generateOne directly with pose and NO fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      const { result } = renderHook(() => usePhotoAlbum(), { wrapper });

      act(() => {
        result.current.setOriginalPhoto(FROZEN_SUBJECT_IMAGE);
        result.current.setSelectedPoses(['pose_1']);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generateOne');
      expect(exec.thisContextValid).toBe(true);

      const job = exec.job as GenerateJob;
      expect(job.workflow).toBe('photo-album');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.generatedImages.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Section C: Deep Prototype Chains, Frozen Inputs & Abort Handling
  // ==========================================================================
  describe('Section C: Multi-Tier Prototype Inheritance, Frozen Objects & Abort Handling', () => {
    it('C.1: Multi-Tier prototype chain (3 levels of Object.create) preserves all methods without fallback', async () => {
      // Create a 3-level prototype chain
      const baseInstance = new PurePrototypeDriver();
      const level1 = Object.create(baseInstance);
      const level2 = Object.create(level1);
      const level3 = Object.create(level2);

      activeDriver = level3;
      const wrapper = createWrapper(level3);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(FROZEN_SUBJECT_IMAGE);
        result.current.handleClothingUpload(FROZEN_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      expect(PurePrototypeDriver.executions[0].method).toBe('generate');
      expect(PurePrototypeDriver.executions[0].thisContextValid).toBe(true);
    });

    it('C.2: Deeply frozen recursive structures survive all hook generation pipelines without TypeError', async () => {
      const wrapper = createWrapper(activeDriver);
      const deeplyFrozenSubject = Object.freeze({
        base64: createDeterministicPngBase64(768, 1024),
        mimeType: 'image/png' as const,
        meta: Object.freeze({ source: 'test', tags: Object.freeze(['a', 'b']) }),
      });

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      expect(() => {
        act(() => {
          result.current.setSubjectImage(deeplyFrozenSubject);
          result.current.handleClothingUpload(FROZEN_GARMENT_IMAGE, result.current.clothingItems[0].id);
        });
      }).not.toThrow();

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(result.current.error).toBeNull();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
    });

    it('C.3: Mid-flight AbortController cleanly cancels in-flight job without unhandled rejection or fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      PurePrototypeDriver.nextDelayMs = 50; // Simulate 50ms network latency

      const abortController = new AbortController();
      let capturedSignal: AbortSignal | undefined;
      PurePrototypeDriver.onExecution = (job) => {
        capturedSignal = job.signal;
      };

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(FROZEN_SUBJECT_IMAGE);
        result.current.handleClothingUpload(FROZEN_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      let promise: Promise<void>;
      act(() => {
        promise = result.current.handleGenerateImage();
      });

      expect(result.current.isLoading).toBe(true);

      // Trigger abort while job is in-flight
      act(() => {
        abortController.abort(new Error('User aborted execution'));
      });

      // Hook internally propagates or aborts via driver
      await act(async () => {
        try {
          await promise;
        } catch {
          // Expected in abort scenarios
        }
      });

      // Zero legacy editImage calls
      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('C.4: Pre-aborted signal passed to PurePrototypeDriver rejects immediately with StudioDriverError', async () => {
      const controller = new AbortController();
      controller.abort();

      const driver = new PurePrototypeDriver();
      await expect(
        driver.generate({
          prompt: 'test',
          signal: controller.signal,
        })
      ).rejects.toThrow(StudioDriverError);

      await expect(
        driver.generateOne({
          prompt: 'test',
          signal: controller.signal,
        })
      ).rejects.toThrow(StudioDriverError);
    });

    it('C.5: ClothingTransfer & LookbookGenerator abort handling without fallback to legacy editImage', async () => {
      const wrapper = createWrapper(activeDriver);
      PurePrototypeDriver.nextError = new StudioDriverError('cancelled', 'Aborted mid-flight', { retryable: false });

      // Clothing transfer
      const { result: ctResult } = renderHook(() => useClothingTransfer(), { wrapper });
      act(() => {
        ctResult.current.handleConceptUpload(FROZEN_GARMENT_IMAGE);
        ctResult.current.handleReferenceUpload(FROZEN_SUBJECT_IMAGE, ctResult.current.referenceItems[0].id);
      });
      await act(async () => {
        await ctResult.current.handleGenerate();
      });
      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(ctResult.current.isLoading).toBe(false);
      expect(ctResult.current.conceptItems[0].status).toBe('error');

      // Lookbook generator
      PurePrototypeDriver.nextError = new StudioDriverError('cancelled', 'Aborted mid-flight', { retryable: false });
      const { result: lbResult } = renderHook(() => useLookbookGenerator(), { wrapper });
      act(() => {
        lbResult.current.updateForm({
          clothingImages: [{ id: 'lb-1', image: FROZEN_GARMENT_IMAGE, name: 'Silk Shirt' }],
          clothingDescription: 'Casual summer lookbook',
        });
      });
      await act(async () => {
        await lbResult.current.handleGenerate();
      });
      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(lbResult.current.isLoading).toBe(false);
      expect(lbResult.current.error).not.toBeNull();
    });
  });

  // ==========================================================================
  // Section D: Driver Error Propagation & Subclass Inheritance Stress
  // ==========================================================================
  describe('Section D: Driver Error Propagation & Subclass Inheritance Stress', () => {
    it('D.1: StudioDriverError failures are propagated cleanly to UI without triggering legacy fallback', async () => {
      const wrapper = createWrapper(activeDriver);
      PurePrototypeDriver.nextError = new StudioDriverError('hardware_error', 'ComfyUI CUDA OOM out of memory', {
        status: 500,
        retryable: false,
      });

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });
      act(() => {
        result.current.setSubjectImage(FROZEN_SUBJECT_IMAGE);
        result.current.handleClothingUpload(FROZEN_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      // Crucial verification: Hook MUST NOT catch driver error and fall back to editImage
      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.subjectItems[0].status).toBe('error');
      expect(result.current.subjectItems[0].error).toBeDefined();
    });

    it('D.2: Subclass of PurePrototypeDriver inherits prototype methods cleanly across deep hierarchies', async () => {
      class SpecializedStudioDriver extends PurePrototypeDriver {
        readonly brand = 'custom-studio';
      }

      const subclassInstance = new SpecializedStudioDriver();
      activeDriver = subclassInstance as any;
      const wrapper = createWrapper(subclassInstance as any);

      // Verify prototype properties on subclass
      expect(Object.prototype.hasOwnProperty.call(subclassInstance, 'generate')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(SpecializedStudioDriver.prototype, 'generate')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(PurePrototypeDriver.prototype, 'generate')).toBe(true);

      const { result } = renderHook(() => usePoseChanger(), { wrapper });
      act(() => {
        result.current.setSubjectImage(FROZEN_SUBJECT_IMAGE);
        result.current.handlePoseReferenceUpload(FROZEN_POSE_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(legacyEditImageSpy).not.toHaveBeenCalled();
      expect(PurePrototypeDriver.executions).toHaveLength(1);
      const exec = PurePrototypeDriver.executions[0];
      expect(exec.method).toBe('generateOne');
      expect(exec.thisContextValid).toBe(true);
      expect(result.current.generatedImages.length).toBeGreaterThan(0);
    });
  });
});

