import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GptImageDriverAdapter,
  mapGptImageErrorToStudioDriverError,
  type GptImageClientLike,
} from '@/services/providers/gpt-image/GptImageDriverAdapter';
import {
  StudioDriverError,
  isStudioDriverError,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
} from '@/services/providers/ImageDriver';
import type { ImageFile } from '@/types';
import * as requestSlots from '@/utils/request-slots';
import { ProviderApiError } from '@/services/providers/shared/ProviderApiError';

describe('GptImageDriverAdapter Contract & Unit Test Suite', () => {
  let mockClient: GptImageClientLike;
  let adapter: GptImageDriverAdapter;

  const standardSizes = ['1024x1024', '1536x1024', '1024x1536', '1080x1920'] as const;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = {
      generateImage: vi.fn().mockResolvedValue([
        { base64: 'synthetic_gpt_gen_base64', mimeType: 'image/png' },
      ]),
      editImage: vi.fn().mockResolvedValue([
        { base64: 'synthetic_gpt_edit_base64', mimeType: 'image/png' },
      ]),
    };
    adapter = new GptImageDriverAdapter({
      client: mockClient,
      model: 'gpt-image-2',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      sizeOptions: standardSizes,
    });
  });

  describe('Suite 1: ImageDriver Seam Compliance & Basic Asset Generation', () => {
    it('exposes canonical identifier adapter.id === "gptImage"', () => {
      expect(adapter.id).toBe('gptImage');
    });

    it('generates text-to-image via generateImage when no input images or references', async () => {
      const job: GenerateJob = {
        prompt: 'Minimalist runway model in silk slip dress',
      };

      const results = await adapter.generate(job);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].base64).toBe('synthetic_gpt_gen_base64');
      expect(results[0].mimeType).toBe('image/png');

      expect(mockClient.generateImage).toHaveBeenCalledTimes(1);
      expect(mockClient.editImage).not.toHaveBeenCalled();

      const callArgs = (mockClient.generateImage as any).mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-image-2');
      expect(callArgs.prompt).toBe(job.prompt);
      expect(callArgs.size).toBe('1024x1024'); // default 1:1
    });

    it('generates multiple images when job.count > 1 via bounded parallel fan-out', async () => {
      let callCount = 0;
      mockClient.generateImage = vi.fn().mockImplementation(async () => {
        callCount++;
        return [{ base64: `gpt_gen_b64_${callCount}`, mimeType: 'image/png' }];
      });

      const job: GenerateJob = {
        prompt: 'Fashion lookbook collection',
        count: 3,
      };

      const results = await adapter.generate(job);

      expect(results).toHaveLength(3);
      expect(results[0].base64).toBe('gpt_gen_b64_1');
      expect(results[1].base64).toBe('gpt_gen_b64_2');
      expect(results[2].base64).toBe('gpt_gen_b64_3');
      expect(mockClient.generateImage).toHaveBeenCalledTimes(3);
    });

    it('generateOne returns a single unwrapped ImageFile', async () => {
      const job: GenerateJob = {
        prompt: 'Studio portrait with clean backdrop',
      };

      const result = await adapter.generateOne(job);

      expect(result).toBeDefined();
      expect(result.base64).toBe('synthetic_gpt_gen_base64');
      expect(result.mimeType).toBe('image/png');
    });

    it('strictly preserves caller job immutability even if job is frozen', async () => {
      const frozenJob: GenerateJob = Object.freeze({
        prompt: 'Frozen job prompt invariant check',
        count: 1,
        aspectRatio: '3:4',
      });

      const results = await adapter.generate(frozenJob);
      expect(results).toHaveLength(1);

      expect(frozenJob.prompt).toBe('Frozen job prompt invariant check');
      expect((frozenJob as any).resolvedDimensions).toBeUndefined();
    });

    it('records dispatched jobs with resolvedDimensions and clears them on clearRecordedJobs()', async () => {
      expect(adapter.getRecordedJobs()).toHaveLength(0);

      await adapter.generate({ prompt: 'Job 1', aspectRatio: '3:4' });
      await adapter.upscale({ image: { base64: 'source_b64', mimeType: 'image/png' }, quality: '4K' });

      const recorded = adapter.getRecordedJobs();
      expect(recorded).toHaveLength(2);
      expect((recorded[0] as GenerateJob).prompt).toBe('Job 1');
      expect((recorded[0] as GenerateJob).resolvedDimensions).toBe('1024x1536');
      expect((recorded[1] as UpscaleJob).quality).toBe('4K');

      adapter.clearRecordedJobs();
      expect(adapter.getRecordedJobs()).toHaveLength(0);
    });

    it('emits onProgress callbacks across the generation lifecycle', async () => {
      const progressMessages: string[] = [];
      const onProgress = vi.fn((msg: string) => progressMessages.push(msg));

      await adapter.generate({
        prompt: 'Model wearing wool coat',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      expect(progressMessages.some((msg) => msg.includes('GPT:'))).toBe(true);
    });
  });

  describe('Suite 2: Aspect Ratio to Pixel Mapping (resolveSizeForRatio)', () => {
    it.each([
      ['1:1', '1024x1024'],
      ['3:4', '1024x1536'],
      ['4:3', '1536x1024'],
      ['9:16', '1080x1920'],
      ['Default', '1024x1024'],
    ] as const)('maps aspect ratio %s into pixel dimension %s', async (ratio, expectedSize) => {
      await adapter.generate({
        prompt: 'Ratio test',
        aspectRatio: ratio,
      });

      const callArgs = (mockClient.generateImage as any).mock.calls[0][0];
      expect(callArgs.size).toBe(expectedSize);
    });
  });

  describe('Suite 3: Negative Prompt Compilation & Reference Handling', () => {
    const dummyImage: ImageFile = { base64: 'dummy_b64', mimeType: 'image/png' };

    it('routes to editImage when job.references is provided', async () => {
      const references: ReferenceRoleImage[] = [
        { role: 'subject', image: { base64: 'subject_b64', mimeType: 'image/png' }, label: 'Model' },
        { role: 'garment', image: { base64: 'garment_b64', mimeType: 'image/png' }, label: 'Leather Jacket' },
      ];

      await adapter.generate({
        prompt: 'Transfer the jacket to the model',
        references,
      });

      expect(mockClient.editImage).toHaveBeenCalledTimes(1);
      expect(mockClient.generateImage).not.toHaveBeenCalled();

      const callArgs = (mockClient.editImage as any).mock.calls[0][0];
      expect(callArgs.images).toHaveLength(2);
      expect(callArgs.images[0].base64).toBe('subject_b64');
      expect(callArgs.images[1].base64).toBe('garment_b64');

      // Reference roles are clearly indicated in the prompt
      expect(callArgs.prompt).toContain('SUBJECT');
      expect(callArgs.prompt).toContain('GARMENT');
      expect(callArgs.prompt).toContain('Transfer the jacket to the model');
    });

    it('routes to editImage when job.images is provided directly', async () => {
      await adapter.generate({
        prompt: 'Edit this outfit',
        images: [{ base64: 'direct_img_b64', mimeType: 'image/png' }],
      });

      expect(mockClient.editImage).toHaveBeenCalledTimes(1);
      const callArgs = (mockClient.editImage as any).mock.calls[0][0];
      expect(callArgs.images).toHaveLength(1);
      expect(callArgs.images[0].base64).toBe('direct_img_b64');
    });

    it('appends negative prompt via appendNegativePrompt while preserving prompt body', async () => {
      await adapter.generate({
        prompt: 'Fashion photoshoot in studio',
        negativePrompt: 'blurry, distorted hands',
      });

      const callArgs = (mockClient.generateImage as any).mock.calls[0][0];
      expect(callArgs.prompt).toContain('Fashion photoshoot in studio');
      expect(callArgs.prompt).toContain('strictly excluding blurry, distorted hands');
    });

    it('strictly preserves Outfit Drape Invariant in prompt text', async () => {
      const outfitDrapeInstruction = 'Ensure tops remain untucked outside waistband with clean hemline.';
      await adapter.generate({
        prompt: `Dress the subject in denim. ${outfitDrapeInstruction}`,
        negativePrompt: 'tucked, folded',
      });

      const callArgs = (mockClient.generateImage as any).mock.calls[0][0];
      expect(callArgs.prompt).toContain(outfitDrapeInstruction);
      expect(callArgs.prompt).toContain('strictly excluding tucked, folded');
    });

    it('rejects when input image count exceeds maximum allowed limit (> 10)', async () => {
      const elevenImages: ImageFile[] = Array.from({ length: 11 }, (_, i) => ({
        base64: `img_${i}`,
        mimeType: 'image/png',
      }));

      mockClient.editImage = vi.fn().mockImplementation(async () => {
        throw new ProviderApiError('error.provider.tooManyImages', 400, 'too_many_images');
      });

      await expect(
        adapter.generate({
          prompt: 'Too many images',
          images: elevenImages,
        })
      ).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('unknown');
        expect(driverErr.status).toBe(400);
        expect(driverErr.retryable).toBe(false);
        return true;
      });
    });
  });

  describe('Suite 4: Upscale via Preservation Edit', () => {
    it('executes preservation edit with PROVIDER_UPSCALE_PROMPTS and high quality', async () => {
      const sourceImage: ImageFile = {
        base64: 'source_to_upscale',
        mimeType: 'image/png',
      };

      const result = await adapter.upscale({
        image: sourceImage,
        quality: '2K',
      });

      expect(result).toBeDefined();
      expect(result.base64).toBe('synthetic_gpt_edit_base64');

      expect(mockClient.editImage).toHaveBeenCalledTimes(1);
      const callArgs = (mockClient.editImage as any).mock.calls[0][0];
      expect(callArgs.images[0].base64).toBe('source_to_upscale');
      expect(callArgs.prompt).toContain('Upscale this image to 2K resolution');
      expect(callArgs.size).toBe('1024x1024'); // default size for upscale
      expect(callArgs.quality).toBe('high');
    });

    it('immediately throws StudioDriverError("cancelled") if upscale job signal is pre-aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        adapter.upscale({
          image: { base64: 'source_b64', mimeType: 'image/png' },
          signal: controller.signal,
        })
      ).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('cancelled');
        expect(driverErr.retryable).toBe(false);
        return true;
      });

      expect(mockClient.editImage).not.toHaveBeenCalled();
    });
  });

  describe('Suite 5: Concurrency Slot Management (withImageRequestSlot)', () => {
    it('executes generate and upscale within withImageRequestSlot', async () => {
      const slotSpy = vi.spyOn(requestSlots, 'withImageRequestSlot');

      await adapter.generate({ prompt: 'Slot test' });
      expect(slotSpy).toHaveBeenCalled();

      slotSpy.mockClear();
      await adapter.upscale({ image: { base64: 'b64', mimeType: 'image/png' } });
      expect(slotSpy).toHaveBeenCalled();
    });

    it('immediately rejects on pre-aborted signal without calling client', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        adapter.generate({ prompt: 'Pre-abort', signal: controller.signal })
      ).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('cancelled');
        expect(driverErr.retryable).toBe(false);
        return true;
      });

      expect(mockClient.generateImage).not.toHaveBeenCalled();
    });
  });

  describe('Suite 6: Error Normalization & StudioDriverError Mapping', () => {
    it('maps content policy violation / safety error to StudioDriverError("safety_blocked", status: 400, retryable: false)', async () => {
      mockClient.generateImage = vi.fn().mockRejectedValue(
        new ProviderApiError('Your request was rejected due to content policy violation', 400, 'content_policy_violation')
      );

      await expect(adapter.generate({ prompt: 'Policy test' })).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('safety_blocked');
        expect(driverErr.status).toBe(400);
        expect(driverErr.retryable).toBe(false);
        return true;
      });
    });

    it('maps HTTP 429 / rate_limit_exceeded to StudioDriverError("rate_limited", status: 429, retryable: true)', async () => {
      mockClient.generateImage = vi.fn().mockRejectedValue(
        new ProviderApiError('Rate limit exceeded', 429, 'rate_limit_exceeded')
      );

      await expect(adapter.generate({ prompt: 'Rate limit test' })).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('rate_limited');
        expect(driverErr.status).toBe(429);
        expect(driverErr.retryable).toBe(true);
        return true;
      });
    });

    it('maps HTTP 500, 502, 503, 504 to StudioDriverError("gateway_down", retryable: true)', async () => {
      const serverStatuses = [500, 502, 503, 504];

      for (const status of serverStatuses) {
        mockClient.generateImage = vi.fn().mockRejectedValue(
          new ProviderApiError(`Gateway error ${status}`, status, 'server_error')
        );

        await expect(adapter.generate({ prompt: 'Gateway test' })).rejects.toSatisfy((err) => {
          expect(isStudioDriverError(err)).toBe(true);
          const driverErr = err as StudioDriverError;
          expect(driverErr.category).toBe('gateway_down');
          expect(driverErr.status).toBe(status);
          expect(driverErr.retryable).toBe(true);
          return true;
        });
      }
    });

    it('maps network failures (fetch failed, econnrefused) to StudioDriverError("gateway_down", retryable: true)', async () => {
      const networkErrors = [
        new Error('fetch failed'),
        new Error('connect ECONNREFUSED 127.0.0.1:443'),
        new Error('Network error: socket hang up'),
      ];

      for (const netErr of networkErrors) {
        mockClient.generateImage = vi.fn().mockRejectedValue(netErr);

        await expect(adapter.generate({ prompt: 'Network test' })).rejects.toSatisfy((err) => {
          expect(isStudioDriverError(err)).toBe(true);
          const driverErr = err as StudioDriverError;
          expect(driverErr.category).toBe('gateway_down');
          expect(driverErr.status).toBe(503);
          expect(driverErr.retryable).toBe(true);
          return true;
        });
      }
    });

    it('maps HTTP 401, 403, and missing/invalid api key to StudioDriverError("unknown", retryable: false)', async () => {
      const authErrors = [
        new ProviderApiError('Missing API key', 401, 'missing_api_key'),
        new ProviderApiError('Invalid API key', 401, 'invalid_api_key'),
        new ProviderApiError('Model not allowed', 403, 'model_not_allowed'),
      ];

      for (const authErr of authErrors) {
        mockClient.generateImage = vi.fn().mockRejectedValue(authErr);

        await expect(adapter.generate({ prompt: 'Auth test' })).rejects.toSatisfy((err) => {
          expect(isStudioDriverError(err)).toBe(true);
          const driverErr = err as StudioDriverError;
          expect(driverErr.category).toBe('unknown');
          expect(driverErr.retryable).toBe(false);
          return true;
        });
      }
    });

    it('maps empty results or unhandled errors to StudioDriverError("unknown", retryable: false)', async () => {
      mockClient.generateImage = vi.fn().mockResolvedValue([]);

      await expect(adapter.generateOne({ prompt: 'Empty results' })).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('unknown');
        expect(driverErr.retryable).toBe(false);
        return true;
      });
    });
  });
});
