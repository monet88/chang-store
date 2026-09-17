/**
 * GPT Image (OpenAI) model registry for the GPT Image provider studio.
 *
 * A projection of `imageModelCatalog.ts`: the catalog owns the capability facts, the size
 * vocabulary and the labels; this file owns which of its entries the studio lists today.
 * Phase 5 of US-006 replaces the pinned membership with `catalog ∩ served(profile)`.
 *
 * Contract behind those entries: OpenAI Images API — `gpt-image-2`, quality
 * `low|medium|high|auto`, multipart `image[]` fields for raw HTTP edits.
 */
import {
  resolveCapabilities,
  requireImageModelDescriptor,
  type OpenAiImageSize,
} from './imageModelCatalog';

export type GptImageModelId = 'gpt-image-2';

/** Pinned UI membership: today's single model. Phase 5 sources this from the gateway. */
const LISTED_GPT_IMAGE_MODEL_IDS: readonly GptImageModelId[] = ['gpt-image-2'];

export const DEFAULT_GPT_IMAGE_MODEL: GptImageModelId = LISTED_GPT_IMAGE_MODEL_IDS[0];

export const GPT_IMAGE_MODELS: Array<{ modelId: GptImageModelId; label: string }> =
  LISTED_GPT_IMAGE_MODEL_IDS.map((modelId) => ({
    modelId,
    label: requireImageModelDescriptor(modelId).label,
  }));

const GPT_IMAGE_CAPABILITIES = resolveCapabilities(requireImageModelDescriptor(DEFAULT_GPT_IMAGE_MODEL));

/** Quality values exposed in the studio UI. */
export const GPT_IMAGE_QUALITIES = ['low', 'medium', 'high', 'auto'] as const;
export type GptImageQuality = typeof GPT_IMAGE_QUALITIES[number];
export const DEFAULT_GPT_IMAGE_QUALITY: GptImageQuality = 'high';

/**
 * Size values exposed in the studio UI: the model's catalog sizes (pixel vocabulary) plus
 * the `auto` placeholder. A model whose `honorsSize` is `'no'` hides the control instead.
 */
export type GptImageSize = 'auto' | OpenAiImageSize;
export const GPT_IMAGE_SIZES: readonly GptImageSize[] = [
  'auto',
  ...GPT_IMAGE_CAPABILITIES.sizes as readonly OpenAiImageSize[],
];
export const DEFAULT_GPT_IMAGE_SIZE: GptImageSize = GPT_IMAGE_CAPABILITIES.defaultSize as GptImageSize;

/**
 * Product cap on reference images. OpenAI allows up to 16, but we cap at 10 to
 * avoid timeouts and UX overload.
 */
export const MAX_GPT_REFERENCE_IMAGES = 10;

/** GPT Image generations return a single image (n effectively one). */
export const GPT_IMAGE_OUTPUT_COUNT = 1;

/** Rough response-time guidance for UI warnings (seconds). */
export const GPT_IMAGE_ESTIMATED_RESPONSE_SECONDS = '60-90';

export function isKnownGptImageQuality(value: string): value is GptImageQuality {
  return (GPT_IMAGE_QUALITIES as readonly string[]).includes(value);
}

export function isKnownGptImageSize(value: string): value is GptImageSize {
  return (GPT_IMAGE_SIZES as readonly string[]).includes(value);
}
