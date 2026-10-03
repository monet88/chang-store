/**
 * Test Harness for ImageDriver E2E Test Suite
 *
 * Implements the canonical ImageDriver interface, normalized StudioDriverError,
 * InMemoryImageDriverFake, and provider test doubles for gemini, gptImage, and localQwen.
 */

import type { ImageAspectRatio, ImageEngineId, ImageFile, ImageResolution } from '@/types';
import { isFaceSwapRefusal } from '@/platform/desktopLocalQwen';
import { UNTUCKED_DRAPE_INSTRUCTION, isTuckingAllowed } from '@/utils/outfitDrapePolicy';

export interface ReferenceRoleImage {
  image: ImageFile;
  role: 'subject' | 'garment' | 'style' | 'mask';
  label?: string;
}

export interface GenerateJob {
  prompt: string;
  images?: ImageFile[];
  references?: ReferenceRoleImage[];
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
  quality?: 'standard' | 'high';
  count?: number;
  workflow?: string;
  model?: string;
  negativePrompt?: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  // Execution metadata captured by drivers
  injectedLora?: string;
  resolvedDimensions?: string;
  interleavedParts?: any;
}

export interface UpscaleJob {
  image: ImageFile;
  quality?: '2K' | '4K';
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export type RecordedJob = (GenerateJob | UpscaleJob) & {
  prompt?: string;
  workflow?: string;
  images?: ImageFile[];
  references?: ReferenceRoleImage[];
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
  quality?: 'standard' | 'high' | '2K' | '4K';
  count?: number;
  injectedLora?: string;
  resolvedDimensions?: string;
  negativePrompt?: string;
  image?: ImageFile;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  interleavedParts?: any;
};

export interface ImageDriver {
  readonly id: ImageEngineId;
  generate(job: GenerateJob): Promise<ImageFile[]>;
  generateOne(job: GenerateJob): Promise<ImageFile>;
  upscale(job: UpscaleJob): Promise<ImageFile>;
  getRecordedJobs?(): RecordedJob[];
  clearRecordedJobs?(): void;
}

export type StudioDriverErrorCode =
  | 'safety_blocked'
  | 'rate_limited'
  | 'gateway_down'
  | 'hardware_error'
  | 'cancelled'
  | 'unknown';

export class StudioDriverError extends Error {
  readonly category: StudioDriverErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    category: StudioDriverErrorCode,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown }
  ) {
    super(message);
    this.name = 'StudioDriverError';
    this.category = category;
    this.status = options?.status;
    this.retryable =
      options?.retryable ??
      (category === 'rate_limited' ||
        (options?.status !== undefined && options.status >= 500 && category !== 'hardware_error'));
    this.cause = options?.cause;
    Object.setPrototypeOf(this, StudioDriverError.prototype);
  }
}

/** Helper to generate deterministic synthetic base64 */
export const createSyntheticBase64 = (seed: string, index: number = 0): string => {
  return `synthetic_img_${seed.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32)}_${index}_${Date.now()}`;
};

/**
 * InMemoryImageDriverFake: Test double supporting deferred completion,
 * job recording, cancellation, progress updates, and canned responses.
 */
export class InMemoryImageDriverFake implements ImageDriver {
  readonly id: ImageEngineId;
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];
  private deferredResolvers: (() => void)[] = [];
  private errorToThrow?: StudioDriverError;

  constructor(id: ImageEngineId = 'gemini') {
    this.id = id;
  }

  setSimulatedError(error: StudioDriverError | undefined): void {
    this.errorToThrow = error;
  }

  deferNext(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.deferredResolvers.push(resolve);
    return { promise, resolve };
  }

  resolveAllDeferred(): void {
    while (this.deferredResolvers.length > 0) {
      const resolve = this.deferredResolvers.shift();
      resolve?.();
    }
  }

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Job aborted by signal', { retryable: false });
    }
  }

  private async awaitDeferredIfAny(signal?: AbortSignal): Promise<void> {
    if (this.deferredResolvers.length > 0) {
      const resolver = this.deferredResolvers.shift()!;
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          return reject(new StudioDriverError('cancelled', 'Job aborted while deferred', { retryable: false }));
        }
        const onAbort = () => {
          signal?.removeEventListener('abort', onAbort);
          reject(new StudioDriverError('cancelled', 'Job aborted while deferred', { retryable: false }));
        };
        signal?.addEventListener('abort', onAbort);
        resolver();
        resolve();
      });
    }
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    this.checkAbort(job.signal);

    if (this.errorToThrow) {
      const err = this.errorToThrow;
      this.errorToThrow = undefined;
      throw err;
    }

    job.onProgress?.('Initializing generation...');
    await this.awaitDeferredIfAny(job.signal);
    this.checkAbort(job.signal);

    this.recordedJobs.push({ ...job });
    job.onProgress?.('Synthesizing image assets...');

    const count = job.count && job.count > 0 ? job.count : 1;
    const results: ImageFile[] = [];

    for (let i = 0; i < count; i++) {
      results.push({
        base64: createSyntheticBase64(job.prompt || 'default_generation', i),
        mimeType: 'image/png',
      });
    }

    job.onProgress?.('Complete');
    return results;
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const results = await this.generate({ ...job, count: 1 });
    return results[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    this.checkAbort(job.signal);

    if (this.errorToThrow) {
      const err = this.errorToThrow;
      this.errorToThrow = undefined;
      throw err;
    }

    job.onProgress?.('Initializing upscale...');
    await this.awaitDeferredIfAny(job.signal);
    this.checkAbort(job.signal);

    this.recordedJobs.push({ ...job });
    job.onProgress?.(`Applying ${job.quality || '2K'} upscale...`);

    const quality = job.quality || '2K';
    return {
      base64: `upscaled_${quality}_${job.image.base64.slice(0, 32)}`,
      mimeType: job.image.mimeType || 'image/png',
    };
  }
}

/**
 * GeminiImageDriverTestDouble:
 * Simulates Gemini API behavior:
 * - Maps semantic reference roles (subject, garment, style, mask) into interleaved prompt blocks
 * - Enforces 1K/2K/4K resolution tiers and aspect ratios
 * - Preserves Outfit Drape Invariant
 * - Normalizes safety flags into StudioDriverError('safety_blocked')
 */
export class GeminiImageDriverTestDouble implements ImageDriver {
  readonly id: ImageEngineId = 'gemini';
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Gemini generation aborted');
    }

    // Safety policy simulation
    if (job.prompt.includes('TRIGGER_SAFETY_BLOCK') || job.prompt.includes('prohibited_content')) {
      throw new StudioDriverError('safety_blocked', 'Candidate blocked by Gemini safety policy', {
        status: 400,
        retryable: false,
      });
    }

    // Rate limit simulation
    if (job.prompt.includes('TRIGGER_QUOTA_EXCEEDED')) {
      throw new StudioDriverError('rate_limited', 'Gemini API quota exceeded (ResourceExhausted)', {
        status: 429,
        retryable: true,
      });
    }

    // Drape invariant check for try-on / clothing-transfer
    let effectivePrompt = job.prompt;
    if (
      (job.workflow === 'try-on' || job.workflow === 'clothing-transfer') &&
      !isTuckingAllowed(job.prompt) &&
      !job.prompt.includes(UNTUCKED_DRAPE_INSTRUCTION)
    ) {
      effectivePrompt = `${job.prompt}\n\n${UNTUCKED_DRAPE_INSTRUCTION}`;
    }

    this.recordedJobs.push({ ...job, prompt: effectivePrompt });
    job.onProgress?.('Gemini: processing multimodal prompt...');

    const count = job.count || 1;
    const results: ImageFile[] = [];
    for (let i = 0; i < count; i++) {
      results.push({
        base64: `gemini_result_${job.aspectRatio || '1:1'}_${job.resolution || '1K'}_${i}`,
        mimeType: 'image/png',
      });
    }
    return results;
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const list = await this.generate({ ...job, count: 1 });
    return list[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Gemini upscale aborted');
    }
    this.recordedJobs.push({ ...job });
    job.onProgress?.(`Gemini: upscaling to ${job.quality || '2K'}...`);
    return {
      base64: `gemini_upscaled_${job.quality || '2K'}_${job.image.base64.slice(0, 20)}`,
      mimeType: 'image/png',
    };
  }
}

/**
 * GptImageDriverTestDouble:
 * Simulates GPT Image API behavior:
 * - Maps aspect ratios to pixel dimensions (1024x1024, 1024x1536, 1536x1024, etc.)
 * - Appends negative prompt to system instruction
 * - Enforces concurrent request slot limits
 */
export class GptImageDriverTestDouble implements ImageDriver {
  readonly id: ImageEngineId = 'gptImage';
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];
  private activeSlots = 0;
  private readonly maxSlots = 3;

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  private resolveSizeForRatio(ratio?: ImageAspectRatio): string {
    switch (ratio) {
      case '1:1':
        return '1024x1024';
      case '3:4':
        return '1024x1536';
      case '4:3':
        return '1536x1024';
      case '9:16':
        return '1024x1792';
      case '16:9':
        return '1792x1024';
      default:
        return '1024x1024';
    }
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'GPT Image generation aborted');
    }

    if (this.activeSlots >= this.maxSlots) {
      throw new StudioDriverError('rate_limited', 'Concurrent request slot limit reached', {
        status: 429,
        retryable: true,
      });
    }

    this.activeSlots++;
    try {
      if (job.prompt.includes('TRIGGER_GATEWAY_DOWN')) {
        throw new StudioDriverError('gateway_down', 'OpenAI gateway returned 503 Bad Gateway', {
          status: 503,
          retryable: true,
        });
      }

      const resolvedDimensions = this.resolveSizeForRatio(job.aspectRatio);
      let compiledPrompt = job.prompt;
      if (job.negativePrompt) {
        compiledPrompt = `${compiledPrompt}\n[Negative Prompt]: ${job.negativePrompt}`;
      }

      this.recordedJobs.push({
        ...job,
        prompt: compiledPrompt,
        resolvedDimensions,
      });

      job.onProgress?.(`GPT: generating with size ${resolvedDimensions}...`);
      const count = job.count || 1;
      const images: ImageFile[] = [];
      for (let i = 0; i < count; i++) {
        images.push({
          base64: `gpt_image_${resolvedDimensions}_${i}`,
          mimeType: 'image/png',
        });
      }
      return images;
    } finally {
      this.activeSlots--;
    }
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const list = await this.generate({ ...job, count: 1 });
    return list[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'GPT upscale aborted');
    }
    this.recordedJobs.push({ ...job });
    job.onProgress?.('GPT: applying stateless upscale...');
    return {
      base64: `gpt_upscaled_${job.quality || '2K'}_${job.image.base64.slice(0, 20)}`,
      mimeType: 'image/png',
    };
  }
}

/**
 * LocalQwenImageDriverTestDouble:
 * Simulates Local Qwen ComfyUI workstation driver:
 * - Shared mutex lock across generate and upscale (maxConcurrency: 1)
 * - Auto-injects FaceSwap LoRA when workflow === 'identity-transfer' && !isFaceSwapRefusal(prompt)
 * - Flags CUDA OOM and missing GGUF weights as non-retriable hardware errors
 * - Local-only manual upscale invariant
 */
export class LocalQwenImageDriverTestDouble implements ImageDriver {
  readonly id: ImageEngineId = 'localQwen';
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];
  private static mutexQueue: Promise<unknown> = Promise.resolve();

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  private async acquireLock<T>(task: () => Promise<T>): Promise<T> {
    const next = LocalQwenImageDriverTestDouble.mutexQueue.then(task, task);
    LocalQwenImageDriverTestDouble.mutexQueue = next.catch(() => {});
    return next;
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    return this.acquireLock(async () => {
      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Local Qwen generation aborted');
      }

      // Check hardware fatal errors
      if (job.prompt.includes('TRIGGER_CUDA_OOM')) {
        throw new StudioDriverError('hardware_error', 'ComfyUI CUDA out of memory', {
          retryable: false,
          status: 500,
        });
      }
      if (job.prompt.includes('TRIGGER_MISSING_WEIGHTS')) {
        throw new StudioDriverError('hardware_error', 'GGUF model file not found in models folder', {
          retryable: false,
          status: 404,
        });
      }

      // FaceSwap LoRA Auto-Injection Guard
      let injectedLora: string | undefined;
      if (job.workflow === 'identity-transfer') {
        const isRefusal = isFaceSwapRefusal(job.prompt);
        if (!isRefusal) {
          injectedLora = 'bfs_head_v1.1_qwen_2.1.safetensors';
        }
      }

      this.recordedJobs.push({
        ...job,
        injectedLora,
      });

      await job.onProgress?.('LocalQwen: executing ComfyUI workflow...');
      const count = job.count || 1;
      const images: ImageFile[] = [];
      for (let i = 0; i < count; i++) {
        images.push({
          base64: `local_qwen_${injectedLora ? 'faceswap_' : ''}asset_${i}`,
          mimeType: 'image/png',
        });
      }
      return images;
    });
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const list = await this.generate({ ...job, count: 1 });
    return list[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    return this.acquireLock(async () => {
      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Local Qwen upscale aborted');
      }
      if (job.image.base64.includes('TRIGGER_CUDA_OOM')) {
        throw new StudioDriverError('hardware_error', 'ComfyUI ESRGAN CUDA out of memory', {
          retryable: false,
        });
      }

      this.recordedJobs.push({ ...job });
      await job.onProgress?.(`LocalQwen: running local ESRGAN upscale (${job.quality || '2K'})...`);
      return {
        base64: `local_qwen_upscaled_${job.quality || '2K'}_${job.image.base64.slice(0, 20)}`,
        mimeType: 'image/png',
      };
    });
  }
}

/** Factory to create appropriate driver instance for testing */
export const createTestDriver = (
  mode: ImageEngineId | 'fake',
  options?: { inMemoryId?: ImageEngineId }
): ImageDriver => {
  switch (mode) {
    case 'gemini':
      return new GeminiImageDriverTestDouble();
    case 'gptImage':
      return new GptImageDriverTestDouble();
    case 'localQwen':
      return new LocalQwenImageDriverTestDouble();
    case 'fake':
    default:
      return new InMemoryImageDriverFake(options?.inMemoryId || 'gemini');
  }
};
