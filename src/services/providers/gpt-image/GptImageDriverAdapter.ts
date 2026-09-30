import type { ImageAspectRatio, ImageEngineId, ImageFile } from '../../../types';
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
  type RecordedJob,
  StudioDriverError,
  isStudioDriverError,
} from '../ImageDriver';
import {
  DEFAULT_GPT_IMAGE_MODEL,
  DEFAULT_GPT_IMAGE_QUALITY,
  type GptImageQuality,
  resolveGptImageSizeOptions,
} from '../../../config/gptImageModelRegistry';
import { gatewayHostOf } from '../shared/imageDriverPolicy';
import { resolveSizeForRatio } from './gptImageEngine';
import { appendNegativePrompt } from '../../../utils/negative-prompt-builder';
import { PROVIDER_UPSCALE_PROMPTS } from '../../../utils/provider-refine-prompt';
import { runBoundedWorkers } from '../../../utils/run-bounded-workers';
import { withImageRequestSlot } from '../../../utils/request-slots';
import {
  generateGptImage,
  editGptImage,
  type GptImageServiceConfig,
  type GptImageGenerateParams,
  type GptImageEditParams,
} from './gptImageService';
import { ProviderApiError } from '../shared/ProviderApiError';

export interface GptImageClientLike {
  generateImage?(
    params: GptImageGenerateParams,
    config: GptImageServiceConfig,
    signal?: AbortSignal
  ): Promise<ImageFile[]>;
  editImage?(
    params: GptImageEditParams,
    config: GptImageServiceConfig,
    signal?: AbortSignal
  ): Promise<ImageFile[]>;
}

export interface GptImageDriverAdapterOptions {
  client?: GptImageClientLike;
  credentials?: GptImageServiceConfig;
  apiKey?: string;
  baseUrl?: string;
  endpoint?: string;
  credentialRef?: string;
  model?: string;
  quality?: GptImageQuality;
  sizeOptions?: readonly string[];
}

/**
 * Maps any error from OpenAI / GPT Image service to a canonical StudioDriverError.
 */
export const mapGptImageErrorToStudioDriverError = (error: unknown): StudioDriverError => {
  if (isStudioDriverError(error)) {
    return error;
  }

  // 1. Cancellation
  if (
    (error instanceof Error && error.name === 'AbortError') ||
    (error as any)?.name === 'AbortError'
  ) {
    return new StudioDriverError('cancelled', (error as Error).message || 'GPT image request was cancelled.', {
      retryable: false,
      cause: error,
    });
  }

  let status: number | undefined;
  let code: string | undefined;
  let rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? 'Unknown GPT image error');

  if (error instanceof ProviderApiError) {
    status = error.status;
    code = error.code;
    rawMessage = error.message;
  } else if (error && typeof error === 'object' && 'status' in error && typeof (error as any).status === 'number') {
    status = (error as any).status;
    code = (error as any).code;
  }

  const lower = rawMessage.toLowerCase();

  // 2. Cancellation by message
  if (lower.includes('aborted') || lower.includes('cancelled') || lower.includes('canceled')) {
    return new StudioDriverError('cancelled', rawMessage, {
      status,
      retryable: false,
      cause: error,
    });
  }

  // 3. Safety / Content Policy Block
  if (
    code === 'content_policy_violation' ||
    code === 'image_safety' ||
    lower.includes('content policy') ||
    lower.includes('safety') ||
    lower.includes('prohibited_content')
  ) {
    return new StudioDriverError('safety_blocked', rawMessage, {
      status: status ?? 400,
      retryable: false,
      cause: error,
    });
  }

  // 4. Rate Limiting / Quota
  if (
    status === 429 ||
    code === 'rate_limit_exceeded' ||
    code === 'quota_error' ||
    code === 'insufficient_quota' ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return new StudioDriverError('rate_limited', rawMessage, {
      status: 429,
      retryable: true,
      cause: error,
    });
  }

  // 5. Gateway / Server / Network Errors (5xx or network drops)
  if (status !== undefined && status >= 500) {
    return new StudioDriverError('gateway_down', rawMessage, {
      status,
      retryable: true,
      cause: error,
    });
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('socket hang up') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout')
  ) {
    return new StudioDriverError('gateway_down', rawMessage, {
      status: status ?? 503,
      retryable: true,
      cause: error,
    });
  }

  // 6. Auth / Model / Client errors (401, 403, missing_api_key, model_not_allowed, etc)
  if (
    status === 401 ||
    status === 403 ||
    code === 'missing_api_key' ||
    code === 'invalid_api_key' ||
    code === 'model_not_allowed' ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return new StudioDriverError('unknown', rawMessage, {
      status: status ?? (code === 'missing_api_key' ? 401 : 403),
      retryable: false,
      cause: error,
    });
  }

  // 7. Unknown / Malformed
  return new StudioDriverError('unknown', rawMessage, {
    status: status ?? 400,
    retryable: false,
    cause: error,
  });
};

/**
 * ImageDriver adapter for OpenAI / GPT Image endpoints (DALL-E, GPT Image 2, etc.).
 *
 * Invariants:
 * - Maps aspect ratio to concrete pixel dimensions via resolveSizeForRatio.
 * - Handles client-side multi-image fan-out bounded by withImageRequestSlot.
 * - Appends negative prompt to prompt body and preserves Outfit Drape Invariant.
 * - Flattens ReferenceRoleImage references into multipart edit payload.
 * - Upscale operates via high-quality preservation edit.
 * - Bounded by withImageRequestSlot across all outbound calls.
 * - Strictly preserves caller job immutability.
 * - Records executed jobs with resolvedDimensions for testing and diagnostics.
 */
export class GptImageDriverAdapter implements ImageDriver {
  readonly id: ImageEngineId = 'gptImage';
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];
  private credentials: GptImageServiceConfig;
  private defaultModel: string;
  private defaultQuality: GptImageQuality;
  private sizeOptions: readonly string[];
  private client?: GptImageClientLike;

  constructor(options?: GptImageDriverAdapterOptions) {
    this.client = options?.client;
    this.credentials = {
      apiKey: options?.apiKey ?? options?.credentials?.apiKey ?? '',
      baseUrl: options?.baseUrl ?? options?.endpoint ?? options?.credentials?.baseUrl ?? '',
      credentialRef: options?.credentialRef ?? options?.credentials?.credentialRef,
    };
    this.defaultModel = options?.model ?? DEFAULT_GPT_IMAGE_MODEL;
    this.defaultQuality = options?.quality ?? DEFAULT_GPT_IMAGE_QUALITY;
    const gatewayHost = gatewayHostOf(this.credentials.baseUrl);
    this.sizeOptions = options?.sizeOptions ?? resolveGptImageSizeOptions(this.defaultModel, gatewayHost);
    this.generate = this.generate.bind(this);
    this.generateOne = this.generateOne.bind(this);
    this.upscale = this.upscale.bind(this);
  }

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  setCredentials(credentials: GptImageServiceConfig): void {
    this.credentials = { ...credentials };
    const gatewayHost = gatewayHostOf(this.credentials.baseUrl);
    this.sizeOptions = resolveGptImageSizeOptions(this.defaultModel, gatewayHost);
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    // 1. Pre-abort check
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'GPT image generation was cancelled before starting.', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    const effectiveModel = job.model ?? this.defaultModel;
    const effectiveQuality: GptImageQuality =
      job.quality === 'standard' ? 'medium' : job.quality === 'high' ? 'high' : this.defaultQuality;

    const pixelSize = resolveSizeForRatio(this.sizeOptions, (job.aspectRatio ?? 'Default') as ImageAspectRatio);

    // 2. Prepare images and prompt with reference roles
    const inputImages: ImageFile[] = [];
    let promptWithReferences = job.prompt;

    if (job.references && job.references.length > 0) {
      for (const ref of job.references) {
        if (ref.image) {
          inputImages.push(ref.image);
        }
      }

      const hasExistingRoles = job.prompt.includes('IMAGE 1 =') || job.prompt.includes('SUBJECT:');
      if (!hasExistingRoles) {
        const roleLines = job.references.map((ref, idx) => {
          const roleUpper = ref.role.toUpperCase();
          const label = ref.label ? ` (${ref.label})` : '';
          return `IMAGE ${idx + 1} (${roleUpper}${label}): Reference for ${ref.role}.`;
        });
        promptWithReferences = `${roleLines.join('\n')}\n\n${job.prompt}`;
      }
    }

    if (job.images && job.images.length > 0) {
      inputImages.push(...job.images);
    }

    const effectivePrompt = appendNegativePrompt(promptWithReferences, job.negativePrompt);

    // 3. Record job with resolved dimensions while preserving caller immutability
    this.recordedJobs.push({
      ...job,
      resolvedDimensions: pixelSize,
    });

    job.onProgress?.('GPT: requesting image generation slot...');

    const executeOne = async (sig?: AbortSignal): Promise<ImageFile[]> => {
      if (inputImages.length > 0) {
        const editParams: GptImageEditParams = {
          model: effectiveModel,
          prompt: effectivePrompt,
          images: inputImages,
          size: pixelSize,
          quality: effectiveQuality,
        };

        if (this.client?.editImage) {
          return this.client.editImage(editParams, this.credentials, sig);
        }
        return editGptImage(editParams, this.credentials, sig);
      }

      const generateParams: GptImageGenerateParams = {
        model: effectiveModel,
        prompt: effectivePrompt,
        size: pixelSize,
        quality: effectiveQuality,
      };

      if (this.client?.generateImage) {
        return this.client.generateImage(generateParams, this.credentials, sig);
      }
      return generateGptImage(generateParams, this.credentials, sig);
    };

    const count = Math.max(1, Math.min(job.count ?? 1, 4));

    try {
      if (count === 1) {
        const results = await withImageRequestSlot(async () => {
          if (job.signal?.aborted) {
            throw new StudioDriverError('cancelled', 'GPT image generation was cancelled.', {
              retryable: false,
              cause: job.signal.reason,
            });
          }
          job.onProgress?.('GPT: dispatching image request...');
          return executeOne(job.signal);
        });
        job.onProgress?.('GPT: image generation completed.');
        return results;
      }

      const slots = Array.from({ length: count }, (_, index) => index);
      const results: ImageFile[] = new Array(count);
      let firstError: unknown = null;

      await runBoundedWorkers(slots, count, async (index) => {
        if (job.signal?.aborted) return;
        try {
          job.onProgress?.(`GPT: generating image ${index + 1} of ${count}...`);
          const [result] = await withImageRequestSlot(async () => {
            if (job.signal?.aborted) {
              throw new StudioDriverError('cancelled', 'GPT image generation was cancelled.', {
                retryable: false,
                cause: job.signal.reason,
              });
            }
            return executeOne(job.signal);
          });
          if (result) {
            results[index] = result;
          }
        } catch (err) {
          if (!firstError) firstError = err;
          console.error(`Parallel GPT image request ${index + 1} failed:`, err);
        }
      });

      const successfulResults = results.filter(Boolean);
      if (successfulResults.length === 0) {
        if (job.signal?.aborted) {
          throw new StudioDriverError('cancelled', 'GPT image generation was cancelled.', {
            retryable: false,
            cause: job.signal.reason,
          });
        }
        if (firstError) throw mapGptImageErrorToStudioDriverError(firstError);
        throw new StudioDriverError('unknown', 'All parallel GPT image requests failed', { retryable: false });
      }

      job.onProgress?.('GPT: parallel generation completed.');
      return successfulResults;
    } catch (err) {
      throw mapGptImageErrorToStudioDriverError(err);
    }
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const results = await this.generate({ ...job, count: 1 });
    if (!results || results.length === 0) {
      throw new StudioDriverError('unknown', 'No image returned from GPT image generation', { retryable: false });
    }
    return results[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'GPT image upscale was cancelled before starting.', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    this.recordedJobs.push({ ...job });
    const qualityLevel = job.quality ?? '2K';
    job.onProgress?.(`GPT: running preservation upscale (${qualityLevel})...`);

    try {
      const results = await withImageRequestSlot(async () => {
        if (job.signal?.aborted) {
          throw new StudioDriverError('cancelled', 'GPT image upscale was cancelled.', {
            retryable: false,
            cause: job.signal.reason,
          });
        }
        const upscaleSize = resolveSizeForRatio(this.sizeOptions, 'Default');
        const upscaleParams: GptImageEditParams = {
          model: this.defaultModel,
          prompt: PROVIDER_UPSCALE_PROMPTS[qualityLevel],
          images: [job.image],
          size: upscaleSize,
          quality: 'high',
        };

        if (this.client?.editImage) {
          return this.client.editImage(upscaleParams, this.credentials, job.signal);
        }
        return editGptImage(upscaleParams, this.credentials, job.signal);
      });

      const upscaled = results?.[0];
      if (!upscaled) {
        throw new StudioDriverError('unknown', 'GPT image upscale returned empty response.', { retryable: false });
      }

      job.onProgress?.('GPT: upscale completed.');
      return upscaled;
    } catch (err) {
      throw mapGptImageErrorToStudioDriverError(err);
    }
  }
}
