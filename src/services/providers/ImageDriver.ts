import type { Part } from '@google/genai';
import type { ImageAspectRatio, ImageEngineId, ImageFile, ImageResolution } from '../../types';

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
  interleavedParts?: Part[];
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
  interleavedParts?: Part[];
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

export interface StudioDriverErrorOptions {
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class StudioDriverError extends Error {
  readonly category: StudioDriverErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    category: StudioDriverErrorCode,
    message: string,
    options?: StudioDriverErrorOptions
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
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

/**
 * Type guard for StudioDriverError.
 */
export const isStudioDriverError = (error: unknown): error is StudioDriverError =>
  error instanceof StudioDriverError;

/**
 * Predicate checking if an error is a retryable StudioDriverError.
 * Integrates directly with withRetry({ retryOn: isRetryableDriverError }).
 */
export const isRetryableDriverError = (error: unknown): boolean =>
  error instanceof StudioDriverError && error.retryable;
