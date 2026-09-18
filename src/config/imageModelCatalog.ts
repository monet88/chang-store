/**
 * Image model catalog — the single source of truth for image-model capabilities (US-006 Lớp 1).
 *
 * Capabilities belong to the (gateway, model) pair: the same id was measured honouring
 * `size` on one gateway and ignoring it on the other, so consumers read them through
 * `resolveCapabilities`, never straight off `descriptor.capabilities`. Every row dates the
 * live probe behind it; a row still awaiting one carries `RE_VERIFY` and never reaches a picker.
 *
 * Evidence: docs/api/xompet-image-api-guide.md and the per-row probes it records.
 */

export type ImageDriverId = 'gemini-native' | 'openai-images';
export type ImageSizeMode = 'ratio' | 'pixel';
export type ImageHonorsSize = 'yes' | 'no' | 'flaky';
export type ImageResponseShape = 'b64_json' | 'url' | 'echo_fields';
/** Provider scopes: the two studios, the Gemini route, and the CPA gateway. */
export type ImageModelProviderId = 'gptImage' | 'google' | 'cpa';
/** One profile = one lane = one driver (design invariant 10). */
export type GatewayLane = 'gemini' | 'image';

/** `verifiedAt` sentinel for a row with no live probe behind it yet. */
export const RE_VERIFY = 're-verify';

export interface ImageModelCapabilities {
  driver: ImageDriverId;
  /** Which vocabulary the driver accepts in `size` / `imageConfig`. */
  sizeMode: ImageSizeMode;
  /** Pixels ('1080x1920') when `sizeMode === 'pixel'`, ratios ('9:16') otherwise. */
  sizes: readonly string[];
  defaultSize: string;
  /** Scale knob where one exists: ImageResolution ('1K'|'2K'|'4K') for `gemini-native`. */
  resolutions?: readonly string[];
  /** Measured, never assumed: `flaky` keeps the size control and mandates the dimension guard. */
  honorsSize: ImageHonorsSize;
  sizeObservations?: { honored: number; total: number };
  honorsQuality: boolean;
  supportsTransparentBackground: boolean;
  /** Envelopes the response parser must accept — a driver property, never a per-model one. */
  responseShapes: readonly ImageResponseShape[];
  /** ISO date of the last live probe behind these flags. */
  verifiedAt: string;
}

/** An override carries its own evidence date, so a merged set keeps exactly one. */
export type ImageCapabilityOverride = Partial<Omit<ImageModelCapabilities, 'verifiedAt'>> & { verifiedAt: string };

export interface ImageModelDescriptor {
  modelId: string;
  label: string;
  providerId: ImageModelProviderId;
  /** Capabilities of the model's own contract; gateway facts live in `gatewayOverrides`. */
  capabilities: ImageModelCapabilities;
  /** Keyed by bare host, e.g. 'cliproxy.monet.uno'. */
  gatewayOverrides?: Record<string, ImageCapabilityOverride>;
  notes?: string;
}

/** Exhaustive at compile time: no driver can appear without declaring its lane and its existing seam. */
export const IMAGE_DRIVERS: Record<ImageDriverId, { lane: GatewayLane; seam: 'provider-driver' | 'gemini-adapter' }> = {
  'gemini-native': { lane: 'gemini', seam: 'gemini-adapter' },
  'openai-images': { lane: 'image', seam: 'provider-driver' },
};

const MEASURED_AT = '2026-09-17';
/** The Gemini lane's gateway (CPA) — never a source of image-lane capability facts. */
export const CPA_GATEWAY_HOST = 'cliproxy.monet.uno';
/** Reference gateway of the image lane. */
export const XOMPET_GATEWAY_HOST = 'api.xompet.io.vn';
/** OpenAI Images pixel vocabulary — the `openai-images` driver's own contract. */
export const OPENAI_IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const;
/** The one `openai-images` adapter tolerates all three; no model may claim a shape outside them. */
const OPENAI_IMAGE_SHAPES = ['b64_json', 'url', 'echo_fields'] as const;
/** Sizes the image lane's reference gateway returned at pixel precision. */
const XOMPET_HONORED_SIZES = ['1080x1920', '1536x1024', '1024x1024', '1024x1536'] as const;
export type OpenAiImageSize = (typeof OPENAI_IMAGE_SIZES)[number];

interface OpenAiCapabilitiesInput {
  honorsSize?: ImageHonorsSize;
  sizeObservations?: { honored: number; total: number };
  sizes?: readonly string[];
  defaultSize?: string;
  transparent?: boolean;
  honorsQuality?: boolean;
  responseShapes?: readonly ImageResponseShape[];
  verifiedAt?: string;
}

/** Documented OpenAI Images contract; every measured deviation lives in `gatewayOverrides`. */
const openAiCapabilities = (input: OpenAiCapabilitiesInput = {}): ImageModelCapabilities => {
  const sizes = input.sizes ?? OPENAI_IMAGE_SIZES;
  return {
    driver: 'openai-images',
    sizeMode: 'pixel',
    sizes,
    defaultSize: input.defaultSize ?? sizes[0],
    honorsSize: input.honorsSize ?? 'yes',
    ...(input.sizeObservations ? { sizeObservations: input.sizeObservations } : {}),
    honorsQuality: input.honorsQuality ?? true,
    supportsTransparentBackground: input.transparent ?? true,
    responseShapes: input.responseShapes ?? OPENAI_IMAGE_SHAPES,
    verifiedAt: input.verifiedAt ?? MEASURED_AT,
  };
};

/** Gemini lane: ratio vocabulary plus the resolution scale, both measured honoured exactly (1K→2K→4K). */
const geminiCapabilities = (): ImageModelCapabilities => ({
  driver: 'gemini-native',
  sizeMode: 'ratio',
  sizes: ['1:1', '3:4', '9:16'],
  defaultSize: '9:16',
  resolutions: ['1K', '2K', '4K'],
  honorsSize: 'yes',
  honorsQuality: false,
  supportsTransparentBackground: false, // returns image/jpeg through parts[].inlineData
  responseShapes: ['b64_json'], // inlineData is base64
  verifiedAt: MEASURED_AT,
});


const openAiRow = (modelId: string, label: string, capabilities: ImageModelCapabilities, gatewayOverrides?: Record<string, ImageCapabilityOverride>, notes?: string): ImageModelDescriptor =>
  ({ modelId, label, providerId: 'gptImage', capabilities, gatewayOverrides, notes });
const geminiRow = (modelId: string, label: string, notes: string): ImageModelDescriptor =>
  ({ modelId, label, providerId: 'google', capabilities: geminiCapabilities(), notes });

const CPA_IMAGE_FACTS: ImageCapabilityOverride = {
  honorsSize: 'no', // measured: 1254x1254 whatever `size` asked for
  honorsQuality: false, // measured: `high` came back echoed as `medium`/`low`
  supportsTransparentBackground: true,
  responseShapes: ['echo_fields', 'b64_json'],
  verifiedAt: MEASURED_AT,
};

/** Image lane (all documented 2026-09-17), then the Gemini lane. */
export const IMAGE_MODEL_CATALOG: readonly ImageModelDescriptor[] = [
  openAiRow('gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst', openAiCapabilities({
    honorsSize: 'flaky', sizeObservations: { honored: 2, total: 3 }, sizes: XOMPET_HONORED_SIZES,
    defaultSize: '1080x1920', transparent: true, honorsQuality: false,
    responseShapes: ['b64_json', 'url', 'echo_fields'],
  }), { [CPA_GATEWAY_HOST]: CPA_IMAGE_FACTS },
  'Three identical 1080x1920 calls returned 1080x1920, 1080x1920, 1254x1254 — hence `flaky` and the mandatory dimension guard.'),
  openAiRow('gpt-image-2.5-flare', 'GPT Image 2.5 Flare', openAiCapabilities(),
    { [CPA_GATEWAY_HOST]: CPA_IMAGE_FACTS }, 'CPA-only measurement: the image-lane defaults stay fail-closed until this id is measured there.'),
  openAiRow('gpt-image-2.5', 'GPT Image 2.5', openAiCapabilities(),
    { [CPA_GATEWAY_HOST]: CPA_IMAGE_FACTS }, 'CPA answers 1369x1149 — non-square, so nothing may infer an aspect ratio from the request.'),
  openAiRow('gpt-image-2', 'GPT Image 2', openAiCapabilities(), { [CPA_GATEWAY_HOST]: CPA_IMAGE_FACTS },
    'The only GPT Image model the studio lists today; the CPA images route serves it at the gateway own size.'),
  openAiRow('gpt-image-1.5', 'GPT Image 1.5', openAiCapabilities({ verifiedAt: RE_VERIFY }), undefined,
    'Named by the CPA images route own 400 as supported, never driven — stays out of every picker.'),
  geminiRow('gemini-3.1-flash-image', 'Nano Banana 2',
    'aspectRatio + imageSize honoured exactly; without imageConfig the model answers landscape (1408x768), so a request always sends an explicit ratio.'),
  geminiRow('agy/gemini-3.1-flash-image', 'Nano Banana 2 (agy alias)', 'The agy/ alias answers 200 on the same generateContent route.'),
];

export function getImageModelDescriptor(modelId: string): ImageModelDescriptor | undefined {
  return IMAGE_MODEL_CATALOG.find((entry) => entry.modelId === modelId);
}

export function requireImageModelDescriptor(modelId: string): ImageModelDescriptor {
  const descriptor = getImageModelDescriptor(modelId);
  if (!descriptor) {
    throw new Error(`imageModelCatalog: unknown image model '${modelId}'`);
  }
  return descriptor;
}

/** The only way capabilities are read. No host ⇒ no gateway context ⇒ the model's own defaults. Most specific wins, and the merged set keeps exactly one evidence date. */
export function resolveCapabilities(descriptor: ImageModelDescriptor, gatewayHost?: string): ImageModelCapabilities {
  const override = gatewayHost ? descriptor.gatewayOverrides?.[gatewayHost] : undefined;
  return { ...descriptor.capabilities, ...override };
}

/** A row is usable only with a live probe behind it — `RE_VERIFY` rows ship disabled. */
export function isVerifiedModel(descriptor: ImageModelDescriptor, gatewayHost?: string): boolean {
  return resolveCapabilities(descriptor, gatewayHost).verifiedAt !== RE_VERIFY;
}
