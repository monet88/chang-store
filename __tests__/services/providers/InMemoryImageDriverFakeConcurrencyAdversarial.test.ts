import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InMemoryImageDriverFake,
} from '@/services/providers/testing/InMemoryImageDriverFake';
import {
  StudioDriverError,
  isStudioDriverError,
  type GenerateJob,
  type UpscaleJob,
} from '@/services/providers/ImageDriver';
import type { ImageFile } from '@/types';
import { extractDimensionsFromHeader } from '@/utils/imageAspectRatio';

describe('Adversarial Stress: InMemoryImageDriverFake Concurrency & Batch Deferrals', () => {
  let fake: InMemoryImageDriverFake;

  beforeEach(() => {
    fake = new InMemoryImageDriverFake('gemini');
  });

  // ==========================================================================
  // Vector 1: 100 Simultaneous Jobs with 100 In-Flight Deferrals & resolveAllDeferred()
  // ==========================================================================
  it('Vector 1: executes 100 simultaneous jobs (generate, generateOne, upscale) with 100 in-flight deferrals resolved by resolveAllDeferred()', async () => {
    const TOTAL_JOBS = 100;
    const deferrals = Array.from({ length: TOTAL_JOBS }, () => fake.deferNext());

    const progressTracker = new Map<number, string[]>();
    const promises: Promise<ImageFile[] | ImageFile>[] = [];

    // Dispatch 40 generate, 30 generateOne, 30 upscale
    for (let i = 0; i < TOTAL_JOBS; i++) {
      const idx = i;
      progressTracker.set(idx, []);
      const onProgress = (msg: string) => {
        progressTracker.get(idx)!.push(msg);
      };

      if (i < 40) {
        promises.push(
          fake.generate({
            prompt: `Batch prompt #${i}`,
            aspectRatio: (['1:1', '3:4', '4:3', '9:16', '16:9'] as const)[i % 5],
            resolution: (['1K', '2K', '4K'] as const)[i % 3],
            count: (i % 2) + 1,
            onProgress,
          })
        );
      } else if (i < 70) {
        promises.push(
          fake.generateOne({
            prompt: `Batch generateOne prompt #${i}`,
            aspectRatio: '3:4',
            resolution: '2K',
            onProgress,
          })
        );
      } else {
        promises.push(
          fake.upscale({
            image: { base64: `input-asset-${i}`, mimeType: 'image/png' },
            quality: i % 2 === 0 ? '4K' : '2K',
            onProgress,
          })
        );
      }
    }

    // Let all 100 jobs enter waitForDeferralOrAbort and register into inFlightDeferred
    await Promise.resolve();

    // Verify all 100 deferrals are actively pending and tracked
    expect(fake.hasPendingDeferrals()).toBe(true);
    deferrals.forEach((d) => expect(d.isPending).toBe(true));

    // Verify initial progress callbacks fired for all 100 jobs
    for (let i = 0; i < TOTAL_JOBS; i++) {
      const events = progressTracker.get(i)!;
      expect(events.length).toBeGreaterThanOrEqual(1);
    }

    // Resolve all 100 simultaneously via resolveAllDeferred()
    const startTime = performance.now();
    fake.resolveAllDeferred();

    const results = await Promise.all(promises);
    const durationMs = performance.now() - startTime;

    expect(results).toHaveLength(TOTAL_JOBS);
    expect(durationMs).toBeLessThan(3000);

    // Verify deferral states
    expect(fake.hasPendingDeferrals()).toBe(false);
    deferrals.forEach((d) => expect(d.isPending).toBe(false));

    // Verify job counts: 40 generate + 30 generateOne = 70 in dispatchedJobs, 30 in dispatchedUpscaleJobs
    expect(fake.dispatchedJobs).toHaveLength(70);
    expect(fake.dispatchedUpscaleJobs).toHaveLength(30);
    expect(fake.recordedCalls).toHaveLength(100);
    expect(fake.getRecordedJobs()).toHaveLength(100);

    // Verify chronological recordedCalls matches dispatch order
    for (let i = 0; i < 70; i++) {
      expect(fake.recordedCalls[i].type).toBe('generate');
    }
    for (let i = 70; i < 100; i++) {
      expect(fake.recordedCalls[i].type).toBe('upscale');
    }

    // Verify every single output asset is a valid PNG with correct headers
    for (let i = 0; i < TOTAL_JOBS; i++) {
      const res = results[i];
      const files = Array.isArray(res) ? res : [res];
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        expect(file.mimeType).toBe('image/png');
        expect(file.base64).toBeTruthy();
        const header = extractDimensionsFromHeader(file.base64);
        expect(header.width).toBe(file.width);
        expect(header.height).toBe(file.height);
      }

      // Verify post-deferral progress steps completed
      const events = progressTracker.get(i)!;
      if (i < 70) {
        expect(events.length).toBe(4);
      } else {
        expect(events.length).toBe(3);
      }
    }
  });

  // ==========================================================================
  // Vector 2: High Concurrency Partial Deferral Batch (50 deferred + 50 immediate)
  // ==========================================================================
  it('Vector 2: handles 100 concurrent jobs where 50 are deferred and 50 proceed immediately', async () => {
    // Only queue 50 deferrals
    const deferrals = Array.from({ length: 50 }, () => fake.deferNext());

    const deferredSettled = new Array(50).fill(false);
    const immediateSettled = new Array(50).fill(false);

    const deferredPromises: Promise<ImageFile[]>[] = [];
    const immediatePromises: Promise<ImageFile[]>[] = [];

    // Dispatch the first 50 (these will consume the 50 deferrals)
    for (let i = 0; i < 50; i++) {
      const idx = i;
      deferredPromises.push(
        fake.generate({ prompt: `Deferred #${idx}` }).then((res) => {
          deferredSettled[idx] = true;
          return res;
        })
      );
    }

    // Dispatch the next 50 (no deferrals available, must complete immediately)
    for (let i = 0; i < 50; i++) {
      const idx = i;
      immediatePromises.push(
        fake.generate({ prompt: `Immediate #${idx}` }).then((res) => {
          immediateSettled[idx] = true;
          return res;
        })
      );
    }

    // Await immediate promises
    const immediateResults = await Promise.all(immediatePromises);
    expect(immediateResults).toHaveLength(50);
    expect(immediateSettled.every(Boolean)).toBe(true);

    // At this moment, deferred jobs MUST still be pending!
    expect(deferredSettled.every((s) => s === false)).toBe(true);
    expect(fake.hasPendingDeferrals()).toBe(true);

    // Now resolve all deferred jobs
    fake.resolveAllDeferred();

    const deferredResults = await Promise.all(deferredPromises);
    expect(deferredResults).toHaveLength(50);
    expect(deferredSettled.every(Boolean)).toBe(true);
    expect(fake.hasPendingDeferrals()).toBe(false);

    expect(fake.dispatchedJobs).toHaveLength(100);
  });

  // ==========================================================================
  // Vector 3: Massive In-Flight Abort Chaos (50 aborted + 50 resolved simultaneously)
  // ==========================================================================
  it('Vector 3: handles 100 concurrent in-flight jobs where 50 are aborted and 50 are resolved via resolveAllDeferred()', async () => {
    const TOTAL = 100;
    const controllers = Array.from({ length: TOTAL }, () => new AbortController());
    Array.from({ length: TOTAL }, () => fake.deferNext());

    const promises = controllers.map((ctrl, i) =>
      fake.generate({
        prompt: `Chaos #${i}`,
        signal: ctrl.signal,
      })
    );

    // Let all 100 jobs enter in-flight waiting
    await Promise.resolve();
    expect(fake.hasPendingDeferrals()).toBe(true);

    // Abort odd-indexed jobs in-flight
    for (let i = 1; i < TOTAL; i += 2) {
      controllers[i].abort(new Error(`Aborted in-flight job ${i}`));
    }

    // Resolve all deferred (this will resolve even-indexed jobs and clean up)
    fake.resolveAllDeferred();

    const settled = await Promise.allSettled(promises);

    let fulfilledCount = 0;
    let cancelledCount = 0;

    settled.forEach((outcome, idx) => {
      if (idx % 2 === 0) {
        // Even indices were not aborted, must fulfill
        expect(outcome.status).toBe('fulfilled');
        fulfilledCount++;
      } else {
        // Odd indices were aborted, must reject with StudioDriverError('cancelled')
        expect(outcome.status).toBe('rejected');
        if (outcome.status === 'rejected') {
          expect(isStudioDriverError(outcome.reason)).toBe(true);
          expect((outcome.reason as StudioDriverError).category).toBe('cancelled');
          expect((outcome.reason as StudioDriverError).retryable).toBe(false);
        }
        cancelledCount++;
      }
    });

    expect(fulfilledCount).toBe(50);
    expect(cancelledCount).toBe(50);
    expect(fake.hasPendingDeferrals()).toBe(false);
  });

  // ==========================================================================
  // Vector 4: Over-Provisioned Deferral Queue Resolution & Subsequent Dispatch
  // ==========================================================================
  it('Vector 4: handles over-provisioned deferral queue: 100 queued deferrals, 30 jobs run, resolveAllDeferred() clears queue cleanly', async () => {
    const deferrals = Array.from({ length: 100 }, () => fake.deferNext());

    // Dispatch only 30 jobs
    const promises = Array.from({ length: 30 }, (_, i) =>
      fake.generate({ prompt: `Job #${i}` })
    );

    await Promise.resolve();
    expect(fake.hasPendingDeferrals()).toBe(true);

    // Calling resolveAllDeferred() must drain both in-flight (30) AND queued (70)
    fake.resolveAllDeferred();

    const results = await Promise.all(promises);
    expect(results).toHaveLength(30);

    // All 100 deferrals must no longer be pending
    expect(fake.hasPendingDeferrals()).toBe(false);
    deferrals.forEach((d) => expect(d.isPending).toBe(false));

    // Next 30 jobs dispatched should NOT hang or wait on any leftover deferrals
    const freshPromises = Array.from({ length: 30 }, (_, i) =>
      fake.generate({ prompt: `Fresh Job #${i}` })
    );

    const freshResults = await Promise.all(freshPromises);
    expect(freshResults).toHaveLength(30);
    expect(fake.dispatchedJobs).toHaveLength(60);
  });

  // ==========================================================================
  // Vector 5: Concurrent / Reentrant Multiple Calls to resolveAllDeferred()
  // ==========================================================================
  it('Vector 5: survives concurrent reentrant calls to resolveAllDeferred() without double-settling or throwing', async () => {
    const deferrals = Array.from({ length: 50 }, () => fake.deferNext());
    const promises = Array.from({ length: 50 }, (_, i) =>
      fake.generate({ prompt: `Reentrant #${i}` })
    );

    await Promise.resolve();
    expect(fake.hasPendingDeferrals()).toBe(true);

    // Call resolveAllDeferred() 10 times concurrently in the same tick
    expect(() => {
      for (let i = 0; i < 10; i++) {
        fake.resolveAllDeferred();
      }
    }).not.toThrow();

    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);
    expect(fake.hasPendingDeferrals()).toBe(false);
    deferrals.forEach((d) => expect(d.isPending).toBe(false));
  });

  // ==========================================================================
  // Vector 6: Stress Test on Abort Event Listener Cleanup under 200 Concurrent Jobs
  // ==========================================================================
  it('Vector 6: does not leak AbortSignal event listeners under 200 concurrent jobs sharing controllers', async () => {
    const CONTROLLER_COUNT = 5;
    const JOBS_PER_CONTROLLER = 40;
    const TOTAL_JOBS = CONTROLLER_COUNT * JOBS_PER_CONTROLLER; // 200 jobs

    const controllers = Array.from({ length: CONTROLLER_COUNT }, () => new AbortController());
    Array.from({ length: TOTAL_JOBS }, () => fake.deferNext());

    const promises: Promise<ImageFile[]>[] = [];

    for (let c = 0; c < CONTROLLER_COUNT; c++) {
      const signal = controllers[c].signal;
      for (let j = 0; j < JOBS_PER_CONTROLLER; j++) {
        promises.push(fake.generate({ prompt: `Shared signal c${c}-j${j}`, signal }));
      }
    }

    await Promise.resolve();

    // Abort controller 0 and 2
    controllers[0].abort(new Error('Controller 0 aborted'));
    controllers[2].abort(new Error('Controller 2 aborted'));

    // Resolve all
    fake.resolveAllDeferred();

    const settled = await Promise.allSettled(promises);
    expect(settled).toHaveLength(TOTAL_JOBS);

    // Controllers 0 and 2 jobs (80 jobs) rejected with cancelled
    // Controllers 1, 3, 4 jobs (120 jobs) fulfilled
    let fulfilled = 0;
    let cancelled = 0;

    settled.forEach((s) => {
      if (s.status === 'fulfilled') fulfilled++;
      if (s.status === 'rejected') cancelled++;
    });

    expect(fulfilled).toBe(120);
    expect(cancelled).toBe(80);

    // Aborting the remaining controllers after settlement should not trigger any stray listeners
    controllers[1].abort();
    controllers[3].abort();
    controllers[4].abort();
  });

  // ==========================================================================
  // Vector 7: Rapid Burst Cycles (5 cycles of 50 concurrent deferred jobs)
  // ==========================================================================
  it('Vector 7: executes 5 consecutive burst cycles of 50 concurrent deferred jobs with reset() in between', async () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      Array.from({ length: 50 }, () => fake.deferNext());
      const promises = Array.from({ length: 50 }, (_, i) =>
        fake.generate({ prompt: `Cycle ${cycle} Job ${i}` })
      );

      await Promise.resolve();
      expect(fake.hasPendingDeferrals()).toBe(true);

      fake.resolveAllDeferred();

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
      expect(fake.dispatchedJobs).toHaveLength(50);
      expect(fake.hasPendingDeferrals()).toBe(false);

      // Reset for next cycle
      fake.reset();
      expect(fake.dispatchedJobs).toHaveLength(0);
      expect(fake.hasPendingDeferrals()).toBe(false);
    }
  });

  // ==========================================================================
  // Vector 8: Custom Output Mixed with resolveAllDeferred()
  // ==========================================================================
  it('Vector 8: preserves individual custom output when some deferrals are resolved manually before resolveAllDeferred()', async () => {
    const def1 = fake.deferNext();
    const def2 = fake.deferNext();
    const def3 = fake.deferNext();

    const p1 = fake.generate({ prompt: 'Custom 1' });
    const p2 = fake.generate({ prompt: 'Custom 2' });
    const p3 = fake.generate({ prompt: 'Batch resolved 3' });

    await Promise.resolve();

    const customImg1: ImageFile = {
      base64: 'custom-base64-1',
      mimeType: 'image/png',
      width: 100,
      height: 100,
    };
    const customImg2: ImageFile = {
      base64: 'custom-base64-2',
      mimeType: 'image/png',
      width: 200,
      height: 200,
    };

    // Resolve def1 and def2 with custom outputs
    def1.resolve([customImg1]);
    def2.resolve([customImg2]);

    // Resolve remaining via resolveAllDeferred()
    fake.resolveAllDeferred();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toEqual([customImg1]);
    expect(r2).toEqual([customImg2]);
    expect(r3).toHaveLength(1);
    expect(r3[0].base64).not.toBe('custom-base64-1');
    expect(r3[0].base64).not.toBe('custom-base64-2');
  });

  // ==========================================================================
  // Vector 9: Calling resolveAllDeferred() on idle fake is a safe no-op
  // ==========================================================================
  it('Vector 9: calling resolveAllDeferred() when idle does not corrupt internal state', () => {
    expect(fake.hasPendingDeferrals()).toBe(false);
    expect(() => fake.resolveAllDeferred()).not.toThrow();
    expect(fake.hasPendingDeferrals()).toBe(false);
  });

  // ==========================================================================
  // Vector 10: 250 Concurrent Jobs Swarm with Batch Deferrals
  // ==========================================================================
  it('Vector 10: executes a 250 concurrent jobs swarm with batch deferrals resolved via resolveAllDeferred()', async () => {
    const TOTAL = 250;
    Array.from({ length: TOTAL }, () => fake.deferNext());

    const jobs = Array.from({ length: TOTAL }, (_, i) => ({
      prompt: `Swarm job #${i}`,
      aspectRatio: (['1:1', '3:4', '4:3', '9:16', '16:9'] as const)[i % 5],
      resolution: (['1K', '2K', '4K'] as const)[i % 3],
    }));

    const promises = jobs.map((j) => fake.generate(j));

    await Promise.resolve();
    expect(fake.hasPendingDeferrals()).toBe(true);

    const startTime = performance.now();
    fake.resolveAllDeferred();

    const results = await Promise.all(promises);
    const durationMs = performance.now() - startTime;

    expect(results).toHaveLength(TOTAL);
    expect(fake.dispatchedJobs).toHaveLength(TOTAL);
    expect(fake.hasPendingDeferrals()).toBe(false);
    expect(durationMs).toBeLessThan(3000);
  });

  // ==========================================================================
  // Vector 11: 100-Job Multi-Fault Swarm (Canned Responses, Canned Errors, Aborts, Deferrals)
  // ==========================================================================
  it('Vector 11: executes 100-job multi-fault swarm combining canned errors, canned responses, aborts, and deferrals', async () => {
    const TOTAL = 100;
    // 25 deferrals queued
    for (let i = 0; i < 25; i++) {
      fake.deferNext();
    }
    // 25 canned responses queued
    for (let i = 0; i < 25; i++) {
      fake.queueNextResponse([{ base64: `canned-${i}`, mimeType: 'image/png' }]);
    }
    // 25 canned errors queued
    for (let i = 0; i < 25; i++) {
      fake.queueNextError(new StudioDriverError('rate_limited', `Rate limited #${i}`));
    }
    // Remaining 25 will be synthetic generation

    const controllers = Array.from({ length: TOTAL }, () => new AbortController());
    const promises = Array.from({ length: TOTAL }, (_, i) =>
      fake.generate({ prompt: `Swarm #${i}`, signal: controllers[i].signal })
    );

    await Promise.resolve();

    // Abort 10 jobs from the deferred set (indices 0..9)
    for (let i = 0; i < 10; i++) {
      controllers[i].abort(new Error(`Aborted deferred #${i}`));
    }

    // Resolve deferred jobs
    fake.resolveAllDeferred();

    const settled = await Promise.allSettled(promises);
    expect(settled).toHaveLength(TOTAL);

    let cancelledCount = 0;
    let rateLimitedCount = 0;
    let fulfilledCount = 0;

    settled.forEach((outcome) => {
      if (outcome.status === 'fulfilled') {
        fulfilledCount++;
      } else {
        const err = outcome.reason;
        if (isStudioDriverError(err)) {
          if (err.category === 'cancelled') cancelledCount++;
          if (err.category === 'rate_limited') rateLimitedCount++;
        }
      }
    });

    expect(cancelledCount).toBe(10);
    expect(rateLimitedCount).toBe(25);
    // 15 deferred fulfilled + 25 canned fulfilled + 25 synthetic fulfilled = 65
    expect(fulfilledCount).toBe(65);
    expect(fake.hasPendingDeferrals()).toBe(false);
  });

  // ==========================================================================
  // Vector 12: Custom Signal Abort Reasons Preserved across High Concurrency
  // ==========================================================================
  it('Vector 12: preserves non-standard abort reasons (strings, objects, DOMException) across batch in-flight aborts', async () => {
    const reasons = [
      'simple string abort reason',
      { code: 499, reason: 'Client Closed Request' },
      new DOMException('User cancelled the pipeline', 'AbortError'),
      new TypeError('Type mismatch in caller pipeline'),
    ];

    const controllers = reasons.map(() => new AbortController());
    reasons.forEach(() => fake.deferNext());

    const promises = controllers.map((ctrl, i) =>
      fake.generate({ prompt: `Reason #${i}`, signal: ctrl.signal })
    );

    await Promise.resolve();

    // Abort each with its specific reason
    reasons.forEach((reason, i) => {
      controllers[i].abort(reason);
    });

    fake.resolveAllDeferred();

    const settled = await Promise.allSettled(promises);
    settled.forEach((outcome, idx) => {
      expect(outcome.status).toBe('rejected');
      if (outcome.status === 'rejected') {
        const err = outcome.reason;
        expect(isStudioDriverError(err)).toBe(true);
        expect(err.category).toBe('cancelled');
        expect(err.cause).toBe(reasons[idx]);
      }
    });
  });

  // ==========================================================================
  // Vector 13: Mixed Deferrals with generateOne and upscale Under Concurrency
  // ==========================================================================
  it('Vector 13: resolves 60 interleaved generateOne and upscale jobs with batch deferral', async () => {
    const TOTAL = 60;
    Array.from({ length: TOTAL }, () => fake.deferNext());

    const promises: Promise<ImageFile>[] = [];

    for (let i = 0; i < TOTAL; i++) {
      if (i % 2 === 0) {
        promises.push(fake.generateOne({ prompt: `GenOne #${i}` }));
      } else {
        promises.push(
          fake.upscale({
            image: { base64: `img-${i}`, mimeType: 'image/png' },
            quality: '4K',
          })
        );
      }
    }

    await Promise.resolve();
    expect(fake.hasPendingDeferrals()).toBe(true);

    fake.resolveAllDeferred();

    const results = await Promise.all(promises);
    expect(results).toHaveLength(TOTAL);

    results.forEach((img, idx) => {
      expect(img.mimeType).toBe('image/png');
      expect(img.base64).toBeTruthy();
      if (idx % 2 === 0) {
        expect(img.width).toBe(1536);
        expect(img.height).toBe(2048);
      } else {
        expect(img.width).toBe(3072);
        expect(img.height).toBe(4096);
      }
    });

    expect(fake.dispatchedJobs).toHaveLength(30);
    expect(fake.dispatchedUpscaleJobs).toHaveLength(30);
    expect(fake.recordedCalls).toHaveLength(60);
  });

  // ==========================================================================
  // Vector 14: Race Condition: Abort Triggered inside onProgress during Batch Deferral
  // ==========================================================================
  it('Vector 14: handles abort triggered inside onProgress callback during batch deferral', async () => {
    const TOTAL = 30;
    const controllers = Array.from({ length: TOTAL }, () => new AbortController());
    Array.from({ length: TOTAL }, () => fake.deferNext());

    const promises = controllers.map((ctrl, i) =>
      fake.generate({
        prompt: `Progress Abort #${i}`,
        signal: ctrl.signal,
        onProgress: (step) => {
          if (i % 2 === 0 && step.includes('Initializing')) {
            ctrl.abort(new Error(`Aborted in step: ${step}`));
          }
        },
      })
    );

    await Promise.resolve();

    fake.resolveAllDeferred();

    const settled = await Promise.allSettled(promises);
    expect(settled).toHaveLength(TOTAL);

    let fulfilledCount = 0;
    let cancelledCount = 0;

    settled.forEach((outcome, idx) => {
      if (idx % 2 === 0) {
        expect(outcome.status).toBe('rejected');
        cancelledCount++;
      } else {
        expect(outcome.status).toBe('fulfilled');
        fulfilledCount++;
      }
    });

    expect(cancelledCount).toBe(15);
    expect(fulfilledCount).toBe(15);
  });
});
