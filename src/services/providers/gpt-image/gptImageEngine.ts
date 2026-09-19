import type { editImage, upscaleImage, EditImageParams } from '../../imageEditingService';
import type { ImageAspectRatio, ImageFile, UpscaleQuality } from '../../../types';
import { DEFAULT_GPT_IMAGE_SIZE, type GptImageQuality } from '../../../config/gptImageModelRegistry';
import { PROVIDER_UPSCALE_PROMPTS } from '../../../utils/provider-refine-prompt';
import { appendNegativePrompt } from '../../../utils/negative-prompt-builder';
import { runBoundedWorkers } from '../../../utils/run-bounded-workers';
import { editGptImage, type GptImageServiceConfig } from './gptImageService';

/**
 * The GPT lane's implementation of the shared image engine contract
 * (`imageEditingService` is the Gemini one). Feature hooks take either
 * implementation from `ImageEngineContext`, so those hooks never learn which
 * engine is behind them (issue #152, Decision 3).
 */
export interface GptImageEngine {
  editImage: typeof editImage;
  upscaleImage: typeof upscaleImage;
}

/** Ratios the GPT studio offers, in the product's priority order (issue #152, Decision 4). */
export const GPT_STUDIO_ASPECT_RATIOS: readonly ImageAspectRatio[] = ['1:1', '3:4', '9:16'];

const ratioValue = (value: string): number | null => {
  const [width, height] = value.split(/[:x]/).map(Number);
  return width > 0 && height > 0 ? width / height : null;
};

/**
 * Closest advertised pixel size to `ratio`. The size set comes from
 * `resolveGptImageSizeOptions` (the (gateway, model) capability), never from a
 * literal table, so a gateway that honors different sizes still maps correctly.
 */
export const resolveSizeForRatio = (
  sizes: readonly string[],
  ratio: ImageAspectRatio,
): string => {
  const advertised = sizes.filter((size) => size !== 'auto');
  const target = ratioValue(ratio);
  if (advertised.length === 0 || !target) {
    // A ratio the lane cannot express ('Default') keeps the product's default pixel size.
    return advertised.includes(DEFAULT_GPT_IMAGE_SIZE) ? DEFAULT_GPT_IMAGE_SIZE : advertised[0] ?? 'auto';
  }
  return advertised.reduce((best, size) => {
    const bestValue = ratioValue(best);
    const value = ratioValue(size);
    if (!value) return best;
    if (!bestValue) return size;
    return Math.abs(Math.log(value / target)) < Math.abs(Math.log(bestValue / target)) ? size : best;
  }, advertised[0]);
};

export interface GptImageEngineParams {
  /** Model id sent verbatim; the catalog decides which ids a gateway can serve. */
  model: string;
  quality: GptImageQuality;
  /** Pixel sizes the active (gateway, model) pair advertises. */
  sizeOptions: readonly string[];
  /** Fail-closed credentials of the resolved image-lane profile. */
  credentials: GptImageServiceConfig;
}

/**
 * The shared workflow hooks hand both lanes the same interleaved `Part[]`
 * (role labels + images) that `editImage` documents as overriding prompt and
 * images. OpenAI's edit endpoint has no interleaved content: the text parts
 * become the one `prompt`, the inline parts become the ordered `image[]` files.
 */
const flattenInterleavedParts = (
  parts: EditImageParams['interleavedParts'],
): { prompt: string; images: ImageFile[] } | null => {
  if (!parts?.length) return null;
  return {
    prompt: parts.flatMap((part) => (part.text ? [part.text] : [])).join('\n\n'),
    images: parts.flatMap((part) =>
      part.inlineData?.data
        ? [{ base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? 'image/png' }]
        : [],
    ),
  };
};

/**
 * OpenAI Images edits are stateless: a refine is one edit request carrying the
 * current image, and there is no chat session to expose (Decision 5). Upscale
 * has no native flag either, so it uses the preservation prompt at the largest
 * quality, exactly like the retired provider studio.
 */
export const buildGptImageEngine = ({
  model,
  quality,
  sizeOptions,
  credentials,
}: GptImageEngineParams): GptImageEngine => {
  const sizeForRatio = (ratio: ImageAspectRatio): string => resolveSizeForRatio(sizeOptions, ratio);
  const upscaleSize = sizeForRatio('Default');

  return {
    editImage: async (params, _model, _config): Promise<ImageFile[]> => {
      const interleaved = flattenInterleavedParts(params.interleavedParts);
      const editParams = {
        model,
        // `/images/edits` has no negative field, so the avoid-sentence rides
        // inside the one prompt — same wording as the Gemini lane.
        prompt: appendNegativePrompt(interleaved?.prompt || params.prompt, params.negativePrompt),
        images: interleaved?.images.length ? interleaved.images : params.images,
        size: sizeForRatio(params.aspectRatio ?? 'Default'),
        quality,
      };

      const count = Math.max(1, Math.min(params.numberOfImages ?? 1, 4));
      if (count === 1) {
        return editGptImage(editParams, credentials);
      }

      const slots = Array.from({ length: count }, (_, index) => index);
      const results: ImageFile[] = new Array(count);
      await runBoundedWorkers(slots, count, async (index) => {
        try {
          const [result] = await editGptImage(editParams, credentials);
          if (result) {
            results[index] = result;
          }
        } catch (err) {
          console.error(`Parallel GPT image request ${index + 1} failed:`, err);
        }
      });

      const successfulResults = results.filter(Boolean);
      if (successfulResults.length === 0) {
        return editGptImage(editParams, credentials);
      }
      return successfulResults;
    },
    upscaleImage: async (
      image,
      _model,
      _config,
      qualityLevel: UpscaleQuality = '2K',
    ): Promise<ImageFile> => {
      const [upscaled] = await editGptImage(
        {
          model,
          prompt: PROVIDER_UPSCALE_PROMPTS[qualityLevel],
          images: [image],
          size: upscaleSize,
          quality: 'high',
        },
        credentials,
      );
      return upscaled;
    },
  };
};
