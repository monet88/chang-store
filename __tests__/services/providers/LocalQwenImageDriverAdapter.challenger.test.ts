import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalQwenImageDriverAdapter,
  FACE_SWAP_LORA_NAME,
} from '@/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import {
  isLocalQwenBusy,
  resetLocalQwenLock,
  withLocalQwenLock,
  cancelQueuedLocalQwenJobs,
  getLocalQwenLockState,
} from '@/services/providers/local-qwen/localQwenLock';
import { runSerializedLocalQwenJob } from '@/hooks/useLocalQwenImageEngine';
import {
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
  type GenerateJob,
  type UpscaleJob,
} from '@/services/providers/ImageDriver';
import { withRetry } from '@/services/providers/shared/withRetry';
import type {
  DesktopLocalQwenApi,
  DesktopBridgeResult,
  LocalQwenGenerateResult,
  LocalQwenUpscaleResult,
} from '@/platform/desktopLocalQwen';

describe('Adversarial Challenger: LocalQwen Concurrency, Crash Safety & Abort Stress', () => {
  let adapter: LocalQwenImageDriverAdapter;
  let activeExecutions: number;
  let maxObservedConcurrency: number;
  let executionLog: string[];

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

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetLocalQwenLock();

    activeExecutions = 0;
    maxObservedConcurrency = 0;
    executionLog = [];

    mockDesktopApi = {
      getStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'ready', isAppOwned: true, port: 8188 },
      }),
      startServer: vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'ready', isAppOwned: true, port: 8188 },
      }),
      stopServer: vi.fn().mockResolvedValue({
        ok: true,
        value: { stopped: true, wasExternal: false },
      }),
      generateImage: vi.fn().mockImplementation(async (params) => {
        activeExecutions++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
        executionLog.push(`start:generate:${params.prompt}`);

        // Simulate inference delay with jitter
        await delay(10 + Math.floor(Math.random() * 15));

        activeExecutions--;
        executionLog.push(`end:generate:${params.prompt}`);
        return {
          ok: true,
          value: { image: { base64: `gen-${params.prompt}`, mimeType: 'image/png' } },
        };
      }),
      cancelJob: vi.fn().mockImplementation(async () => {
        executionLog.push('bridge:cancelJob');
        return { ok: true, value: { cancelled: true } };
      }),
      upscaleImage: vi.fn().mockImplementation(async (params) => {
        activeExecutions++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
        executionLog.push(`start:upscale:scale${params.scale}`);

        // Simulate upscale processing delay with jitter
        await delay(10 + Math.floor(Math.random() * 15));

        activeExecutions--;
        executionLog.push(`end:upscale:scale${params.scale}`);
        return {
          ok: true,
          value: { image: `upscaled-${params.scale}`, mimeType: 'image/png' },
        };
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

  // =========================================================================
  // Challenge 1: Heavy Concurrency & Interleaving (32 concurrent calls)
  // =========================================================================
  describe('Challenge 1: Heavy Concurrency & Interleaving (32 concurrent calls)', () => {
    it('strictly limits bridge concurrency to <= 1 across 32 interleaved generate and upscale calls', async () => {
      const TOTAL_CALLS = 32;
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < TOTAL_CALLS; i++) {
        const callType = i % 4;
        if (callType === 0) {
          // adapter.generate
          promises.push(adapter.generate({ prompt: `gen-job-${i}` }));
        } else if (callType === 1) {
          // adapter.upscale
          promises.push(
            adapter.upscale({
              image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
              quality: i % 2 === 0 ? '4K' : '2K',
            }),
          );
        } else if (callType === 2) {
          // adapter.generateOne
          promises.push(adapter.generateOne({ prompt: `genOne-job-${i}` }));
        } else {
          // legacy runSerializedLocalQwenJob sharing the exact same lock
          promises.push(
            runSerializedLocalQwenJob(async () => {
              activeExecutions++;
              maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
              await delay(8);
              activeExecutions--;
              return `legacy-job-${i}`;
            }),
          );
        }
      }

      // Concurrency must already be detected as active
      expect(isLocalQwenBusy()).toBe(true);
      expect(getLocalQwenLockState().isLocked).toBe(true);

      const results = await Promise.all(promises);

      // Invariants verification
      expect(results).toHaveLength(TOTAL_CALLS);
      expect(maxObservedConcurrency).toBe(1);
      expect(activeExecutions).toBe(0);
      expect(isLocalQwenBusy()).toBe(false);
      expect(getLocalQwenLockState().queueDepth).toBe(0);
      expect(getLocalQwenLockState().isLocked).toBe(false);

      // Verify that every started job had its corresponding end before the next started
      for (let i = 0; i < executionLog.length; i += 2) {
        expect(executionLog[i]).toMatch(/^start:/);
        if (i + 1 < executionLog.length) {
          expect(executionLog[i + 1]).toMatch(/^end:/);
        }
      }
    });
  });

  // =========================================================================
  // Challenge 2: Chaos & Failure Injection under High Concurrency
  // =========================================================================
  describe('Challenge 2: Chaos & Failure Injection under High Concurrency', () => {
    it('always releases lock on CUDA OOM, bridge crash, or unhandled exceptions without hanging subsequent jobs', async () => {
      // Deterministic error routing via prompt / scale markers
      mockDesktopApi.generateImage.mockImplementation(async (params) => {
        activeExecutions++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
        await delay(5);
        activeExecutions--;

        if (params.prompt.startsWith('oom-job-')) {
          return {
            ok: false,
            error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 4.00 GiB' },
          };
        }
        if (params.prompt.startsWith('net-crash-')) {
          throw new Error('connect ECONNREFUSED 127.0.0.1:8188');
        }
        return {
          ok: true,
          value: { image: { base64: `gen-${params.prompt}`, mimeType: 'image/png' } },
        };
      });

      mockDesktopApi.upscaleImage.mockImplementation(async (params) => {
        activeExecutions++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
        await delay(5);
        activeExecutions--;

        if (params.scale === 4) {
          return {
            ok: false,
            error: { message: 'UpscaleModelLoader: RealESRGAN_x4plus.pth not found' },
          };
        }
        return {
          ok: true,
          value: { image: `upscaled-${params.scale}`, mimeType: 'image/png' },
        };
      });

      const TOTAL_CHAOS_CALLS = 24;
      const promises: Promise<unknown>[] = [];
      const expectedOutcomes: ('success' | 'error')[] = [];

      for (let i = 0; i < TOTAL_CHAOS_CALLS; i++) {
        const isErrorCall = i % 3 !== 0; // 2 out of every 3 calls fail with various errors

        if (isErrorCall) {
          expectedOutcomes.push('error');
          if (i % 6 === 1) {
            // CUDA OOM error via generateImage
            promises.push(adapter.generate({ prompt: `oom-job-${i}` }));
          } else if (i % 6 === 2) {
            // Missing weights error via upscale
            promises.push(
              adapter.upscale({
                image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
                quality: '4K', // adapter maps 4K to scale 4 normally, let's test failure via quality
              }),
            );
            // Wait, upscale maps quality: '4K' -> scale 4, quality: '2K' -> scale 2.
            // Let's test missing model via generate
          } else if (i % 6 === 4) {
            // Unhandled network / bridge disconnection rejection
            promises.push(adapter.generate({ prompt: `net-crash-${i}` }));
          } else {
            // Synchronous error thrown inside legacy lock
            promises.push(
              runSerializedLocalQwenJob(async () => {
                activeExecutions++;
                maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);
                await delay(3);
                activeExecutions--;
                throw new Error('Fatal synchronous pipeline panic');
              }),
            );
          }
        } else {
          // Healthy job
          expectedOutcomes.push('success');
          promises.push(adapter.generate({ prompt: `healthy-job-${i}` }));
        }
      }

      // Settle all promises safely
      const settled = await Promise.allSettled(promises);

      // Verify outcomes match expected
      for (let i = 0; i < TOTAL_CHAOS_CALLS; i++) {
        if (expectedOutcomes[i] === 'error') {
          expect(settled[i].status).toBe('rejected');
          const reason = (settled[i] as PromiseRejectedResult).reason;
          expect(reason).toBeDefined();
        } else {
          expect(settled[i].status).toBe('fulfilled');
        }
      }

      // Concurrency must NEVER exceed 1 even amidst crashes
      expect(maxObservedConcurrency).toBe(1);
      expect(activeExecutions).toBe(0);

      // Lock MUST be completely unlocked and queue clean
      expect(isLocalQwenBusy()).toBe(false);
      expect(getLocalQwenLockState().isLocked).toBe(false);
      expect(getLocalQwenLockState().queueDepth).toBe(0);

      // Subsequent job executes without deadlock or residue
      const canaryResult = await adapter.generate({ prompt: 'post-chaos-canary' });
      expect(canaryResult).toBeDefined();
      expect(canaryResult[0].base64).toBe('gen-post-chaos-canary');
      expect(isLocalQwenBusy()).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 3: AbortSignal & Cancellation Storm
  // =========================================================================
  describe('Challenge 3: AbortSignal & Cancellation Storm', () => {
    it('properly cleans up waitQueue and executes non-aborted jobs without hanging', async () => {
      const TOTAL_ABORT_CALLS = 16;
      const controllers: AbortController[] = [];
      const promises: Promise<unknown>[] = [];
      const abortPlan: ('pre-aborted' | 'queue-aborted' | 'in-flight-aborted' | 'keep')[] = [];

      // Block bridge at start to guarantee queue build-up
      let unblockFirstJob!: () => void;
      const firstJobBlocker = new Promise<void>((r) => {
        unblockFirstJob = r;
      });

      mockDesktopApi.generateImage.mockImplementation(async (params) => {
        activeExecutions++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeExecutions);

        if (params.prompt === 'job-blocker') {
          await firstJobBlocker;
        } else if (params.prompt.startsWith('in-flight-')) {
          const idx = parseInt(params.prompt.replace('in-flight-', ''), 10);
          controllers[idx]?.abort(new Error(`InFlight-Aborted-${idx}`));
          await delay(10);
        } else {
          await delay(10);
        }

        activeExecutions--;
        return {
          ok: true,
          value: { image: { base64: `gen-${params.prompt}`, mimeType: 'image/png' } },
        };
      });

      // 1. Initial blocking job
      promises.push(adapter.generate({ prompt: 'job-blocker' }));
      abortPlan.push('keep');
      controllers.push(new AbortController());

      // 2. Enqueue subsequent jobs while blocker is active
      for (let i = 1; i < TOTAL_ABORT_CALLS; i++) {
        const controller = new AbortController();
        controllers.push(controller);

        if (i % 4 === 1) {
          // Pre-aborted before enqueue
          abortPlan.push('pre-aborted');
          controller.abort(new Error(`Pre-aborted-${i}`));
          promises.push(
            adapter.generate({
              prompt: `pre-aborted-${i}`,
              signal: controller.signal,
            }),
          );
        } else if (i % 4 === 2) {
          // Aborted while waiting in queue (before blocker unblocks)
          abortPlan.push('queue-aborted');
          promises.push(
            adapter.generate({
              prompt: `queue-aborted-${i}`,
              signal: controller.signal,
            }),
          );
          // Abort while blocked
          controller.abort(new Error(`Queue-aborted-${i}`));
        } else if (i % 4 === 3) {
          // In-flight aborted during execution
          abortPlan.push('in-flight-aborted');
          promises.push(
            adapter.generate({
              prompt: `in-flight-${i}`,
              signal: controller.signal,
            }),
          );
        } else {
          // Normal keep job
          abortPlan.push('keep');
          promises.push(
            adapter.generate({
              prompt: `keep-${i}`,
              signal: controller.signal,
            }),
          );
        }
      }

      // Now unblock the queue
      unblockFirstJob();

      const settled = await Promise.allSettled(promises);

      // Verify outcomes
      for (let i = 0; i < TOTAL_ABORT_CALLS; i++) {
        if (abortPlan[i] === 'keep') {
          expect(settled[i].status).toBe('fulfilled');
        } else {
          expect(settled[i].status).toBe('rejected');
          const err = (settled[i] as PromiseRejectedResult).reason;
          expect(isStudioDriverError(err)).toBe(true);
          expect(err.category).toBe('cancelled');
        }
      }

      // Max concurrency must still be 1
      expect(maxObservedConcurrency).toBe(1);
      expect(activeExecutions).toBe(0);

      // Queue depth must be 0, no dangling listeners or waiters
      expect(getLocalQwenLockState().queueDepth).toBe(0);
      expect(isLocalQwenBusy()).toBe(false);
      expect(getLocalQwenLockState().isLocked).toBe(false);
    });

    it('mass cancellation via cancelQueuedLocalQwenJobs flushes all waiters instantly', async () => {
      let resolveSlowJob!: (val: DesktopBridgeResult<LocalQwenGenerateResult>) => void;
      const slowJobDeferred = new Promise<DesktopBridgeResult<LocalQwenGenerateResult>>((r) => {
        resolveSlowJob = r;
      });
      mockDesktopApi.generateImage.mockImplementationOnce(() => slowJobDeferred);

      // Start slow job holding the lock
      const activeJob = adapter.generate({ prompt: 'slow active' });
      expect(isLocalQwenBusy()).toBe(true);

      // Queue 10 waiters
      const waiterPromises: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        waiterPromises.push(adapter.generate({ prompt: `queued-${i}` }));
      }

      expect(getLocalQwenLockState().queueDepth).toBe(10);

      // Trigger mass cancel
      cancelQueuedLocalQwenJobs('User cleared generation queue');

      // All 10 waiters should reject immediately with StudioDriverError('cancelled')
      const settledWaiters = await Promise.allSettled(waiterPromises);
      for (const res of settledWaiters) {
        expect(res.status).toBe('rejected');
        const err = (res as PromiseRejectedResult).reason;
        expect(isStudioDriverError(err)).toBe(true);
        expect(err.category).toBe('cancelled');
        expect(err.message).toContain('User cleared generation queue');
      }

      expect(getLocalQwenLockState().queueDepth).toBe(0);

      // Active job was not affected by cancelQueuedLocalQwenJobs and finishes cleanly
      resolveSlowJob({
        ok: true,
        value: { image: { base64: 'slow-done', mimeType: 'image/png' } },
      });
      const activeRes = await activeJob;
      expect(activeRes[0].base64).toBe('slow-done');
      expect(isLocalQwenBusy()).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 4: Anti-Barging & Strict FIFO under Microtask Flooding
  // =========================================================================
  describe('Challenge 4: Anti-Barging & Strict FIFO under Microtask Flooding', () => {
    it('guarantees that newly arriving callers cannot barge ahead of queued waiters on lock handoff', async () => {
      const executionOrder: number[] = [];
      let resolveFirst!: () => void;
      const firstDeferred = new Promise<void>((r) => {
        resolveFirst = r;
      });

      // Task 0 takes lock and blocks
      const task0 = withLocalQwenLock(async () => {
        executionOrder.push(0);
        await firstDeferred;
      });

      // Tasks 1, 2, 3 enqueue in FIFO order
      const task1 = withLocalQwenLock(async () => {
        executionOrder.push(1);
      });
      const task2 = withLocalQwenLock(async () => {
        executionOrder.push(2);
      });
      const task3 = withLocalQwenLock(async () => {
        executionOrder.push(3);
      });

      expect(getLocalQwenLockState().queueDepth).toBe(3);

      // Attempt microtask barging: when first finishes, immediately spawn taskBarge
      resolveFirst();
      const taskBarge = withLocalQwenLock(async () => {
        executionOrder.push(99); // Barger
      });

      await Promise.all([task0, task1, task2, task3, taskBarge]);

      // Direct handoff guarantees barger 99 MUST be queued after 1, 2, 3!
      expect(executionOrder).toEqual([0, 1, 2, 3, 99]);
    });
  });

  // =========================================================================
  // Challenge 5: Caller Object Immutability & Reference Isolation under High Concurrency
  // =========================================================================
  describe('Challenge 5: Caller Object Immutability & Reference Isolation under High Concurrency', () => {
    it('processes 32 concurrent frozen job objects with zero mutation attempts, zero TypeError, and strict concurrency <= 1', async () => {
      const TOTAL_FROZEN_CALLS = 32;
      const frozenJobs: (GenerateJob | UpscaleJob)[] = [];
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < TOTAL_FROZEN_CALLS; i++) {
        if (i % 2 === 0) {
          const isRefusal = i % 4 === 2;
          const frozenJob = Object.freeze({
            prompt: isRefusal
              ? `Adversarial frozen prompt #${i} - please do not swap face`
              : `Lookbook portrait with frozen job reference #${i}`,
            workflow: 'identity-transfer',
            count: 1,
            aspectRatio: '1:1' as const,
          }) as GenerateJob;
          frozenJobs.push(frozenJob);
          promises.push(adapter.generate(frozenJob));
        } else {
          const frozenUpscaleJob = Object.freeze({
            image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
            quality: i % 4 === 1 ? ('2K' as const) : ('4K' as const),
          }) as UpscaleJob;
          frozenJobs.push(frozenUpscaleJob);
          promises.push(adapter.upscale(frozenUpscaleJob));
        }
      }

      // Concurrency tracking
      expect(isLocalQwenBusy()).toBe(true);
      const results = await Promise.all(promises);

      // Verify outcomes
      expect(results).toHaveLength(TOTAL_FROZEN_CALLS);
      expect(maxObservedConcurrency).toBe(1);
      expect(activeExecutions).toBe(0);

      // Verify every frozen input object was strictly NOT mutated
      for (let i = 0; i < TOTAL_FROZEN_CALLS; i++) {
        const job = frozenJobs[i];
        expect(Object.isFrozen(job)).toBe(true);
        if ('prompt' in job) {
          expect((job as { injectedLora?: string }).injectedLora).toBeUndefined();
        }
      }

      // Verify recorded execution metadata accurately reflects injected LoRA
      const recorded = adapter.getRecordedJobs();
      expect(recorded).toHaveLength(TOTAL_FROZEN_CALLS);

      for (let i = 0; i < TOTAL_FROZEN_CALLS; i++) {
        if (i % 2 === 0) {
          const recordedJob = recorded[i] as GenerateJob;
          expect(recordedJob.workflow).toBe('identity-transfer');
          expect(recordedJob.injectedLora).toBeUndefined();
        }
      }
    });

    it('re-uses the same mutable job object reference across alternating calls (identity-transfer -> refusal -> identity-transfer) without LoRA contamination or state leak', async () => {
      // Single mutable object instance reused across 6 sequential refinement iterations
      const sharedMutableJob: GenerateJob & { injectedLora?: string } = {
        prompt: 'Initial prompt without workflow',
      };

      const steps: {
        prompt: string;
        workflow?: string;
        expectedLora: string | undefined;
        expectedWorkflow: string;
      }[] = [
        {
          // Step 1: identity-transfer preserved, loraName undefined (Finding 5)
          prompt: 'Lookbook model in evening dress',
          workflow: 'identity-transfer',
          expectedLora: undefined,
          expectedWorkflow: 'identity-transfer',
        },
        {
          // Step 2: explicit English refusal preserves workflow and loraName undefined
          prompt: 'Refining look: please do not swap face or alter identity',
          workflow: 'identity-transfer',
          expectedLora: undefined,
          expectedWorkflow: 'identity-transfer',
        },
        {
          // Step 3: subsequent refinement
          prompt: 'Actually, apply identity transfer to match model face',
          workflow: 'identity-transfer',
          expectedLora: undefined,
          expectedWorkflow: 'identity-transfer',
        },
        {
          // Step 4: Vietnamese refusal preserves workflow and loraName undefined
          prompt: 'Không đổi mặt nha, giữ nguyên mặt mẫu',
          workflow: 'identity-transfer',
          expectedLora: undefined,
          expectedWorkflow: 'identity-transfer',
        },
        {
          // Step 5: standard workflow without identity-transfer
          prompt: 'Standard fashion product shot',
          workflow: 'standard',
          expectedLora: undefined,
          expectedWorkflow: 'standard',
        },
        {
          // Step 6: identity-transfer preserved
          prompt: 'Final high-end look with identity-transfer',
          workflow: 'identity-transfer',
          expectedLora: undefined,
          expectedWorkflow: 'identity-transfer',
        },
      ];

      adapter.clearRecordedJobs();

      for (let s = 0; s < steps.length; s++) {
        const step = steps[s];
        // Mutate shared object's prompt and workflow for each step (simulating user refining same form state)
        sharedMutableJob.prompt = step.prompt;
        sharedMutableJob.workflow = step.workflow;

        // Ensure injectedLora has never been set on the caller's shared object prior to execution
        expect(sharedMutableJob.injectedLora).toBeUndefined();

        const result = await adapter.generate(sharedMutableJob);
        expect(result).toBeDefined();
        expect(result[0].base64).toBe(`gen-${step.prompt}`);

        // Invariant: caller's mutable object MUST REMAIN UNTOUCHED (zero mutation)
        expect(sharedMutableJob.injectedLora).toBeUndefined();

        // Verify the bridge received the expected loraName and workflow
        expect(mockDesktopApi.generateImage).toHaveBeenLastCalledWith(
          expect.objectContaining({
            prompt: step.prompt,
            workflow: step.expectedWorkflow,
            loraName: step.expectedLora,
          }),
        );
      }

      // Verify all recorded entries accurately track the intended execution metadata
      const recorded = adapter.getRecordedJobs();
      expect(recorded).toHaveLength(steps.length);
      for (let s = 0; s < steps.length; s++) {
        const recordedJob = recorded[s] as GenerateJob;
        expect(recordedJob.injectedLora).toBe(steps[s].expectedLora);
        expect(recordedJob.workflow).toBe(steps[s].workflow);
      }
    });

    it('interleaves 40 rapid-fire concurrent generate() and upscale() calls with randomized delays and verifies maxConcurrency <= 1 is never violated', async () => {
      const TOTAL_INTERLEAVED = 40;
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < TOTAL_INTERLEAVED; i++) {
        if (i % 2 === 0) {
          promises.push(
            adapter.generate({
              prompt: `interleaved-gen-${i}`,
              workflow: i % 4 === 0 ? 'identity-transfer' : 'standard',
            }),
          );
        } else {
          promises.push(
            adapter.upscale({
              image: { base64: SAMPLE_BASE64, mimeType: 'image/png' },
              quality: i % 4 === 1 ? '2K' : '4K',
            }),
          );
        }
      }

      expect(isLocalQwenBusy()).toBe(true);
      expect(getLocalQwenLockState().isLocked).toBe(true);

      const results = await Promise.all(promises);

      expect(results).toHaveLength(TOTAL_INTERLEAVED);
      expect(maxObservedConcurrency).toBe(1);
      expect(activeExecutions).toBe(0);
      expect(isLocalQwenBusy()).toBe(false);
      expect(getLocalQwenLockState().isLocked).toBe(false);
      expect(getLocalQwenLockState().queueDepth).toBe(0);
    });
  });

  // =========================================================================
  // Challenge 6: Batch Generation Mid-Stream Failure & Re-entrancy Characterization
  // =========================================================================
  describe('Challenge 6: Batch Generation Mid-Stream Failure & Re-entrancy Characterization', () => {
    it('releases lock cleanly when batch generation (count: 4) fails on item 3', async () => {
      let callCount = 0;
      mockDesktopApi.generateImage.mockImplementation(async (params) => {
        callCount++;
        if (callCount === 3) {
          return {
            ok: false,
            error: { message: 'torch.cuda.OutOfMemoryError: CUDA out of memory' },
          };
        }
        return {
          ok: true,
          value: { image: { base64: `img-${callCount}`, mimeType: 'image/png' } },
        };
      });

      await expect(
        adapter.generate({ prompt: 'batch prompt', count: 4 }),
      ).rejects.toThrow();

      // Mutex must be unlocked despite mid-batch failure
      expect(isLocalQwenBusy()).toBe(false);
      expect(getLocalQwenLockState().isLocked).toBe(false);
      expect(getLocalQwenLockState().queueDepth).toBe(0);

      // Verify subsequent job runs without issues
      mockDesktopApi.generateImage.mockImplementationOnce(async () => ({
        ok: true,
        value: { image: { base64: 'subsequent', mimeType: 'image/png' } },
      }));

      const res = await adapter.generate({ prompt: 'after batch fail' });
      expect(res[0].base64).toBe('subsequent');
    });

    it('demonstrates non-reentrant property: calling withLocalQwenLock inside itself deadlocks (as designed)', async () => {
      // Documenting invariant: mutex is non-reentrant by design to prevent recursive hijacking.
      // adapter.generateOne avoids this by directly delegating to generate without acquiring a second lock.
      let innerRan = false;
      const deadlockPromise = withLocalQwenLock(async () => {
        // Inner acquisition with a timeout to detect deadlock
        const controller = new AbortController();
        setTimeout(() => controller.abort('Deadlock detected'), 50);
        await withLocalQwenLock(async () => {
          innerRan = true;
        }, { signal: controller.signal });
      });

      await expect(deadlockPromise).rejects.toThrow('Deadlock detected');
      expect(innerRan).toBe(false);

      // Mutex properly cleans up even after aborting deadlocked inner call
      expect(isLocalQwenBusy()).toBe(false);
    });
  });
});
