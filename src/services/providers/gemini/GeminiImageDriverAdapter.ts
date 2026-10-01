import { Modality, type Part } from '@google/genai';
import type {
  ImageAspectRatio,
  ImageEngineId,
  ImageFile,
  ImageResolution,
  UpscaleQuality,
} from '../../../types';
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
  type RecordedJob,
  StudioDriverError,
  isStudioDriverError,
} from '../ImageDriver';
import { getGeminiClient } from '../../apiClient';
import { getModelCapabilities, resolveImageSizeConfig } from '../../../config/modelRegistry';
import { appendNegativePrompt, negativePromptSentence } from '../../../utils/negative-prompt-builder';
import { buildUpscalePrompt } from '../../../utils/upscale-prompt-builder';
import { withImageRequestSlot } from '../../../utils/request-slots';
import { runBoundedWorkers } from '../../../utils/run-bounded-workers';
import { DEFAULT_MAX_CONCURRENCY } from '../../../utils/engineDispatch';
import { logApiCall } from '../../debugService';

export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

export interface GeminiClientLike {
  models: {
    generateContent(params: any): Promise<any>;
  };
}

export interface GeminiImageDriverAdapterOptions {
  client?: GeminiClientLike;
  model?: string;
}

/**
 * Formats a semantic reference role into a descriptive header text part for Gemini.
 */
export function formatReferenceRoleHeader(ref: ReferenceRoleImage): string {
  const customLabel = ref.label ? ` (${ref.label})` : '';
  switch (ref.role) {
    case 'subject':
      return `SUBJECT REFERENCE${customLabel}: Primary model/person/entity. Preserve identity, facial features, body proportions, and pose unless modified by instructions.`;
    case 'garment':
      return `GARMENT REFERENCE${customLabel}: Clothing or outfit to transfer. Extract design, silhouette, texture, pattern, and construction details.`;
    case 'style':
      return `STYLE REFERENCE${customLabel}: Aesthetic style, lighting, color palette, and visual mood reference.`;
    case 'mask':
      return `MASK REFERENCE${customLabel}: Spatial targeting or inpainting mask indicating regions to modify.`;
    default:
      return `REFERENCE IMAGE${customLabel}:`;
  }
}

/**
 * Builds the interleaved parts array from a GenerateJob.
 * Semantic references are interleaved with role header text parts and image data.
 * Unlabelled images (if any) are appended.
 * The combined task prompt (including negative prompt avoid sentence) is appended.
 */
export function buildGeminiParts(job: GenerateJob): Part[] {
  // 1. If interleavedParts is present, send it as-is (+ negative-prompt sentence)
  if (job.interleavedParts && job.interleavedParts.length > 0) {
    const avoidSentence = negativePromptSentence(job.negativePrompt);
    return avoidSentence ? [...job.interleavedParts, { text: avoidSentence }] : job.interleavedParts;
  }

  const parts: Part[] = [];

  // 2. Interleaved semantic references OR unlabelled images (never both)
  if (job.references && job.references.length > 0) {
    for (const ref of job.references) {
      parts.push({ text: formatReferenceRoleHeader(ref) });
      parts.push({
        inlineData: {
          data: ref.image.base64,
          mimeType: ref.image.mimeType || 'image/png',
        },
      });
    }
  } else if (job.images && job.images.length > 0) {
    for (const img of job.images) {
      parts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType || 'image/png',
        },
      });
    }
  }

  // 3. Task text prompt + negative prompt avoid sentence
  const taskPrompt = appendNegativePrompt(job.prompt, job.negativePrompt);
  if (parts.length === 0) {
    // Text-only prompt
    parts.push({ text: taskPrompt });
  } else if (!job.references || job.references.length === 0) {
    // Legacy images only: place prompt first followed by images
    return [{ text: taskPrompt }, ...parts];
  } else {
    // Interleaved references: prompt placed after reference declarations
    parts.push({ text: taskPrompt });
  }

  return parts;
}

/**
 * Determines whether a candidate finish reason indicates a safety or policy filter block.
 */
const isSafetyFinishReason = (finishReason?: string): boolean =>
  finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER';

/**
 * Extracts the base64 inline image from a Gemini generateContent response.
 * Throws appropriate errors if safety blocked or no image returned.
 */
export function extractInlineImageFromResponse(response: any): ImageFile {
  if (response.promptFeedback?.blockReason) {
    throw new Error(`error.api.safetyBlock:${response.promptFeedback.blockReason}`);
  }

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('error.api.safetyBlock:no_candidates');
  }

  const candidate = response.candidates[0];
  if (isSafetyFinishReason(candidate.finishReason)) {
    throw new Error(`error.api.safetyBlock:${candidate.finishReason}`);
  }

  if (candidate.finishReason === 'NO_IMAGE') {
    throw new Error('error.api.noImageGenerated');
  }

  const parts = candidate.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  if (response.text) {
    throw new Error(`error.api.textOnlyResponse:${response.text}`);
  }

  if (parts.length === 0) {
    throw new Error('error.api.noContent');
  }

  throw new Error('error.api.noImageInParts');
}

/**
 * Maps any error from Gemini API or network to a canonical StudioDriverError.
 */
export function mapGeminiErrorToStudioDriverError(error: unknown): StudioDriverError {
  if (isStudioDriverError(error)) {
    return error;
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? 'Unknown Gemini API error');

  const lower = rawMessage.toLowerCase();
  const status = typeof (error as any)?.status === 'number' ? (error as any).status : undefined;
  const formattedMessage = rawMessage.startsWith('error.')
    ? rawMessage
    : `error.api.geminiFailed:${rawMessage}`;

  // 1. Cancellation / Abort
  if (
    (error as any)?.name === 'AbortError' ||
    lower.includes('aborted') ||
    lower.includes('cancelled') ||
    lower.includes('canceled')
  ) {
    return new StudioDriverError('cancelled', rawMessage, {
      retryable: false,
      cause: error,
    });
  }

  // 2. Safety filter blocks
  if (
    lower.includes('safetyblock') ||
    lower.includes('harm_category') ||
    lower.includes('blocked due to safety') ||
    lower.includes('safety ratings') ||
    lower.includes('prohibited_content') ||
    lower.includes('promptfeedback') ||
    lower.includes('safety')
  ) {
    return new StudioDriverError('safety_blocked', rawMessage.startsWith('error.') ? rawMessage : 'error.api.safetyBlock', {
      status: 400,
      retryable: false,
      cause: error,
    });
  }

  // 3. Quota / Rate limit (HTTP 429, RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return new StudioDriverError('rate_limited', formattedMessage, {
      status: 429,
      retryable: true,
      cause: error,
    });
  }

  // 4. Gateway down / Network failures / Server errors (HTTP 500, 502, 503, 504)
  if (
    (status !== undefined && status >= 500) ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('socket hang up') ||
    lower.includes('network error') ||
    lower.includes('unreachable') ||
    lower.includes('unavailable')
  ) {
    return new StudioDriverError('gateway_down', formattedMessage, {
      status: status ?? 503,
      retryable: true,
      cause: error,
    });
  }

  // 5. Auth / Unauthorized / Forbidden (HTTP 401, 403)
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key is not configured') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return new StudioDriverError('unknown', formattedMessage, {
      status: status ?? 401,
      retryable: false,
      cause: error,
    });
  }

  // 6. Default fallback
  return new StudioDriverError('unknown', formattedMessage, {
    status,
    retryable: false,
    cause: error,
  });
}

function splitIntoBatches(count: number, batchSize: number): number[] {
  const safeBatchSize = Math.max(1, batchSize);
  const batches: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const current = Math.min(safeBatchSize, remaining);
    batches.push(current);
    remaining -= current;
  }
  return batches;
}

/**
 * ImageDriver adapter for Google Gemini multimodal image generation models (gemini-3.1-flash-image).
 *
 * Invariants:
 * - Maps semantic references (`subject`, `garment`, `style`, `mask`) to interleavedParts.
 * - Handles `aspectRatio` and `resolution` tiers (`1K`, `2K`, `4K`) via `imageConfig`.
 * - Upscale operates via prompt re-synthesis with source image input and 2K/4K resolution config.
 * - Enforces request slots via `withImageRequestSlot` across all outbound calls.
 * - Normalizes API and network failures into `StudioDriverError`.
 * - Preserves caller job immutability.
 * - Records executed jobs for testing and diagnostics via `getRecordedJobs()`.
 */
export class GeminiImageDriverAdapter implements ImageDriver {
  readonly id: ImageEngineId = 'gemini';
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];
  private readonly clientOverride?: GeminiClientLike;
  private readonly defaultModel: string;

  constructor(options?: GeminiImageDriverAdapterOptions) {
    this.clientOverride = options?.client;
    this.defaultModel = options?.model ?? DEFAULT_GEMINI_IMAGE_MODEL;
    this.generate = this.generate.bind(this);
    this.generateOne = this.generateOne.bind(this);
    this.upscale = this.upscale.bind(this);
  }

  private getClient(): GeminiClientLike {
    return this.clientOverride ?? getGeminiClient();
  }

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    // 1. Immediate pre-abort check
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Gemini generation was cancelled before starting.', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    // 2. Record job for history/test harnesses (preserving caller immutability)
    this.recordedJobs.push({ ...job });

    // 3. Resolve effective model and capabilities
    const effectiveModel = job.model || this.defaultModel;
    const capabilities = getModelCapabilities(effectiveModel);

    // 4. Build interleaved parts
    const contentParts = buildGeminiParts(job);

    // 5. Build imageConfig (aspectRatio and imageSize)
    const imageConfig: { aspectRatio?: string; imageSize?: string } = {};

    if (job.aspectRatio && job.aspectRatio !== 'Default' && capabilities.supportsAspectRatio) {
      imageConfig.aspectRatio = job.aspectRatio;
    }

    const imageSize = resolveImageSizeConfig(effectiveModel, job.resolution);
    if (imageSize) {
      imageConfig.imageSize = imageSize;
    }

    // 6. Prepare request parameters
    const requestConfig: Record<string, unknown> = {
      responseModalities: [Modality.IMAGE],
      ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
    };

    const count = Math.max(1, job.count ?? 1);
    const client = this.getClient();
    const startTime = Date.now();
    const logPrompt = job.prompt
      || (job.interleavedParts?.filter((p: any) => p.text).map((p: any) => p.text).join(' | '))
      || '';

    const generateSingleImage = async (): Promise<ImageFile> => {
      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Gemini generation was cancelled.', {
          retryable: false,
          cause: job.signal.reason,
        });
      }

      const response = await withImageRequestSlot(() =>
        client.models.generateContent({
          model: effectiveModel,
          contents: [{ role: 'user', parts: contentParts }],
          config: requestConfig,
        })
      );

      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Gemini generation was cancelled.', {
          retryable: false,
          cause: job.signal.reason,
        });
      }

      return extractInlineImageFromResponse(response);
    };

    try {
      if (count === 1) {
        const singleResult = await generateSingleImage();
        logApiCall({
          provider: 'Gemini',
          model: effectiveModel,
          feature: job.workflow || 'Image Generate',
          prompt: logPrompt,
          duration: Date.now() - startTime,
          status: 'success',
          responseSize: singleResult.base64.length * 0.75,
        });
        return [singleResult];
      }

      const results: ImageFile[] = [];
      for (const batchSize of splitIntoBatches(count, DEFAULT_MAX_CONCURRENCY)) {
        if (job.signal?.aborted) {
          throw new StudioDriverError('cancelled', 'Gemini generation was cancelled.', {
            retryable: false,
            cause: job.signal.reason,
          });
        }

        const batchResults: ImageFile[] = new Array(batchSize);
        const batchSlots = Array.from({ length: batchSize }, (_, index) => index);

        await runBoundedWorkers(batchSlots, batchSize, async (index) => {
          batchResults[index] = await generateSingleImage();
        });

        results.push(...batchResults);
      }

      logApiCall({
        provider: 'Gemini',
        model: effectiveModel,
        feature: job.workflow || 'Image Generate',
        prompt: logPrompt,
        duration: Date.now() - startTime,
        status: 'success',
        responseSize: results.reduce((sum, img) => sum + img.base64.length * 0.75, 0),
      });

      return results;
    } catch (err) {
      logApiCall({
        provider: 'Gemini',
        model: effectiveModel,
        feature: job.workflow || 'Image Generate',
        prompt: logPrompt,
        duration: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      throw mapGeminiErrorToStudioDriverError(err);
    }
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const results = await this.generate({ ...job, count: 1 });
    if (!results || results.length === 0) {
      throw new StudioDriverError('unknown', 'No image returned from Gemini generation', {
        retryable: false,
      });
    }
    return results[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    // 1. Immediate pre-abort check
    if (job.signal?.aborted) {
      throw new StudioDriverError('cancelled', 'Gemini upscale was cancelled before starting.', {
        retryable: false,
        cause: job.signal.reason,
      });
    }

    // 2. Record upscale job (preserving caller immutability)
    this.recordedJobs.push({ ...job });

    const quality: UpscaleQuality = job.quality ?? '2K';
    const effectiveModel = this.defaultModel;
    const client = this.getClient();
    const startTime = Date.now();

    const upscalePrompt = buildUpscalePrompt(quality, 'model');
    const imagePart: Part = {
      inlineData: {
        data: job.image.base64,
        mimeType: job.image.mimeType || 'image/png',
      },
    };
    const textPart: Part = { text: upscalePrompt };

    const imageSize = resolveImageSizeConfig(effectiveModel, quality as ImageResolution);

    try {
      const response = await withImageRequestSlot(() =>
        client.models.generateContent({
          model: effectiveModel,
          contents: [{ role: 'user', parts: [imagePart, textPart] }],
          config: {
            responseModalities: [Modality.IMAGE],
            ...(imageSize ? { imageConfig: { imageSize } } : {}),
          },
        })
      );

      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Gemini upscale was cancelled.', {
          retryable: false,
          cause: job.signal.reason,
        });
      }

      const extracted = extractInlineImageFromResponse(response);

      logApiCall({
        provider: 'Gemini',
        model: effectiveModel,
        feature: 'Upscale',
        prompt: upscalePrompt,
        duration: Date.now() - startTime,
        status: 'success',
        responseSize: extracted.base64.length * 0.75,
      });

      return {
        base64: extracted.base64,
        mimeType: extracted.mimeType || job.image.mimeType || 'image/png',
      };
    } catch (err) {
      logApiCall({
        provider: 'Gemini',
        model: effectiveModel,
        feature: 'Upscale',
        prompt: upscalePrompt,
        duration: Date.now() - startTime,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      throw mapGeminiErrorToStudioDriverError(err);
    }
  }
}
