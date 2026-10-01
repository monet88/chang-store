import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  InMemoryImageDriverFake,
  createDeterministicPngBase64,
} from '../../src/services/providers/testing/InMemoryImageDriverFake';
import { StudioDriverError, type GenerateJob } from '../../src/services/providers/ImageDriver';
import { ImageDriverProvider } from '../../src/contexts/useImageDriver';
import {
  UNTUCKED_DRAPE_INSTRUCTION,
  UNTUCKED_OVERRIDE_HEADLINE,
  UNTUCKED_PROHIBITION_LINE,
} from '../../src/utils/outfitDrapePolicy';
import type { ImageFile, VirtualTryOnClothingItem } from '../../src/types';

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
    id: currentDriver?.id ?? 'gemini',
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
    id: currentDriver?.id ?? 'gemini',
    model: 'gemini-2.5-flash-image',
    driver: currentDriver,
  }),
  useImageDriver: () => currentDriver,
  useOptionalImageDriver: () => currentDriver,
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
import { useAIEditor } from '../../src/hooks/useAIEditor';
import { useIdentityTransfer } from '../../src/hooks/useIdentityTransfer';
import { useBackgroundReplacer } from '../../src/hooks/useBackgroundReplacer';
import { usePoseChanger } from '../../src/hooks/usePoseChanger';
import { usePatternGenerator } from '../../src/hooks/usePatternGenerator';
import { useWatermarkRemover } from '../../src/hooks/useWatermarkRemover';
import { useLookbookGenerator } from '../../src/hooks/useLookbookGenerator';
import { usePhotoAlbum } from '../../src/hooks/usePhotoAlbum';

// Synthetic fixture generators
const createTestImage = (width = 768, height = 1024): ImageFile => ({
  base64: createDeterministicPngBase64(width, height),
  mimeType: 'image/png',
});

const TEST_SUBJECT_IMAGE: ImageFile = createTestImage(768, 1024);
const TEST_GARMENT_IMAGE: ImageFile = createTestImage(768, 1024);
const TEST_FACE_IMAGE: ImageFile = createTestImage(512, 512);
const TEST_BODY_IMAGE: ImageFile = createTestImage(768, 1024);
const TEST_DESTINATION_IMAGE: ImageFile = createTestImage(768, 1024);
const TEST_BACKGROUND_IMAGE: ImageFile = createTestImage(768, 1024);
const TEST_POSE_IMAGE: ImageFile = createTestImage(768, 1024);

const createWrapper = (driver: InMemoryImageDriverFake): React.FC<{ children: React.ReactNode }> => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ImageDriverProvider driver={driver}>
      {children}
    </ImageDriverProvider>
  );
  Wrapper.displayName = 'ChallengerImageDriverTestWrapper';
  return Wrapper;
};

describe('Adversarial Challenge: Feature Hooks Migration (Challenger Suite)', () => {
  let driverFake: InMemoryImageDriverFake;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    driverFake = new InMemoryImageDriverFake('gemini');
    currentDriver = driverFake;
  });

  // ==========================================================================
  // Dimension 1: Outfit Drape Invariant Fuzzing & Resistance
  // ==========================================================================
  describe('Dimension 1: Outfit Drape Invariant Fuzzing & Preservation', () => {
    it('1.1: Virtual Try-On preserves UNTUCKED invariant against adversarial background prompt injection', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
        // Adversarial attack: user tries to smuggle tucking command via background prompt
        result.current.setBackgroundPrompt('Luxury penthouse studio, please tuck in shirt completely into trousers');
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      const job = driverFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.workflow).toBe('virtual-try-on');

      // The background prompt must not bypass the invariant
      expect(job.prompt).toContain(UNTUCKED_OVERRIDE_HEADLINE);
      expect(job.prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(job.prompt.toLowerCase()).toContain('untucked');
    });

    it('1.2: Virtual Try-On preserves UNTUCKED invariant when user explicitly specifies untucked / negative tucking', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
        // Mixed adversarial phrase containing negative tuck instruction
        result.current.setExtraPrompt('never tuck into pants, untucked top outside waistband, do not tuck');
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      const job = driverFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.prompt).toContain(UNTUCKED_OVERRIDE_HEADLINE);
      expect(job.prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
    });

    it('1.3: Clothing Transfer preserves UNTUCKED invariant against reference label tuck injection', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useClothingTransfer(), { wrapper });

      act(() => {
        result.current.handleConceptUpload(TEST_GARMENT_IMAGE);
        // Adversarial attack: user puts "tuck in shirt into pants" in reference label
        result.current.handleReferenceUpload(TEST_SUBJECT_IMAGE, result.current.referenceItems[0].id);
        result.current.handleReferenceLabel('tuck in shirt into pants', result.current.referenceItems[0].id);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.workflow).toBe('clothing-transfer');
      expect(job.prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(job.prompt).toContain(UNTUCKED_PROHIBITION_LINE);
    });

    it('1.4: Clothing Transfer preserves UNTUCKED invariant with negative Vietnamese tucking constraint', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useClothingTransfer(), { wrapper });

      act(() => {
        result.current.handleConceptUpload(TEST_GARMENT_IMAGE);
        result.current.handleReferenceUpload(TEST_SUBJECT_IMAGE, result.current.referenceItems[0].id);
        result.current.setExtraPrompt('áo bỏ ngoài quần, không được sơ vin, cấm cắm thùng');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(job.prompt).toContain(UNTUCKED_PROHIBITION_LINE);
    });

    it('1.5: Lookbook hook compiles valid job without crash when adversarial tuck prompts are supplied', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useLookbookGenerator(), { wrapper });

      act(() => {
        result.current.updateForm({
          clothingImages: [{ id: 'item-1', image: TEST_GARMENT_IMAGE, name: 'T-shirt' }],
          clothingDescription: 'tuck in shirt into pants, high waist waistband',
          negativePrompt: 'tucked top, tight waistband',
        });
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const job = driverFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.workflow).toBe('lookbook');
      expect(job.prompt).toBeDefined();
      expect(job.negativePrompt).toBe('tucked top, tight waistband');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('1.6: Virtual Try-On on GPT Image engine preserves UNTUCKED invariant against adversarial prompt', async () => {
      const gptFake = new InMemoryImageDriverFake('gptImage');
      currentDriver = gptFake;
      const wrapper = createWrapper(gptFake);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
        result.current.setBackgroundPrompt('Urban cafe with tucked shirt background setting');
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      const job = gptFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.prompt).toContain(UNTUCKED_OVERRIDE_HEADLINE);
      expect(job.prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
    });

    it('1.7: Virtual Try-On on Local Qwen engine preserves UNTUCKED invariant against adversarial prompt', async () => {
      const qwenFake = new InMemoryImageDriverFake('localQwen');
      currentDriver = qwenFake;
      const wrapper = createWrapper(qwenFake);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
        result.current.setBackgroundPrompt('High fashion studio, tuck in shirt');
      });

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      const job = qwenFake.getLastDispatchedJob() as GenerateJob;
      expect(job).toBeDefined();
      expect(job.prompt).toContain(UNTUCKED_OVERRIDE_HEADLINE);
      expect(job.prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
    });
  });

  // ==========================================================================
  // Dimension 2: Caller Object Immutability (Object.freeze)
  // ==========================================================================
  describe('Dimension 2: Caller Object Immutability (Object.freeze)', () => {
    it('2.1: Virtual Try-On safely accepts deeply frozen images and options without mutation', async () => {
      const wrapper = createWrapper(driverFake);
      const frozenSubject = Object.freeze({
        base64: createDeterministicPngBase64(768, 1024),
        mimeType: 'image/png' as const,
      });
      const frozenGarment = Object.freeze({
        base64: createDeterministicPngBase64(768, 1024),
        mimeType: 'image/png' as const,
      });

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      expect(() => {
        act(() => {
          result.current.setSubjectImage(frozenSubject);
          result.current.handleClothingUpload(frozenGarment, result.current.clothingItems[0].id);
        });
      }).not.toThrow();

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(driverFake.getRecordedJobs()).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('2.2: Clothing Transfer safely processes deeply frozen concept and reference images', async () => {
      const wrapper = createWrapper(driverFake);
      const frozenConcept = Object.freeze({
        base64: createDeterministicPngBase64(768, 1024),
        mimeType: 'image/png' as const,
      });
      const frozenReference = Object.freeze({
        base64: createDeterministicPngBase64(768, 1024),
        mimeType: 'image/png' as const,
      });

      const { result } = renderHook(() => useClothingTransfer(), { wrapper });

      expect(() => {
        act(() => {
          result.current.handleConceptUpload(frozenConcept);
          result.current.handleReferenceUpload(frozenReference, result.current.referenceItems[0].id);
        });
      }).not.toThrow();

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(driverFake.getRecordedJobs()).toHaveLength(1);
      expect(result.current.conceptItems[0].status).toBe('completed');
    });

    it('2.3: AI Editor safely accepts frozen image array without mutation', async () => {
      const wrapper = createWrapper(driverFake);
      const frozenImages = Object.freeze([
        Object.freeze({ base64: createDeterministicPngBase64(512, 512), mimeType: 'image/png' }),
        Object.freeze({ base64: createDeterministicPngBase64(512, 512), mimeType: 'image/png' }),
      ]);

      const { result } = renderHook(() => useAIEditor(), { wrapper });

      expect(() => {
        act(() => {
          result.current.setImages(frozenImages as ImageFile[]);
          result.current.setPrompt('Adjust color grading on @img1');
        });
      }).not.toThrow();

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.resultImage).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    it('2.4: Identity Transfer, Background Replacer, and Pose Changer accept frozen references', async () => {
      const wrapper = createWrapper(driverFake);

      // Identity Transfer
      const { result: idResult } = renderHook(() => useIdentityTransfer(), { wrapper });
      act(() => {
        idResult.current.setFaceReference(Object.freeze(createTestImage(512, 512)));
        idResult.current.setBodyReference(Object.freeze(createTestImage(768, 1024)));
        idResult.current.handleDestinationImagesUpload(Object.freeze([Object.freeze(createTestImage(768, 1024))]) as ImageFile[]);
      });
      await act(async () => {
        await idResult.current.handleGenerate();
      });
      expect(idResult.current.destinationItems[0].status).toBe('completed');

      // Background Replacer
      const { result: bgResult } = renderHook(() => useBackgroundReplacer(), { wrapper });
      act(() => {
        bgResult.current.setSubjectImage(Object.freeze(createTestImage(768, 1024)));
        bgResult.current.setBackgroundImage(Object.freeze(createTestImage(768, 1024)));
      });
      await act(async () => {
        await bgResult.current.handleGenerate();
      });
      expect(bgResult.current.generatedImages.length).toBeGreaterThan(0);

      // Pose Changer
      const { result: poseResult } = renderHook(() => usePoseChanger(), { wrapper });
      act(() => {
        poseResult.current.setSubjectImage(Object.freeze(createTestImage(768, 1024)));
        poseResult.current.handlePoseReferenceUpload(Object.freeze(createTestImage(768, 1024)));
      });
      await act(async () => {
        await poseResult.current.handleGenerate();
      });
      expect(poseResult.current.generatedImages.length).toBeGreaterThan(0);
    });

    it('2.5: Pattern Generator and Watermark Remover accept deeply frozen inputs without mutation', async () => {
      const wrapper = createWrapper(driverFake);

      // Pattern Generator with frozen arrays
      const { result: patternResult } = renderHook(() => usePatternGenerator(), { wrapper });
      act(() => {
        patternResult.current.setReferenceImages(Object.freeze([Object.freeze(createTestImage(512, 512))]) as ImageFile[]);
        patternResult.current.setPrompt('Checkerboard');
      });
      await act(async () => {
        await patternResult.current.handleGenerate();
      });
      expect(patternResult.current.generatedPatterns.length).toBeGreaterThan(0);

      // Watermark Remover with frozen image list
      const addToGallery = vi.fn();
      const { result: wmResult } = renderHook(() => useWatermarkRemover(addToGallery), { wrapper });
      act(() => {
        wmResult.current.addImages(Object.freeze([Object.freeze(createTestImage(512, 512))]) as ImageFile[]);
      });
      await act(async () => {
        await wmResult.current.startProcessing();
      });
      expect(wmResult.current.items[0].status).toBe('completed');
    });
  });

  // ==========================================================================
  // Dimension 3: Mid-Flight Abort Cancellation & Race Conditions
  // ==========================================================================
  describe('Dimension 3: Mid-Flight Abort Cancellation & Race Conditions', () => {
    it('3.1: Virtual Try-On handles mid-flight driver cancellation cleanly without unhandled rejection', async () => {
      const wrapper = createWrapper(driverFake);
      const deferred = driverFake.deferNext();

      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      let promise: Promise<void>;
      act(() => {
        promise = result.current.handleGenerateImage();
      });

      // Generation is in-flight
      expect(result.current.isLoading).toBe(true);

      // Trigger mid-flight cancellation via StudioDriverError('cancelled')
      await act(async () => {
        deferred.reject(new StudioDriverError('cancelled', 'Generation aborted mid-flight by client signal'));
        await promise;
      });

      // Hook must recover cleanly
      expect(result.current.isLoading).toBe(false);
      expect(result.current.clothingItems[0].id).toBeDefined();
    });

    it('3.2: Clothing Transfer handles mid-flight error during batch execution without unhandled rejections', async () => {
      const wrapper = createWrapper(driverFake);
      const deferred = driverFake.deferNext();

      const { result } = renderHook(() => useClothingTransfer(), { wrapper });

      act(() => {
        result.current.handleConceptUpload(TEST_GARMENT_IMAGE);
        result.current.handleReferenceUpload(TEST_SUBJECT_IMAGE, result.current.referenceItems[0].id);
      });

      let promise: Promise<void>;
      act(() => {
        promise = result.current.handleGenerate();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.conceptItems[0].status).toBe('processing');

      // Abort / reject deferred in-flight
      await act(async () => {
        deferred.reject(new StudioDriverError('cancelled', 'Aborted by user', { retryable: false }));
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.conceptItems[0].status).toBe('error');
      expect(result.current.conceptItems[0].error).toBeDefined();
    });

    it('3.3: AI Editor mid-flight cancellation resets loading state and logs error', async () => {
      const wrapper = createWrapper(driverFake);
      const deferred = driverFake.deferNext();

      const { result } = renderHook(() => useAIEditor(), { wrapper });

      act(() => {
        result.current.setImages([TEST_SUBJECT_IMAGE]);
        result.current.setPrompt('Mid-flight cancellation test');
      });

      let promise: Promise<void>;
      act(() => {
        promise = result.current.handleGenerate();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        deferred.reject(new StudioDriverError('cancelled', 'Task cancelled'));
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.resultImage).toBeNull();
    });

    it('3.4: Pre-aborted AbortSignal immediately rejects without executing generation', async () => {
      const controller = new AbortController();
      controller.abort(new Error('Pre-aborted signal'));

      await expect(
        driverFake.generate({
          prompt: 'test prompt',
          signal: controller.signal,
        })
      ).rejects.toThrow(StudioDriverError);
    });

    it('3.5: Multi-subject Virtual Try-On handles partial worker failure cleanly without hanging', async () => {
      const wrapper = createWrapper(driverFake);
      const { result } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        result.current.handleSubjectImagesUpload([
          TEST_SUBJECT_IMAGE,
          createTestImage(768, 1024),
        ]);
        result.current.handleClothingUpload(TEST_GARMENT_IMAGE, result.current.clothingItems[0].id);
      });

      // Queue an error for the first job, while the second will succeed
      driverFake.queueNextError(new StudioDriverError('gateway_down', 'Connection dropped', { status: 502 }));

      await act(async () => {
        await result.current.handleGenerateImage();
      });

      expect(result.current.isLoading).toBe(false);
      const subjects = result.current.subjectItems;
      expect(subjects).toHaveLength(2);
      expect(subjects.some((s) => s.status === 'error')).toBe(true);
      expect(subjects.some((s) => s.status === 'completed')).toBe(true);
    });
  });

  // ==========================================================================
  // Dimension 4: Local Qwen Upscale Isolation across All 10 Hooks
  // ==========================================================================
  describe('Dimension 4: Local Qwen Upscale Isolation across All 10 Hooks', () => {
    it('4.1: Upscale is never automatically invoked during generation across all 10 feature hooks', async () => {
      const wrapper = createWrapper(driverFake);

      // Helper to assert zero upscale jobs dispatched
      const assertZeroUpscaleJobs = (hookName: string) => {
        expect(driverFake.dispatchedUpscaleJobs).toHaveLength(0);
        expect(driverFake.getLastDispatchedUpscaleJob()).toBeUndefined();
      };

      // 1. Virtual Try-On
      const { result: vtoResult } = renderHook(() => useVirtualTryOn(), { wrapper });
      act(() => {
        vtoResult.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        vtoResult.current.handleClothingUpload(TEST_GARMENT_IMAGE, vtoResult.current.clothingItems[0].id);
      });
      await act(async () => {
        await vtoResult.current.handleGenerateImage();
      });
      assertZeroUpscaleJobs('useVirtualTryOn');
      expect(driverFake.dispatchedJobs.length).toBe(1);

      // 2. Clothing Transfer
      const { result: ctResult } = renderHook(() => useClothingTransfer(), { wrapper });
      act(() => {
        ctResult.current.handleConceptUpload(TEST_GARMENT_IMAGE);
        ctResult.current.handleReferenceUpload(TEST_SUBJECT_IMAGE, ctResult.current.referenceItems[0].id);
      });
      await act(async () => {
        await ctResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('useClothingTransfer');
      expect(driverFake.dispatchedJobs.length).toBe(2);

      // 3. AI Editor
      const { result: aieResult } = renderHook(() => useAIEditor(), { wrapper });
      act(() => {
        aieResult.current.setImages([TEST_SUBJECT_IMAGE]);
        aieResult.current.setPrompt('Touch up lighting');
      });
      await act(async () => {
        await aieResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('useAIEditor');
      expect(driverFake.dispatchedJobs.length).toBe(3);

      // 4. Identity Transfer
      const { result: idResult } = renderHook(() => useIdentityTransfer(), { wrapper });
      act(() => {
        idResult.current.setFaceReference(TEST_FACE_IMAGE);
        idResult.current.setBodyReference(TEST_BODY_IMAGE);
        idResult.current.handleDestinationImagesUpload([TEST_DESTINATION_IMAGE]);
      });
      await act(async () => {
        await idResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('useIdentityTransfer');
      expect(driverFake.dispatchedJobs.length).toBe(4);

      // 5. Background Replacer
      const { result: bgResult } = renderHook(() => useBackgroundReplacer(), { wrapper });
      act(() => {
        bgResult.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        bgResult.current.setBackgroundImage(TEST_BACKGROUND_IMAGE);
      });
      await act(async () => {
        await bgResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('useBackgroundReplacer');
      expect(driverFake.dispatchedJobs.length).toBe(5);

      // 6. Pose Changer
      const { result: poseResult } = renderHook(() => usePoseChanger(), { wrapper });
      act(() => {
        poseResult.current.setSubjectImage(TEST_SUBJECT_IMAGE);
        poseResult.current.handlePoseReferenceUpload(TEST_POSE_IMAGE);
      });
      await act(async () => {
        await poseResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('usePoseChanger');
      expect(driverFake.dispatchedJobs.length).toBe(6);

      // 7. Pattern Generator
      const { result: patternResult } = renderHook(() => usePatternGenerator(), { wrapper });
      act(() => {
        patternResult.current.setReferenceImages([TEST_GARMENT_IMAGE]);
        patternResult.current.setPrompt('Damask texture pattern');
      });
      await act(async () => {
        await patternResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('usePatternGenerator');
      expect(driverFake.dispatchedJobs.length).toBe(7);

      // 8. Watermark Remover
      const addToGallery = vi.fn();
      const { result: wmResult } = renderHook(() => useWatermarkRemover(addToGallery), { wrapper });
      act(() => {
        wmResult.current.addImages([TEST_SUBJECT_IMAGE]);
      });
      await act(async () => {
        await wmResult.current.startProcessing();
      });
      assertZeroUpscaleJobs('useWatermarkRemover');
      expect(driverFake.dispatchedJobs.length).toBe(8);

      // 9. Lookbook Generator
      const { result: lbResult } = renderHook(() => useLookbookGenerator(), { wrapper });
      act(() => {
        lbResult.current.updateForm({
          clothingImages: [{ id: 'lb-1', image: TEST_GARMENT_IMAGE, name: 'Suit' }],
        });
      });
      await act(async () => {
        await lbResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('useLookbookGenerator');
      expect(driverFake.dispatchedJobs.length).toBe(9);

      // 10. Photo Album
      const { result: paResult } = renderHook(() => usePhotoAlbum(), { wrapper });
      act(() => {
        paResult.current.setOriginalPhoto(TEST_SUBJECT_IMAGE);
        paResult.current.setSelectedPoses(['pose_1']);
      });
      await act(async () => {
        await paResult.current.handleGenerate();
      });
      assertZeroUpscaleJobs('usePhotoAlbum');
      expect(driverFake.dispatchedJobs.length).toBe(10);

      // Explicit user upscale: only now must driver.upscale be invoked
      await act(async () => {
        await aieResult.current.handleUpscale(TEST_SUBJECT_IMAGE);
      });
      expect(driverFake.dispatchedUpscaleJobs).toHaveLength(1);
      expect(driverFake.getLastDispatchedUpscaleJob()?.image).toBe(TEST_SUBJECT_IMAGE);
    });

    it('4.2: Local Qwen upscale isolation is preserved even when prompt contains upscale keywords', async () => {
      const qwenFake = new InMemoryImageDriverFake('localQwen');
      currentDriver = qwenFake;
      const wrapper = createWrapper(qwenFake);
      const { result } = renderHook(() => useAIEditor(), { wrapper });

      act(() => {
        result.current.setImages([TEST_SUBJECT_IMAGE]);
        result.current.setPrompt('Please upscale this image to 4K high resolution enhanced quality');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(qwenFake.dispatchedUpscaleJobs).toHaveLength(0);
      expect(qwenFake.dispatchedJobs).toHaveLength(1);
    });
  });
});
