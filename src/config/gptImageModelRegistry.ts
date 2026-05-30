/**
 * GPT Image (OpenAI) model registry for the GPT Image provider studio.
 *
 * Isolated from the Gemini `modelRegistry.ts`. Contract verified against the
 * OpenAI Images API: `gpt-image-2`, quality `low|medium|high|auto`, multipart
 * `image[]` fields for raw HTTP edits.
 */

export type GptImageModelId = 'gpt-image-2';

export const DEFAULT_GPT_IMAGE_MODEL: GptImageModelId = 'gpt-image-2';

export const GPT_IMAGE_MODELS: Array<{ modelId: GptImageModelId; label: string }> = [
  { modelId: 'gpt-image-2', label: 'GPT Image 2' },
];

/** Quality values exposed in the studio UI. */
export const GPT_IMAGE_QUALITIES = ['low', 'medium', 'high', 'auto'] as const;
export type GptImageQuality = typeof GPT_IMAGE_QUALITIES[number];
export const DEFAULT_GPT_IMAGE_QUALITY: GptImageQuality = 'high';

/** Size values exposed in the studio UI. */
export const GPT_IMAGE_SIZES = ['auto', '1024x1024', '1536x1024', '1024x1536'] as const;
export type GptImageSize = typeof GPT_IMAGE_SIZES[number];
export const DEFAULT_GPT_IMAGE_SIZE: GptImageSize = '1024x1024';

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
