import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalQwenImageDriverAdapter,
  FACE_SWAP_LORA_NAME,
  mapLocalQwenErrorToStudioDriverError,
} from '@/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import {
  isLocalQwenBusy,
  resetLocalQwenLock,
  getLocalQwenLockState,
} from '@/services/providers/local-qwen/localQwenLock';
import {
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
  type GenerateJob,
  type UpscaleJob,
} from '@/services/providers/ImageDriver';
import { withRetry } from '@/services/providers/shared/withRetry';
import { isFaceSwapRefusal } from '@/platform/desktopLocalQwen';
import type { DesktopLocalQwenApi } from '@/platform/desktopLocalQwen';

describe('Adversarial Challenger Suite: FaceSwap Refusal Edge Cases & Retry Storm Prevention', () => {
  let adapter: LocalQwenImageDriverAdapter;
  let mockDesktopApi: {
    getStatus: ReturnType<typeof vi.fn>;
    startServer: ReturnType<typeof vi.fn>;
    stopServer: ReturnType<typeof vi.fn>;
    generateImage: ReturnType<typeof vi.fn>;
    cancelJob: ReturnType<typeof vi.fn>;
    upscaleImage: ReturnType<typeof vi.fn>;
  };

  const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetLocalQwenLock();

    mockDesktopApi = {
      getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready', isAppOwned: true, port: 8188 } }),
      startServer: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready', isAppOwned: true, port: 8188 } }),
      stopServer: vi.fn().mockResolvedValue({ ok: true, value: { stopped: true, wasExternal: false } }),
      generateImage: vi.fn().mockResolvedValue({
        ok: true,
        value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
      }),
      cancelJob: vi.fn().mockResolvedValue({ ok: true, value: { cancelled: true } }),
      upscaleImage: vi.fn().mockResolvedValue({
        ok: true,
        value: { image: SAMPLE_BASE64, mimeType: 'image/png' },
      }),
    };

    window.desktopLocalQwen = mockDesktopApi as unknown as DesktopLocalQwenApi;
    adapter = new LocalQwenImageDriverAdapter();
  });

  afterEach(() => {
    resetLocalQwenLock();
    delete window.desktopLocalQwen;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // ===========================================================================
  // Suite 1: Canonical Refusal Invariant Verification (Positives & Negatives)
  // ===========================================================================
  describe('Suite 1: Canonical Refusal Invariant Verification', () => {
    const canonicalEnglishRefusals = [
      'no face swap',
      'without face swap',
      'do not swap',
      "don't swap",
      'not swap face',
      'keep the original face',
    ];

    const canonicalVietnameseRefusals = [
      'không đổi mặt',
      'không thay mặt',
      'không ghép mặt',
      'không đổi khuôn mặt',
      'không thay khuôn mặt',
      'không chuyển mặt',
      'không chuyển danh tính',
    ];

    it.each(canonicalEnglishRefusals)(
      'canonical English refusal suppresses LoRA and forces standard workflow: "%s"',
      async (refusalPhrase) => {
        const job: GenerateJob = {
          prompt: `High fashion lookbook model in silk evening gown, ${refusalPhrase}. Studio lighting.`,
          workflow: 'identity-transfer',
        };

        await adapter.generate(job);

        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            workflow: 'standard',
          }),
        );
        expect(mockDesktopApi.generateImage).not.toHaveBeenCalledWith(
          expect.objectContaining({
            loraName: FACE_SWAP_LORA_NAME,
          }),
        );
        expect(job.injectedLora).toBeUndefined();
      },
    );

    it.each(canonicalVietnameseRefusals)(
      'canonical Vietnamese refusal suppresses LoRA and forces standard workflow: "%s"',
      async (refusalPhrase) => {
        const job: GenerateJob = {
          prompt: `Người mẫu mặc áo dài cách tân hoa sen, ${refusalPhrase}, phông nền studio.`,
          workflow: 'identity-transfer',
        };

        await adapter.generate(job);

        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            workflow: 'standard',
          }),
        );
        expect(mockDesktopApi.generateImage).not.toHaveBeenCalledWith(
          expect.objectContaining({
            loraName: FACE_SWAP_LORA_NAME,
          }),
        );
        expect(job.injectedLora).toBeUndefined();
      },
    );

    it('negative control: non-refusal prompts containing "face" or "swap" or "không" still auto-inject LoRA in identity-transfer mode', async () => {
      const nonRefusals = [
        'Close-up facial detail of fashion model in trench coat',
        'Swap palette to autumn earth tones with linen blazer',
        'Không gian studio chụp ảnh cao cấp với ánh sáng mềm',
        'Mặt dây chuyền vàng đính ngọc trai trên nền áo len cổ lọ',
      ];

      for (const prompt of nonRefusals) {
        mockDesktopApi.generateImage.mockClear();
        const job: GenerateJob = {
          prompt,
          workflow: 'identity-transfer',
        };

        await adapter.generate(job);

        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            workflow: 'identity-transfer',
            loraName: FACE_SWAP_LORA_NAME,
          }),
        );
        const recorded = adapter.getRecordedJobs();
        expect((recorded[recorded.length - 1] as GenerateJob).injectedLora).toBe(FACE_SWAP_LORA_NAME);
        expect(job.injectedLora).toBeUndefined();
      }
    });

    it('workflow standard never auto-injects LoRA regardless of prompt contents', async () => {
      const prompts = [
        'Portrait of model, identity transfer style',
        'Model portrait without face swap',
        'Simple blazer shoot',
      ];

      for (const prompt of prompts) {
        mockDesktopApi.generateImage.mockClear();
        const job: GenerateJob = {
          prompt,
          workflow: 'standard',
        };

        await adapter.generate(job);

        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            workflow: 'standard',
          }),
        );
        expect(job.injectedLora).toBeUndefined();
      }
    });
  });

  // ===========================================================================
  // Suite 2: Fuzzing Subtle, Mixed-Language, and Edge Case Refusal Variations
  // ===========================================================================
  describe('Suite 2: Fuzzing Subtle, Mixed-Language, and Edge Case Refusal Variations', () => {
    // Attack vectors: subtle variations that represent user refusal intent
    const subtleAndMixedRefusalCases = [
      // Vector A: English compounding / hyphenation variations
      { category: 'English Compounding', phrase: 'no faceswap', prompt: 'Model wearing winter coat, no faceswap' },
      { category: 'English Compounding', phrase: 'without faceswap', prompt: 'Winter lookbook, without faceswap' },
      { category: 'English Hyphenation', phrase: 'no face-swap', prompt: 'Editorial shoot, no face-swap please' },
      { category: 'English Hyphenation', phrase: 'without face-swap', prompt: 'Portrait mode, without face-swap' },

      // Vector B: English contraction & article variations
      { category: 'English Contraction', phrase: 'dont swap', prompt: 'Studio portrait, dont swap face' },
      { category: 'English Phrasing', phrase: 'keep original face', prompt: 'Fashion lookbook, keep original face' },
      { category: 'English Phrasing', phrase: 'never swap face', prompt: 'Model in trench coat, never swap face' },
      { category: 'English Phrasing', phrase: 'do not swap the face', prompt: 'Editorial photoshoot, do not swap the face' },

      // Vector C: Vietnamese imperative "đừng" instead of "không"
      { category: 'Vietnamese Imperative', phrase: 'đừng đổi mặt', prompt: 'Chụp lookbook áo dạ, đừng đổi mặt mẫu' },
      { category: 'Vietnamese Imperative', phrase: 'đừng thay mặt', prompt: 'Ảnh quảng cáo thời trang, đừng thay mặt' },
      { category: 'Vietnamese Imperative', phrase: 'đừng ghép mặt', prompt: 'Bộ sưu tập mùa thu, đừng ghép mặt người mẫu' },

      // Vector D: Vietnamese semantic equivalents of "keep original face"
      { category: 'Vietnamese Semantic', phrase: 'giữ nguyên mặt', prompt: 'Áo sơ mi lụa tơ tằm, giữ nguyên mặt mẫu gốc' },
      { category: 'Vietnamese Semantic', phrase: 'giữ mặt gốc', prompt: 'Thời trang dạ hội, giữ mặt gốc nha' },
      { category: 'Vietnamese Semantic', phrase: 'giữ nguyên khuôn mặt', prompt: 'Chụp ngoại cảnh, giữ nguyên khuôn mặt mẫu' },

      // Vector E: Mixed-language code switching (Vietnamese + English)
      { category: 'Mixed Language', phrase: 'không face swap', prompt: 'Chụp mẫu áo vest, không face swap nhé' },
      { category: 'Mixed Language', phrase: 'không faceswap', prompt: 'Tạo ảnh lookbook, không faceswap' },
      { category: 'Mixed Language', phrase: 'đừng face swap', prompt: 'Người mẫu đầm công sở, đừng face swap' },
      { category: 'Mixed Language', phrase: 'đừng faceswap', prompt: 'Thời trang đường phố, đừng faceswap' },

      // Vector F: Unaccented Vietnamese (tiếng Việt không dấu)
      { category: 'Unaccented Vietnamese', phrase: 'khong doi mat', prompt: 'Chup anh ao dai, khong doi mat' },
      { category: 'Unaccented Vietnamese', phrase: 'khong thay mat', prompt: 'Mau vay cuoi, khong thay mat' },
      { category: 'Unaccented Vietnamese', phrase: 'khong ghep mat', prompt: 'Lookbook mua he, khong ghep mat' },
      { category: 'Unaccented Vietnamese', phrase: 'dung doi mat', prompt: 'Ao khoac mang to, dung doi mat' },
    ];

    it('evaluates empirical refusal detection coverage across fuzzed attack vectors', () => {
      const results: { category: string; phrase: string; detected: boolean }[] = [];

      for (const item of subtleAndMixedRefusalCases) {
        const detected = isFaceSwapRefusal(item.prompt);
        results.push({
          category: item.category,
          phrase: item.phrase,
          detected,
        });
      }

      const passed = results.filter((r) => r.detected);
      const failed = results.filter((r) => !r.detected);

      // Console diagnostic table for empirical challenger report
      console.log('--- Adversarial Refusal Detection Empirical Results ---');
      console.log(`Total test cases: ${results.length}`);
      console.log(`Detected (Refusal Honored): ${passed.length}`);
      console.log(`Bypassed (Vulnerable - LoRA injected): ${failed.length}`);
      for (const f of failed) {
        console.log(`  [VULNERABLE BYPASS] [${f.category}] "${f.phrase}" failed detection!`);
      }

      // Assert 100% refusal coverage
      expect(failed.length).toBe(0);
      expect(passed.length).toBe(results.length);
    });

    it('honors subtle refusal with compound word and suppresses LoRA auto-injection', async () => {
      // Prompt with 'no faceswap' (single word without space)
      const unspacedPrompt = 'Lookbook portrait of woman in trench coat, no faceswap';
      const job: GenerateJob = {
        prompt: unspacedPrompt,
        workflow: 'identity-transfer',
      };

      await adapter.generate(job);

      const isRefusalDetected = isFaceSwapRefusal(unspacedPrompt);
      expect(isRefusalDetected).toBe(true);
      const recorded = adapter.getRecordedJobs();
      expect((recorded[recorded.length - 1] as GenerateJob).injectedLora).toBeUndefined();
      expect(job.injectedLora).toBeUndefined();
    });

    it('honors mixed-language refusal and suppresses LoRA auto-injection', async () => {
      // Prompt with mixed language 'không face swap'
      const mixedPrompt = 'Chụp mẫu áo vest, không face swap nhé';
      const job: GenerateJob = {
        prompt: mixedPrompt,
        workflow: 'identity-transfer',
      };

      await adapter.generate(job);

      const isRefusalDetected = isFaceSwapRefusal(mixedPrompt);
      expect(isRefusalDetected).toBe(true);
      const recorded = adapter.getRecordedJobs();
      expect((recorded[recorded.length - 1] as GenerateJob).injectedLora).toBeUndefined();
      expect(job.injectedLora).toBeUndefined();
    });
  });

  // ===========================================================================
  // Suite 3: Non-Retriable Hardware Errors & Retry Storm Prevention
  // ===========================================================================
  describe('Suite 3: Non-Retriable Hardware Errors & Retry Storm Prevention', () => {
    const oomErrorVariants = [
      'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB',
      'CUDA error: out of memory',
      'RuntimeError: OutOfMemoryError: allocation on device 0 failed',
      'torch.cuda.CudaError: allocation on device failed',
      'VRAM full: unable to allocate 1024MB',
      'VRAM exceeded maximum capacity on GPU 0',
      'Not enough VRAM to complete generation',
    ];

    const missingModelVariants = [
      'UnetLoaderGGUF: qwen-image-2.1-Q4_K_M.gguf not found',
      'CLIPLoader: qwen3vl_8b_w4a8.safetensors missing from models/text_encoders',
      'VAELoader: qwen_image_2.1_vae.safetensors not found',
      'FileNotFoundError: [Errno 2] No such file or directory: models/diffusion_models/qwen.safetensors',
      'Model file does not exist: models/unet/qwen2.1.safetensors',
    ];

    it.each(oomErrorVariants)(
      'OOM variant maps to hardware_error with retryable: false ("%s")',
      async (errorMessage) => {
        mockDesktopApi.generateImage.mockResolvedValueOnce({
          ok: false,
          error: { message: errorMessage },
        });

        let callCount = 0;
        const op = () => {
          callCount++;
          return adapter.generate({ prompt: 'test oom' });
        };

        let thrownError: unknown;
        try {
          await withRetry(op, { retries: 5, delay: 1, retryOn: isRetryableDriverError });
        } catch (err) {
          thrownError = err;
        }

        expect(isStudioDriverError(thrownError)).toBe(true);
        if (isStudioDriverError(thrownError)) {
          expect(thrownError.category).toBe('hardware_error');
          expect(thrownError.retryable).toBe(false);
          expect(isRetryableDriverError(thrownError)).toBe(false);
        }

        // Must halt on attempt 1 — zero retry storm!
        expect(callCount).toBe(1);
      },
    );

    it.each(missingModelVariants)(
      'Missing model variant maps to hardware_error with retryable: false ("%s")',
      async (errorMessage) => {
        mockDesktopApi.generateImage.mockResolvedValueOnce({
          ok: false,
          error: { message: errorMessage },
        });

        let callCount = 0;
        const op = () => {
          callCount++;
          return adapter.generate({ prompt: 'test missing model' });
        };

        let thrownError: unknown;
        try {
          await withRetry(op, { retries: 5, delay: 1, retryOn: isRetryableDriverError });
        } catch (err) {
          thrownError = err;
        }

        expect(isStudioDriverError(thrownError)).toBe(true);
        if (isStudioDriverError(thrownError)) {
          expect(thrownError.category).toBe('hardware_error');
          expect(thrownError.retryable).toBe(false);
          expect(isRetryableDriverError(thrownError)).toBe(false);
        }

        // Must halt on attempt 1 — zero retry storm!
        expect(callCount).toBe(1);
      },
    );

    it('halts custom while-loop retries immediately when StudioDriverError is not retryable', async () => {
      mockDesktopApi.generateImage.mockResolvedValue({
        ok: false,
        error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory' },
      });

      let attempts = 0;
      const MAX_RETRIES = 10;
      let finalError: unknown;

      for (let i = 0; i <= MAX_RETRIES; i++) {
        attempts++;
        try {
          await adapter.generate({ prompt: 'trigger oom' });
          break;
        } catch (err) {
          finalError = err;
          // Standard resilient client pattern
          if (err instanceof StudioDriverError && !err.retryable) {
            break; // Stop immediately!
          }
        }
      }

      expect(attempts).toBe(1);
      expect(isStudioDriverError(finalError)).toBe(true);
      expect((finalError as StudioDriverError).category).toBe('hardware_error');
    });

    it('halts upscale hardware fatal error in withRetry on attempt 1', async () => {
      mockDesktopApi.upscaleImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory during upscale' },
      });

      let callCount = 0;
      const op = () => {
        callCount++;
        return adapter.upscale({
          image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
          quality: '4K',
        });
      };

      await expect(
        withRetry(op, { retries: 3, delay: 1, retryOn: isRetryableDriverError }),
      ).rejects.toMatchObject({
        category: 'hardware_error',
        retryable: false,
      });

      expect(callCount).toBe(1);
    });

    it('simulates 10 concurrent requests during GPU OOM: verifies zero retry storm and clean lock drainage', async () => {
      // GPU is exhausted: all attempts return OOM
      mockDesktopApi.generateImage.mockImplementation(async () => {
        return {
          ok: false,
          error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory' },
        };
      });

      let totalExecutionCalls = 0;
      const makeJob = (index: number) => {
        return withRetry(
          async () => {
            totalExecutionCalls++;
            return adapter.generate({ prompt: `concurrent job ${index}` });
          },
          { retries: 5, delay: 1, retryOn: isRetryableDriverError },
        );
      };

      const promises = Array.from({ length: 10 }, (_, i) => makeJob(i));
      const results = await Promise.allSettled(promises);

      // All 10 jobs should have rejected with hardware_error
      expect(results.length).toBe(10);
      for (const res of results) {
        expect(res.status).toBe('rejected');
        if (res.status === 'rejected') {
          expect(isStudioDriverError(res.reason)).toBe(true);
          expect(res.reason.category).toBe('hardware_error');
          expect(res.reason.retryable).toBe(false);
        }
      }

      // If a retry storm had occurred with 5 retries each, totalExecutionCalls would be 10 * 6 = 60!
      // With non-retriable classification, each job is attempted exactly once: total = 10.
      expect(totalExecutionCalls).toBe(10);

      // Lock must be completely released
      expect(isLocalQwenBusy()).toBe(false);
      expect(getLocalQwenLockState().queueDepth).toBe(0);
    });
  });

  // ===========================================================================
  // Suite 4: Mutex Health & Recovery After Hardware Fatalities
  // ===========================================================================
  describe('Suite 4: Mutex Health & Recovery After Hardware Fatalities', () => {
    it('successfully executes subsequent job after hardware crash without stale lock', async () => {
      // Step 1: Fatal crash
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory' },
      });

      await expect(adapter.generate({ prompt: 'job 1 fails' })).rejects.toThrow();

      // Step 2: Verify lock state is idle
      expect(isLocalQwenBusy()).toBe(false);

      // Step 3: Subsequent job succeeds cleanly
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: true,
        value: { image: { base64: 'recovered-image', mimeType: 'image/png' } },
      });

      const result = await adapter.generate({ prompt: 'job 2 succeeds' });
      expect(result[0].base64).toBe('recovered-image');
      expect(isLocalQwenBusy()).toBe(false);
    });
  });
});
