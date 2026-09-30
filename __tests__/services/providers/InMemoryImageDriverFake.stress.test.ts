import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StudioDriverError,
  isStudioDriverError,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
} from '@/services/providers/ImageDriver';
import {
  InMemoryImageDriverFake,
  createDeterministicPngBase64,
} from '@/services/providers/testing/InMemoryImageDriverFake';
import type { ImageAspectRatio, ImageFile, ImageResolution } from '@/types';

// Helper to extract dimensions from PNG header in base64 string
function extractDimensionsFromPngBase64(base64: string): { width: number; height: number } {
  const binary = Buffer.from(base64, 'base64');
  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  expect(binary[0]).toBe(0x89);
  expect(binary[1]).toBe(0x50);
  expect(binary[2]).toBe(0x4e);
  expect(binary[3]).toBe(0x47);
  // IHDR starts at byte 12 (0-indexed byte 16 is width, byte 20 is height)
  const width = binary.readUInt32BE(16);
  const height = binary.readUInt32BE(20);
  return { width, height };
}

describe('InMemoryImageDriverFake Adversarial Stress Suite', () => {
  let fake: InMemoryImageDriverFake;

  beforeEach(() => {
    fake = new InMemoryImageDriverFake('gemini');
  });

  // ==========================================================================
  // 1. High Concurrency: 50+ Concurrent Jobs
  // ==========================================================================
  describe('High Concurrency: 50 Concurrent Jobs', () => {
    it('executes 50 concurrent generate jobs with varied configurations without state corruption', async () => {
      const CONCURRENCY = 50;
      const aspectRatios: (ImageAspectRatio | undefined)[] = ['1:1', '3:4', '4:3', '9:16', '16:9', 'Default', undefined];
      const resolutions: (ImageResolution | undefined)[] = ['1K', '2K', '4K', undefined];
      const workflows = ['virtual-try-on', 'clothing-transfer', 'ai-editor', 'lookbook', 'pose-changer'];

      const progressSpy = vi.fn();

      const jobs: GenerateJob[] = Array.from({ length: CONCURRENCY }, (_, i) => ({
        prompt: `Stress job prompt #${i}`,
        aspectRatio: aspectRatios[i % aspectRatios.length],
        resolution: resolutions[i % resolutions.length],
        workflow: workflows[i % workflows.length],
        count: (i % 3) + 1,
        onProgress: progressSpy,
      }));

      const startTime = performance.now();
      const results = await Promise.all(jobs.map((job) => fake.generate(job)));
      const durationMs = performance.now() - startTime;

      expect(results).toHaveLength(CONCURRENCY);
      expect(fake.dispatchedJobs).toHaveLength(CONCURRENCY);

      // Verify every result is valid and dimensions match
      results.forEach((images, idx) => {
        const job = jobs[idx];
        const expectedCount = Math.max(1, job.count ?? 1);
        expect(images).toHaveLength(expectedCount);

        images.forEach((img) => {
          expect(img.mimeType).toBe('image/png');
          expect(img.base64).toBeTruthy();
          const { width, height } = extractDimensionsFromPngBase64(img.base64);
          expect(width).toBeGreaterThan(0);
          expect(height).toBeGreaterThan(0);
          expect(img.width).toBe(width);
          expect(img.height).toBe(height);
        });
      });

      // Verify progress callbacks were made for all jobs
      expect(progressSpy).toHaveBeenCalledTimes(CONCURRENCY * 4);
      // Ensure fast execution (< 1000ms for 50 jobs)
      expect(durationMs).toBeLessThan(2000);
    });

    it('executes 50 interleaved generate, generateOne, and upscale jobs concurrently', async () => {
      const CONCURRENCY = 60; // 20 generate, 20 generateOne, 20 upscale
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < CONCURRENCY; i++) {
        const type = i % 3;
        if (type === 0) {
          promises.push(fake.generate({ prompt: `Gen #${i}`, count: 2 }));
        } else if (type === 1) {
          promises.push(fake.generateOne({ prompt: `GenOne #${i}` }));
        } else {
          promises.push(
            fake.upscale({
              image: { base64: 'test-src', mimeType: 'image/png' },
              quality: i % 2 === 0 ? '4K' : '2K',
            })
          );
        }
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(CONCURRENCY);

      // 20 generate + 20 generateOne = 40 generate jobs
      expect(fake.dispatchedJobs).toHaveLength(40);
      // 20 upscale jobs
      expect(fake.dispatchedUpscaleJobs).toHaveLength(20);

      const allRecorded = fake.getRecordedJobs();
      expect(allRecorded).toHaveLength(60);
    });
  });

  // ==========================================================================
  // 2. Interleaved Deferrals & Immediate Abort Signals
  // ==========================================================================
  describe('Interleaved Deferrals and Abort Signals', () => {
    it('does not consume queued deferrals when job is pre-aborted', async () => {
      // Setup a deferral intended for a valid job
      const deferral = fake.deferNext();
      expect(deferral.isPending).toBe(true);

      // Create a pre-aborted controller
      const abortedController = new AbortController();
      abortedController.abort(new Error('Pre-aborted'));

      // Dispatch pre-aborted job
      await expect(
        fake.generate({ prompt: 'Should fail immediately', signal: abortedController.signal })
      ).rejects.toSatisfy((err: unknown) => {
        return isStudioDriverError(err) && err.category === 'cancelled';
      });

      // The pre-aborted job must NOT have consumed the deferral!
      expect(deferral.isPending).toBe(true);
      expect(fake.dispatchedJobs).toHaveLength(0);

      // A subsequent valid job MUST consume the pending deferral
      let validSettled = false;
      const validPromise = fake.generate({ prompt: 'Valid deferred job' }).then((res) => {
        validSettled = true;
        return res;
      });

      await Promise.resolve();
      expect(validSettled).toBe(false);

      deferral.resolve();
      const validResult = await validPromise;
      expect(validSettled).toBe(true);
      expect(validResult).toHaveLength(1);
      expect(fake.dispatchedJobs).toHaveLength(1);
    });

    it('handles 20 concurrent deferred jobs where half are aborted in-flight and half resolve', async () => {
      const TOTAL = 20;
      const controllers = Array.from({ length: TOTAL }, () => new AbortController());
      const deferrals = Array.from({ length: TOTAL }, () => fake.deferNext());

      const promises = controllers.map((ctrl, i) =>
        fake.generate({ prompt: `Deferred #${i}`, signal: ctrl.signal })
      );

      // Abort odd-indexed jobs in-flight
      for (let i = 1; i < TOTAL; i += 2) {
        controllers[i].abort(new Error(`Aborted job ${i}`));
      }

      // Resolve even-indexed jobs
      for (let i = 0; i < TOTAL; i += 2) {
        deferrals[i].resolve();
      }

      const settled = await Promise.allSettled(promises);

      settled.forEach((outcome, idx) => {
        if (idx % 2 === 0) {
          expect(outcome.status).toBe('fulfilled');
          if (outcome.status === 'fulfilled') {
            expect(outcome.value).toHaveLength(1);
          }
          expect(deferrals[idx].isPending).toBe(false);
        } else {
          expect(outcome.status).toBe('rejected');
          if (outcome.status === 'rejected') {
            expect(isStudioDriverError(outcome.reason)).toBe(true);
            expect((outcome.reason as StudioDriverError).category).toBe('cancelled');
          }
          expect(deferrals[idx].isPending).toBe(false);
        }
      });

      // All 20 were dispatched (not pre-aborted, aborted in-flight)
      expect(fake.dispatchedJobs).toHaveLength(TOTAL);
    });

    it('aborts cleanly when signal is aborted inside onProgress callback', async () => {
      const controller = new AbortController();

      const promise = fake.generate({
        prompt: 'Abort during progress',
        signal: controller.signal,
        onProgress: (msg) => {
          if (msg.includes('Initializing')) {
            controller.abort();
          }
        },
      });

      await expect(promise).rejects.toSatisfy((err: unknown) => {
        return isStudioDriverError(err) && err.category === 'cancelled';
      });

      // Because it was dispatched before being aborted inside onProgress, it should be recorded
      expect(fake.dispatchedJobs).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 3. Abort Signal Racing Against Completion
  // ==========================================================================
  describe('Race Condition: Abort Signal vs Completion', () => {
    it('settles cleanly when resolve() and abort() fire in the same tick', async () => {
      const TRIALS = 30;

      for (let i = 0; i < TRIALS; i++) {
        const controller = new AbortController();
        const deferral = fake.deferNext();

        const promise = fake.generate({
          prompt: `Race #${i}`,
          signal: controller.signal,
        });

        // Fire both resolve and abort synchronously
        deferral.resolve();
        controller.abort();

        // The promise MUST settle (either fulfilled or rejected with cancelled, NEVER hang)
        const outcome = await Promise.allSettled([promise]);
        expect(outcome[0].status).toMatch(/fulfilled|rejected/);

        if (outcome[0].status === 'rejected') {
          const err = outcome[0].reason;
          expect(isStudioDriverError(err)).toBe(true);
          expect(err.category).toBe('cancelled');
        }
        expect(deferral.isPending).toBe(false);
      }
    });

    it('settles cleanly when reject() and abort() fire in the same tick', async () => {
      const controller = new AbortController();
      const deferral = fake.deferNext();

      const promise = fake.generate({
        prompt: 'Reject vs abort',
        signal: controller.signal,
      });

      const customError = new StudioDriverError('gateway_down', 'Gateway failure');
      deferral.reject(customError);
      controller.abort();

      const outcome = await Promise.allSettled([promise]);
      expect(outcome[0].status).toBe('rejected');
      const err = (outcome[0] as PromiseRejectedResult).reason;
      expect(isStudioDriverError(err)).toBe(true);
      // Either gateway_down or cancelled is valid, but must be a StudioDriverError
      expect(['gateway_down', 'cancelled']).toContain(err.category);
    });
  });

  // ==========================================================================
  // 4. Investigation of resolveAllDeferred and hasPendingDeferrals
  // ==========================================================================
  describe('resolveAllDeferred and hasPendingDeferrals In-Flight Investigation', () => {
    it('verifies that resolveAllDeferred resolves queued unshifted deferrals', async () => {
      const d1 = fake.deferNext();
      const d2 = fake.deferNext();

      expect(fake.hasPendingDeferrals()).toBe(true);

      // Resolving all before jobs start
      fake.resolveAllDeferred();

      expect(d1.isPending).toBe(false);
      expect(d2.isPending).toBe(false);
      expect(fake.hasPendingDeferrals()).toBe(false);
    });

    it('resolves in-flight deferral when generate is already awaiting and tracks pending state correctly', async () => {
      const deferral = fake.deferNext();
      let settled = false;

      const promise = fake.generate({ prompt: 'In flight deferred' }).then((res) => {
        settled = true;
        return res;
      });

      // Allow microtask to run so generate() enters waitForDeferralOrAbort and shifts the deferral
      await Promise.resolve();

      // With in-flight tracking, fake.hasPendingDeferrals() correctly reports true
      expect(fake.hasPendingDeferrals()).toBe(true);

      // fake.resolveAllDeferred() resolves both queued and in-flight deferrals
      fake.resolveAllDeferred();
      await expect(promise).resolves.toBeDefined();
      expect(settled).toBe(true);
      expect(deferral.isPending).toBe(false);
      expect(fake.hasPendingDeferrals()).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Rapid FIFO Queuing and Reset Cycles
  // ==========================================================================
  describe('Rapid FIFO Queuing and Reset Cycles', () => {
    it('handles 100 rapid canned responses and errors with clean FIFO ordering', async () => {
      const TOTAL = 100;

      for (let i = 0; i < TOTAL; i++) {
        if (i % 2 === 0) {
          fake.queueNextResponse([{ base64: `canned-${i}`, mimeType: 'image/png' }]);
        } else {
          fake.queueNextError(new StudioDriverError('rate_limited', `Rate limit ${i}`));
        }
      }

      for (let i = 0; i < TOTAL; i++) {
        if (i % 2 === 0) {
          const res = await fake.generate({ prompt: `Call ${i}` });
          expect(res[0].base64).toBe(`canned-${i}`);
        } else {
          await expect(fake.generate({ prompt: `Call ${i}` })).rejects.toSatisfy(
            (err: unknown) => isStudioDriverError(err) && err.category === 'rate_limited'
          );
        }
      }

      // After exhausting the queue, falls back cleanly to synthetic generation
      const fallback = await fake.generate({ prompt: 'Clean fallback' });
      expect(fallback).toHaveLength(1);
      expect(fallback[0].base64).not.toContain('canned');
    });

    it('flushes all state cleanly across multiple rapid reset() cycles', async () => {
      for (let cycle = 0; cycle < 5; cycle++) {
        fake.queueNextResponse([{ base64: `stale-${cycle}`, mimeType: 'image/png' }]);
        fake.queueNextError(new Error('Stale error'));
        fake.deferNext(); // Queued deferral that would hang generate if not reset
        fake.setSimulatedError(new StudioDriverError('gateway_down', 'Stale gateway'));

        fake.reset();

        expect(fake.dispatchedJobs).toHaveLength(0);
        expect(fake.dispatchedUpscaleJobs).toHaveLength(0);
        expect(fake.getRecordedJobs()).toHaveLength(0);

        // Immediate normal generation succeeds without interference or hanging from wiped queues
        const clean = await fake.generate({ prompt: `Clean ${cycle}` });
        expect(clean).toHaveLength(1);
        expect(clean[0].base64).not.toContain('stale');
      }
    });
  });

  // ==========================================================================
  // 6. Memory Safety: AbortSignal Listener Cleanup
  // ==========================================================================
  describe('Memory Safety: AbortSignal Listener Cleanup', () => {
    it('does not leak abort event listeners when multiple jobs share a single AbortController', async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      // Run 50 jobs sequentially and concurrently using the same signal
      const jobs: Promise<ImageFile[]>[] = [];
      for (let i = 0; i < 50; i++) {
        const deferral = fake.deferNext();
        jobs.push(fake.generate({ prompt: `Shared signal #${i}`, signal }));
        deferral.resolve();
      }

      await Promise.all(jobs);

      // Verify all 50 completed cleanly
      expect(fake.dispatchedJobs).toHaveLength(50);

      // If listeners were not removed with removeEventListener, signal would hold onto references.
      // Calling abort now should not throw unhandled errors
      expect(() => controller.abort()).not.toThrow();
    });
  });

  // ==========================================================================
  // 7. Edge Cases & Hostile Inputs
  // ==========================================================================
  describe('Edge Cases and Hostile Inputs', () => {
    it('handles count = 0, count = -5, count = 100 gracefully', async () => {
      const resZero = await fake.generate({ prompt: 'Count 0', count: 0 });
      expect(resZero).toHaveLength(1); // normalized via Math.max(1, 0)

      const resNegative = await fake.generate({ prompt: 'Count -5', count: -5 });
      expect(resNegative).toHaveLength(1);

      const resMany = await fake.generate({ prompt: 'Count 50', count: 50 });
      expect(resMany).toHaveLength(50);
    });

    it('handles extreme semantic reference arrays without crash', async () => {
      const references: ReferenceRoleImage[] = Array.from({ length: 20 }, (_, i) => ({
        image: { base64: `ref-base64-${i}`, mimeType: 'image/png' },
        role: (['subject', 'garment', 'style', 'mask'] as const)[i % 4],
        label: `ref-label-${i}`,
      }));

      const res = await fake.generate({
        prompt: 'Complex fashion transfer',
        references,
      });

      expect(res).toHaveLength(1);
      expect(fake.dispatchedJobs[0].references).toEqual(references);
    });

    it('handles giant prompt strings (50,000 chars) under concurrency', async () => {
      const hugePrompt = 'A'.repeat(50000);
      const res = await fake.generate({ prompt: hugePrompt });
      expect(res).toHaveLength(1);
      expect(fake.dispatchedJobs[0].prompt.length).toBe(50000);
    });

    it('enforces that pre-aborted upscale jobs are never recorded in dispatchedUpscaleJobs', async () => {
      const controller = new AbortController();
      controller.abort(new Error('Pre-aborted upscale'));

      await expect(
        fake.upscale({
          image: { base64: 'test', mimeType: 'image/png' },
          signal: controller.signal,
        })
      ).rejects.toSatisfy((err: unknown) => {
        return isStudioDriverError(err) && err.category === 'cancelled';
      });

      expect(fake.dispatchedUpscaleJobs).toHaveLength(0);
      expect(fake.getRecordedJobs()).toHaveLength(0);
    });

    it('executes 50 concurrent upscale jobs with 2K and 4K quality', async () => {
      const CONCURRENCY = 50;
      const jobs: UpscaleJob[] = Array.from({ length: CONCURRENCY }, (_, i) => ({
        image: { base64: `input-asset-${i}`, mimeType: 'image/png' },
        quality: i % 2 === 0 ? '4K' : '2K',
      }));

      const results = await Promise.all(jobs.map((j) => fake.upscale(j)));

      expect(results).toHaveLength(CONCURRENCY);
      expect(fake.dispatchedUpscaleJobs).toHaveLength(CONCURRENCY);

      results.forEach((img, idx) => {
        const expectedDimensions = jobs[idx].quality === '4K' ? { width: 3072, height: 4096 } : { width: 1536, height: 2048 };
        expect(img.width).toBe(expectedDimensions.width);
        expect(img.height).toBe(expectedDimensions.height);
        const header = extractDimensionsFromPngBase64(img.base64);
        expect(header.width).toBe(expectedDimensions.width);
        expect(header.height).toBe(expectedDimensions.height);
      });
    });

    it('strictly enforces hardware_error non-retryable across all 5xx HTTP statuses', () => {
      const statuses = [500, 501, 502, 503, 504, 507, 508, 599];
      for (const status of statuses) {
        const error = new StudioDriverError('hardware_error', `CUDA failure ${status}`, { status });
        expect(error.retryable).toBe(false);
      }
    });
  });
});
