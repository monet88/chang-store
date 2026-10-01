import type {
  ImageAspectRatio,
  ImageEngineId,
  ImageFile,
  ImageResolution,
} from '../../../types';
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type RecordedJob,
  StudioDriverError,
} from '../ImageDriver';

export interface DeferredExecution {
  promise: Promise<void>;
  resolve: (customOutput?: ImageFile[]) => void;
  reject: (err: Error) => void;
  readonly isPending: boolean;
}

export type QueuedResult =
  | { type: 'response'; value: ImageFile[] | ImageFile }
  | { type: 'error'; error: Error | StudioDriverError };

export interface SyntheticImageFile extends ImageFile {
  dataUrl: string;
  filename: string;
  width: number;
  height: number;
  id?: string;
}

export type RecordedJobCall =
  | { type: 'generate'; job: GenerateJob; timestamp: number }
  | { type: 'upscale'; job: UpscaleJob; timestamp: number };

// ============================================================================
// Deterministic PNG Generator (Zero Dependencies, Browser & Node Safe)
// ============================================================================

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Creates a valid, minimal 68-byte PNG base64 string with specified width and height
 * encoded into the IHDR chunk with a valid CRC32.
 */
export function createDeterministicPngBase64(width: number, height: number): string {
  const buffer = new Uint8Array(68);

  // PNG Signature: \x89PNG\r\n\x1a\n
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

  // IHDR chunk length: 13 bytes
  buffer.set([0x00, 0x00, 0x00, 0x0d], 8);

  // IHDR data: 'IHDR' (4 bytes) + width (4) + height (4) + bit_depth 8 + color_type 6 + comp 0 + filt 0 + inter 0
  const ihdrData = new Uint8Array(17);
  ihdrData.set([0x49, 0x48, 0x44, 0x52], 0);
  ihdrData[4] = (width >>> 24) & 0xff;
  ihdrData[5] = (width >>> 16) & 0xff;
  ihdrData[6] = (width >>> 8) & 0xff;
  ihdrData[7] = width & 0xff;
  ihdrData[8] = (height >>> 24) & 0xff;
  ihdrData[9] = (height >>> 16) & 0xff;
  ihdrData[10] = (height >>> 8) & 0xff;
  ihdrData[11] = height & 0xff;
  ihdrData.set([0x08, 0x06, 0x00, 0x00, 0x00], 12);
  buffer.set(ihdrData, 12);

  // IHDR CRC32
  const crc = calculateCrc32(ihdrData);
  buffer[29] = (crc >>> 24) & 0xff;
  buffer[30] = (crc >>> 16) & 0xff;
  buffer[31] = (crc >>> 8) & 0xff;
  buffer[32] = crc & 0xff;

  // Minimal valid IDAT chunk (11 bytes payload + 12 bytes overhead = 23 bytes: 33..55)
  // Payload: valid zlib deflate stream of 3 zero bytes -> 11 bytes
  const idatPayload = [0x78, 0x9c, 0x63, 0x60, 0x60, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01];
  buffer.set([0x00, 0x00, 0x00, 0x0b], 33);
  const idatChunkData = new Uint8Array(4 + idatPayload.length);
  idatChunkData.set([0x49, 0x44, 0x41, 0x54], 0);
  idatChunkData.set(idatPayload, 4);
  buffer.set(idatChunkData, 37);

  const idatCrc = calculateCrc32(idatChunkData);
  buffer[52] = (idatCrc >>> 24) & 0xff;
  buffer[53] = (idatCrc >>> 16) & 0xff;
  buffer[54] = (idatCrc >>> 8) & 0xff;
  buffer[55] = idatCrc & 0xff;

  // Minimal valid IEND chunk (12 bytes: 56..67)
  buffer.set(
    [
      0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ],
    56
  );

  return uint8ArrayToBase64(buffer);
}

// ============================================================================
// Dimension Matrices & Synthetic Asset Helpers
// ============================================================================

export const RATIO_RESOLUTION_DIMENSIONS: Record<
  ImageResolution,
  Record<Exclude<ImageAspectRatio, 'Default'>, { width: number; height: number }>
> = {
  '1K': {
    '1:1': { width: 1024, height: 1024 },
    '3:4': { width: 768, height: 1024 },
    '4:3': { width: 1024, height: 768 },
    '9:16': { width: 576, height: 1024 },
    '16:9': { width: 1024, height: 576 },
  },
  '2K': {
    '1:1': { width: 2048, height: 2048 },
    '3:4': { width: 1536, height: 2048 },
    '4:3': { width: 2048, height: 1536 },
    '9:16': { width: 1152, height: 2048 },
    '16:9': { width: 2048, height: 1152 },
  },
  '4K': {
    '1:1': { width: 4096, height: 4096 },
    '3:4': { width: 3072, height: 4096 },
    '4:3': { width: 4096, height: 3072 },
    '9:16': { width: 2304, height: 4096 },
    '16:9': { width: 4096, height: 2304 },
  },
};

export function resolveSyntheticDimensions(
  aspectRatio: ImageAspectRatio = '3:4',
  resolution: ImageResolution = '2K'
): { width: number; height: number } {
  const effectiveRatio = aspectRatio === 'Default' ? '3:4' : aspectRatio;
  const resolutionMap = RATIO_RESOLUTION_DIMENSIONS[resolution] ?? RATIO_RESOLUTION_DIMENSIONS['2K'];
  return resolutionMap[effectiveRatio] ?? { width: 1536, height: 2048 };
}

export function resolveUpscaleDimensions(
  quality: '2K' | '4K' = '2K'
): { width: number; height: number } {
  return quality === '4K'
    ? { width: 3072, height: 4096 }
    : { width: 1536, height: 2048 };
}

export function createSyntheticImageFile(options: {
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
  quality?: '2K' | '4K';
  workflow?: string;
  index?: number;
  prompt?: string;
  prefix?: string;
}): SyntheticImageFile {
  const { width, height } = options.quality
    ? resolveUpscaleDimensions(options.quality)
    : resolveSyntheticDimensions(options.aspectRatio, options.resolution);

  const base64 = createDeterministicPngBase64(width, height);
  const workflow = options.workflow ? options.workflow.replace(/[^a-zA-Z0-9_-]/g, '_') : 'studio';
  const prefix = options.prefix ?? (options.quality ? 'upscaled' : 'synthetic');
  const indexStr = options.index !== undefined ? `_${options.index}` : '';
  const filename = `${prefix}_${workflow}_${width}x${height}${indexStr}.png`;

  return {
    base64,
    mimeType: 'image/png',
    dataUrl: `data:image/png;base64,${base64}`,
    filename,
    width,
    height,
  };
}

export const DEFAULT_GENERATION_PROGRESS_STEPS: readonly string[] = [
  'Initializing generation pipeline...',
  'Compiling fashion prompts & reference roles...',
  'Rendering synthetic fashion preview...',
  'Finalizing image buffers...',
];

export const DEFAULT_UPSCALE_PROGRESS_STEPS: readonly string[] = [
  'Initializing local upscale engine...',
  'Refining texture and edge details...',
  'Finalizing high-resolution output...',
];

interface InternalDeferred {
  promise: Promise<void>;
  resolve: (customOutput?: ImageFile[]) => void;
  reject: (err: Error) => void;
  isPending: () => boolean;
  getCustomOutput: () => ImageFile[] | undefined;
}

// ============================================================================
// InMemoryImageDriverFake Implementation
// ============================================================================

export class InMemoryImageDriverFake implements ImageDriver {
  public id: ImageEngineId;
  public readonly dispatchedJobs: GenerateJob[] = [];
  public readonly dispatchedUpscaleJobs: UpscaleJob[] = [];
  public readonly recordedCalls: RecordedJobCall[] = [];

  private resultQueue: QueuedResult[] = [];
  private deferredQueue: InternalDeferred[] = [];
  private inFlightDeferred: Set<InternalDeferred> = new Set();
  private simulatedError?: StudioDriverError;

  public generationProgressSteps: string[] = [...DEFAULT_GENERATION_PROGRESS_STEPS];
  public upscaleProgressSteps: string[] = [...DEFAULT_UPSCALE_PROGRESS_STEPS];

  constructor(id: ImageEngineId = 'gemini') {
    this.id = id;
    this.generate = this.generate.bind(this);
    this.generateOne = this.generateOne.bind(this);
    this.upscale = this.upscale.bind(this);
  }

  // --------------------------------------------------------------------------
  // Deferral & Test Control APIs
  // --------------------------------------------------------------------------

  deferNext(): DeferredExecution {
    let resolveFn!: (customOutput?: ImageFile[]) => void;
    let rejectFn!: (err: Error) => void;
    let pending = true;
    let resolvedCustomOutput: ImageFile[] | undefined;

    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = (customOutput?: ImageFile[]) => {
        if (!pending) return;
        pending = false;
        resolvedCustomOutput = customOutput;
        resolve();
      };
      rejectFn = (err: Error) => {
        if (!pending) return;
        pending = false;
        reject(err);
      };
    });

    const item: InternalDeferred = {
      promise,
      resolve: resolveFn,
      reject: rejectFn,
      isPending: () => pending,
      getCustomOutput: () => resolvedCustomOutput,
    };

    this.deferredQueue.push(item);

    return {
      promise,
      resolve: resolveFn,
      reject: rejectFn,
      get isPending() {
        return pending;
      },
    };
  }

  resolveAllDeferred(): void {
    while (this.deferredQueue.length > 0) {
      const d = this.deferredQueue.shift();
      d?.resolve();
    }
    for (const d of this.inFlightDeferred) {
      d.resolve();
    }
    this.inFlightDeferred.clear();
  }

  queueNextResponse(response: ImageFile[] | ImageFile): void {
    this.resultQueue.push({ type: 'response', value: response });
  }

  queueNextError(error: Error | StudioDriverError): void {
    this.resultQueue.push({ type: 'error', error });
  }

  setSimulatedError(error: StudioDriverError | undefined): void {
    this.simulatedError = error;
  }

  reset(): void {
    this.dispatchedJobs.length = 0;
    this.dispatchedUpscaleJobs.length = 0;
    this.recordedCalls.length = 0;
    this.resultQueue.length = 0;
    this.deferredQueue.length = 0;
    this.inFlightDeferred.clear();
    this.simulatedError = undefined;
    this.generationProgressSteps = [...DEFAULT_GENERATION_PROGRESS_STEPS];
    this.upscaleProgressSteps = [...DEFAULT_UPSCALE_PROGRESS_STEPS];
  }

  // Harness-compatible accessors
  getRecordedJobs(): RecordedJob[] {
    return this.recordedCalls.map((call) => call.job) as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.dispatchedJobs.length = 0;
    this.dispatchedUpscaleJobs.length = 0;
    this.recordedCalls.length = 0;
  }

  getLastDispatchedJob(): GenerateJob | undefined {
    return this.dispatchedJobs[this.dispatchedJobs.length - 1];
  }

  getLastDispatchedUpscaleJob(): UpscaleJob | undefined {
    return this.dispatchedUpscaleJobs[this.dispatchedUpscaleJobs.length - 1];
  }

  getLastRecordedCall(): RecordedJobCall | undefined {
    return this.recordedCalls[this.recordedCalls.length - 1];
  }

  hasPendingDeferrals(): boolean {
    const hasInQueue = this.deferredQueue.some((d) => d.isPending());
    const hasInFlight = Array.from(this.inFlightDeferred).some((d) => d.isPending());
    return hasInQueue || hasInFlight;
  }

  // --------------------------------------------------------------------------
  // Core Transport Operations
  // --------------------------------------------------------------------------

  private async waitForDeferralOrAbort(signal?: AbortSignal): Promise<ImageFile[] | undefined> {
    if (signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Operation cancelled by caller', {
        retryable: false,
        cause: signal.reason,
      });
    }

    const nextDeferred = this.deferredQueue.shift();
    if (!nextDeferred) {
      await Promise.resolve();
      if (signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Operation cancelled by caller', {
          retryable: false,
          cause: signal.reason,
        });
      }
      return undefined;
    }

    this.inFlightDeferred.add(nextDeferred);

    return new Promise<ImageFile[] | undefined>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        settled = true;
        this.inFlightDeferred.delete(nextDeferred);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        if (settled) return;
        cleanup();
        const cancelError = new StudioDriverError('cancelled', 'Operation cancelled by caller', {
          retryable: false,
          cause: signal?.reason,
        });
        nextDeferred.reject(cancelError);
        reject(cancelError);
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      nextDeferred.promise.then(
        () => {
          if (settled) return;
          cleanup();
          resolve(nextDeferred.getCustomOutput());
        },
        (err) => {
          if (settled) return;
          cleanup();
          reject(err);
        }
      );
    });
  }

  async generate(job: GenerateJob): Promise<SyntheticImageFile[]> {
    // 1. Immediate pre-abort check (does not record to history if already aborted)
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Job aborted before execution', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    // 2. Record dispatched job in history
    this.dispatchedJobs.push(job);
    this.recordedCalls.push({
      type: 'generate',
      job,
      timestamp: Date.now(),
    });

    // 3. Emit initial progress steps
    if (job.onProgress && this.generationProgressSteps.length > 0) {
      job.onProgress(this.generationProgressSteps[0]);
      if (this.generationProgressSteps.length > 1) {
        job.onProgress(this.generationProgressSteps[1]);
      }
    }

    // 4. Await deferral or abort
    const customDeferredOutput = await this.waitForDeferralOrAbort(job.signal);

    // 5. Emit remaining progress steps
    if (job.onProgress && this.generationProgressSteps.length > 2) {
      for (let i = 2; i < this.generationProgressSteps.length; i++) {
        job.onProgress(this.generationProgressSteps[i]);
      }
    }

    // 6. Check abort after deferral
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Job aborted during execution', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    // 7. Return custom output if provided to deferral.resolve(customOutput)
    if (customDeferredOutput && customDeferredOutput.length > 0) {
      return customDeferredOutput as SyntheticImageFile[];
    }

    // 8. Consume simulated error if configured
    if (this.simulatedError) {
      const err = this.simulatedError;
      this.simulatedError = undefined;
      throw err;
    }

    // 9. Consume queued canned error or response
    if (this.resultQueue.length > 0) {
      const queued = this.resultQueue.shift()!;
      if (queued.type === 'error') {
        throw queued.error;
      }
      return (Array.isArray(queued.value) ? queued.value : [queued.value]) as SyntheticImageFile[];
    }

    // 10. Generate deterministic synthetic images
    const count = Math.max(1, job.count ?? 1);
    const results: SyntheticImageFile[] = [];
    for (let i = 0; i < count; i++) {
      results.push(
        createSyntheticImageFile({
          aspectRatio: job.aspectRatio,
          resolution: job.resolution,
          workflow: job.workflow,
          index: i,
          prompt: job.prompt,
        })
      );
    }

    return results;
  }

  async generateOne(job: GenerateJob): Promise<SyntheticImageFile> {
    const results = await this.generate({ ...job, count: 1 });
    if (!results || results.length === 0) {
      throw new StudioDriverError('unknown', 'No image returned from generation');
    }
    return results[0];
  }

  async upscale(job: UpscaleJob): Promise<SyntheticImageFile> {
    // 1. Immediate pre-abort check
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Upscale aborted before execution', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    // 2. Record dispatched upscale job in history
    this.dispatchedUpscaleJobs.push(job);
    this.recordedCalls.push({
      type: 'upscale',
      job,
      timestamp: Date.now(),
    });

    // 3. Emit initial progress steps
    if (job.onProgress && this.upscaleProgressSteps.length > 0) {
      job.onProgress(this.upscaleProgressSteps[0]);
    }

    // 4. Await deferral or abort
    const customDeferredOutput = await this.waitForDeferralOrAbort(job.signal);

    // 5. Emit remaining progress steps
    if (job.onProgress && this.upscaleProgressSteps.length > 1) {
      for (let i = 1; i < this.upscaleProgressSteps.length; i++) {
        job.onProgress(this.upscaleProgressSteps[i]);
      }
    }

    // 6. Check abort after deferral
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Upscale aborted during execution', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    // 7. Return custom output if provided to deferral.resolve(customOutput)
    if (customDeferredOutput && customDeferredOutput.length > 0) {
      return customDeferredOutput[0] as SyntheticImageFile;
    }

    // 8. Consume simulated error if configured
    if (this.simulatedError) {
      const err = this.simulatedError;
      this.simulatedError = undefined;
      throw err;
    }

    // 9. Consume queued canned error or response
    if (this.resultQueue.length > 0) {
      const queued = this.resultQueue.shift()!;
      if (queued.type === 'error') {
        throw queued.error;
      }
      return (Array.isArray(queued.value) ? queued.value[0] : queued.value) as SyntheticImageFile;
    }

    // 10. Generate synthetic upscaled asset
    const quality = job.quality ?? '2K';
    return createSyntheticImageFile({
      quality,
      prefix: 'upscaled',
    });
  }
}
