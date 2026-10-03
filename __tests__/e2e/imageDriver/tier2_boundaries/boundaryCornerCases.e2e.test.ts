import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  StudioDriverError,
  InMemoryImageDriverFake,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
} from '../harness/testHarness';
import { FIXTURE_IMAGES } from '../harness/testFixtures';

describe('Tier 2: Boundary & Corner Cases (ImageDriver Seam)', () => {
  let fakeDriver: InMemoryImageDriverFake;
  let geminiDriver: GeminiImageDriverTestDouble;
  let gptDriver: GptImageDriverTestDouble;
  let localDriver: LocalQwenImageDriverTestDouble;

  beforeEach(() => {
    fakeDriver = createTestDriver('fake') as InMemoryImageDriverFake;
    geminiDriver = createTestDriver('gemini') as GeminiImageDriverTestDouble;
    gptDriver = createTestDriver('gptImage') as GptImageDriverTestDouble;
    localDriver = createTestDriver('localQwen') as LocalQwenImageDriverTestDouble;
  });

  describe('2.1: Empty and Minimal Input Boundaries', () => {
    it('handles empty prompt string gracefully', async () => {
      const results = await fakeDriver.generate({
        prompt: '',
        images: [FIXTURE_IMAGES.modelSubjectA],
        workflow: 'try-on',
      });
      expect(results).toHaveLength(1);
      expect(results[0].base64).toBeDefined();
    });

    it('handles whitespace-only prompt strings', async () => {
      const results = await fakeDriver.generate({
        prompt: '    \n\t   ',
        images: [FIXTURE_IMAGES.modelSubjectA],
        workflow: 'ai-editor',
      });
      expect(results).toHaveLength(1);
    });

    it('handles empty images array and empty references array', async () => {
      const results = await fakeDriver.generate({
        prompt: 'Fashion creation without input images',
        images: [],
        references: [],
        workflow: 'lookbook',
      });
      expect(results).toHaveLength(1);
    });

    it('handles count = 0 or negative count by falling back to 1 image', async () => {
      const res0 = await fakeDriver.generate({
        prompt: 'Minimal count test',
        count: 0,
      });
      expect(res0).toHaveLength(1);

      const resNeg = await fakeDriver.generate({
        prompt: 'Negative count test',
        count: -5,
      });
      expect(resNeg).toHaveLength(1);
    });
  });

  describe('2.2: Cancellation Semantics via AbortSignal', () => {
    it('immediately rejects when AbortSignal is pre-aborted before invocation', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fakeDriver.generate({
          prompt: 'Fast cancel test',
          signal: controller.signal,
        })
      ).rejects.toThrowError(StudioDriverError);

      try {
        await fakeDriver.generate({
          prompt: 'Fast cancel test',
          signal: controller.signal,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(StudioDriverError);
        expect((err as StudioDriverError).category).toBe('cancelled');
        expect((err as StudioDriverError).retryable).toBe(false);
      }
    });

    it('aborts an in-flight deferred generation job cleanly when signal fires', async () => {
      const { resolve } = fakeDriver.deferNext();
      const controller = new AbortController();

      const jobPromise = fakeDriver.generate({
        prompt: 'In-flight cancel test',
        signal: controller.signal,
      });

      // Fire abort while job is deferred
      controller.abort();
      resolve();

      await expect(jobPromise).rejects.toThrowError(StudioDriverError);
      await expect(jobPromise).rejects.toMatchObject({
        category: 'cancelled',
        retryable: false,
      });
    });

    it('aborts an in-flight upscale job when signal fires', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fakeDriver.upscale({
          image: FIXTURE_IMAGES.modelSubjectA,
          quality: '4K',
          signal: controller.signal,
        })
      ).rejects.toMatchObject({
        category: 'cancelled',
      });
    });
  });

  describe('2.3: Transient Errors and Rate Limiting', () => {
    it('normalizes HTTP 429 quota exhaustion to retryable rate_limited StudioDriverError', async () => {
      await expect(
        geminiDriver.generate({
          prompt: 'TRIGGER_QUOTA_EXCEEDED test',
        })
      ).rejects.toMatchObject({
        category: 'rate_limited',
        status: 429,
        retryable: true,
      });
    });

    it('normalizes HTTP 503 gateway outages to retryable gateway_down StudioDriverError', async () => {
      await expect(
        gptDriver.generate({
          prompt: 'TRIGGER_GATEWAY_DOWN test',
        })
      ).rejects.toMatchObject({
        category: 'gateway_down',
        status: 503,
        retryable: true,
      });
    });

    it('normalizes safety blocks to non-retriable safety_blocked StudioDriverError', async () => {
      await expect(
        geminiDriver.generate({
          prompt: 'TRIGGER_SAFETY_BLOCK test',
        })
      ).rejects.toMatchObject({
        category: 'safety_blocked',
        retryable: false,
      });
    });
  });

  describe('2.4: Hardware Fatal Errors & Mutex Safety (Local Qwen)', () => {
    it('marks ComfyUI CUDA OOM as non-retriable hardware_error', async () => {
      await expect(
        localDriver.generate({
          prompt: 'TRIGGER_CUDA_OOM crash simulation',
        })
      ).rejects.toMatchObject({
        category: 'hardware_error',
        retryable: false,
      });
    });

    it('marks ComfyUI missing GGUF weights as non-retriable hardware_error', async () => {
      await expect(
        localDriver.generate({
          prompt: 'TRIGGER_MISSING_WEIGHTS test',
        })
      ).rejects.toMatchObject({
        category: 'hardware_error',
        retryable: false,
      });
    });

    it('strictly serializes concurrent generate and upscale requests through the mutex', async () => {
      let activeJobs = 0;
      let maxActiveJobs = 0;
      const executionEvents: string[] = [];

      const job1 = localDriver.generate({
        prompt: 'Task 1: Generate job',
        onProgress: async () => {
          activeJobs++;
          maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
          executionEvents.push('task1_start');
          await new Promise((r) => setTimeout(r, 10));
          activeJobs--;
          executionEvents.push('task1_finish');
        },
      });

      const job2 = localDriver.upscale({
        image: FIXTURE_IMAGES.modelSubjectA,
        quality: '2K',
        onProgress: async () => {
          activeJobs++;
          maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
          executionEvents.push('task2_start');
          await new Promise((r) => setTimeout(r, 10));
          activeJobs--;
          executionEvents.push('task2_finish');
        },
      });

      await Promise.all([job1, job2]);

      expect(maxActiveJobs).toBe(1);
      expect(executionEvents).toEqual([
        'task1_start',
        'task1_finish',
        'task2_start',
        'task2_finish',
      ]);
    });
  });
});
