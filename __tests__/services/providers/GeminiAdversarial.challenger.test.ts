import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function createMockImage(id: string = '1', role?: string): ImageFile {
  return {
    base64: `base64_data_${id}_${role ?? 'img'}`,
    mimeType: 'image/png',
  };
}

function createSuccessCandidate(id: string = '1') {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              inlineData: {
                data: `synthetic_gemini_output_${id}`,
                mimeType: 'image/png',
              },
            },
          ],
        },
      },
    ],
  };
}

describe('Milestone 3 Challenger: GeminiImageDriverAdapter Adversarial Verification', () => {
  let unhandledRejections: any[] = [];
  const unhandledListener = (err: any) => {
    unhandledRejections.push(err);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    unhandledRejections = [];
    process.on('unhandledRejection', unhandledListener);
  });

  afterEach(() => {
    process.removeListener('unhandledRejection', unhandledListener);
    expect(unhandledRejections).toHaveLength(0);
  });

  // =========================================================================
  // SUITE 1: Extreme Reference Permutations & Interleaving Invariants
  // =========================================================================
  describe('Suite 1: Extreme Reference Permutations & Interleaving Invariants', () => {
    it('handles 0 references gracefully with pure text prompt', () => {
      const job: GenerateJob = {
        prompt: 'Fashion photoshoot of red silk evening gown',
        references: [],
      };
      const parts = buildGeminiParts(job);
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({
        text: 'Fashion photoshoot of red silk evening gown',
      });
    });

    it('handles 0 references but legacy images array with prompt prepended', () => {
      const job: GenerateJob = {
        prompt: 'Model wearing jacket',
        images: [createMockImage('a'), createMockImage('b')],
      };
      const parts = buildGeminiParts(job);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({ text: 'Model wearing jacket' });
      expect((parts[1] as any).inlineData.data).toBe('base64_data_a_img');
      expect((parts[2] as any).inlineData.data).toBe('base64_data_b_img');
    });

    it('handles 10 references with mixed roles and verifies exact interleaved sequence', () => {
      const roles: Array<ReferenceRoleImage['role']> = [
        'subject',
        'garment',
        'style',
        'mask',
        'subject',
        'garment',
        'garment',
        'style',
        'mask',
        'subject',
      ];

      const references: ReferenceRoleImage[] = roles.map((role, idx) => ({
        role,
        image: createMockImage(`${idx + 1}`, role),
        label: `layer_${idx + 1}`,
      }));

      const job: GenerateJob = {
        prompt: 'Generate complete editorial look',
        references,
      };

      const parts = buildGeminiParts(job);
      // 10 references * 2 parts (header text + inlineData) + 1 task prompt = 21 parts
      expect(parts).toHaveLength(21);

      // Verify each interleaved pair preserves exact role and image data in order
      for (let i = 0; i < 10; i++) {
        const textPart = parts[i * 2] as { text: string };
        const imgPart = parts[i * 2 + 1] as { inlineData: { data: string; mimeType: string } };

        expect(textPart.text).toContain(roles[i].toUpperCase());
        expect(textPart.text).toContain(`(layer_${i + 1})`);
        expect(imgPart.inlineData.data).toBe(`base64_data_${i + 1}_${roles[i]}`);
      }

      // Final part is the task prompt
      expect(parts[20]).toEqual({ text: 'Generate complete editorial look' });
    });

    it('handles duplicate roles without collisions or label drops', () => {
      const references: ReferenceRoleImage[] = [
        { role: 'garment', image: createMockImage('top', 'garment'), label: 'Silk Blouse' },
        { role: 'garment', image: createMockImage('bottom', 'garment'), label: 'Pleated Skirt' },
        { role: 'garment', image: createMockImage('coat', 'garment'), label: 'Wool Trench Coat' },
      ];

      const job: GenerateJob = {
        prompt: 'Fashion layering composite',
        references,
      };

      const parts = buildGeminiParts(job);
      expect(parts).toHaveLength(7); // 3 * 2 + 1
      expect((parts[0] as any).text).toContain('GARMENT REFERENCE (Silk Blouse):');
      expect((parts[2] as any).text).toContain('GARMENT REFERENCE (Pleated Skirt):');
      expect((parts[4] as any).text).toContain('GARMENT REFERENCE (Wool Trench Coat):');
    });

    it('handles edge-case labels: undefined, empty string, and special characters', () => {
      const references: ReferenceRoleImage[] = [
        { role: 'subject', image: createMockImage('1', 'subject') }, // undefined label
        { role: 'garment', image: createMockImage('2', 'garment'), label: '' }, // empty label
        {
          role: 'style',
          image: createMockImage('3', 'style'),
          label: 'Mood: 90s Grunge (grainy / high-contrast)',
        }, // special chars
      ];

      const parts = buildGeminiParts({
        prompt: 'Studio shot',
        references,
      });

      expect(parts).toHaveLength(7);
      // undefined label -> no parens
      expect((parts[0] as any).text).toBe(
        'SUBJECT REFERENCE: Primary model/person/entity. Preserve identity, facial features, body proportions, and pose unless modified by instructions.'
      );
      // empty string label -> no parens
      expect((parts[2] as any).text).toBe(
        'GARMENT REFERENCE: Clothing or outfit to transfer. Extract design, silhouette, texture, pattern, and construction details.'
      );
      // special chars preserved
      expect((parts[4] as any).text).toBe(
        'STYLE REFERENCE (Mood: 90s Grunge (grainy / high-contrast)): Aesthetic style, lighting, color palette, and visual mood reference.'
      );
    });

    it('sends references when present and never sends both references and images', () => {
      const references: ReferenceRoleImage[] = [
        { role: 'subject', image: createMockImage('s', 'subject'), label: 'Model' },
        { role: 'garment', image: createMockImage('g', 'garment'), label: 'Dress' },
      ];
      const images: ImageFile[] = [createMockImage('un1'), createMockImage('un2')];

      const parts = buildGeminiParts({
        prompt: 'Composite workflow',
        references,
        images,
      });

      // (2 * 2) references + 1 prompt = 5 parts (never sends both references and images)
      expect(parts).toHaveLength(5);
      expect((parts[0] as any).text).toContain('SUBJECT REFERENCE');
      expect((parts[1] as any).inlineData.data).toBe('base64_data_s_subject');
      expect((parts[2] as any).text).toContain('GARMENT REFERENCE');
      expect((parts[3] as any).inlineData.data).toBe('base64_data_g_garment');
      expect((parts[4] as any).text).toBe('Composite workflow');
    });

    it('strictly preserves Outfit Drape Invariant with references and negative prompt', () => {
      const references: ReferenceRoleImage[] = [
        { role: 'garment', image: createMockImage('shirt', 'garment'), label: 'Linen Top' },
      ];

      const promptWithDrapeInvariant =
        'Fashion model wearing linen shirt, untucked outside waistband, and relaxed shorts';

      const parts = buildGeminiParts({
        prompt: promptWithDrapeInvariant,
        negativePrompt: 'blurry, distorted',
        references,
      });

      const promptPart = parts[parts.length - 1] as { text: string };
      // Verify the invariant from the prompt compiler is strictly preserved
      expect(promptPart.text).toContain('untucked outside waistband');
      // Verify avoid sentence from negative prompt builder is appended
      expect(promptPart.text).toContain(
        'Ensure the output contains only the intended subject and scene, strictly excluding blurry, distorted.'
      );
    });
  });

  // =========================================================================
  // SUITE 2: Tricky Safety Blocks & Malformed API Responses
  // =========================================================================
  describe('Suite 2: Tricky Safety Blocks & Malformed API Responses', () => {
    let mockClient: GeminiClientLike;
    let adapter: GeminiImageDriverAdapter;

    beforeEach(() => {
      mockClient = {
        models: {
          generateContent: vi.fn(),
        },
      };
      adapter = new GeminiImageDriverAdapter({ client: mockClient });
    });

    it('translates finishReason "SAFETY" into non-retriable StudioDriverError with status 400', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('safety_blocked');
      expect(error.status).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.safetyBlock:SAFETY');
    });

    it('translates finishReason "RECITATION" into non-retriable safety_blocked StudioDriverError', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [{ finishReason: 'RECITATION', content: { parts: [] } }],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('safety_blocked');
      expect(error.status).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.safetyBlock:RECITATION');
    });

    it('translates finishReason "OTHER" into non-retriable safety_blocked StudioDriverError', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [{ finishReason: 'OTHER', content: { parts: [] } }],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('safety_blocked');
      expect(error.status).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.safetyBlock:OTHER');
    });

    it('translates promptFeedback.blockReason "BLOCKLIST" / "PROHIBITED_CONTENT" into safety_blocked', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        promptFeedback: { blockReason: 'PROHIBITED_CONTENT' },
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('safety_blocked');
      expect(error.status).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.safetyBlock:PROHIBITED_CONTENT');
    });

    it('translates empty candidates array into non-retriable safety_blocked StudioDriverError', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('safety_blocked');
      expect(error.status).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.safetyBlock:no_candidates');
    });

    it('translates text-only response (model refusal text) into non-retriable unknown error', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        text: 'I cannot generate images of real public figures.',
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: 'I cannot generate images of real public figures.' }] },
          },
        ],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('unknown');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.textOnlyResponse:I cannot generate images');
    });

    it('translates candidate with no inlineData parts into non-retriable unknown error', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: 'No image here' }] },
          },
        ],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('unknown');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.noImageInParts');
    });

    it('translates candidate with completely empty parts array into non-retriable unknown error', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [] },
          },
        ],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('unknown');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.noContent');
    });

    it('translates candidate with finishReason NO_IMAGE into non-retriable unknown error', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [
          {
            finishReason: 'NO_IMAGE',
            content: { parts: [] },
          },
        ],
      });

      const error = await adapter.generate({ prompt: 'test' }).catch((e) => e);
      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('unknown');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('error.api.noImageGenerated');
    });

    it('translates raw SDK safety error strings into safety_blocked StudioDriverError', () => {
      const err = new Error(
        'User prompt blocked by Gemini safety ratings: HARM_CATEGORY_DANGEROUS_CONTENT'
      );
      const mapped = mapGeminiErrorToStudioDriverError(err);
      expect(mapped.category).toBe('safety_blocked');
      expect(mapped.status).toBe(400);
      expect(mapped.retryable).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 3: AbortSignal Race Conditions & Cancellation Guarantees
  // =========================================================================
  describe('Suite 3: AbortSignal Race Conditions & Cancellation Guarantees', () => {
    let mockClient: GeminiClientLike;
    let adapter: GeminiImageDriverAdapter;

    beforeEach(() => {
      mockClient = {
        models: {
          generateContent: vi.fn(),
        },
      };
      adapter = new GeminiImageDriverAdapter({ client: mockClient });
    });

    it('rejects immediately on pre-aborted signal without invoking client', async () => {
      const controller = new AbortController();
      controller.abort(new Error('Pre-flight user cancel'));

      const error = await adapter
        .generate({
          prompt: 'test',
          signal: controller.signal,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('cancelled');
      expect(error.retryable).toBe(false);
      expect(mockClient.models.generateContent).not.toHaveBeenCalled();
    });

    it('rejects with cancelled error when signal is aborted mid-flight during network transmission', async () => {
      const controller = new AbortController();

      (mockClient.models.generateContent as any).mockImplementation(async () => {
        // Simulate in-flight abort
        controller.abort(new Error('User cancelled during download'));
        return createSuccessCandidate('mid-abort');
      });

      const error = await adapter
        .generate({
          prompt: 'test',
          signal: controller.signal,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('cancelled');
      expect(error.retryable).toBe(false);
    });

    it('upscale rejects immediately on pre-aborted signal without invoking client', async () => {
      const controller = new AbortController();
      controller.abort();

      const error = await adapter
        .upscale({
          image: createMockImage('upscale-pre'),
          signal: controller.signal,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('cancelled');
      expect(error.retryable).toBe(false);
      expect(mockClient.models.generateContent).not.toHaveBeenCalled();
    });

    it('upscale rejects with cancelled error when aborted mid-flight', async () => {
      const controller = new AbortController();

      (mockClient.models.generateContent as any).mockImplementation(async () => {
        controller.abort();
        return createSuccessCandidate('upscale-mid');
      });

      const error = await adapter
        .upscale({
          image: createMockImage('upscale-mid'),
          signal: controller.signal,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('cancelled');
      expect(error.retryable).toBe(false);
    });

    it('handles mid-flight abort during multi-image fan-out without unhandled rejections', async () => {
      const controller = new AbortController();
      let callCount = 0;

      (mockClient.models.generateContent as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          controller.abort(new Error('User clicked cancel mid-batch'));
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return createSuccessCandidate(`${callCount}`);
      });

      const error = await adapter
        .generate({
          prompt: 'Batch of 4 images',
          count: 4,
          signal: controller.signal,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('cancelled');
      expect(error.retryable).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: Batch Count Fan-Out, Slot Bounding & Partial Failures
  // =========================================================================
  describe('Suite 4: Batch Count Fan-Out, Slot Bounding & Partial Failures', () => {
    let mockClient: GeminiClientLike;
    let adapter: GeminiImageDriverAdapter;

    beforeEach(() => {
      mockClient = {
        models: {
          generateContent: vi.fn(),
        },
      };
      adapter = new GeminiImageDriverAdapter({ client: mockClient });
    });

    it('successfully processes count = 12 spanning 2 batches (10 + 2) in exact order', async () => {
      let callIndex = 0;
      (mockClient.models.generateContent as any).mockImplementation(async () => {
        callIndex++;
        return createSuccessCandidate(`${callIndex}`);
      });

      const results = await adapter.generate({
        prompt: 'Fashion lookbook collection',
        count: 12,
      });

      expect(results).toHaveLength(12);
      expect(mockClient.models.generateContent).toHaveBeenCalledTimes(12);
      expect(results[0].base64).toBe('synthetic_gemini_output_1');
      expect(results[11].base64).toBe('synthetic_gemini_output_12');
    });

    it('strictly bounds concurrent in-flight requests to <= DEFAULT_MAX_CONCURRENCY (10)', async () => {
      let activeConcurrency = 0;
      let peakConcurrency = 0;

      (mockClient.models.generateContent as any).mockImplementation(async () => {
        activeConcurrency++;
        if (activeConcurrency > peakConcurrency) {
          peakConcurrency = activeConcurrency;
        }
        // Small delay to ensure overlap
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeConcurrency--;
        return createSuccessCandidate('peak');
      });

      const results = await adapter.generate({
        prompt: 'Stress test concurrency',
        count: 15,
      });

      expect(results).toHaveLength(15);
      expect(peakConcurrency).toBeLessThanOrEqual(10);
    });

    it('rejects cleanly on partial failure (429 rate limit) during fan-out without unhandled rejections', async () => {
      let invocation = 0;
      (mockClient.models.generateContent as any).mockImplementation(async () => {
        invocation++;
        if (invocation === 3) {
          const rateLimitErr: any = new Error('Resource has been exhausted (e.g. check quota)');
          rateLimitErr.status = 429;
          throw rateLimitErr;
        }
        return createSuccessCandidate(`${invocation}`);
      });

      const error = await adapter
        .generate({
          prompt: 'Batch with partial error',
          count: 5,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('rate_limited');
      expect(error.status).toBe(429);
      expect(error.retryable).toBe(true);
    });

    it('rejects cleanly on partial failure (503 Service Unavailable) during fan-out', async () => {
      let invocation = 0;
      (mockClient.models.generateContent as any).mockImplementation(async () => {
        invocation++;
        if (invocation === 2) {
          const serverErr: any = new Error('503 Service Unavailable: upstream timeout');
          serverErr.status = 503;
          throw serverErr;
        }
        return createSuccessCandidate(`${invocation}`);
      });

      const error = await adapter
        .generate({
          prompt: 'Batch with 503 error',
          count: 4,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('gateway_down');
      expect(error.status).toBe(503);
      expect(error.retryable).toBe(true);
    });

    it('verifies generateOne works with complex references and unwraps single ImageFile', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue(
        createSuccessCandidate('single-unwrap')
      );

      const job: GenerateJob = {
        prompt: 'Editorial single image',
        references: [
          { role: 'subject', image: createMockImage('sub', 'subject'), label: 'Model' },
          { role: 'style', image: createMockImage('sty', 'style'), label: 'Studio Noir' },
        ],
      };

      const result = await adapter.generateOne(job);
      expect(result.base64).toBe('synthetic_gemini_output_single-unwrap');
      expect(result.mimeType).toBe('image/png');
    });

    it('guarantees caller job immutability even when caller job is frozen', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue(
        createSuccessCandidate('immutable')
      );

      const job: GenerateJob = Object.freeze({
        prompt: 'Frozen job input',
        count: 2,
        references: Object.freeze([
          Object.freeze({
            role: 'garment' as const,
            image: Object.freeze(createMockImage('frozen-g', 'garment')),
          }),
        ]) as any,
      });

      // Should execute without throwing TypeError: Cannot add property ... to non-extensible object
      const results = await adapter.generate(job);
      expect(results).toHaveLength(2);

      const recorded = adapter.getRecordedJobs();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].prompt).toBe('Frozen job input');
    });
  });

  // =========================================================================
  // SUITE 5: Non-standard Roles, Untyped Errors, Upscale Safety & Multi-Batch Abort
  // =========================================================================
  describe('Suite 5: Non-standard Roles, Untyped Errors, Upscale Safety & Multi-Batch Abort', () => {
    let mockClient: GeminiClientLike;
    let adapter: GeminiImageDriverAdapter;

    beforeEach(() => {
      mockClient = {
        models: {
          generateContent: vi.fn(),
        },
      };
      adapter = new GeminiImageDriverAdapter({ client: mockClient });
    });

    it('falls back gracefully to generic REFERENCE IMAGE header for unexpected roles', () => {
      const customRef: ReferenceRoleImage = {
        role: 'accessory' as any,
        image: createMockImage('acc', 'accessory'),
        label: 'Leather Belt',
      };
      const header = formatReferenceRoleHeader(customRef);
      expect(header).toBe('REFERENCE IMAGE (Leather Belt):');
    });

    it('handles untyped error payloads (plain strings, status objects, null) robustly', () => {
      const stringErr = 'Resource has been exhausted: quota limit reached';
      const mappedString = mapGeminiErrorToStudioDriverError(stringErr);
      expect(mappedString.category).toBe('rate_limited');
      expect(mappedString.status).toBe(429);
      expect(mappedString.retryable).toBe(true);

      const statusObj = { status: 504, message: 'Gateway timeout from upstream proxy' };
      const mappedStatus = mapGeminiErrorToStudioDriverError(statusObj);
      expect(mappedStatus.category).toBe('gateway_down');
      expect(mappedStatus.status).toBe(504);
      expect(mappedStatus.retryable).toBe(true);

      const authObj = { status: 401, message: 'Invalid API key provided' };
      const mappedAuth = mapGeminiErrorToStudioDriverError(authObj);
      expect(mappedAuth.category).toBe('unknown');
      expect(mappedAuth.status).toBe(401);
      expect(mappedAuth.retryable).toBe(false);

      const nullErr = null;
      const mappedNull = mapGeminiErrorToStudioDriverError(nullErr);
      expect(mappedNull.category).toBe('unknown');
      expect(mappedNull.retryable).toBe(false);
    });

    it('handles safety block during upscale and translates to safety_blocked StudioDriverError', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue({
        candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }],
      });

      const error = await adapter
        .upscale({
          image: createMockImage('upscale-safety'),
          quality: '4K',
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('safety_blocked');
      expect(error.status).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it('handles 429 quota exhaustion during upscale and translates to rate_limited', async () => {
      const rateLimitErr: any = new Error('RESOURCE_EXHAUSTED: Daily quota exceeded');
      rateLimitErr.status = 429;
      (mockClient.models.generateContent as any).mockRejectedValue(rateLimitErr);

      const error = await adapter
        .upscale({
          image: createMockImage('upscale-quota'),
          quality: '2K',
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('rate_limited');
      expect(error.status).toBe(429);
      expect(error.retryable).toBe(true);
    });

    it('cleanly aborts between batches in a multi-batch fan-out (count = 15)', async () => {
      const controller = new AbortController();
      let completedInBatch = 0;

      (mockClient.models.generateContent as any).mockImplementation(async () => {
        completedInBatch++;
        if (completedInBatch === 10) {
          // Batch 1 (10 items) just finished, abort before batch 2 starts
          controller.abort(new Error('User aborted after batch 1'));
        }
        return createSuccessCandidate(`${completedInBatch}`);
      });

      const error = await adapter
        .generate({
          prompt: 'Large lookbook collection',
          count: 15, // 10 in batch 1, 5 in batch 2
          signal: controller.signal,
        })
        .catch((e) => e);

      expect(isStudioDriverError(error)).toBe(true);
      expect(error.category).toBe('cancelled');
      expect(error.retryable).toBe(false);
      // Batch 2 should not have dispatched any requests
      expect(mockClient.models.generateContent).toHaveBeenCalledTimes(10);
    });

    it('clamps negative or zero count to at least 1 image', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue(
        createSuccessCandidate('clamped')
      );

      const resultsZero = await adapter.generate({ prompt: 'test', count: 0 });
      expect(resultsZero).toHaveLength(1);

      const resultsNeg = await adapter.generate({ prompt: 'test', count: -5 });
      expect(resultsNeg).toHaveLength(1);
    });

    it('isolates recorded jobs and clears history cleanly', async () => {
      (mockClient.models.generateContent as any).mockResolvedValue(
        createSuccessCandidate('history')
      );

      await adapter.generate({ prompt: 'Job 1' });
      await adapter.upscale({ image: createMockImage('h1') });

      expect(adapter.getRecordedJobs()).toHaveLength(2);

      adapter.clearRecordedJobs();
      expect(adapter.getRecordedJobs()).toHaveLength(0);
    });
  });
});
