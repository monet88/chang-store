import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GeminiImageDriverAdapter,
  DEFAULT_GEMINI_IMAGE_MODEL,
  formatReferenceRoleHeader,
  buildGeminiParts,
  extractInlineImageFromResponse,
  mapGeminiErrorToStudioDriverError,
  type GeminiClientLike,
} from '@/services/providers/gemini/GeminiImageDriverAdapter';
import {
  StudioDriverError,
  isStudioDriverError,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
} from '@/services/providers/ImageDriver';
import type { ImageFile } from '@/types';
import * as requestSlots from '@/utils/request-slots';

interface MockResponseOptions {
  base64?: string;
  mimeType?: string;
  finishReason?: string;
  blockReason?: string;
  text?: string;
  emptyParts?: boolean;
  noInlineData?: boolean;
}

function createSuccessfulResponse(options: MockResponseOptions = {}) {
  if (options.blockReason) {
    return {
      promptFeedback: { blockReason: options.blockReason },
    };
  }

  if (options.emptyParts) {
    return {
      candidates: [
        {
          finishReason: options.finishReason ?? 'STOP',
          content: { parts: [] },
        },
      ],
    };
  }

  if (options.noInlineData) {
    return {
      candidates: [
        {
          finishReason: options.finishReason ?? 'STOP',
          content: { parts: [{ text: 'No image here' }] },
        },
      ],
      text: options.text,
    };
  }

  return {
    candidates: [
      {
        finishReason: options.finishReason ?? 'STOP',
        content: {
          parts: [
            {
              inlineData: {
                data: options.base64 ?? 'synthetic_gemini_base64_data',
                mimeType: options.mimeType ?? 'image/jpeg',
              },
            },
          ],
        },
      },
    ],
  };
}

function createMockGeminiClient(handler?: (params: any) => Promise<any>): GeminiClientLike {
  const defaultHandler = async () => createSuccessfulResponse();
  return {
    models: {
      generateContent: vi.fn().mockImplementation(handler ?? defaultHandler),
    },
  };
}

describe('GeminiImageDriverAdapter Contract & Unit Test Suite', () => {
  let mockClient: GeminiClientLike;
  let adapter: GeminiImageDriverAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = createMockGeminiClient();
    adapter = new GeminiImageDriverAdapter({ client: mockClient });
  });

  describe('Suite 1: ImageDriver Seam Compliance & Basic Asset Generation', () => {
    it('exposes canonical identifier adapter.id === "gemini"', () => {
      expect(adapter.id).toBe('gemini');
    });

    it('generates a single image by default and returns ImageFile[] with base64 and mimeType', async () => {
      const job: GenerateJob = {
        prompt: 'Fashion editorial portrait of a model in a linen shirt',
      };

      const results = await adapter.generate(job);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].base64).toBe('synthetic_gemini_base64_data');
      expect(results[0].mimeType).toBe('image/jpeg');

      expect(mockClient.models.generateContent).toHaveBeenCalledTimes(1);
      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      expect(callArgs.model).toBe(DEFAULT_GEMINI_IMAGE_MODEL);
      expect(callArgs.contents[0].parts[0].text).toContain(job.prompt);
    });

    it('generates multiple images when job.count > 1 via parallel bounded fan-out', async () => {
      let callCount = 0;
      mockClient = createMockGeminiClient(async () => {
        callCount++;
        return createSuccessfulResponse({ base64: `image_b64_${callCount}` });
      });
      adapter = new GeminiImageDriverAdapter({ client: mockClient });

      const job: GenerateJob = {
        prompt: 'Lookbook collection photoshoot',
        count: 3,
      };

      const results = await adapter.generate(job);

      expect(results).toHaveLength(3);
      expect(results[0].base64).toBe('image_b64_1');
      expect(results[1].base64).toBe('image_b64_2');
      expect(results[2].base64).toBe('image_b64_3');
      expect(mockClient.models.generateContent).toHaveBeenCalledTimes(3);
    });

    it('generateOne returns a single unwrapped ImageFile', async () => {
      const job: GenerateJob = {
        prompt: 'Studio portrait with soft lighting',
      };

      const result = await adapter.generateOne(job);

      expect(result).toBeDefined();
      expect(result.base64).toBe('synthetic_gemini_base64_data');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('strictly preserves caller job immutability even if job is frozen', async () => {
      const frozenJob: GenerateJob = Object.freeze({
        prompt: 'Frozen job prompt invariant check',
        count: 1,
        aspectRatio: '3:4',
        resolution: '2K',
      });

      // Calling generate with an Object.freeze() job should NOT throw TypeError
      const results = await adapter.generate(frozenJob);
      expect(results).toHaveLength(1);

      // Verify that caller job was not mutated
      expect(frozenJob.prompt).toBe('Frozen job prompt invariant check');
      expect((frozenJob as any).resolvedDimensions).toBeUndefined();
    });

    it('records dispatched jobs in getRecordedJobs() and clears them on clearRecordedJobs()', async () => {
      expect(adapter.getRecordedJobs()).toHaveLength(0);

      await adapter.generate({ prompt: 'Job 1' });
      await adapter.upscale({ image: { base64: 'source_b64', mimeType: 'image/png' }, quality: '2K' });

      const recorded = adapter.getRecordedJobs();
      expect(recorded).toHaveLength(2);
      expect((recorded[0] as GenerateJob).prompt).toBe('Job 1');
      expect((recorded[1] as UpscaleJob).quality).toBe('2K');

      // Verify getRecordedJobs returns a copy, not the internal array directly
      recorded.pop();
      expect(adapter.getRecordedJobs()).toHaveLength(2);

      adapter.clearRecordedJobs();
      expect(adapter.getRecordedJobs()).toHaveLength(0);
    });

    it('emits onProgress callbacks across the generation lifecycle', async () => {
      const progressMessages: string[] = [];
      const onProgress = vi.fn((msg: string) => progressMessages.push(msg));

      await adapter.generate({
        prompt: 'Model wearing winter coat',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      expect(progressMessages.some((msg) => msg.includes('Gemini:'))).toBe(true);
    });
  });

  describe('Suite 2: Semantic Reference Role Interleaving & Multimodal Prompt Assembly', () => {
    const dummyImage: ImageFile = { base64: 'test_base64_payload', mimeType: 'image/png' };

    it('formats reference role headers accurately for each semantic role', () => {
      const subjectRef: ReferenceRoleImage = { role: 'subject', image: dummyImage, label: 'Alice' };
      const garmentRef: ReferenceRoleImage = { role: 'garment', image: dummyImage };
      const styleRef: ReferenceRoleImage = { role: 'style', image: dummyImage };
      const maskRef: ReferenceRoleImage = { role: 'mask', image: dummyImage };

      expect(formatReferenceRoleHeader(subjectRef)).toContain('SUBJECT REFERENCE (Alice): Primary model');
      expect(formatReferenceRoleHeader(garmentRef)).toContain('GARMENT REFERENCE: Clothing or outfit');
      expect(formatReferenceRoleHeader(styleRef)).toContain('STYLE REFERENCE: Aesthetic style');
      expect(formatReferenceRoleHeader(maskRef)).toContain('MASK REFERENCE: Spatial targeting');
    });

    it('interleaves reference role text parts and inline image parts in exact sequential pairs', async () => {
      const references: ReferenceRoleImage[] = [
        { role: 'subject', image: { base64: 'subject_b64', mimeType: 'image/png' }, label: 'Primary Model' },
        { role: 'garment', image: { base64: 'garment_b64', mimeType: 'image/jpeg' }, label: 'Silk Blouse' },
      ];

      await adapter.generate({
        prompt: 'Dress the model in the silk blouse',
        references,
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      const parts = callArgs.contents[0].parts;

      // Part 0: Subject role header
      expect(parts[0].text).toContain('SUBJECT REFERENCE (Primary Model):');
      // Part 1: Subject image inline data
      expect(parts[1].inlineData.data).toBe('subject_b64');
      expect(parts[1].inlineData.mimeType).toBe('image/png');

      // Part 2: Garment role header
      expect(parts[2].text).toContain('GARMENT REFERENCE (Silk Blouse):');
      // Part 3: Garment image inline data
      expect(parts[3].inlineData.data).toBe('garment_b64');
      expect(parts[3].inlineData.mimeType).toBe('image/jpeg');

      // Part 4: Task instruction text at the end
      expect(parts[4].text).toContain('Dress the model in the silk blouse');
    });

    it('handles legacy flat job.images without references by placing prompt first', async () => {
      await adapter.generate({
        prompt: 'Modify this outfit',
        images: [{ base64: 'legacy_img_b64', mimeType: 'image/png' }],
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      const parts = callArgs.contents[0].parts;

      expect(parts).toHaveLength(2);
      expect(parts[0].text).toContain('Modify this outfit');
      expect(parts[1].inlineData.data).toBe('legacy_img_b64');
    });

    it('appends negative prompt avoidance sentence via appendNegativePrompt', async () => {
      await adapter.generate({
        prompt: 'Fashion model in evening gown',
        negativePrompt: 'blurry, distorted fingers, watermark',
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      const textPart = callArgs.contents[0].parts[0].text;

      expect(textPart).toContain('Fashion model in evening gown');
      expect(textPart).toContain('strictly excluding blurry, distorted fingers, watermark');
    });

    it('strictly preserves Outfit Drape Invariant in prompt text', async () => {
      const outfitDrapeInstruction = 'Never tuck in tops, shirts, blouses, or sweaters. Hemline MUST fall naturally over waist.';
      const job: GenerateJob = {
        prompt: `Dress the subject in casual outfit. ${outfitDrapeInstruction}`,
        negativePrompt: 'wrinkled',
      };

      await adapter.generate(job);

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      const promptText = callArgs.contents[0].parts[0].text;

      expect(promptText).toContain(outfitDrapeInstruction);
      expect(promptText).toContain('strictly excluding wrinkled');
    });
  });

  describe('Suite 3: Aspect Ratio and Resolution Tiers Mapping (1K, 2K, 4K)', () => {
    it.each([
      ['1:1', '1:1'],
      ['3:4', '3:4'],
      ['4:3', '4:3'],
      ['9:16', '9:16'],
      ['16:9', '16:9'],
    ] as const)('maps aspect ratio %s into imageConfig.aspectRatio', async (ratio, expected) => {
      await adapter.generate({
        prompt: 'Portrait',
        aspectRatio: ratio,
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      expect(callArgs.config?.imageConfig?.aspectRatio).toBe(expected);
    });

    it('normalizes "Default" aspect ratio to "1:1"', async () => {
      await adapter.generate({
        prompt: 'Portrait',
        aspectRatio: 'Default',
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      expect(callArgs.config?.imageConfig?.aspectRatio).toBe('1:1');
    });

    it.each([
      ['1K', '1K'],
      ['2K', '2K'],
      ['4K', '4K'],
    ] as const)('maps resolution tier %s into imageConfig.imageSize for supported models', async (res, expected) => {
      await adapter.generate({
        prompt: 'High-res shoot',
        resolution: res,
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      expect(callArgs.config?.imageConfig?.imageSize).toBe(expected);
    });
  });

  describe('Suite 4: Upscale Contract & Re-synthesis', () => {
    it('upscales image using prompt re-synthesis with quality 2K by default', async () => {
      const sourceImage: ImageFile = {
        base64: 'low_res_b64',
        mimeType: 'image/png',
      };

      const result = await adapter.upscale({
        image: sourceImage,
      });

      expect(result).toBeDefined();
      expect(result.base64).toBe('synthetic_gemini_base64_data');

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      expect(callArgs.contents[0].parts[0].inlineData.data).toBe('low_res_b64');
      expect(callArgs.contents[0].parts[1].text).toContain('Upscale this image to 2K resolution');
      expect(callArgs.config?.imageConfig?.imageSize).toBe('2K');
    });

    it('upscales with quality 4K when requested', async () => {
      const sourceImage: ImageFile = {
        base64: 'low_res_b64',
        mimeType: 'image/png',
      };

      await adapter.upscale({
        image: sourceImage,
        quality: '4K',
      });

      const callArgs = (mockClient.models.generateContent as any).mock.calls[0][0];
      expect(callArgs.contents[0].parts[1].text).toContain('Upscale this image to 4K resolution');
      expect(callArgs.config?.imageConfig?.imageSize).toBe('4K');
    });

    it('immediately throws StudioDriverError("cancelled") if upscale job signal is pre-aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('User cancelled upscale'));

      await expect(
        adapter.upscale({
          image: { base64: 'source_b64', mimeType: 'image/png' },
          signal: controller.signal,
        })
      ).rejects.toThrow(StudioDriverError);

      try {
        await adapter.upscale({
          image: { base64: 'source_b64', mimeType: 'image/png' },
          signal: controller.signal,
        });
      } catch (err) {
        expect(isStudioDriverError(err)).toBe(true);
        if (isStudioDriverError(err)) {
          expect(err.category).toBe('cancelled');
          expect(err.retryable).toBe(false);
        }
      }

      expect(mockClient.models.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('Suite 5: Error Normalization & StudioDriverError Mapping', () => {
    it('maps promptFeedback.blockReason to StudioDriverError("safety_blocked", status: 400, retryable: false)', async () => {
      mockClient = createMockGeminiClient(async () =>
        createSuccessfulResponse({ blockReason: 'SAFETY' })
      );
      adapter = new GeminiImageDriverAdapter({ client: mockClient });

      await expect(adapter.generate({ prompt: 'test' })).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('safety_blocked');
        expect(driverErr.status).toBe(400);
        expect(driverErr.retryable).toBe(false);
        return true;
      });
    });

    it('maps finishReason "SAFETY", "RECITATION", "OTHER" to StudioDriverError("safety_blocked")', async () => {
      for (const reason of ['SAFETY', 'RECITATION', 'OTHER']) {
        mockClient = createMockGeminiClient(async () =>
          createSuccessfulResponse({ finishReason: reason })
        );
        adapter = new GeminiImageDriverAdapter({ client: mockClient });

        await expect(adapter.generate({ prompt: 'test' })).rejects.toSatisfy((err) => {
          expect(isStudioDriverError(err)).toBe(true);
          const driverErr = err as StudioDriverError;
          expect(driverErr.category).toBe('safety_blocked');
          expect(driverErr.status).toBe(400);
          expect(driverErr.retryable).toBe(false);
          return true;
        });
      }
    });

    it('maps HTTP 429 / RESOURCE_EXHAUSTED to StudioDriverError("rate_limited", status: 429, retryable: true)', async () => {
      const quotaError = Object.assign(new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric'), {
        status: 429,
      });
      mockClient = createMockGeminiClient(async () => {
        throw quotaError;
      });
      adapter = new GeminiImageDriverAdapter({ client: mockClient });

      await expect(adapter.generate({ prompt: 'test' })).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('rate_limited');
        expect(driverErr.status).toBe(429);
        expect(driverErr.retryable).toBe(true);
        return true;
      });
    });

    it('maps HTTP 500, 502, 503, 504 and UNAVAILABLE to StudioDriverError("gateway_down", retryable: true)', async () => {
      const serverErrors = [
        Object.assign(new Error('503 Service Unavailable'), { status: 503 }),
        Object.assign(new Error('502 Bad Gateway'), { status: 502 }),
        Object.assign(new Error('500 Internal Server Error'), { status: 500 }),
        new Error('UNAVAILABLE: network socket hang up'),
      ];

      for (const serverErr of serverErrors) {
        mockClient = createMockGeminiClient(async () => {
          throw serverErr;
        });
        adapter = new GeminiImageDriverAdapter({ client: mockClient });

        await expect(adapter.generate({ prompt: 'test' })).rejects.toSatisfy((err) => {
          expect(isStudioDriverError(err)).toBe(true);
          const driverErr = err as StudioDriverError;
          expect(driverErr.category).toBe('gateway_down');
          expect(driverErr.retryable).toBe(true);
          return true;
        });
      }
    });

    it('maps HTTP 401, 403, and invalid api key to StudioDriverError("unknown", retryable: false)', async () => {
      const authErrors = [
        Object.assign(new Error('API_KEY_INVALID: API key not valid'), { status: 401 }),
        Object.assign(new Error('Permission denied'), { status: 403 }),
      ];

      for (const authErr of authErrors) {
        mockClient = createMockGeminiClient(async () => {
          throw authErr;
        });
        adapter = new GeminiImageDriverAdapter({ client: mockClient });

        await expect(adapter.generate({ prompt: 'test' })).rejects.toSatisfy((err) => {
          expect(isStudioDriverError(err)).toBe(true);
          const driverErr = err as StudioDriverError;
          expect(driverErr.category).toBe('unknown');
          expect(driverErr.retryable).toBe(false);
          return true;
        });
      }
    });

    it('maps NO_IMAGE, text-only response, or missing content to StudioDriverError("unknown")', async () => {
      mockClient = createMockGeminiClient(async () =>
        createSuccessfulResponse({ noInlineData: true, text: 'I cannot create that image' })
      );
      adapter = new GeminiImageDriverAdapter({ client: mockClient });

      await expect(adapter.generate({ prompt: 'test' })).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('unknown');
        expect(driverErr.retryable).toBe(false);
        return true;
      });
    });
  });

  describe('Suite 6: Request Slot Bounding & Cancellation Lifecycle', () => {
    it('executes generation within withImageRequestSlot', async () => {
      const slotSpy = vi.spyOn(requestSlots, 'withImageRequestSlot');

      await adapter.generate({ prompt: 'Slot check' });

      expect(slotSpy).toHaveBeenCalled();
    });

    it('immediately rejects with StudioDriverError("cancelled") on pre-aborted signal without calling client', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        adapter.generate({ prompt: 'Pre-aborted test', signal: controller.signal })
      ).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('cancelled');
        expect(driverErr.retryable).toBe(false);
        return true;
      });

      expect(mockClient.models.generateContent).not.toHaveBeenCalled();
    });

    it('cancels mid-flight if signal is aborted during network call', async () => {
      const controller = new AbortController();
      mockClient = createMockGeminiClient(async () => {
        controller.abort();
        return createSuccessfulResponse();
      });
      adapter = new GeminiImageDriverAdapter({ client: mockClient });

      await expect(
        adapter.generate({ prompt: 'Mid-flight abort test', signal: controller.signal })
      ).rejects.toSatisfy((err) => {
        expect(isStudioDriverError(err)).toBe(true);
        const driverErr = err as StudioDriverError;
        expect(driverErr.category).toBe('cancelled');
        expect(driverErr.retryable).toBe(false);
        return true;
      });
    });
  });
});
