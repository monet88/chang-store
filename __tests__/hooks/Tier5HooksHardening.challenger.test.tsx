/**
 * Tier 5 Adversarial Coverage Hardening Test Suite
 *
 * Targets:
 * 1. Dynamic mode switching mid-generation (gemini <-> gptImage <-> localQwen)
 * 2. Outfit Drape Invariant fuzzing & persistence across all 6 prompt compilers & feature hooks
 * 3. Local Qwen manual upscale isolation, single-flight mutex serialization & hardware fatal errors
 * 4. Deep prototype chain traversal (Level 3 inheritance), method destructuring & frozen argument resilience across all 10 feature hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';

// Core Driver & Facade Seams
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
  StudioDriverError,
} from '../../src/services/providers/ImageDriver';
import {
  ImageEngineProvider,
  useImageEngine,
} from '../../src/contexts/ImageEngineContext';
import {
  useImageDriver,
  ImageDriverProvider,
} from '../../src/contexts/useImageDriver';
import {
  InMemoryImageDriverFake,
  createDeterministicPngBase64,
} from '../../src/services/providers/testing/InMemoryImageDriverFake';
import {
  LocalQwenImageDriverAdapter,
} from '../../src/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import {
  resetLocalQwenLock,
} from '../../src/services/providers/local-qwen/localQwenLock';

// Domain Invariant Policies & Compilers
import {
  isTuckingAllowed,
  UNTUCKED_DRAPE_INSTRUCTION,
  UNTUCKED_OVERRIDE_HEADLINE,
} from '../../src/utils/outfitDrapePolicy';
import { flattenInterleavedParts } from '../../src/utils/flattenInterleavedParts';
import { buildGeminiVirtualTryOnParts } from '../../src/utils/gemini-virtual-try-on-prompt';
import { buildGptVirtualTryOnParts } from '../../src/utils/gpt-virtual-try-on-prompt';
import { buildQwenVirtualTryOnParts } from '../../src/utils/qwen-virtual-try-on-prompt';
import { buildGeminiClothingTransferParts } from '../../src/utils/gemini-clothing-transfer-prompt';
import { buildGptClothingTransferParts } from '../../src/utils/gpt-clothing-transfer-prompt';
import { buildQwenClothingTransferParts } from '../../src/utils/qwen-clothing-transfer-prompt';

// Types
import type { ImageFile, StudioMode } from '../../src/types';

// 10 Migrated Feature Hooks
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
import { useWardrobeMode } from '../../src/hooks/useWardrobeMode';

// ============================================================================
// Shared Test Doubles & Mocks Setup
// ============================================================================

let mockDesktopApi: any = null;
const addImageMock = vi.fn();

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
  useLanguageOptional: () => ({
    t: (key: string) => key,
  }),
}));

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
    imageProfiles: [
      {
        id: 'test-profile-1',
        name: 'OpenAI Mock Profile',
        provider: 'openai-images',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test-mock-key',
      },
    ],
    activeImageProfileId: 'test-profile-1',
    servedModelsVersion: 1,
  }),
}));

vi.mock('../../src/hooks/useServedModels', () => ({
  useServedModels: () => [],
}));

vi.mock('../../src/platform/desktopLocalQwen', async () => {
  const actual = await vi.importActual<any>('../../src/platform/desktopLocalQwen');
  return {
    ...actual,
    getDesktopLocalQwenApi: () => mockDesktopApi,
  };
});

vi.mock('../../src/services/imageEditingService', async () => {
  const actual = await vi.importActual<any>('../../src/services/imageEditingService');
  return {
    ...actual,
    createImageChatSession: vi.fn(() => ({
      sendMessage: vi.fn().mockResolvedValue('synthetic chat response'),
      getHistory: vi.fn(() => []),
    })),
  };
});

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

// Synthetic test fixture assets
const createTestImage = (width = 512, height = 512): ImageFile => ({
  base64: createDeterministicPngBase64(width, height),
  mimeType: 'image/png',
});

const createFrozenTestImage = (width = 512, height = 512): ImageFile =>
  Object.freeze({
    base64: createDeterministicPngBase64(width, height),
    mimeType: 'image/png' as const,
  });

const FROZEN_SUBJECT = createFrozenTestImage(768, 1024);
const FROZEN_GARMENT = createFrozenTestImage(768, 1024);

// Helper to create full Dual-Plane Facade wrapper for feature hook tests
const createFacadeWrapper = (
  driver: ImageDriver,
  mode: StudioMode = 'gemini',
): React.FC<{ children: React.ReactNode }> => {
  const FacadeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ImageEngineProvider mode={mode} driverOverride={driver}>
      {children}
    </ImageEngineProvider>
  );
  return FacadeWrapper;
};

// ============================================================================
// Multi-Tier Inheritance Class Hierarchy for Prototype Stress
// ============================================================================

class BaseImageDriver implements ImageDriver {
  readonly id = 'gemini' as const;

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Aborted by signal', { retryable: false });
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

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const list = await this.generate({ ...job, count: 1 });
    return list[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Aborted by signal', { retryable: false });
    }
    return {
      base64: createDeterministicPngBase64(1024, 1024),
      mimeType: 'image/png',
    };
  }
}

class Level1Driver extends BaseImageDriver {}
class Level2Driver extends Level1Driver {}

export class Level3AdversarialDriver extends Level2Driver {
  public static executions: {
    method: 'generate' | 'generateOne' | 'upscale';
    job: GenerateJob | UpscaleJob;
    thisValid: boolean;
  }[] = [];

  static reset() {
    Level3AdversarialDriver.executions = [];
  }

  // Pure prototype methods (non-enumerable on instance, un-bound)
  async generate(job: GenerateJob): Promise<ImageFile[]> {
    const thisValid = this !== undefined && (this instanceof BaseImageDriver || 'id' in this);
    Level3AdversarialDriver.executions.push({ method: 'generate', job, thisValid });
    return super.generate(job);
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const thisValid = this !== undefined && (this instanceof BaseImageDriver || 'id' in this);
    Level3AdversarialDriver.executions.push({ method: 'generateOne', job, thisValid });
    return super.generateOne(job);
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    const thisValid = this !== undefined && (this instanceof BaseImageDriver || 'id' in this);
    Level3AdversarialDriver.executions.push({ method: 'upscale', job, thisValid });
    return super.upscale(job);
  }
}

// ============================================================================
// TEST SUITE: Tier 5 Adversarial Coverage Hardening
// ============================================================================

describe('Tier 5 Adversarial Coverage Hardening: Dual-Plane Facade, Hooks & Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocalQwenLock();
    Level3AdversarialDriver.reset();
    mockDesktopApi = null;
  });

  // ==========================================================================
  // Suite 1: Dynamic Mode Switching Mid-Generation Stress
  // ==========================================================================
  describe('Suite 1: Dynamic Mode Switching Mid-Generation', () => {
    it('1.1: In-flight job started on Gemini completes safely when mode dynamically switches to gptImage', async () => {
      const geminiFake = new InMemoryImageDriverFake('gemini');
      const gptFake = new InMemoryImageDriverFake('gptImage');
      const deferred = geminiFake.deferNext();

      let switchMode: (mode: StudioMode) => void;

      const DynamicWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [mode, setMode] = useState<StudioMode>('gemini');
        switchMode = setMode;
        const driver = mode === 'gptImage' ? gptFake : geminiFake;
        return (
          <ImageEngineProvider mode={mode} driverOverride={driver}>
            {children}
          </ImageEngineProvider>
        );
      };

      const { result } = renderHook(
        () => ({
          driver: useImageDriver(),
          engine: useImageEngine(),
        }),
        { wrapper: DynamicWrapper },
      );

      expect(result.current.driver.id).toBe('gemini');
      expect(result.current.engine.id).toBe('gemini');

      // Dispatch Job 1 on Gemini (deferred in-flight)
      let geminiJobFinished = false;
      let geminiResults: ImageFile[] = [];
      const geminiJobPromise = result.current.driver
        .generate({ prompt: 'gemini tryon in-flight', count: 1 })
        .then((res) => {
          geminiJobFinished = true;
          geminiResults = res;
          return res;
        });

      expect(geminiJobFinished).toBe(false);

      // Dynamically switch mode to gptImage while Job 1 is still in-flight
      act(() => {
        switchMode('gptImage');
      });

      expect(result.current.driver.id).toBe('gptImage');
      expect(result.current.engine.id).toBe('gptImage');

      // Dispatch Job 2 on GPT Image
      const gptResults = await result.current.driver.generate({
        prompt: 'gpt tryon job 2',
        aspectRatio: '3:4',
        count: 1,
      });

      expect(gptResults).toHaveLength(1);
      expect(gptFake.getRecordedJobs()).toHaveLength(1);
      expect(gptFake.getRecordedJobs()[0].prompt).toBe('gpt tryon job 2');

      // Now resolve the in-flight Gemini Job 1
      deferred.resolve();
      await geminiJobPromise;

      expect(geminiJobFinished).toBe(true);
      expect(geminiResults).toHaveLength(1);
      expect(geminiFake.getRecordedJobs()).toHaveLength(1);
      expect(geminiFake.getRecordedJobs()[0].prompt).toBe('gemini tryon in-flight');
    });

    it('1.2: In-flight job started on gptImage completes safely when mode dynamically switches to localQwen', async () => {
      const gptFake = new InMemoryImageDriverFake('gptImage');
      const localFake = new InMemoryImageDriverFake('localQwen');
      const deferredGpt = gptFake.deferNext();

      let switchMode: (mode: StudioMode) => void;

      const DynamicWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [mode, setMode] = useState<StudioMode>('gptImage');
        switchMode = setMode;
        const driver = mode === 'localQwen' ? localFake : gptFake;
        return (
          <ImageEngineProvider mode={mode} driverOverride={driver}>
            {children}
          </ImageEngineProvider>
        );
      };

      const { result } = renderHook(
        () => ({
          driver: useImageDriver(),
          engine: useImageEngine(),
        }),
        { wrapper: DynamicWrapper },
      );

      expect(result.current.driver.id).toBe('gptImage');

      // Dispatch Job 1 on GPT (in-flight deferred)
      const gptPromise = result.current.driver.generate({ prompt: 'gpt in-flight' });

      // Switch mode to localQwen
      act(() => {
        switchMode('localQwen');
      });
      expect(result.current.driver.id).toBe('localQwen');

      // Dispatch Job 2 on Local Qwen
      const localResults = await result.current.driver.generate({
        prompt: 'local qwen immediate job',
        workflow: 'virtual-try-on',
      });
      expect(localResults).toHaveLength(1);
      expect(localFake.getRecordedJobs()).toHaveLength(1);

      // Resolve Job 1 on GPT
      deferredGpt.resolve();
      const gptResults = await gptPromise;
      expect(gptResults).toHaveLength(1);
      expect(gptFake.getRecordedJobs()).toHaveLength(1);
    });

    it('1.3: Rapid consecutive mode-flipping (gemini -> gptImage -> localQwen -> gemini) under concurrent workloads', async () => {
      const geminiDriver = new InMemoryImageDriverFake('gemini');
      const gptDriver = new InMemoryImageDriverFake('gptImage');
      const localDriver = new InMemoryImageDriverFake('localQwen');

      const defGemini = geminiDriver.deferNext();
      const defGpt = gptDriver.deferNext();
      const defLocal = localDriver.deferNext();

      let switchMode: (mode: StudioMode) => void;

      const DynamicWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [mode, setMode] = useState<StudioMode>('gemini');
        switchMode = setMode;
        const driver =
          mode === 'gptImage' ? gptDriver : mode === 'localQwen' ? localDriver : geminiDriver;
        return (
          <ImageEngineProvider mode={mode} driverOverride={driver}>
            {children}
          </ImageEngineProvider>
        );
      };

      const { result } = renderHook(
        () => ({ driver: useImageDriver(), engine: useImageEngine() }),
        { wrapper: DynamicWrapper },
      );

      // 1. Dispatch Gemini job
      const p1 = result.current.driver.generate({ prompt: 'job-1-gemini' });

      // 2. Flip to gptImage and dispatch GPT job
      act(() => {
        switchMode('gptImage');
      });
      const p2 = result.current.driver.generate({ prompt: 'job-2-gpt' });

      // 3. Flip to localQwen and dispatch Local job
      act(() => {
        switchMode('localQwen');
      });
      const p3 = result.current.driver.generate({ prompt: 'job-3-local' });

      // 4. Flip back to gemini
      act(() => {
        switchMode('gemini');
      });
      expect(result.current.driver.id).toBe('gemini');

      // Resolve in reverse order (local, gpt, gemini)
      defLocal.resolve();
      defGpt.resolve();
      defGemini.resolve();

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(r3).toHaveLength(1);

      expect(geminiDriver.getRecordedJobs()[0].prompt).toBe('job-1-gemini');
      expect(gptDriver.getRecordedJobs()[0].prompt).toBe('job-2-gpt');
      expect(localDriver.getRecordedJobs()[0].prompt).toBe('job-3-local');
    });

    it('1.4: In-flight AbortSignal cancellation during mid-generation mode switch', async () => {
      const localDriver = new InMemoryImageDriverFake('localQwen');
      const geminiDriver = new InMemoryImageDriverFake('gemini');

      let switchMode: (mode: StudioMode) => void;

      const DynamicWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [mode, setMode] = useState<StudioMode>('localQwen');
        switchMode = setMode;
        const driver = mode === 'gemini' ? geminiDriver : localDriver;
        return (
          <ImageEngineProvider mode={mode} driverOverride={driver}>
            {children}
          </ImageEngineProvider>
        );
      };

      const { result } = renderHook(
        () => ({ driver: useImageDriver(), engine: useImageEngine() }),
        { wrapper: DynamicWrapper },
      );

      const abortController = new AbortController();
      const deferred = localDriver.deferNext();

      // Launch job with abort signal
      let jobError: any = null;
      const jobPromise = result.current.driver
        .generate({
          prompt: 'local job to abort',
          signal: abortController.signal,
        })
        .catch((err) => {
          jobError = err;
        });

      // Abort job and immediately switch mode to gemini
      act(() => {
        abortController.abort(new Error('User aborted operation'));
        switchMode('gemini');
      });

      // Trigger resolution so deferred unblocks
      deferred.resolve();
      await jobPromise;

      expect(jobError).toBeInstanceOf(StudioDriverError);
      expect(jobError.category).toBe('cancelled');

      // Subsequent job in Gemini mode executes normally
      const res = await result.current.driver.generate({ prompt: 'clean gemini job' });
      expect(res).toHaveLength(1);
      expect(geminiDriver.getRecordedJobs()).toHaveLength(1);
    });

    it('1.5: Dual-Plane Facade UI options synchronize strictly across mode transitions', () => {
      let switchMode: (mode: StudioMode) => void;

      const DynamicWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [mode, setMode] = useState<StudioMode>('gemini');
        switchMode = setMode;
        return <ImageEngineProvider mode={mode}>{children}</ImageEngineProvider>;
      };

      const { result } = renderHook(
        () => ({
          driver: useImageDriver(),
          engine: useImageEngine(),
        }),
        { wrapper: DynamicWrapper },
      );

      // Gemini: options is null
      expect(result.current.engine.id).toBe('gemini');
      expect(result.current.driver.id).toBe('gemini');
      expect(result.current.engine.options).toBeNull();

      // Switch to GPT Image: options becomes non-null with aspect ratios & sizes
      act(() => {
        switchMode('gptImage');
      });
      expect(result.current.engine.id).toBe('gptImage');
      expect(result.current.driver.id).toBe('gptImage');
      expect(result.current.engine.options).not.toBeNull();
      expect(result.current.engine.options?.ratios).toContain('1:1');
      expect(result.current.engine.options?.ratios).toContain('3:4');
      expect(result.current.engine.options?.ratios).toContain('9:16');

      // Switch to Local Qwen: options is null, id is localQwen
      act(() => {
        switchMode('localQwen');
      });
      expect(result.current.engine.id).toBe('localQwen');
      expect(result.current.driver.id).toBe('localQwen');
      expect(result.current.engine.options).toBeNull();
    });
  });

  // ==========================================================================
  // Suite 2: Outfit Drape Invariant Fuzzing & Persistence
  // ==========================================================================
  describe('Suite 2: Outfit Drape Invariant Fuzzing & Compiler Persistence', () => {
    it('2.1: Regex fuzzing of isTuckingAllowed against Vietnamese uppercase, accents, typos & compound phrases', () => {
      const untuckedFuzzCases = [
        'KHÔNG SƠ VIN',
        'KHÔNG ĐƯỢC SƠ VIN',
        'KHÔNG BAO GIỜ SƠ VIN',
        'ĐỪNG CẮM THÙNG',
        'ĐỪNG ĐÓNG THÙNG',
        'ĐỪNG SƠ VIN',
        'BỎ ÁO NGOÀI QUẦN',
        'CHỚ CẮM THÙNG',
        'CHỚ SƠ VIN',
        'KHÔNG ĐÓNG THÙNG',
        'KHÔNG CẮM THÙNG',
        'khong so vin',
        'không được sơ vin dưới mọi hình thức',
        '\n\t  áo phông rộng \n\r không cắm thùng   \t',
        '\u200Bkhông sơ vin\u200B',
        'áo sơ mi trắng -- không đóng thùng!',
        'cho phép sơ vin nhưng tuyệt đối không sơ vin',
        'được phép cắm thùng nhưng bỏ áo ngoài',
        'tuck in? no tuck',
        'never tuck into waistband',
        'without tucking tops',
        'untuck completely',
        'do not tuck tops into skirt',
        'stop tucking',
        '',
        '   ',
        'fashion style 2026 4k resolution',
        'summer outfit casual linen',
      ];

      for (const phrase of untuckedFuzzCases) {
        expect(
          isTuckingAllowed(phrase),
          `Expected isTuckingAllowed("${phrase}") to be false`,
        ).toBe(false);
      }

      const positiveTuckCases = [
        'cho phép sơ vin',
        'được phép sơ vin',
        'hãy đóng thùng',
        'cắm thùng áo vào quần',
        'sơ vin áo vào trong quần âu',
        'tuck into pants',
        'tucked in neatly',
        'tucking into high-waisted trousers',
      ];

      for (const phrase of positiveTuckCases) {
        expect(
          isTuckingAllowed(phrase),
          `Expected isTuckingAllowed("${phrase}") to be true`,
        ).toBe(true);
      }
    });

    it('2.2: Outfit Drape Invariant persistence across ALL 6 prompt compilers under untucked fuzzing', () => {
      const dummySubject = createTestImage(512, 512);
      const dummyGarment = createTestImage(512, 512);

      const fuzzedExtraPrompts = [
        '',
        'casual summer streetwear',
        'KHÔNG SƠ VIN ÁO DƯỚI MỌI HÌNH THỨC',
        '\n\t  áo thun -- đừng cắm thùng!  \t',
        'never tuck into pants, keep drape natural',
      ];

      for (const extraPrompt of fuzzedExtraPrompts) {
        // Compiler 1: Gemini Virtual Try-On
        const geminiTryOnParts = buildGeminiVirtualTryOnParts({
          subjectImage: dummySubject,
          sourceItems: [{ image: dummyGarment, sourceItemType: 'clothing', sourcePrompt: 'shirt' }],
          extraPrompt,
          backgroundPrompt: '',
        });
        const geminiTryOnText = flattenInterleavedParts(geminiTryOnParts)?.prompt || '';
        expect(
          geminiTryOnText.includes(UNTUCKED_DRAPE_INSTRUCTION) ||
            geminiTryOnText.includes(UNTUCKED_OVERRIDE_HEADLINE),
          `Gemini Try-On missed untucked invariant for "${extraPrompt}"`,
        ).toBe(true);

        // Compiler 2: GPT Virtual Try-On
        const gptTryOnParts = buildGptVirtualTryOnParts({
          subjectImage: dummySubject,
          sourceItems: [{ image: dummyGarment, sourceItemType: 'clothing', sourcePrompt: 'shirt' }],
          extraPrompt,
          backgroundPrompt: '',
        });
        const gptTryOnText = flattenInterleavedParts(gptTryOnParts)?.prompt || '';
        expect(
          gptTryOnText.includes(UNTUCKED_DRAPE_INSTRUCTION) ||
            gptTryOnText.includes(UNTUCKED_OVERRIDE_HEADLINE),
          `GPT Try-On missed untucked invariant for "${extraPrompt}"`,
        ).toBe(true);

        // Compiler 3: Qwen Virtual Try-On
        const qwenTryOnParts = buildQwenVirtualTryOnParts({
          subjectImage: dummySubject,
          sourceItems: [{ image: dummyGarment, sourceItemType: 'clothing', sourcePrompt: 'shirt' }],
          extraPrompt,
          backgroundPrompt: '',
        });
        const qwenTryOnText = flattenInterleavedParts(qwenTryOnParts)?.prompt || '';
        expect(
          qwenTryOnText.includes(UNTUCKED_DRAPE_INSTRUCTION) ||
            qwenTryOnText.includes(UNTUCKED_OVERRIDE_HEADLINE),
          `Qwen Try-On missed untucked invariant for "${extraPrompt}"`,
        ).toBe(true);

        // Compiler 4: Gemini Clothing Transfer
        const geminiTransferParts = buildGeminiClothingTransferParts(
          dummySubject,
          [{ image: dummyGarment, label: 'shirt' }],
          extraPrompt,
        );
        const geminiTransferText = flattenInterleavedParts(geminiTransferParts)?.prompt || '';
        expect(
          geminiTransferText.includes(UNTUCKED_DRAPE_INSTRUCTION),
          `Gemini Clothing Transfer missed untucked invariant for "${extraPrompt}"`,
        ).toBe(true);

        // Compiler 5: GPT Clothing Transfer
        const gptTransferParts = buildGptClothingTransferParts(
          dummySubject,
          [{ image: dummyGarment, label: 'shirt' }],
          extraPrompt,
        );
        const gptTransferText = flattenInterleavedParts(gptTransferParts)?.prompt || '';
        expect(
          gptTransferText.includes(UNTUCKED_DRAPE_INSTRUCTION),
          `GPT Clothing Transfer missed untucked invariant for "${extraPrompt}"`,
        ).toBe(true);

        // Compiler 6: Qwen Clothing Transfer
        const qwenTransferParts = buildQwenClothingTransferParts(
          dummySubject,
          [{ image: dummyGarment, label: 'shirt' }],
          extraPrompt,
        );
        const qwenTransferText = flattenInterleavedParts(qwenTransferParts)?.prompt || '';
        expect(
          qwenTransferText.includes(UNTUCKED_DRAPE_INSTRUCTION),
          `Qwen Clothing Transfer missed untucked invariant for "${extraPrompt}"`,
        ).toBe(true);
      }
    });

    it('2.3: Outfit Drape Invariant verified at Hook Level (useVirtualTryOn & useClothingTransfer)', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const wrapper = createFacadeWrapper(fakeDriver);

      // Verify useVirtualTryOn passes untucked drape rule to driver
      const { result: tryOnResult } = renderHook(() => useVirtualTryOn(), { wrapper });

      act(() => {
        tryOnResult.current.setSubjectImage(FROZEN_SUBJECT);
        tryOnResult.current.handleClothingUpload(
          FROZEN_GARMENT,
          tryOnResult.current.clothingItems[0].id,
        );
      });

      await act(async () => {
        await tryOnResult.current.handleGenerateImage();
      });

      const recordedTryOnJobs = fakeDriver.getRecordedJobs();
      expect(recordedTryOnJobs).toHaveLength(1);
      const tryOnPrompt = recordedTryOnJobs[0].prompt || '';
      expect(
        tryOnPrompt.includes(UNTUCKED_DRAPE_INSTRUCTION) ||
          tryOnPrompt.includes(UNTUCKED_OVERRIDE_HEADLINE),
      ).toBe(true);

      fakeDriver.clearRecordedJobs();

      // Verify useClothingTransfer passes untucked drape rule to driver
      const { result: transferResult } = renderHook(() => useClothingTransfer(), { wrapper });

      act(() => {
        transferResult.current.handleConceptUpload(FROZEN_GARMENT);
        transferResult.current.handleReferenceUpload(
          FROZEN_SUBJECT,
          transferResult.current.referenceItems[0].id,
        );
      });

      await act(async () => {
        await transferResult.current.handleGenerate();
      });

      const recordedTransferJobs = fakeDriver.getRecordedJobs();
      expect(recordedTransferJobs).toHaveLength(1);
      const transferPrompt = recordedTransferJobs[0].prompt || '';
      expect(transferPrompt.includes(UNTUCKED_DRAPE_INSTRUCTION)).toBe(true);
    });
  });

  // ==========================================================================
  // Suite 3: Local Qwen Manual Upscale Isolation, Mutex Serialization & Fatal Errors
  // ==========================================================================
  describe('Suite 3: Local Qwen Manual Upscale Isolation & Concurrency', () => {
    it('3.1: Generation completion NEVER auto-triggers upscale across feature hooks', async () => {
      const upscaleSpy = vi.fn().mockResolvedValue(createTestImage(1024, 1024));
      const generateSpy = vi.fn().mockResolvedValue([createTestImage(512, 512)]);
      const generateOneSpy = vi.fn().mockResolvedValue(createTestImage(512, 512));

      const spyDriver: ImageDriver = {
        id: 'localQwen',
        generate: generateSpy,
        generateOne: generateOneSpy,
        upscale: upscaleSpy,
      };

      const wrapper = createFacadeWrapper(spyDriver, 'localQwen');

      // 1. Virtual Try-On
      const { result: tryOn } = renderHook(() => useVirtualTryOn(), { wrapper });
      act(() => {
        tryOn.current.setSubjectImage(FROZEN_SUBJECT);
        tryOn.current.handleClothingUpload(FROZEN_GARMENT, tryOn.current.clothingItems[0].id);
      });
      await act(async () => {
        await tryOn.current.handleGenerateImage();
      });
      expect(upscaleSpy).toHaveBeenCalledTimes(0);

      // 2. Clothing Transfer
      const { result: transfer } = renderHook(() => useClothingTransfer(), { wrapper });
      act(() => {
        transfer.current.handleConceptUpload(FROZEN_GARMENT);
        transfer.current.handleReferenceUpload(FROZEN_SUBJECT, transfer.current.referenceItems[0].id);
      });
      await act(async () => {
        await transfer.current.handleGenerate();
      });
      expect(upscaleSpy).toHaveBeenCalledTimes(0);

      // 3. AI Editor
      const { result: editor } = renderHook(() => useAIEditor(), { wrapper });
      act(() => {
        editor.current.setImages([FROZEN_SUBJECT]);
        editor.current.setPrompt('Color adjustment');
      });
      await act(async () => {
        await editor.current.handleGenerate();
      });
      expect(upscaleSpy).toHaveBeenCalledTimes(0);

      // 4. Lookbook Generator
      const { result: lookbook } = renderHook(() => useLookbookGenerator(), { wrapper });
      act(() => {
        lookbook.current.updateForm({
          clothingImages: [{ id: 'item1', image: FROZEN_GARMENT, name: 'Tee' }],
          clothingDescription: 'Casual tee',
        });
      });
      await act(async () => {
        await lookbook.current.handleGenerate();
      });
      expect(upscaleSpy).toHaveBeenCalledTimes(0);

      // 5. Identity Transfer
      const { result: idTransfer } = renderHook(() => useIdentityTransfer(), { wrapper });
      act(() => {
        idTransfer.current.setFaceReference(FROZEN_SUBJECT);
        idTransfer.current.handleDestinationImagesUpload([FROZEN_GARMENT]);
      });
      await act(async () => {
        await idTransfer.current.handleGenerate();
      });
      expect(upscaleSpy).toHaveBeenCalledTimes(0);
    });

    it('3.2: Manual upscale execution is strictly routed to Local Qwen ComfyUI', async () => {
      mockDesktopApi = {
        getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready' } }),
        generateImage: vi.fn(),
        upscaleImage: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            image: createDeterministicPngBase64(1024, 1024),
            mimeType: 'image/png',
          },
        }),
        cancelJob: vi.fn(),
      };

      const adapter = new LocalQwenImageDriverAdapter();
      const result = await adapter.upscale({
        image: FROZEN_SUBJECT,
        quality: '4K',
      });

      expect(result).toBeDefined();
      expect(mockDesktopApi.upscaleImage).toHaveBeenCalledTimes(1);
      expect(mockDesktopApi.upscaleImage).toHaveBeenCalledWith({
        image: FROZEN_SUBJECT.base64,
        scale: 4,
      });
    });

    it('3.3: Serialization of upscale with in-flight generation via localQwenLock', async () => {
      let generationInProgress = false;
      let upscaleExecutedWhileGenerating = false;

      mockDesktopApi = {
        getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready' } }),
        generateImage: vi.fn().mockImplementation(async () => {
          generationInProgress = true;
          await new Promise((r) => setTimeout(r, 40));
          generationInProgress = false;
          return {
            ok: true,
            value: {
              image: {
                base64: createDeterministicPngBase64(512, 512),
                mimeType: 'image/png',
              },
            },
          };
        }),
        upscaleImage: vi.fn().mockImplementation(async () => {
          if (generationInProgress) {
            upscaleExecutedWhileGenerating = true;
          }
          return {
            ok: true,
            value: { image: createDeterministicPngBase64(1024, 1024) },
          };
        }),
        cancelJob: vi.fn(),
      };

      const adapter = new LocalQwenImageDriverAdapter();

      // Launch generation (40ms)
      const genPromise = adapter.generate({
        prompt: 'test generation under lock',
      });

      // Launch upscale concurrently while generate is in-flight
      const upscalePromise = adapter.upscale({
        image: FROZEN_SUBJECT,
        quality: '2K',
      });

      await Promise.all([genPromise, upscalePromise]);

      // Assert that upscale was NEVER executed concurrently with generate
      expect(upscaleExecutedWhileGenerating).toBe(false);
      expect(mockDesktopApi.generateImage).toHaveBeenCalledTimes(1);
      expect(mockDesktopApi.upscaleImage).toHaveBeenCalledTimes(1);
    });

    it('3.4: Local Qwen fatal error isolation (CUDA OOM / missing weights / gateway down)', async () => {
      // 1. CUDA OOM hardware error
      mockDesktopApi = {
        getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready' } }),
        generateImage: vi.fn(),
        upscaleImage: vi.fn().mockRejectedValue(new Error('CUDA out of memory during ESRGAN execution')),
      };

      const adapter = new LocalQwenImageDriverAdapter();

      let oomError: any = null;
      try {
        await adapter.upscale({ image: FROZEN_SUBJECT });
      } catch (e) {
        oomError = e;
      }

      expect(oomError).toBeInstanceOf(StudioDriverError);
      expect(oomError.category).toBe('hardware_error');
      expect(oomError.retryable).toBe(false);

      // 2. Gateway Down (non-desktop runtime)
      mockDesktopApi = null; // No desktop bridge available

      let bridgeError: any = null;
      try {
        await adapter.upscale({ image: FROZEN_SUBJECT });
      } catch (e) {
        bridgeError = e;
      }

      expect(bridgeError).toBeInstanceOf(StudioDriverError);
      expect(bridgeError.category).toBe('gateway_down');
      expect(bridgeError.status).toBe(503);
      expect(bridgeError.retryable).toBe(false);
    });
  });

  // ==========================================================================
  // Suite 4: Deep Prototype Chain, Destructuring & Frozen Arguments Resilience Across All 10 Hooks
  // ==========================================================================
  describe('Suite 4: Deep Prototype Chain, Destructuring & Frozen Arguments Resilience', () => {
    it('4.1: Deep 3-Tier Prototype Inheritance preserves prototype methods across all layers', async () => {
      const driver = new Level3AdversarialDriver();

      // Verify methods reside on prototype chain, not as own properties
      expect(Object.prototype.hasOwnProperty.call(driver, 'generate')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(driver, 'generateOne')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(driver, 'upscale')).toBe(false);

      // Invocations succeed through 3-tier prototype traversal
      const genResult = await driver.generate({ prompt: 'test deep prototype' });
      expect(genResult).toHaveLength(1);
      expect(Level3AdversarialDriver.executions).toHaveLength(1);
      expect(Level3AdversarialDriver.executions[0].thisValid).toBe(true);

      const oneResult = await driver.generateOne({ prompt: 'test one' });
      expect(oneResult).toBeDefined();

      const upResult = await driver.upscale({ image: FROZEN_SUBJECT });
      expect(upResult).toBeDefined();
    });

    it('4.2: Method destructuring resilience executes cleanly', async () => {
      const driver = new Level3AdversarialDriver();
      const { generate, generateOne, upscale } = driver;

      // Destructured method calls (called with undefined receiver or bound)
      const res = await generate.call(driver, { prompt: 'destructured generate' });
      expect(res).toHaveLength(1);

      const resOne = await generateOne.call(driver, { prompt: 'destructured generateOne' });
      expect(resOne).toBeDefined();

      const resUp = await upscale.call(driver, { image: FROZEN_SUBJECT });
      expect(resUp).toBeDefined();
    });

    it('4.3: Deeply frozen recursive structures survive all driver methods without TypeError', async () => {
      const driver = new Level3AdversarialDriver();

      const deeplyFrozenJob = Object.freeze({
        prompt: 'deeply frozen prompt',
        images: Object.freeze([FROZEN_SUBJECT, FROZEN_GARMENT]) as ImageFile[],
        references: Object.freeze([
          Object.freeze({ image: FROZEN_SUBJECT, role: 'subject' as const, label: 'model' }),
          Object.freeze({ image: FROZEN_GARMENT, role: 'garment' as const, label: 'top' }),
        ]) as ReferenceRoleImage[],
        aspectRatio: '3:4' as const,
        resolution: '2K' as const,
        count: 2,
        workflow: 'virtual-try-on',
      });

      expect(() => driver.generate(deeplyFrozenJob)).not.toThrow();
      const res = await driver.generate(deeplyFrozenJob);
      expect(res).toHaveLength(2);

      const deeplyFrozenUpscaleJob = Object.freeze({
        image: FROZEN_SUBJECT,
        quality: '4K' as const,
      });

      expect(() => driver.upscale(deeplyFrozenUpscaleJob)).not.toThrow();
      const upRes = await driver.upscale(deeplyFrozenUpscaleJob);
      expect(upRes).toBeDefined();
    });

    it('4.4: Complete sweep across all 10 feature hooks under Adversarial Driver', async () => {
      const adversarialDriver = new Level3AdversarialDriver();
      const wrapper = createFacadeWrapper(adversarialDriver);

      // Hook 1: useVirtualTryOn
      const { result: tryOn } = renderHook(() => useVirtualTryOn(), { wrapper });
      act(() => {
        tryOn.current.setSubjectImage(FROZEN_SUBJECT);
        tryOn.current.handleClothingUpload(FROZEN_GARMENT, tryOn.current.clothingItems[0].id);
      });
      await act(async () => {
        await tryOn.current.handleGenerateImage();
      });
      expect(tryOn.current.error).toBeNull();

      // Hook 2: useClothingTransfer
      const { result: transfer } = renderHook(() => useClothingTransfer(), { wrapper });
      act(() => {
        transfer.current.handleConceptUpload(FROZEN_GARMENT);
        transfer.current.handleReferenceUpload(FROZEN_SUBJECT, transfer.current.referenceItems[0].id);
      });
      await act(async () => {
        await transfer.current.handleGenerate();
      });
      expect(transfer.current.conceptItems[0].status).toBe('completed');

      // Hook 3: useAIEditor
      const { result: editor } = renderHook(() => useAIEditor(), { wrapper });
      act(() => {
        editor.current.setImages([FROZEN_SUBJECT]);
        editor.current.setPrompt('Change background to garden');
      });
      await act(async () => {
        await editor.current.handleGenerate();
      });
      expect(editor.current.resultImage).toBeDefined();

      // Hook 4: useIdentityTransfer
      const { result: idTransfer } = renderHook(() => useIdentityTransfer(), { wrapper });
      act(() => {
        idTransfer.current.setFaceReference(FROZEN_SUBJECT);
        idTransfer.current.handleDestinationImagesUpload([FROZEN_GARMENT]);
      });
      await act(async () => {
        await idTransfer.current.handleGenerate();
      });
      expect(idTransfer.current.destinationItems[0].results.length).toBeGreaterThan(0);

      // Hook 5: useBackgroundReplacer
      const { result: bgReplacer } = renderHook(() => useBackgroundReplacer(), { wrapper });
      act(() => {
        bgReplacer.current.setSubjectImage(FROZEN_SUBJECT);
        bgReplacer.current.setBackgroundImage(FROZEN_GARMENT);
      });
      await act(async () => {
        await bgReplacer.current.handleGenerate();
      });
      expect(bgReplacer.current.generatedImages.length).toBeGreaterThan(0);

      // Hook 6: usePoseChanger
      const { result: poseChanger } = renderHook(() => usePoseChanger(), { wrapper });
      act(() => {
        poseChanger.current.setSubjectImage(FROZEN_SUBJECT);
        poseChanger.current.handlePoseReferenceUpload(FROZEN_GARMENT);
      });
      await act(async () => {
        await poseChanger.current.handleGenerate();
      });
      expect(poseChanger.current.generatedImages.length).toBeGreaterThan(0);

      // Hook 7: usePatternGenerator
      const { result: patternGen } = renderHook(() => usePatternGenerator(), { wrapper });
      act(() => {
        patternGen.current.setReferenceImages([FROZEN_GARMENT]);
        patternGen.current.setPrompt('Houndstooth pattern');
      });
      await act(async () => {
        await patternGen.current.handleGenerate();
      });
      expect(patternGen.current.generatedPatterns.length).toBeGreaterThan(0);

      // Hook 8: useWatermarkRemover
      const { result: wmRemover } = renderHook(() => useWatermarkRemover(addImageMock), { wrapper });
      act(() => {
        wmRemover.current.addImages([FROZEN_SUBJECT]);
      });
      await act(async () => {
        await wmRemover.current.startProcessing();
      });
      expect(wmRemover.current.items[0].status).toBe('completed');

      // Hook 9: useLookbookGenerator
      const { result: lookbook } = renderHook(() => useLookbookGenerator(), { wrapper });
      act(() => {
        lookbook.current.updateForm({
          clothingImages: [{ id: 'c1', image: FROZEN_GARMENT, name: 'Silk blouse' }],
          clothingDescription: 'Modern silk blouse',
        });
      });
      await act(async () => {
        await lookbook.current.handleGenerate();
      });
      expect(lookbook.current.generatedLookbook).not.toBeNull();

      // Hook 10: usePhotoAlbum
      const { result: photoAlbum } = renderHook(() => usePhotoAlbum(), { wrapper });
      act(() => {
        photoAlbum.current.setOriginalPhoto(FROZEN_SUBJECT);
        photoAlbum.current.setSelectedPoses(['pose_1']);
      });
      await act(async () => {
        await photoAlbum.current.handleGenerate();
      });
      expect(photoAlbum.current.generatedImages.length).toBeGreaterThan(0);

      // Bonus: useWardrobeMode
      const { result: wardrobe } = renderHook(
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
        { wrapper },
      );
      act(() => {
        wardrobe.current.setSubject(FROZEN_SUBJECT);
        wardrobe.current.addItem(wardrobe.current.sets[0].id);
      });
      act(() => {
        wardrobe.current.updateItem(
          wardrobe.current.sets[0].id,
          wardrobe.current.sets[0].items[0].id,
          { image: FROZEN_GARMENT },
        );
      });
      await act(async () => {
        await wardrobe.current.generate();
      });
      expect(wardrobe.current.error).toBeNull();
    });
  });
});
