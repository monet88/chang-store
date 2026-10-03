import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiImageDriverAdapter,
  formatReferenceRoleHeader,
  buildGeminiParts,
  extractInlineImageFromResponse,
  mapGeminiErrorToStudioDriverError,
  type GeminiClientLike,
} from '@/services/providers/gemini/GeminiImageDriverAdapter';
import {
  GptImageDriverAdapter,
  mapGptImageErrorToStudioDriverError,
  type GptImageClientLike,
} from '@/services/providers/gpt-image/GptImageDriverAdapter';
import {
  LocalQwenImageDriverAdapter,
  FACE_SWAP_LORA_NAME,
  mapLocalQwenErrorToStudioDriverError,
} from '@/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import {
  withLocalQwenLock,
  isLocalQwenBusy,
  getLocalQwenLockState,
  resetLocalQwenLock,
  cancelQueuedLocalQwenJobs,
} from '@/services/providers/local-qwen/localQwenLock';
import {
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
} from '@/services/providers/ImageDriver';
import type { ImageFile, ImageAspectRatio } from '@/types';
import { resolveSizeForRatio } from '@/services/providers/gpt-image/gptImageEngine';
import { isFaceSwapRefusal, isFaceSwapPrompt, normalizePromptForRefusal } from '@/platform/desktopLocalQwen';
import type { DesktopLocalQwenApi } from '@/platform/desktopLocalQwen';
import { withImageRequestSlot } from '@/utils/request-slots';

const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeMockImage(id: string = '1', role?: string): ImageFile {
  return {
    base64: `base64_data_${id}_${role ?? 'img'}`,
    mimeType: 'image/png',
  };
}

function makeGeminiSuccessResponse(id: string = '1') {
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

describe('Tier 5 Provider Adversarial Hardening Suite (Challenger M5)', () => {
  let unhandledRejections: any[] = [];
  const unhandledListener = (err: any) => {
    unhandledRejections.push(err);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    unhandledRejections = [];
    process.on('unhandledRejection', unhandledListener);
    resetLocalQwenLock();
  });

  afterEach(() => {
    process.removeListener('unhandledRejection', unhandledListener);
    resetLocalQwenLock();
    expect(unhandledRejections).toHaveLength(0);
  });

  // =========================================================================
  // SECTION 1: GEMINI ADAPTER WHITE-BOX HARDENING
  // =========================================================================
  describe('Section 1: Gemini Adapter White-Box Hardening', () => {
    describe('1.1 Reference Role Headers and Interleaving Permutations', () => {
      it('formats all 4 semantic reference roles with and without custom labels', () => {
        const roles: ReferenceRoleImage['role'][] = ['subject', 'garment', 'style', 'mask'];
        for (const role of roles) {
          const headerWithoutLabel = formatReferenceRoleHeader({
            role,
            image: makeMockImage('1', role),
          });
          expect(headerWithoutLabel).toContain(role.toUpperCase());
          expect(headerWithoutLabel).not.toContain('(');

          const headerWithLabel = formatReferenceRoleHeader({
            role,
            image: makeMockImage('1', role),
            label: `custom_${role}_v1`,
          });
          expect(headerWithLabel).toContain(role.toUpperCase());
          expect(headerWithLabel).toContain(`(custom_${role}_v1)`);
        }
      });

      it('strictly preserves reference ordering and header interleaving across diverse role permutations', () => {
        const references: ReferenceRoleImage[] = [
          { role: 'garment', image: makeMockImage('g1'), label: 'Silk Blouse' },
          { role: 'subject', image: makeMockImage('s1'), label: 'Female Model' },
          { role: 'style', image: makeMockImage('st1'), label: 'Studio Lighting' },
          { role: 'mask', image: makeMockImage('m1'), label: 'Torso Inpaint Mask' },
          { role: 'garment', image: makeMockImage('g2'), label: 'Trousers' },
        ];

        const job: GenerateJob = {
          prompt: 'Generate fashion look with blouse and trousers untucked',
          negativePrompt: 'blurry, distorted waist',
          references,
        };

        const parts = buildGeminiParts(job);

        // Expected parts: 5 references * 2 (header + image) + 1 taskPrompt = 11 parts
        expect(parts).toHaveLength(11);

        // Verify interleaved pairs
        expect((parts[0] as any).text).toContain('GARMENT REFERENCE (Silk Blouse)');
        expect((parts[1] as any).inlineData.data).toBe('base64_data_g1_img');
        expect((parts[2] as any).text).toContain('SUBJECT REFERENCE (Female Model)');
        expect((parts[3] as any).inlineData.data).toBe('base64_data_s1_img');
        expect((parts[4] as any).text).toContain('STYLE REFERENCE (Studio Lighting)');
        expect((parts[5] as any).inlineData.data).toBe('base64_data_st1_img');
        expect((parts[6] as any).text).toContain('MASK REFERENCE (Torso Inpaint Mask)');
        expect((parts[7] as any).inlineData.data).toBe('base64_data_m1_img');
        expect((parts[8] as any).text).toContain('GARMENT REFERENCE (Trousers)');
        expect((parts[9] as any).inlineData.data).toBe('base64_data_g2_img');

        // Last part is the prompt with negative prompt appended
        const lastPart = parts[10] as any;
        expect(lastPart.text).toContain('Generate fashion look with blouse and trousers untucked');
        expect(lastPart.text).toContain('strictly excluding blurry, distorted waist');
      });

      it('handles mixed legacy unlabelled images alongside semantic references without collision', () => {
        const job: GenerateJob = {
          prompt: 'Virtual Try On prompt',
          references: [
            { role: 'subject', image: makeMockImage('sub') },
          ],
          images: [
            makeMockImage('legacy1'),
            makeMockImage('legacy2'),
          ],
        };

        const parts = buildGeminiParts(job);
        // References: 1 header + 1 inlineData = 2
        // Prompt text: 1 = total 3 parts (never sends both references and images)
        expect(parts).toHaveLength(3);
        expect((parts[0] as any).text).toContain('SUBJECT REFERENCE');
        expect((parts[1] as any).inlineData.data).toBe('base64_data_sub_img');
        expect((parts[2] as any).text).toBe('Virtual Try On prompt');
      });

      it('places prompt first when only legacy unlabelled images are supplied', () => {
        const job: GenerateJob = {
          prompt: 'Legacy image synthesis',
          images: [makeMockImage('legacy_only')],
        };

        const parts = buildGeminiParts(job);
        expect(parts).toHaveLength(2);
        expect((parts[0] as any).text).toBe('Legacy image synthesis');
        expect((parts[1] as any).inlineData.data).toBe('base64_data_legacy_only_img');
      });

      it('produces single text part for pure text prompt', () => {
        const parts = buildGeminiParts({ prompt: 'Pure text prompt' });
        expect(parts).toHaveLength(1);
        expect((parts[0] as any).text).toBe('Pure text prompt');
      });
    });

    describe('1.2 Safety finishReason, BlockReason, and Malformed Responses', () => {
      it('correctly maps various Gemini safety finish reasons to safety_blocked', () => {
        const safetyReasons = ['SAFETY', 'RECITATION', 'OTHER'];
        for (const reason of safetyReasons) {
          const fakeResponse = {
            candidates: [
              {
                finishReason: reason,
                content: { parts: [] },
              },
            ],
          };

          expect(() => extractInlineImageFromResponse(fakeResponse)).toThrow(
            `error.api.safetyBlock:${reason}`
          );

          try {
            extractInlineImageFromResponse(fakeResponse);
          } catch (err) {
            const mapped = mapGeminiErrorToStudioDriverError(err);
            expect(mapped.category).toBe('safety_blocked');
            expect(mapped.status).toBe(400);
            expect(mapped.retryable).toBe(false);
          }
        }
      });

      it('maps promptFeedback.blockReason to safety_blocked', () => {
        const fakeResponse = {
          promptFeedback: {
            blockReason: 'PROHIBITED_CONTENT',
          },
          candidates: [],
        };

        expect(() => extractInlineImageFromResponse(fakeResponse)).toThrow(
          'error.api.safetyBlock:PROHIBITED_CONTENT'
        );

        try {
          extractInlineImageFromResponse(fakeResponse);
        } catch (err) {
          const mapped = mapGeminiErrorToStudioDriverError(err);
          expect(mapped.category).toBe('safety_blocked');
          expect(mapped.retryable).toBe(false);
        }
      });

      it('maps NO_IMAGE finish reason to non-retriable unknown error', () => {
        const fakeResponse = {
          candidates: [
            {
              finishReason: 'NO_IMAGE',
              content: { parts: [] },
            },
          ],
        };

        expect(() => extractInlineImageFromResponse(fakeResponse)).toThrow('error.api.noImageGenerated');
        try {
          extractInlineImageFromResponse(fakeResponse);
        } catch (err) {
          const mapped = mapGeminiErrorToStudioDriverError(err);
          expect(mapped.category).toBe('unknown');
          expect(mapped.retryable).toBe(false);
        }
      });

      it('handles text-only refusal responses from Gemini without crashing', () => {
        const fakeResponse = {
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: "I'm sorry, I cannot generate this image as it may violate safety guidelines." }],
              },
            },
          ],
          text: "I'm sorry, I cannot generate this image as it may violate safety guidelines.",
        };

        expect(() => extractInlineImageFromResponse(fakeResponse)).toThrow(
          "error.api.textOnlyResponse:I'm sorry, I cannot generate this image as it may violate safety guidelines."
        );

        try {
          extractInlineImageFromResponse(fakeResponse);
        } catch (err) {
          const mapped = mapGeminiErrorToStudioDriverError(err);
          // Contains "safety", so mapped to safety_blocked
          expect(mapped.category).toBe('safety_blocked');
          expect(mapped.retryable).toBe(false);
        }
      });

      it('maps empty candidates list to safety_blocked', () => {
        const fakeResponse = { candidates: [] };
        expect(() => extractInlineImageFromResponse(fakeResponse)).toThrow('error.api.safetyBlock:no_candidates');
        try {
          extractInlineImageFromResponse(fakeResponse);
        } catch (err) {
          const mapped = mapGeminiErrorToStudioDriverError(err);
          expect(mapped.category).toBe('safety_blocked');
          expect(mapped.retryable).toBe(false);
        }
      });
    });

    describe('1.3 Rapid Abort and Cancellation Lifecycles', () => {
      it('immediately cancels when pre-aborted signal is provided to generate', async () => {
        const mockClient: GeminiClientLike = {
          models: { generateContent: vi.fn() },
        };
        const adapter = new GeminiImageDriverAdapter({ client: mockClient });

        const controller = new AbortController();
        controller.abort(new Error('Pre-aborted test'));

        await expect(
          adapter.generate({
            prompt: 'Test prompt',
            signal: controller.signal,
          })
        ).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('cancelled');
          expect(sde.retryable).toBe(false);
          return true;
        });

        // Ensure no outbound request was made
        expect(mockClient.models.generateContent).not.toHaveBeenCalled();
      });

      it('cancels immediately when pre-aborted signal is provided to upscale', async () => {
        const mockClient: GeminiClientLike = {
          models: { generateContent: vi.fn() },
        };
        const adapter = new GeminiImageDriverAdapter({ client: mockClient });

        const controller = new AbortController();
        controller.abort(new Error('Pre-aborted upscale'));

        await expect(
          adapter.upscale({
            image: makeMockImage('up'),
            quality: '4K',
            signal: controller.signal,
          })
        ).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('cancelled');
          expect(sde.retryable).toBe(false);
          return true;
        });

        expect(mockClient.models.generateContent).not.toHaveBeenCalled();
      });

      it('aborts mid-execution when signal triggers during generateContent call', async () => {
        const controller = new AbortController();
        const mockClient: GeminiClientLike = {
          models: {
            generateContent: vi.fn().mockImplementation(async () => {
              // Trigger abort during remote call
              controller.abort(new Error('Cancelled while waiting for Gemini'));
              return makeGeminiSuccessResponse();
            }),
          },
        };

        const adapter = new GeminiImageDriverAdapter({ client: mockClient });

        await expect(
          adapter.generate({
            prompt: 'Aborted during network',
            signal: controller.signal,
          })
        ).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('cancelled');
          return true;
        });
      });

      it('cancels batch multi-image generation cleanly when signal is aborted mid-batch', async () => {
        const controller = new AbortController();
        let callCount = 0;
        const mockClient: GeminiClientLike = {
          models: {
            generateContent: vi.fn().mockImplementation(async () => {
              callCount++;
              if (callCount === 1) {
                controller.abort(new Error('Aborted after item 1'));
              }
              return makeGeminiSuccessResponse(String(callCount));
            }),
          },
        };

        const adapter = new GeminiImageDriverAdapter({ client: mockClient });

        await expect(
          adapter.generate({
            prompt: 'Multi-image batch cancel',
            count: 3,
            signal: controller.signal,
          })
        ).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('cancelled');
          return true;
        });
      });
    });
  });

  // =========================================================================
  // SECTION 2: GPT IMAGE ADAPTER CONCURRENCY & ASPECT RATIO HARDENING
  // =========================================================================
  describe('Section 2: GPT Image Adapter Concurrency & Aspect Ratio Hardening', () => {
    describe('2.1 Concurrency Slots Saturation and Release Guarantees', () => {
      it('guarantees slot release even under unexpected thrown errors and async rejections', async () => {
        let activeCalls = 0;
        let peakCalls = 0;

        const mockClient: GptImageClientLike = {
          generateImage: vi.fn().mockImplementation(async () => {
            activeCalls++;
            peakCalls = Math.max(peakCalls, activeCalls);
            await new Promise((res) => setTimeout(res, 10));
            activeCalls--;
            throw new Error('Unexpected network failure in slot worker');
          }),
        };

        const adapter = new GptImageDriverAdapter({
          client: mockClient,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
        });

        // Launch 12 concurrent requests that all fail
        const promises = Array.from({ length: 12 }, (_, i) =>
          adapter.generate({ prompt: `Crash job ${i}` }).catch((e) => e)
        );

        const results = await Promise.all(promises);
        expect(results).toHaveLength(12);
        for (const res of results) {
          expect(isStudioDriverError(res)).toBe(true);
        }

        // Now verify slot queue is healthy by launching a successful request
        mockClient.generateImage = vi.fn().mockResolvedValue([makeMockImage('recovered')]);

        const healthyResult = await adapter.generate({ prompt: 'Recovery test' });
        expect(healthyResult).toHaveLength(1);
        expect(healthyResult[0].base64).toBe('base64_data_recovered_img');
      });

      it('guarantees slot release when task throws non-Error (string or object)', async () => {
        const mockClient: GptImageClientLike = {
          generateImage: vi.fn().mockRejectedValue('Raw string error exception'),
        };

        const adapter = new GptImageDriverAdapter({
          client: mockClient,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
        });

        await expect(adapter.generate({ prompt: 'Non-error rejection' })).rejects.toSatisfy(
          (err: unknown) => {
            expect(isStudioDriverError(err)).toBe(true);
            return true;
          }
        );

        // Next request can acquire slot without hanging
        mockClient.generateImage = vi.fn().mockResolvedValue([makeMockImage('after_string_throw')]);
        const res = await adapter.generate({ prompt: 'Post string throw' });
        expect(res).toHaveLength(1);
      });
    });

    describe('2.2 Aspect Ratio Fuzzing and Dimensions Resolution', () => {
      it('resolves standard and non-standard aspect ratios without crashing', () => {
        const sizeOptions = ['1024x1024', '1024x1536', '1536x1024', '1024x1792', '1792x1024'];

        const cases: Array<{ ratio: any; expected: string }> = [
          { ratio: '1:1', expected: '1024x1024' },
          { ratio: '3:4', expected: '1024x1536' },
          { ratio: '4:3', expected: '1536x1024' },
          { ratio: '9:16', expected: '1024x1792' },
          { ratio: '16:9', expected: '1792x1024' },
          { ratio: 'Default', expected: '1024x1024' },
          // Fuzzed non-standard ratios:
          { ratio: '21:9', expected: '1792x1024' }, // closest to ultra-wide
          { ratio: '9:21', expected: '1024x1792' }, // closest to ultra-tall
          { ratio: '2:3', expected: '1024x1536' }, // closest to 3:4
          { ratio: '3:2', expected: '1536x1024' }, // closest to 4:3
          { ratio: 'invalid', expected: '1024x1024' }, // fallback
          { ratio: '', expected: '1024x1024' }, // fallback
          { ratio: 'NaN:NaN', expected: '1024x1024' }, // fallback
        ];

        for (const c of cases) {
          const resolved = resolveSizeForRatio(sizeOptions, c.ratio as ImageAspectRatio);
          expect(resolved).toBe(c.expected);
        }
      });

      it('captures resolvedDimensions in recordedJobs for fuzzed aspect ratios', async () => {
        const mockClient: GptImageClientLike = {
          generateImage: vi.fn().mockResolvedValue([makeMockImage('fuzz_out')]),
        };

        const adapter = new GptImageDriverAdapter({
          client: mockClient,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          sizeOptions: ['1024x1024', '1024x1536', '1536x1024'],
        });

        await adapter.generate({
          prompt: 'Fuzzed ratio test',
          aspectRatio: '3:4' as ImageAspectRatio,
        });

        const recorded = adapter.getRecordedJobs();
        expect(recorded).toHaveLength(1);
        expect(recorded[0].resolvedDimensions).toBe('1024x1536');
      });
    });

    describe('2.3 Multi-Image Fan-Out Partial Failures and Immutability', () => {
      it('returns partial successes when some workers fail during multi-image fan-out', async () => {
        let callCount = 0;
        const mockClient: GptImageClientLike = {
          generateImage: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [makeMockImage('success_1')];
            }
            throw new Error(`Worker ${callCount} failed`);
          }),
        };

        const adapter = new GptImageDriverAdapter({
          client: mockClient,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
        });

        const results = await adapter.generate({
          prompt: 'Partial fan-out test',
          count: 3,
        });

        // 1 succeeded, 2 failed -> returns the 1 successful image
        expect(results).toHaveLength(1);
        expect(results[0].base64).toBe('base64_data_success_1_img');
      });

      it('throws normalized StudioDriverError when all parallel workers fail', async () => {
        const mockClient: GptImageClientLike = {
          generateImage: vi.fn().mockRejectedValue(new Error('Gateway 504 Gateway Timeout')),
        };

        const adapter = new GptImageDriverAdapter({
          client: mockClient,
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
        });

        await expect(
          adapter.generate({
            prompt: 'All fail test',
            count: 2,
          })
        ).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('gateway_down');
          expect(sde.retryable).toBe(true);
          return true;
        });
      });
    });
  });

  // =========================================================================
  // SECTION 3: LOCAL QWEN ADAPTER MUTEX & REFUSAL FUZZING HARDENING
  // =========================================================================
  describe('Section 3: Local Qwen Adapter Mutex & Refusal Fuzzing Hardening', () => {
    let mockDesktopApi: {
      getStatus: ReturnType<typeof vi.fn>;
      startServer: ReturnType<typeof vi.fn>;
      stopServer: ReturnType<typeof vi.fn>;
      generateImage: ReturnType<typeof vi.fn>;
      cancelJob: ReturnType<typeof vi.fn>;
      upscaleImage: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
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
        generateImage: vi.fn().mockResolvedValue({
          ok: true,
          value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
        }),
        cancelJob: vi.fn().mockResolvedValue({
          ok: true,
          value: { cancelled: true },
        }),
        upscaleImage: vi.fn().mockResolvedValue({
          ok: true,
          value: { image: SAMPLE_BASE64, mimeType: 'image/png' },
        }),
      };

      (window as any).desktopLocalQwen = mockDesktopApi as unknown as DesktopLocalQwenApi;
    });

    describe('3.1 Mutex Unlock Guarantees Under Crashes & Aborts', () => {
      it('guarantees mutex release when ComfyUI throws CUDA OOM fatal error', async () => {
        const adapter = new LocalQwenImageDriverAdapter();

        mockDesktopApi.generateImage.mockResolvedValueOnce({
          ok: false,
          error: {
            message: 'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 4.00 GiB',
          },
        });

        // First job fails with hardware_error
        await expect(
          adapter.generate({ prompt: 'Trigger OOM' })
        ).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('hardware_error');
          expect(sde.retryable).toBe(false);
          return true;
        });

        // Ensure lock was released
        expect(isLocalQwenBusy()).toBe(false);
        const lockState = getLocalQwenLockState();
        expect(lockState.isLocked).toBe(false);
        expect(lockState.queueDepth).toBe(0);

        // Next job executes cleanly
        const nextResult = await adapter.generate({ prompt: 'Subsequent normal job' });
        expect(nextResult).toHaveLength(1);
      });

      it('guarantees mutex release when desktop bridge throws unexpected synchronous error', async () => {
        const adapter = new LocalQwenImageDriverAdapter();

        mockDesktopApi.generateImage.mockImplementationOnce(() => {
          throw new Error('Kernel panic or IPC pipe broken');
        });

        await expect(
          adapter.generate({ prompt: 'Crash IPC pipe' })
        ).rejects.toThrow();

        expect(isLocalQwenBusy()).toBe(false);

        // Subsequent upscale acquires lock cleanly
        const upResult = await adapter.upscale({ image: makeMockImage('up1') });
        expect(upResult.base64).toBe(SAMPLE_BASE64);
      });

      it('safely dequeues and cleans up when queued job is aborted while waiting for mutex', async () => {
        const adapter = new LocalQwenImageDriverAdapter();

        let finishJob1: () => void;
        const job1Promise = new Promise<void>((res) => {
          finishJob1 = res;
        });

        mockDesktopApi.generateImage.mockImplementationOnce(async () => {
          await job1Promise;
          return {
            ok: true,
            value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
          };
        });

        // Launch job 1 (holding lock)
        const p1 = adapter.generate({ prompt: 'Job 1 holding lock' });

        // Launch job 2 with abort controller (waiting in queue)
        const controller2 = new AbortController();
        const p2 = adapter.generate({
          prompt: 'Job 2 waiting in queue',
          signal: controller2.signal,
        });

        // Verify queue state: 1 active, 1 waiting
        expect(getLocalQwenLockState().isLocked).toBe(true);
        expect(getLocalQwenLockState().queueDepth).toBe(1);

        // Abort job 2 while waiting in queue
        controller2.abort(new Error('Job 2 cancelled'));

        await expect(p2).rejects.toSatisfy((err: unknown) => {
          expect(isStudioDriverError(err)).toBe(true);
          const sde = err as StudioDriverError;
          expect(sde.category).toBe('cancelled');
          return true;
        });

        // Queue depth should now be 0, though job 1 is still running
        expect(getLocalQwenLockState().queueDepth).toBe(0);
        expect(getLocalQwenLockState().isLocked).toBe(true);

        // Release job 1
        finishJob1!();
        const res1 = await p1;
        expect(res1).toHaveLength(1);

        // Lock completely free
        expect(isLocalQwenBusy()).toBe(false);
      });

      it('cancels all queued jobs atomically via cancelQueuedLocalQwenJobs', async () => {
        let finishHoldingJob: () => void;
        const holdingPromise = new Promise<void>((res) => {
          finishHoldingJob = res;
        });

        mockDesktopApi.generateImage.mockImplementationOnce(async () => {
          await holdingPromise;
          return {
            ok: true,
            value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
          };
        });

        const adapter = new LocalQwenImageDriverAdapter();
        const pActive = adapter.generate({ prompt: 'Active' });

        const pQueued1 = adapter.generate({ prompt: 'Queued 1' });
        const pQueued2 = adapter.generate({ prompt: 'Queued 2' });

        expect(getLocalQwenLockState().queueDepth).toBe(2);

        // Mass cancel queued jobs
        cancelQueuedLocalQwenJobs('Mass cancellation');

        await expect(pQueued1).rejects.toSatisfy((err: unknown) => {
          expect((err as StudioDriverError).category).toBe('cancelled');
          return true;
        });
        await expect(pQueued2).rejects.toSatisfy((err: unknown) => {
          expect((err as StudioDriverError).category).toBe('cancelled');
          return true;
        });

        expect(getLocalQwenLockState().queueDepth).toBe(0);

        finishHoldingJob!();
        await pActive;
        expect(isLocalQwenBusy()).toBe(false);
      });
    });

    describe('3.2 Vietnamese Colloquial Refusal Permutations and NFD Diacritic Stripping', () => {
      const refusalCases = [
        'đừng đổi mặt',
        'dung doi mat',
        'ĐỪNG ĐỔI MẶT',
        'đừng ghép mặt',
        'dung ghep mat',
        'không hoán đổi khuôn mặt',
        'khong hoan doi khuon mat',
        'chớ thay mặt',
        'giữ nguyên mặt gốc',
        'giu nguyen mat',
        'giữ nguyên khuôn mặt',
        'khong face swap',
        'dung face swap',
        'không đổi danh tính',
        'không chuyển danh tính',
        'không thay khuôn mặt',
        'without face swap',
        'no face swap please',
        'keep the original face',
        // Code-switching & extra spaces & punctuation
        '  Vui lòng   KHÔNG   ghép   mặt !!!  ',
        'Thay trang phục nhưng giu nguyen mat nha shop',
        'dont swap',
      ];

      it('detects refusal across all fuzzed Vietnamese colloquialisms, NFD forms, and code-switching', () => {
        for (const prompt of refusalCases) {
          const detected = isFaceSwapRefusal(prompt);
          expect(detected, `Expected refusal detected for: "${prompt}"`).toBe(true);

          // And isFaceSwapPrompt must yield false because refusal outranks intent
          const isSwap = isFaceSwapPrompt(prompt);
          expect(isSwap, `Expected isFaceSwapPrompt to be false for refusal prompt: "${prompt}"`).toBe(false);
        }
      });

      it('passes workflow through unchanged and leaves loraName undefined by default (Finding 5)', async () => {
        const adapter = new LocalQwenImageDriverAdapter();

        for (const prompt of refusalCases.slice(0, 5)) {
          adapter.clearRecordedJobs();

          await adapter.generate({
            prompt: `QWEN IDENTITY TRANSFER SPECIFICATION: ${prompt}`,
            workflow: 'identity-transfer',
          });

          // Check bridge call parameters: workflow preserved, loraName undefined
          expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
            expect.objectContaining({
              workflow: 'identity-transfer',
              loraName: undefined,
            })
          );
        }
      });
    });

    describe('3.3 Hardware Error Mapping & Non-Retriable Contract', () => {
      it('maps CUDA OOM errors to non-retriable hardware_error', () => {
        const oomMessages = [
          'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.50 GiB',
          'RuntimeError: CUDA error: out of memory on device cuda:0',
          'ComfyUI VRAM full: allocation on device failed',
        ];

        for (const msg of oomMessages) {
          const mapped = mapLocalQwenErrorToStudioDriverError(new Error(msg));
          expect(mapped.category).toBe('hardware_error');
          expect(mapped.retryable).toBe(false);
          expect(isRetryableDriverError(mapped)).toBe(false);
        }
      });

      it('maps missing GGUF weights to non-retriable hardware_error', () => {
        const missingWeightMessages = [
          'FileNotFoundError: File models/diffusion_models/qwen-image-2.1-Q4_K_M.gguf not found',
          'Model file models/vae/qwen_image_2.1_vae.safetensors does not exist',
        ];

        for (const msg of missingWeightMessages) {
          const mapped = mapLocalQwenErrorToStudioDriverError(new Error(msg));
          expect(mapped.category).toBe('hardware_error');
          expect(mapped.retryable).toBe(false);
          expect(isRetryableDriverError(mapped)).toBe(false);
        }
      });

      it('maps missing custom node or unhealthy ComfyUI to gateway_down (non-retriable)', () => {
        const nodeMessages = [
          "Cannot find custom node 'ComfyUI-GGUF'",
          'Node UnetLoaderGGUF missing from ComfyUI',
          'Failed to connect: ECONNREFUSED 127.0.0.1:8188',
        ];

        for (const msg of nodeMessages) {
          const mapped = mapLocalQwenErrorToStudioDriverError(new Error(msg));
          expect(mapped.category).toBe('gateway_down');
          expect(mapped.retryable).toBe(false);
        }
      });
    });
  });

  // =========================================================================
  // SECTION 4: CROSS-DRIVER POLYMORPHIC SEAM & IMMUTABILITY VERIFICATION
  // =========================================================================
  describe('Section 4: Cross-Driver Polymorphic Seam & Immutability Verification', () => {
    it('strictly preserves caller job immutability when Object.freeze is passed to all 3 drivers', async () => {
      // 1. Gemini
      const geminiClient: GeminiClientLike = {
        models: { generateContent: vi.fn().mockResolvedValue(makeGeminiSuccessResponse()) },
      };
      const geminiDriver = new GeminiImageDriverAdapter({ client: geminiClient });

      const frozenGeminiJob = Object.freeze({
        prompt: 'Frozen Gemini prompt',
        aspectRatio: '1:1' as ImageAspectRatio,
        references: Object.freeze([
          Object.freeze({ role: 'subject' as const, image: makeMockImage('fz_sub') }),
        ]),
      });

      await expect(geminiDriver.generate(frozenGeminiJob as any)).resolves.toBeDefined();
      expect(geminiDriver.getRecordedJobs()).toHaveLength(1);

      // 2. GPT Image
      const gptClient: GptImageClientLike = {
        generateImage: vi.fn().mockResolvedValue([makeMockImage('fz_gpt')]),
      };
      const gptDriver = new GptImageDriverAdapter({
        client: gptClient,
        apiKey: 'test',
        baseUrl: 'https://api.openai.com/v1',
      });

      const frozenGptJob = Object.freeze({
        prompt: 'Frozen GPT prompt',
        aspectRatio: '3:4' as ImageAspectRatio,
        count: 1,
      });

      await expect(gptDriver.generate(frozenGptJob as any)).resolves.toBeDefined();
      expect(gptDriver.getRecordedJobs()).toHaveLength(1);
      expect(gptDriver.getRecordedJobs()[0].resolvedDimensions).toBeDefined();

      // 3. Local Qwen
      const localDriver = new LocalQwenImageDriverAdapter();
      const frozenLocalJob = Object.freeze({
        prompt: 'Frozen Local Qwen prompt',
        workflow: 'identity-transfer',
      });

      await expect(localDriver.generate(frozenLocalJob as any)).resolves.toBeDefined();
      expect(localDriver.getRecordedJobs()).toHaveLength(1);
      expect(localDriver.getRecordedJobs()[0].workflow).toBe('identity-transfer');
    });

    it('enforces generateOne contract across all 3 drivers', async () => {
      // Gemini
      const geminiDriver = new GeminiImageDriverAdapter({
        client: { models: { generateContent: vi.fn().mockResolvedValue(makeGeminiSuccessResponse('g1')) } },
      });
      const g1 = await geminiDriver.generateOne({ prompt: 'One test' });
      expect(g1.base64).toBe('synthetic_gemini_output_g1');

      // GPT Image
      const gptDriver = new GptImageDriverAdapter({
        client: { generateImage: vi.fn().mockResolvedValue([makeMockImage('gpt1')]) },
        apiKey: 'test',
        baseUrl: 'https://api.openai.com/v1',
      });
      const gp1 = await gptDriver.generateOne({ prompt: 'One test' });
      expect(gp1.base64).toBe('base64_data_gpt1_img');

      // Local Qwen
      const localDriver = new LocalQwenImageDriverAdapter();
      const l1 = await localDriver.generateOne({ prompt: 'One test' });
      expect(l1.base64).toBe(SAMPLE_BASE64);
    });
  });
});
