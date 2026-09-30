import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalQwenImageDriverAdapter } from '@/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import {
  isLocalQwenBusy,
  resetLocalQwenLock,
  withLocalQwenLock,
  cancelQueuedLocalQwenJobs,
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
import {
  saveLocalQwenSettings,
  DEFAULT_LOCAL_QWEN_SETTINGS,
} from '@/config/localQwenSettings';
import {
  LOCAL_QWEN_UNAVAILABLE_MESSAGE,
  type DesktopBridgeResult,
  type DesktopLocalQwenApi,
  type LocalQwenGenerateResult,
  type LocalQwenUpscaleResult,
} from '@/platform/desktopLocalQwen';

// Helper for cross-environment deferred promises
function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Cloud drivers to verify strict isolation invariant
const cloudGeminiEditMock = vi.hoisted(() => vi.fn());
const cloudGptEditMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/imageEditingService', () => ({
  editImage: cloudGeminiEditMock,
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('@/services/providers/gpt-image/gptImageService', () => ({
  editGptImage: cloudGptEditMock,
}));

describe('LocalQwenImageDriverAdapter Test Suite', () => {
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
  const UPSCALED_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
        value: { image: UPSCALED_BASE64, mimeType: 'image/png' },
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

  // ---------------------------------------------------------------------------
  // Suite 1: Mutex Serialization & Concurrency via localQwenLock
  // ---------------------------------------------------------------------------
  describe('Suite 1: Mutex Serialization & Concurrency via localQwenLock', () => {
    it('strictly serializes concurrent generate() and generate() calls', async () => {
      const job1Deferred = createDeferred<DesktopBridgeResult<LocalQwenGenerateResult>>();
      mockDesktopApi.generateImage.mockImplementationOnce(() => job1Deferred.promise);

      const job1Promise = adapter.generate({ prompt: 'job 1 prompt' });
      expect(isLocalQwenBusy()).toBe(true);

      let job2Started = false;
      mockDesktopApi.generateImage.mockImplementationOnce(async () => {
        job2Started = true;
        return { ok: true, value: { image: { base64: 'job2-res', mimeType: 'image/png' } } };
      });

      const job2Promise = adapter.generate({ prompt: 'job 2 prompt' });

      // Yield event loop
      await Promise.resolve();
      expect(job2Started).toBe(false);

      // Complete job 1
      job1Deferred.resolve({
        ok: true,
        value: { image: { base64: 'job1-res', mimeType: 'image/png' } },
      });

      const res1 = await job1Promise;
      expect(res1[0].base64).toBe('job1-res');

      const res2 = await job2Promise;
      expect(job2Started).toBe(true);
      expect(res2[0].base64).toBe('job2-res');
      expect(isLocalQwenBusy()).toBe(false);
    });

    it('strictly serializes concurrent generate() and upscale() calls across operations', async () => {
      const genDeferred = createDeferred<DesktopBridgeResult<LocalQwenGenerateResult>>();
      mockDesktopApi.generateImage.mockImplementationOnce(() => genDeferred.promise);

      const genPromise = adapter.generate({ prompt: 'heavy generation' });
      expect(isLocalQwenBusy()).toBe(true);

      let upscaleStarted = false;
      mockDesktopApi.upscaleImage.mockImplementationOnce(async () => {
        upscaleStarted = true;
        return { ok: true, value: { image: UPSCALED_BASE64, mimeType: 'image/png' } };
      });

      const upscalePromise = adapter.upscale({
        image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
        quality: '4K',
      });

      await Promise.resolve();
      expect(upscaleStarted).toBe(false);

      // Finish generation
      genDeferred.resolve({
        ok: true,
        value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
      });

      await genPromise;
      const upscaled = await upscalePromise;

      expect(upscaleStarted).toBe(true);
      expect(upscaled.base64).toBe(UPSCALED_BASE64);
      expect(isLocalQwenBusy()).toBe(false);
    });

    it('strictly serializes concurrent upscale() and upscale() calls', async () => {
      const up1Deferred = createDeferred<DesktopBridgeResult<LocalQwenUpscaleResult>>();
      mockDesktopApi.upscaleImage.mockImplementationOnce(() => up1Deferred.promise);

      const up1Promise = adapter.upscale({
        image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
      });

      let up2Started = false;
      mockDesktopApi.upscaleImage.mockImplementationOnce(async () => {
        up2Started = true;
        return { ok: true, value: { image: 'up2', mimeType: 'image/png' } };
      });

      const up2Promise = adapter.upscale({
        image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
      });

      await Promise.resolve();
      expect(up2Started).toBe(false);

      up1Deferred.resolve({ ok: true, value: { image: 'up1', mimeType: 'image/png' } });
      await up1Promise;

      const res2 = await up2Promise;
      expect(up2Started).toBe(true);
      expect(res2.base64).toBe('up2');
      expect(isLocalQwenBusy()).toBe(false);
    });

    it('guarantees lock release in finally block when in-flight job crashes', async () => {
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory' },
      });

      await expect(adapter.generate({ prompt: 'job will fail' })).rejects.toThrow();

      // Mutex must be cleanly unlocked
      expect(isLocalQwenBusy()).toBe(false);

      // Subsequent job executes without deadlock
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: true,
        value: { image: { base64: 'recovered', mimeType: 'image/png' } },
      });

      const recovered = await adapter.generate({ prompt: 'subsequent job' });
      expect(recovered[0].base64).toBe('recovered');
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 2: FaceSwap LoRA Auto-Injection & Refusal Rules
  // ---------------------------------------------------------------------------
  describe('Suite 2: FaceSwap LoRA Auto-Injection & Refusal Rules', () => {
    it('auto-injects FaceSwap LoRA when workflow is identity-transfer and prompt has no refusal', async () => {
      const job: GenerateJob = {
        prompt: 'Fashion studio lookbook portrait of young model in trench coat',
        workflow: 'identity-transfer',
      };

      await adapter.generate(job);

      expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: job.prompt,
          workflow: 'identity-transfer',
          loraName: 'bfs_head_v1.1_qwen_2.1.safetensors',
        }),
      );
      const recorded = adapter.getRecordedJobs();
      expect((recorded[0] as GenerateJob).injectedLora).toBe('bfs_head_v1.1_qwen_2.1.safetensors');
      expect(job.injectedLora).toBeUndefined();
    });

    it('suppresses LoRA auto-injection when prompt contains English refusal phrase', async () => {
      const refusals = [
        'A model in trench coat, no face swap please',
        'A model in trench coat, do not swap face',
        'Keep the original face, high detail blazer portrait',
        'Without face swap, standard fashion shoot',
      ];

      for (const prompt of refusals) {
        mockDesktopApi.generateImage.mockClear();
        const job: GenerateJob = {
          prompt,
          workflow: 'identity-transfer',
        };

        await adapter.generate(job);

        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt,
            workflow: 'standard',
          }),
        );
        expect(job.injectedLora).toBeUndefined();
      }
    });

    it('suppresses LoRA auto-injection when prompt contains Vietnamese refusal phrase', async () => {
      const viRefusals = [
        'Chụp ảnh lookbook áo vest, không đổi mặt',
        'Ảnh người mẫu mặc đầm dạ hội, không thay mặt',
        'Thời trang công sở, không ghép mặt mẫu gốc',
        'Mẫu nam áo sơ mi, không chuyển mặt',
      ];

      for (const prompt of viRefusals) {
        mockDesktopApi.generateImage.mockClear();
        const job: GenerateJob = {
          prompt,
          workflow: 'identity-transfer',
        };

        await adapter.generate(job);

        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt,
            workflow: 'standard',
          }),
        );
        expect(job.injectedLora).toBeUndefined();
      }
    });

    it('does NOT inject LoRA for standard workflow even if prompt contains words like face', async () => {
      const job: GenerateJob = {
        prompt: 'Close-up face lighting on silk scarf',
        workflow: 'standard',
      };

      await adapter.generate(job);

      expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: 'standard',
        }),
      );
      expect(job.injectedLora).toBeUndefined();
    });

    it('preserves explicitly supplied caller LoRA and does not overwrite it', async () => {
      const job: GenerateJob = {
        prompt: 'Virtual try-on with custom vintage style',
        workflow: 'identity-transfer',
        injectedLora: 'custom_vintage_v1.safetensors',
      };

      await adapter.generate(job);

      expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          loraName: 'custom_vintage_v1.safetensors',
        }),
      );
    });

    it('preserves caller job immutability and safely handles reused job reference across refusal refinements', async () => {
      const reusedJob: GenerateJob = {
        prompt: 'Fashion lookbook portrait of young model in trench coat',
        workflow: 'identity-transfer',
      };

      // Call 1: Identity transfer without refusal -> LoRA injected
      await adapter.generate(reusedJob);
      expect(mockDesktopApi.generateImage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workflow: 'identity-transfer',
          loraName: 'bfs_head_v1.1_qwen_2.1.safetensors',
        }),
      );
      expect(reusedJob.injectedLora).toBeUndefined();

      // Call 2: Refusal refinement on the same reused job reference -> LoRA suppressed
      reusedJob.prompt = 'Keep original face, high detail portrait, no face swap';
      await adapter.generate(reusedJob);
      expect(mockDesktopApi.generateImage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workflow: 'standard',
          loraName: undefined,
        }),
      );
      expect(reusedJob.injectedLora).toBeUndefined();

      const recorded = adapter.getRecordedJobs();
      expect((recorded[0] as GenerateJob).injectedLora).toBe('bfs_head_v1.1_qwen_2.1.safetensors');
      expect((recorded[1] as GenerateJob).injectedLora).toBeUndefined();
    });

    it('successfully processes frozen job objects without throwing', async () => {
      const frozenJob = Object.freeze({
        prompt: 'Lookbook portrait with frozen job reference',
        workflow: 'identity-transfer',
      }) as GenerateJob;

      await expect(adapter.generate(frozenJob)).resolves.toBeDefined();
      const recorded = adapter.getRecordedJobs();
      expect((recorded[0] as GenerateJob).injectedLora).toBe('bfs_head_v1.1_qwen_2.1.safetensors');
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 3: Upscale Local Bridge Execution & Cloud Isolation
  // ---------------------------------------------------------------------------
  describe('Suite 3: Upscale Local Bridge Execution & Cloud Isolation', () => {
    it('executes 2K upscale locally via desktopLocalQwen with scale 2', async () => {
      const job: UpscaleJob = {
        image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
        quality: '2K',
      };

      const result = await adapter.upscale(job);

      expect(mockDesktopApi.upscaleImage).toHaveBeenCalledTimes(1);
      expect(mockDesktopApi.upscaleImage).toHaveBeenCalledWith({
        image: SAMPLE_BASE64,
        scale: 2,
      });
      expect(result.base64).toBe(UPSCALED_BASE64);
    });

    it('executes 4K upscale locally via desktopLocalQwen with scale 4', async () => {
      const job: UpscaleJob = {
        image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
        quality: '4K',
      };

      const result = await adapter.upscale(job);

      expect(mockDesktopApi.upscaleImage).toHaveBeenCalledWith({
        image: SAMPLE_BASE64,
        scale: 4,
      });
      expect(result.base64).toBe(UPSCALED_BASE64);
    });

    it('strictly preserves Local Qwen Upscale Invariant: never calls cloud providers', async () => {
      await adapter.upscale({
        image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
      });

      expect(cloudGeminiEditMock).not.toHaveBeenCalled();
      expect(cloudGptEditMock).not.toHaveBeenCalled();
    });

    it('throws StudioDriverError with category gateway_down when desktop bridge is missing', async () => {
      delete window.desktopLocalQwen;

      try {
        await adapter.upscale({
          image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
        });
        expect.unreachable('Should have rejected when desktop bridge is absent');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('gateway_down');
          expect(err.retryable).toBe(false);
          expect(err.message).toMatch(/desktop app/i);
        }
      }
    });

    it('throws StudioDriverError with LOCAL_QWEN_UNAVAILABLE_MESSAGE when generate() is called without desktop bridge', async () => {
      delete window.desktopLocalQwen;

      try {
        await adapter.generate({ prompt: 'test' });
        expect.unreachable('Should have thrown when desktop bridge is absent');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('gateway_down');
          expect(err.status).toBe(503);
          expect(err.retryable).toBe(false);
          expect(err.message).toBe(LOCAL_QWEN_UNAVAILABLE_MESSAGE);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 4: Non-Retriable Hardware Error & Crash Recovery Guard
  // ---------------------------------------------------------------------------
  describe('Suite 4: Non-Retriable Hardware Error & Crash Recovery Guard', () => {
    it('maps CUDA OOM to StudioDriverError(hardware_error, retryable: false)', async () => {
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB' },
      });

      try {
        await adapter.generate({ prompt: 'batch 4k' });
        expect.unreachable('Should have thrown hardware error');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('hardware_error');
          expect(err.retryable).toBe(false);
          expect(isRetryableDriverError(err)).toBe(false);
        }
      }
    });

    it('maps missing GGUF weights to StudioDriverError(hardware_error, retryable: false)', async () => {
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'UnetLoaderGGUF: qwen-image-2.1-Q4_K_M.gguf not found' },
      });

      try {
        await adapter.generate({ prompt: 'test missing unet' });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('hardware_error');
          expect(err.retryable).toBe(false);
          expect(isRetryableDriverError(err)).toBe(false);
        }
      }
    });

    it('maps missing CLIP/text encoder weights to StudioDriverError(hardware_error, retryable: false)', async () => {
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'CLIPLoader: qwen3vl_8b_w4a8.safetensors missing from models/text_encoders' },
      });

      try {
        await adapter.generate({ prompt: 'test missing text encoder' });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('hardware_error');
          expect(err.retryable).toBe(false);
        }
      }
    });

    it('maps server startup / ECONNREFUSED failure to StudioDriverError(gateway_down, retryable: false)', async () => {
      mockDesktopApi.generateImage.mockResolvedValueOnce({
        ok: false,
        error: { message: 'connect ECONNREFUSED 127.0.0.1:8188' },
      });

      try {
        await adapter.generate({ prompt: 'test connection refused' });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('gateway_down');
          expect(err.retryable).toBe(false);
        }
      }
    });

    it('maps AbortSignal cancellation to StudioDriverError(cancelled, retryable: false)', async () => {
      const controller = new AbortController();
      controller.abort(new Error('User clicked Stop'));

      try {
        await adapter.generate({
          prompt: 'abort me',
          signal: controller.signal,
        });
        expect.unreachable('Should have aborted');
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('cancelled');
          expect(err.retryable).toBe(false);
        }
      }
    });

    it('halts withRetry immediately without retry loop when hardware_error occurs', async () => {
      let callCount = 0;
      mockDesktopApi.generateImage.mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory' },
        };
      });

      const retryOperation = () => adapter.generate({ prompt: 'trigger oom' });

      await expect(
        withRetry(retryOperation, { retries: 3, delay: 1, retryOn: isRetryableDriverError }),
      ).rejects.toMatchObject({
        category: 'hardware_error',
        retryable: false,
      });

      // Crucial: Must be called exactly ONCE. Zero retries permitted on hardware fatal errors!
      expect(callCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 5: Settings Snapshotting, generateOne, & Progress Reporting
  // ---------------------------------------------------------------------------
  describe('Suite 5: Settings Snapshotting, generateOne, & Progress Reporting', () => {
    it('snapshots settings at job start so subsequent mutations do not leak into in-flight job', async () => {
      saveLocalQwenSettings({
        resolution: 768,
        steps: 24,
        cfg: 2.0,
        sampler: 'DPM++ 2M',
        scheduler: 'Karras',
      });

      mockDesktopApi.generateImage.mockImplementationOnce(async () => {
        // Mutate storage while job is running
        saveLocalQwenSettings({
          resolution: 1024,
          steps: 50,
          cfg: 7.0,
        });
        return {
          ok: true,
          value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
        };
      });

      await adapter.generate({ prompt: 'test snapshotting' });

      expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: 768,
          steps: 24,
          cfg: 2.0,
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
        }),
      );
    });

    it('generateOne delegates to generate and returns single ImageFile unwrapped', async () => {
      const result = await adapter.generateOne({ prompt: 'single portrait' });

      expect(result).toBeDefined();
      expect(result.base64).toBe(SAMPLE_BASE64);
      expect(result.mimeType).toBe('image/png');
    });

    it('emits onProgress callbacks during generation lifecycle', async () => {
      const progressUpdates: string[] = [];
      await adapter.generate({
        prompt: 'test progress',
        onProgress: (msg) => progressUpdates.push(msg),
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('exposes readonly id as localQwen', () => {
      expect(adapter.id).toBe('localQwen');
    });

    it('records executed jobs in recordedJobs and supports clearRecordedJobs', async () => {
      await adapter.generate({ prompt: 'record gen' });
      await adapter.upscale({ image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } });

      const recorded = adapter.getRecordedJobs();
      expect(recorded.length).toBe(2);
      expect((recorded[0] as GenerateJob).prompt).toBe('record gen');

      adapter.clearRecordedJobs();
      expect(adapter.getRecordedJobs().length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 6: localQwenLock Primitive Invariants (Anti-Barging, Cancel & State)
  // ---------------------------------------------------------------------------
  describe('Suite 6: localQwenLock Primitive Invariants', () => {
    it('immediately throws StudioDriverError(cancelled) when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('Pre-aborted'));

      await expect(
        withLocalQwenLock(async () => 'never called', { signal: controller.signal }),
      ).rejects.toThrow('Pre-aborted');
    });

    it('cancels queued task when signal aborts while waiting in waitQueue', async () => {
      const activeDeferred = createDeferred<void>();
      const task1 = withLocalQwenLock(() => activeDeferred.promise);

      const controller = new AbortController();
      const task2 = withLocalQwenLock(async () => 'task2', { signal: controller.signal });

      expect(getLocalQwenLockState().queueDepth).toBe(1);

      controller.abort(new Error('User aborted wait'));

      await expect(task2).rejects.toThrow('User aborted wait');
      expect(getLocalQwenLockState().queueDepth).toBe(0);

      activeDeferred.resolve();
      await task1;
      expect(isLocalQwenBusy()).toBe(false);
    });

    it('cancelQueuedLocalQwenJobs drains all queued waiters', async () => {
      const activeDeferred = createDeferred<void>();
      const task1 = withLocalQwenLock(() => activeDeferred.promise);

      const task2 = withLocalQwenLock(async () => 'task2');
      const task3 = withLocalQwenLock(async () => 'task3');

      expect(getLocalQwenLockState().queueDepth).toBe(2);

      cancelQueuedLocalQwenJobs('Mass cancel');

      await expect(task2).rejects.toThrow('Mass cancel');
      await expect(task3).rejects.toThrow('Mass cancel');
      expect(getLocalQwenLockState().queueDepth).toBe(0);

      activeDeferred.resolve();
      await task1;
      expect(isLocalQwenBusy()).toBe(false);
    });

    it('preserves FIFO ordering without barging on lock handoff', async () => {
      const order: number[] = [];
      const deferred1 = createDeferred<void>();

      const task1 = withLocalQwenLock(async () => {
        order.push(1);
        await deferred1.promise;
      });

      const task2 = withLocalQwenLock(async () => {
        order.push(2);
      });

      // Complete task1
      deferred1.resolve();
      await task1;
      await task2;

      expect(order).toEqual([1, 2]);
    });
  });
});

