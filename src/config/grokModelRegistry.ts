/**
 * Grok (xAI) image model registry for the Grok provider studio.
 *
 * Isolated from the Gemini `modelRegistry.ts` — provider studios manage their
 * own models. Contract verified against the xAI REST Images reference:
 * generation/edits accept `aspect_ratio`, `resolution`, and
 * `response_format: 'b64_json'`.
 */

export type GrokModelId = 'grok-imagine-image' | 'grok-imagine-image-quality';

export interface GrokModel {
  modelId: GrokModelId;
  label: string;
}

export const GROK_MODELS: GrokModel[] = [
  { modelId: 'grok-imagine-image-quality', label: 'Grok Imagine Image (Quality)' },
  { modelId: 'grok-imagine-image', label: 'Grok Imagine Image' },
];

export const DEFAULT_GROK_MODEL: GrokModelId = 'grok-imagine-image-quality';

/** xAI-supported aspect ratio presets. */
export const GROK_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '9:16', '16:9'] as const;
export type GrokAspectRatio = typeof GROK_ASPECT_RATIOS[number];
export const DEFAULT_GROK_ASPECT_RATIO: GrokAspectRatio = '2:3';

/** xAI-supported resolution values. */
export const GROK_RESOLUTIONS = ['1k', '2k'] as const;
export type GrokResolution = typeof GROK_RESOLUTIONS[number];
export const DEFAULT_GROK_RESOLUTION: GrokResolution = '1k';

/** Output count bounds for the `n` slider. */
export const GROK_MIN_OUTPUTS = 1;
export const GROK_MAX_OUTPUTS = 10;

/** Official multi-image edit source cap. */
export const GROK_MAX_REFERENCE_IMAGES = 3;

export function isKnownGrokModel(modelId: string): modelId is GrokModelId {
  return GROK_MODELS.some((model) => model.modelId === modelId);
}
