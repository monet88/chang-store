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
  getImageModelDescriptor,
  resolveCapabilities,
  requireImageModelDescriptor,
  type ImageModelCapabilities,
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

/**
 * Capability facts of the (gateway, model) pair the studio is about to use. No host ⇒ the
 * model's own documented contract. `null` for an unverified model the gateway serves.
 */
export function resolveGptImageCapabilities(
  modelId: string,
  gatewayHost?: string,
): ImageModelCapabilities | null {
  const descriptor = getImageModelDescriptor(modelId);
  return descriptor ? resolveCapabilities(descriptor, gatewayHost) : null;
}

/** `auto` plus the sizes the model's capabilities claim honor, for the active gateway. */
export function resolveGptImageSizeOptions(modelId: string, gatewayHost?: string): string[] {
  const capabilities = resolveGptImageCapabilities(modelId, gatewayHost);
  return ['auto', ...(capabilities?.sizes ?? GPT_IMAGE_SIZES.slice(1))];
}

/** `honorsSize: 'no'` ⇒ the gateway answers its own size, so the control must not be offered. */
export function resolveGptImageSupportsSize(modelId: string, gatewayHost?: string): boolean {
  return resolveGptImageCapabilities(modelId, gatewayHost)?.honorsSize !== 'no';
}

/** Observed honor rate behind a `flaky` size, so the studio can show what was measured. */
export function resolveGptImageSizeObservations(
  modelId: string,
  gatewayHost?: string,
): { honored: number; total: number } | undefined {
  return resolveGptImageCapabilities(modelId, gatewayHost)?.sizeObservations;
}

/** Measured: both gateways echo a quality they chose (`high` in, `medium` out). */
export function resolveGptImageSupportsQuality(modelId: string, gatewayHost?: string): boolean {
  return resolveGptImageCapabilities(modelId, gatewayHost)?.honorsQuality !== false;
}

export function isKnownGptImageSize(value: string): value is GptImageSize {
  return (GPT_IMAGE_SIZES as readonly string[]).includes(value);
}
