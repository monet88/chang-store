import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StudioDriverError,
  type StudioDriverErrorCode,
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
  isStudioDriverError,
  isRetryableDriverError,
} from '@/services/providers/ImageDriver';
import { InMemoryImageDriverFake } from '@/services/providers/testing/InMemoryImageDriverFake';
import { GeminiImageDriverAdapter } from '@/services/providers/gemini/GeminiImageDriverAdapter';
import { GptImageDriverAdapter } from '@/services/providers/gpt-image/GptImageDriverAdapter';
import { LocalQwenImageDriverAdapter } from '@/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import type { ImageFile } from '@/types';

describe('ImageDriver Contract and InMemoryImageDriverFake Test Suite', () => {
  let fake: InMemoryImageDriverFake;

  beforeEach(() => {
    fake = new InMemoryImageDriverFake();
  });

  describe('StudioDriverError Contract', () => {
    it('sets name, category, status, and message correctly', () => {
      const error = new StudioDriverError('gateway_down', 'Connection dropped', { status: 503 });
      expect(error.name).toBe('StudioDriverError');
      expect(error.category).toBe('gateway_down');
      expect(error.message).toBe('Connection dropped');
      expect(error.status).toBe(503);
      expect(error.retryable).toBe(true);
      expect(error instanceof StudioDriverError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('preserves prototype chain and works with isStudioDriverError type guard', () => {
      const error = new StudioDriverError('unknown', 'Something broke');
      expect(isStudioDriverError(error)).toBe(true);
      expect(isStudioDriverError(new Error('Standard error'))).toBe(false);
      expect(isStudioDriverError(null)).toBe(false);
      expect(isStudioDriverError(undefined)).toBe(false);
      expect(isStudioDriverError({ category: 'unknown' })).toBe(false);
    });

    it('preserves the cause property when provided', () => {
      const original = new Error('Underlying network socket hang up');
      const error = new StudioDriverError('gateway_down', 'Gateway failure', { cause: original });
      expect(error.cause).toBe(original);
    });

    describe('Retryable Rules Invariants', () => {
      it('marks hardware_error as retryable: false by default', () => {
        const oomError = new StudioDriverError('hardware_error', 'CUDA out of memory');
        expect(oomError.retryable).toBe(false);
        expect(isRetryableDriverError(oomError)).toBe(false);
      });

      it('strictly enforces hardware_error as non-retryable even with status >= 500', () => {
        const error = new StudioDriverError('hardware_error', 'ComfyUI process died (SIGSEGV)', { status: 500 });
        expect(error.retryable).toBe(false);
        expect(isRetryableDriverError(error)).toBe(false);
      });

      it('marks rate_limited as retryable: true by default without status', () => {
        const error = new StudioDriverError('rate_limited', 'Rate limit exceeded');
        expect(error.retryable).toBe(true);
        expect(isRetryableDriverError(error)).toBe(true);
      });

      it('marks rate_limited as retryable: true with HTTP 429 status', () => {
        const error = new StudioDriverError('rate_limited', 'Too many requests', { status: 429 });
        expect(error.retryable).toBe(true);
        expect(isRetryableDriverError(error)).toBe(true);
      });

      it('marks gateway_down with status >= 500 as retryable: true', () => {
        const badGateway = new StudioDriverError('gateway_down', 'Bad Gateway', { status: 502 });
        const unavailable = new StudioDriverError('gateway_down', 'Service Unavailable', { status: 503 });
        const gatewayTimeout = new StudioDriverError('gateway_down', 'Gateway Timeout', { status: 504 });

        expect(badGateway.retryable).toBe(true);
        expect(unavailable.retryable).toBe(true);
        expect(gatewayTimeout.retryable).toBe(true);
      });

      it('marks gateway_down with 4xx status as retryable: false', () => {
        const notFound = new StudioDriverError('gateway_down', 'Gateway endpoint not found', { status: 404 });
        expect(notFound.retryable).toBe(false);
      });

      it('marks safety_blocked as retryable: false by default', () => {
        const error = new StudioDriverError('safety_blocked', 'Content violates safety guidelines', { status: 400 });
        expect(error.retryable).toBe(false);
      });

      it('marks cancelled as retryable: false by default', () => {
        const error = new StudioDriverError('cancelled', 'Operation cancelled by caller');
        expect(error.retryable).toBe(false);
      });

      it('marks unknown errors as retryable: false without 5xx status and true with 5xx', () => {
        const unknownPlain = new StudioDriverError('unknown', 'Unrecognized failure');
        expect(unknownPlain.retryable).toBe(false);

        const unknown500 = new StudioDriverError('unknown', 'Internal server error', { status: 500 });
        expect(unknown500.retryable).toBe(true);
      });

      it('allows explicit override of retryable flag regardless of category or status', () => {
        const permanentRateLimit = new StudioDriverError('rate_limited', 'Account banned', { retryable: false });
        expect(permanentRateLimit.retryable).toBe(false);

        const recoverableHardware = new StudioDriverError('hardware_error', 'GPU throttle cooldown complete', { retryable: true });
        expect(recoverableHardware.retryable).toBe(true);
      });
    });
  });

  describe('ImageDriver Contract: General Generation and Asset Properties', () => {
    it('exposes driver id and defaults to gemini if unspecified', () => {
      expect(fake.id).toBe('gemini');
      const qwenFake = new InMemoryImageDriverFake('localQwen');
      expect(qwenFake.id).toBe('localQwen');
    });

    it('generates a single synthetic image by default when count is omitted', async () => {
      const results = await fake.generate({ prompt: 'A stylish silk shirt' });
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].base64).toBeTruthy();
      expect(results[0].mimeType).toBe('image/png');
    });

    it('generates the exact requested number of images when count > 1', async () => {
      const count = 4;
      const results = await fake.generate({ prompt: 'Summer lookbook shot', count });
      expect(results).toHaveLength(count);
      results.forEach((img) => {
        expect(img.base64).toBeTruthy();
        expect(img.mimeType).toBe('image/png');
      });
    });

    it('generateOne returns a single ImageFile object directly', async () => {
      const result = await fake.generateOne({ prompt: 'Fashion portrait close-up' });
      expect(result).toBeDefined();
      expect(result.base64).toBeTruthy();
      expect(result.mimeType).toBe('image/png');
    });

    it('upscale returns an upscaled synthetic ImageFile', async () => {
      const inputImage: ImageFile = { base64: 'synthetic-base-asset', mimeType: 'image/jpeg' };
      const upscaled = await fake.upscale({ image: inputImage, quality: '4K' });
      expect(upscaled).toBeDefined();
      expect(upscaled.base64).toBeTruthy();
      expect(upscaled.mimeType).toBe('image/png');
    });
  });

  describe('Job History Recording Contract', () => {
    it('records dispatched generate jobs with full payload options', async () => {
      expect(fake.dispatchedJobs).toHaveLength(0);

      const job1: GenerateJob = {
        prompt: 'Evening dress studio lighting',
        aspectRatio: '3:4',
        resolution: '2K',
        quality: 'high',
        workflow: 'virtual-try-on',
        model: 'gemini-3.1-flash-image',
        negativePrompt: 'blurry, distorted',
      };
      await fake.generate(job1);

      expect(fake.dispatchedJobs).toHaveLength(1);
      expect(fake.dispatchedJobs[0]).toMatchObject(job1);
    });

    it('records dispatched generateOne calls into dispatchedJobs', async () => {
      await fake.generateOne({ prompt: 'Single item edit' });
      expect(fake.dispatchedJobs).toHaveLength(1);
      expect(fake.dispatchedJobs[0].prompt).toBe('Single item edit');
    });

    it('records semantic reference images with roles in dispatchedJobs', async () => {
      const references: ReferenceRoleImage[] = [
        { image: { base64: 'subj-data', mimeType: 'image/png' }, role: 'subject', label: 'model' },
        { image: { base64: 'garm-data', mimeType: 'image/png' }, role: 'garment', label: 'blazer' },
        { image: { base64: 'style-data', mimeType: 'image/jpeg' }, role: 'style' },
        { image: { base64: 'mask-data', mimeType: 'image/png' }, role: 'mask' },
      ];

      await fake.generate({
        prompt: 'Transfer blazer onto model',
        references,
      });

      expect(fake.dispatchedJobs[0].references).toEqual(references);
    });

    it('records dispatched upscale jobs in dispatchedUpscaleJobs', async () => {
      expect(fake.dispatchedUpscaleJobs).toHaveLength(0);

      const upscaleJob: UpscaleJob = {
        image: { base64: 'input-to-upscale', mimeType: 'image/png' },
        quality: '4K',
      };
      await fake.upscale(upscaleJob);

      expect(fake.dispatchedUpscaleJobs).toHaveLength(1);
      expect(fake.dispatchedUpscaleJobs[0]).toMatchObject(upscaleJob);
    });

    it('clears job history when reset() is called', async () => {
      await fake.generate({ prompt: 'test' });
      await fake.upscale({ image: { base64: 'test', mimeType: 'image/png' } });
      expect(fake.dispatchedJobs).toHaveLength(1);
      expect(fake.dispatchedUpscaleJobs).toHaveLength(1);

      fake.reset();
      expect(fake.dispatchedJobs).toHaveLength(0);
      expect(fake.dispatchedUpscaleJobs).toHaveLength(0);
    });
  });

  describe('Deferral Engine (deferNext) Contract', () => {
    it('holds generate execution in-flight until deferred.resolve() is called', async () => {
      const deferral = fake.deferNext();
      expect(deferral.isPending).toBe(true);

      let resolved = false;
      const promise = fake.generate({ prompt: 'Slow generation' }).then((res) => {
        resolved = true;
        return res;
      });

      await Promise.resolve();
      expect(resolved).toBe(false);
      expect(deferral.isPending).toBe(true);

      deferral.resolve();
      const results = await promise;
      expect(resolved).toBe(true);
      expect(deferral.isPending).toBe(false);
      expect(results).toHaveLength(1);
    });

    it('resolves deferred job with custom ImageFiles if passed to resolve()', async () => {
      const customOutput: ImageFile[] = [
        { base64: 'custom-resolved-image', mimeType: 'image/webp' },
      ];

      const deferral = fake.deferNext();
      const promise = fake.generate({ prompt: 'Custom asset job' });

      deferral.resolve(customOutput);
      const results = await promise;
      expect(results).toEqual(customOutput);
    });

    it('rejects in-flight execution when deferred.reject() is called with StudioDriverError', async () => {
      const deferral = fake.deferNext();
      const promise = fake.generate({ prompt: 'Failing job' });

      const customError = new StudioDriverError('gateway_down', 'Upstream gateway 504 Timeout', { status: 504 });
      deferral.reject(customError);

      await expect(promise).rejects.toBe(customError);
      expect(deferral.isPending).toBe(false);
    });

    it('supports deferral on generateOne and upscale', async () => {
      const deferral1 = fake.deferNext();
      const onePromise = fake.generateOne({ prompt: 'Defer generateOne' });
      deferral1.resolve();
      const oneResult = await onePromise;
      expect(oneResult.base64).toBeTruthy();

      const deferral2 = fake.deferNext();
      const upscalePromise = fake.upscale({ image: { base64: 'img', mimeType: 'image/png' } });
      deferral2.resolve();
      const upscaleResult = await upscalePromise;
      expect(upscaleResult.base64).toBeTruthy();
    });
  });

  describe('AbortSignal Handling Contract', () => {
    it('rejects immediately with StudioDriverError(cancelled) if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = fake.generate({ prompt: 'Do not start', signal: controller.signal });
      await expect(promise).rejects.toSatisfy((err: unknown) => {
        return (
          isStudioDriverError(err) &&
          err.category === 'cancelled' &&
          err.retryable === false
        );
      });
      expect(fake.dispatchedJobs).toHaveLength(0);
    });

    it('rejects an in-flight deferred job immediately when abort() is fired', async () => {
      const controller = new AbortController();
      const deferral = fake.deferNext();

      const promise = fake.generate({ prompt: 'Cancel in-flight', signal: controller.signal });
      expect(deferral.isPending).toBe(true);

      controller.abort();

      await expect(promise).rejects.toSatisfy((err: unknown) => {
        return (
          isStudioDriverError(err) &&
          err.category === 'cancelled' &&
          err.retryable === false
        );
      });
      expect(deferral.isPending).toBe(false);
    });

    it('rejects upscale when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = fake.upscale({
        image: { base64: 'data', mimeType: 'image/png' },
        signal: controller.signal,
      });

      await expect(promise).rejects.toSatisfy((err: unknown) => {
        return isStudioDriverError(err) && err.category === 'cancelled';
      });
    });
  });

  describe('Progress Event Firing (onProgress) Contract', () => {
    it('calls onProgress with descriptive status messages during generate', async () => {
      const messages: string[] = [];
      const onProgress = vi.fn((msg: string) => messages.push(msg));

      await fake.generate({ prompt: 'Track progress', onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(messages.length).toBeGreaterThan(0);
      messages.forEach((msg) => expect(typeof msg).toBe('string'));
    });

    it('calls onProgress during upscale', async () => {
      const messages: string[] = [];
      const onProgress = vi.fn((msg: string) => messages.push(msg));

      await fake.upscale({
        image: { base64: 'track', mimeType: 'image/png' },
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      expect(messages.length).toBeGreaterThan(0);
    });

    it('succeeds gracefully when onProgress is omitted', async () => {
      await expect(fake.generate({ prompt: 'No onProgress' })).resolves.toBeDefined();
      await expect(fake.upscale({ image: { base64: 'x', mimeType: 'image/png' } })).resolves.toBeDefined();
    });
  });

  describe('Canned Responses and Errors Queue Contract', () => {
    it('returns queued canned response on next generate call and reverts to synthetic generation afterwards', async () => {
      const canned: ImageFile[] = [{ base64: 'canned-image-1', mimeType: 'image/jpeg' }];
      fake.queueNextResponse(canned);

      const firstCall = await fake.generate({ prompt: 'First call' });
      expect(firstCall).toEqual(canned);

      const secondCall = await fake.generate({ prompt: 'Second call' });
      expect(secondCall).not.toEqual(canned);
      expect(secondCall[0].base64).toBeTruthy();
    });

    it('throws queued error on next call and allows subsequent call to succeed', async () => {
      const safetyError = new StudioDriverError('safety_blocked', 'Safety violation detected');
      fake.queueNextError(safetyError);

      await expect(fake.generate({ prompt: 'Block this prompt' })).rejects.toBe(safetyError);

      const recoveredCall = await fake.generate({ prompt: 'Clean prompt' });
      expect(recoveredCall).toHaveLength(1);
    });

    it('discards queued responses and errors on reset()', async () => {
      const canned: ImageFile[] = [{ base64: 'discarded-image', mimeType: 'image/png' }];
      fake.queueNextResponse(canned);
      fake.queueNextError(new Error('Discarded error'));

      fake.reset();

      const result = await fake.generate({ prompt: 'After reset' });
      expect(result[0].base64).not.toBe('discarded-image');
    });
  });

  describe('Prototype Method Preservation Contract across all ImageDriver implementations', () => {
    const drivers: [string, () => ImageDriver][] = [
      ['GeminiImageDriverAdapter', () => new GeminiImageDriverAdapter()],
      ['GptImageDriverAdapter', () => new GptImageDriverAdapter()],
      ['LocalQwenImageDriverAdapter', () => new LocalQwenImageDriverAdapter()],
      ['InMemoryImageDriverFake', () => new InMemoryImageDriverFake()],
    ];

    for (const [name, createDriver] of drivers) {
      describe(name, () => {
        it('retains generate, generateOne, and upscale as own or bound properties surviving shallow object spread', () => {
          const driver = createDriver();
          const spread = { ...driver };
          expect(typeof spread.generate).toBe('function');
          expect(typeof spread.generateOne).toBe('function');
          expect(typeof spread.upscale).toBe('function');
        });

        it('allows method extraction without losing this context', async () => {
          const driver = createDriver();
          const { generate, generateOne, upscale } = driver;
          expect(typeof generate).toBe('function');
          expect(typeof generateOne).toBe('function');
          expect(typeof upscale).toBe('function');
        });
      });
    }
  });
});
