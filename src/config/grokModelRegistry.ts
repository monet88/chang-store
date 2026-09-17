/**
 * Grok (xAI) image model registry for the Grok provider studio.
 *
 * A projection of `imageModelCatalog.ts`: the catalog owns the labels, the aspect-ratio
 * vocabulary and the resolution values; this file owns which entries the studio lists
 * today. Phase 5 of US-006 replaces the pinned membership with `catalog ∩ served(profile)`.
 *
 * Contract behind those entries: xAI REST Images reference — generation/edits accept
 * `aspect_ratio`, `resolution`, and `response_format: 'b64_json'`.
 */
import {
  GROK_IMAGE_ASPECT_RATIOS,
  GROK_IMAGE_RESOLUTIONS,
  requireImageModelDescriptor,
  resolveCapabilities,
} from './imageModelCatalog';

export type GrokModelId = 'grok-imagine-image' | 'grok-imagine-image-quality';

export interface GrokModel {
  modelId: GrokModelId;
  label: string;
}

/** Pinned UI membership: today's two models, in today's order. */
const LISTED_GROK_MODEL_IDS: readonly GrokModelId[] = ['grok-imagine-image-quality', 'grok-imagine-image'];

export const GROK_MODELS: GrokModel[] = LISTED_GROK_MODEL_IDS.map((modelId) => ({
  modelId,
  label: requireImageModelDescriptor(modelId).label,
}));

export const DEFAULT_GROK_MODEL: GrokModelId = LISTED_GROK_MODEL_IDS[0];

const GROK_CAPABILITIES = resolveCapabilities(requireImageModelDescriptor(DEFAULT_GROK_MODEL));

/** xAI-supported aspect ratio presets. */
export type GrokAspectRatio = (typeof GROK_IMAGE_ASPECT_RATIOS)[number];
export const GROK_ASPECT_RATIOS: readonly GrokAspectRatio[] = GROK_IMAGE_ASPECT_RATIOS;
export const DEFAULT_GROK_ASPECT_RATIO: GrokAspectRatio = GROK_CAPABILITIES.defaultSize as GrokAspectRatio;

/** xAI-supported resolution values. */
export type GrokResolution = (typeof GROK_IMAGE_RESOLUTIONS)[number];
export const GROK_RESOLUTIONS: readonly GrokResolution[] = GROK_IMAGE_RESOLUTIONS;
export const DEFAULT_GROK_RESOLUTION: GrokResolution = GROK_CAPABILITIES.resolutions?.[0] as GrokResolution;

/** Output count bounds for the `n` slider. */
export const GROK_MIN_OUTPUTS = 1;
export const GROK_MAX_OUTPUTS = 10;

/** Official multi-image edit source cap. */
export const GROK_MAX_REFERENCE_IMAGES = 3;

export function isKnownGrokModel(modelId: string): modelId is GrokModelId {
  return GROK_MODELS.some((model) => model.modelId === modelId);
}
