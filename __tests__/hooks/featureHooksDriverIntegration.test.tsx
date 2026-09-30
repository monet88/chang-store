import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  InMemoryImageDriverFake,
  createDeterministicPngBase64,
} from '../../src/services/providers/testing/InMemoryImageDriverFake';
import { StudioDriverError, type GenerateJob } from '../../src/services/providers/ImageDriver';
import { ImageDriverProvider } from '../../src/contexts/useImageDriver';
import type { ImageFile } from '../../src/types';

// Context mocks
let currentDriver: InMemoryImageDriverFake;

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
    driver: currentDriver,
    editImage: vi.fn(),
    upscaleImage: vi.fn(),
    createImageChatSession: vi.fn(),
  }),
  useOptionalImageEngine: () => ({
    id: 'gemini',
    model: 'gemini-2.5-flash-image',
    driver: currentDriver,
  }),
  useImageDriver: () => currentDriver,
  useOptionalImageDriver: () => currentDriver,
}));

vi.mock('../../src/utils/identity-transfer-defaults', () => ({
  loadDefaultIdentityReferences: vi.fn().mockResolvedValue({ face: null, body: null }),
}));

// Feature Hooks Under Test
import { useVirtualTryOn } from '../../src/hooks/useVirtualTryOn';
import { useClothingTransfer } from '../../src/hooks/useClothingTransfer';
import { useAIEditor } from '../../src/hooks/useAIEditor';
import { useIdentityTransfer } from '../../src/hooks/useIdentityTransfer';
import { useBackgroundReplacer } from '../../src/hooks/useBackgroundReplacer';
import { usePoseChanger } from '../../src/hooks/usePoseChanger';
import { usePatternGenerator } from '../../src/hooks/usePatternGenerator';
import { useWatermarkRemover } from '../../src/hooks/useWatermarkRemover';

// Synthetic image fixtures with valid dimensions
const TEST_SUBJECT_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(768, 1024),
  mimeType: 'image/png',
};

const TEST_GARMENT_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(768, 1024),
  mimeType: 'image/png',
};

const TEST_FACE_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(512, 512),
  mimeType: 'image/png',
};

const TEST_BODY_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(768, 1024),
  mimeType: 'image/png',
};

const TEST_DESTINATION_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(768, 1024),
  mimeType: 'image/png',
};

const TEST_BACKGROUND_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(768, 1024),
  mimeType: 'image/png',
};

const TEST_POSE_IMAGE: ImageFile = {
  base64: createDeterministicPngBase64(768, 1024),
  mimeType: 'image/png',
};

describe('Feature Hooks Driver Integration', () => {
  let driverFake: InMemoryImageDriverFake;

  beforeEach(() => {
    vi.clearAllMocks();
    driverFake = new InMemoryImageDriverFake('gemini');
    currentDriver = driverFake;
  });

  const createWrapper = (driver: InMemoryImageDriverFake): React.FC<{ children: React.ReactNode }> => {
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ImageDriverProvider driver={driver}>
        {children}
      </ImageDriverProvider>
    );
    Wrapper.displayName = 'ImageDriverTestWrapper';
    return Wrapper;
  };

  describe('1. Virtual Try-On through ImageDriver (Slice #201)', () => {
    it('dispatches generate job with subject & garment roles and untucked drape invariant', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      const jobs = driverFake.getRecordedJobs();
      expect(jobs).toHaveLength(1);

      const job = jobs[0] as GenerateJob;
      expect(job.workflow).toBe('virtual-try-on');
      expect(job.prompt).toBeDefined();

      // Outfit Drape Invariant: tops untucked outside waistband
      expect(job.prompt.toLowerCase()).toContain('untucked');

      // Semantic references: subject and garment
      expect(job.references).toBeDefined();
      const roles = job.references?.map((r) => r.role);
      expect(roles).toContain('subject');
      expect(roles).toContain('garment');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('2. Clothing Transfer through ImageDriver (Slice #201)', () => {
    it('dispatches batch GenerateJob with semantic references and updates status', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useClothingTransfer(), { wrapper });

      act(() => {
        result.current.handleConceptUpload(TEST_GARMENT_IMAGE);
        result.current.handleReferenceUpload(TEST_SUBJECT_IMAGE, result.current.referenceItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.workflow).toBe('clothing-transfer');

      const roles = job?.references?.map((r) => r.role);
      expect(roles).toContain('subject');
      expect(roles).toContain('garment');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.conceptItems[0].status).toBe('completed');
      expect(result.current.conceptItems[0].results.length).toBeGreaterThan(0);
    });
  });

  describe('3. AI Editor through ImageDriver with @img mention resolution (Slice #202)', () => {
    it('dispatches generateOne job and resolves @img mentions to targeted images', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useAIEditor(), { wrapper });

      act(() => {
        result.current.setImages([TEST_SUBJECT_IMAGE, TEST_GARMENT_IMAGE]);
        // Mention @img2 specifically to verify mention-targeting
        result.current.setPrompt('Enhance fabric texture of @img2 specifically');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.workflow).toBe('ai-editor');
      // Only the mentioned image (@img2) is routed to the driver
      expect(job?.images).toHaveLength(1);
      expect(job?.images?.[0]).toBe(TEST_GARMENT_IMAGE);
      expect(job?.prompt).toContain('Enhance fabric texture of');

      expect(result.current.resultImage).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('4. Identity Transfer through ImageDriver (Slice #202)', () => {
    it('dispatches job with identity-transfer workflow and face/scene references', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useIdentityTransfer(), { wrapper });

      act(() => {
        result.current.setFaceReference(TEST_FACE_IMAGE);
        result.current.setBodyReference(TEST_BODY_IMAGE);
        result.current.handleDestinationImagesUpload([TEST_DESTINATION_IMAGE]);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.workflow).toBe('identity-transfer');

      const subjectRefs = job?.references?.filter((r) => r.role === 'subject');
      const styleRefs = job?.references?.filter((r) => r.role === 'style');
      expect(subjectRefs?.length).toBeGreaterThanOrEqual(2); // face + body
      expect(styleRefs?.length).toBeGreaterThanOrEqual(1); // destination image

      expect(result.current.isLoading).toBe(false);
      expect(result.current.destinationItems[0].status).toBe('completed');
    });
  });

  describe('5. Background Replacer through ImageDriver (Slice #203)', () => {
    it('dispatches generate job with background-replacement workflow and subject/style references', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useBackgroundReplacer(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.setBackgroundImage(TEST_BACKGROUND_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.workflow).toBe('background-replacement');

      const subjectRef = job?.references?.find((r) => r.role === 'subject');
      const styleRef = job?.references?.find((r) => r.role === 'style');
      expect(subjectRef).toBeDefined();
      expect(styleRef).toBeDefined();

      expect(result.current.isLoading).toBe(false);
      expect(result.current.generatedImages.length).toBeGreaterThan(0);
    });
  });

  describe('6. Pose Changer through ImageDriver (Slice #203)', () => {
    it('dispatches generateOne with pose-changer workflow and model/pose references', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => usePoseChanger(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handlePoseReferenceUpload(TEST_POSE_IMAGE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.workflow).toBe('pose-changer');

      const subjectRef = job?.references?.find((r) => r.role === 'subject');
      const styleRef = job?.references?.find((r) => r.role === 'style');
      expect(subjectRef).toBeDefined();
      expect(styleRef).toBeDefined();

      expect(result.current.isLoading).toBe(false);
      expect(result.current.generatedImages.length).toBeGreaterThan(0);
    });
  });

  describe('7. Pattern Generator through ImageDriver (Slice #203)', () => {
    it('dispatches generate job configured for square repeat output', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => usePatternGenerator(), { wrapper });

      act(() => {
        result.current.setReferenceImages([TEST_GARMENT_IMAGE]);
        result.current.setPrompt('Monogram repeat pattern');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.aspectRatio).toBe('1:1');
      expect(job?.resolution).toBe('4K');
      expect(job?.references?.[0].role).toBe('style');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.generatedPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('8. Watermark Remover through ImageDriver (Slice #203)', () => {
    it('dispatches single-item generateOne job with watermark-remover workflow', async () => {
      const wrapper = createWrapper(driverFake);
      const addToGallery = vi.fn();
      const { result } = renderHook(() => useWatermarkRemover(addToGallery), { wrapper });

      act(() => {
        result.current.addImages([TEST_SUBJECT_IMAGE]);
      });

      await act(async () => {
        await result.current.startProcessing();
      });

      const job = driverFake.getLastDispatchedJob();
      expect(job).toBeDefined();
      expect(job?.workflow).toBe('watermark-remover');
      expect(job?.images).toHaveLength(1);

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.items[0].status).toBe('completed');
      expect(result.current.items[0].result).toBeDefined();
    });
  });

  describe('9. In-Flight Loading State via deferNext & resolveAllDeferred', () => {
    it('reflects active loading state while driver execution is deferred', async () => {
      const wrapper = createWrapper(driverFake);
      const deferred = driverFake.deferNext();

      const { result } = renderHook(() => useAIEditor(), { wrapper });

      act(() => {
        result.current.setImages([TEST_SUBJECT_IMAGE]);
        result.current.setPrompt('Testing deferral lifecycle');
      });

      let promise: Promise<void>;
      act(() => {
        promise = result.current.handleGenerate();
      });

      // While deferred is in-flight, hook must report loading
      expect(result.current.isLoading).toBe(true);
      expect(deferred.isPending).toBe(true);

      // Resolve all deferred executions
      await act(async () => {
        driverFake.resolveAllDeferred();
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.resultImage).toBeDefined();
    });
  });

  describe('10. Error Handling with StudioDriverError', () => {
    it('normalizes StudioDriverError and populates user error state', async () => {
      const wrapper = createWrapper(driverFake);
      driverFake.queueNextError(
        new StudioDriverError('rate_limited', 'API rate limit exceeded', { status: 429 })
      );

      const { result } = renderHook(() => useAIEditor(), { wrapper });

      act(() => {
        result.current.setImages([TEST_SUBJECT_IMAGE]);
        result.current.setPrompt('Trigger rate limit error');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('11. Prototype Method Preservation across Unbound Class Drivers', () => {
    let generateCalled = false;
    class PurePrototypeDriver {
      readonly id = 'gemini' as const;
      async generate(_job: GenerateJob): Promise<ImageFile[]> {
        generateCalled = true;
        return [{ base64: 'pure_proto_gen', mimeType: 'image/png' }];
      }
      async generateOne(_job: GenerateJob): Promise<ImageFile> {
        return { base64: 'pure_proto_one', mimeType: 'image/png' };
      }
      async upscale(): Promise<ImageFile> {
        return { base64: 'pure_proto_up', mimeType: 'image/png' };
      }
    }

    it('successfully calls driver.generate even when driver methods reside purely on prototype', async () => {
      generateCalled = false;
      const protoDriver = new PurePrototypeDriver();
      currentDriver = protoDriver as any;
      const wrapper = createWrapper(protoDriver as any);

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(generateCalled).toBe(true);
    });
  });
});
