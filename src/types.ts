export enum Feature {
  TryOn = 'try-on',
  Lookbook = 'lookbook',
  Background = 'background',
  Pose = 'pose',
  PhotoAlbum = 'photo-album',
  AIEditor = 'ai-editor',
  WatermarkRemover = 'watermark-remover',
  ClothingTransfer = 'clothing-transfer',
  IdentityTransfer = 'identity-transfer',
  PatternGenerator = 'pattern-generator',
}

// ============================================
// STUDIO MODE (Three Provider Studios)
// ============================================

/** Studio mode for the three-provider split. Gemini is default. */
export type StudioMode = 'gemini' | 'grok' | 'gptImage';

/**
 * Subset of features available inside Grok and GPT Image provider studios.
 * Provider studios only support these five workflows.
 */
export const PROVIDER_SUPPORTED_FEATURES: Feature[] = [
  Feature.TryOn,
  Feature.Lookbook,
  Feature.ClothingTransfer,
  Feature.PatternGenerator,
  Feature.AIEditor,
];

/** Returns true when a feature is supported inside provider studios. */
export const isProviderSupportedFeature = (feature: Feature): boolean =>
  PROVIDER_SUPPORTED_FEATURES.includes(feature);

export interface ImageFile {
  base64: string;
  mimeType: string;
}

/** Extended ImageFile with gallery metadata */
export interface GalleryImageFile extends ImageFile {
  /** Feature that generated this image */
  feature?: string;
  /** Creation timestamp */
  createdAt?: Date;
}

export interface AdjustmentState {
    exposure: number; contrast: number; temperature: number; tint: number;
    vibrance: number; saturation: number; grain: number; clarity: number;
    dehaze: number; blur: number;
}

export interface HSLColor { hue: number; saturation: number; luminance: number; }
export type HSLState = Record<string, HSLColor>;

export const INITIAL_ADJUSTMENTS: AdjustmentState = {
    exposure: 0, contrast: 0, temperature: 0, tint: 0,
    vibrance: 0, saturation: 0, grain: 0, clarity: 0,
    dehaze: 0, blur: 0,
};

export const INITIAL_HSL: HSLState = {
    red: { hue: 0, saturation: 0, luminance: 0 },
    yellow: { hue: 0, saturation: 0, luminance: 0 },
    green: { hue: 0, saturation: 0, luminance: 0 },
    cyan: { hue: 0, saturation: 0, luminance: 0 },
    blue: { hue: 0, saturation: 0, luminance: 0 },
    magenta: { hue: 0, saturation: 0, luminance: 0 },
};



export interface RefinementHistoryItem {
  prompt: string;
  timestamp: number;
}

export interface SelectableModel {
  modelId: string;
  label: string;
}

// ============================================
// IMAGE GENERATION OPTIONS (Single Source of Truth)
// ============================================

/** Supported aspect ratios for image generation */
export const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;

/** Supported resolutions for image generation (Gemini 3 Pro) */
export const IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const;

/** Supported upscale quality options */
export const UPSCALE_QUALITIES = ['2K', '4K'] as const;
export type UpscaleQuality = typeof UPSCALE_QUALITIES[number];

/** Aspect ratio type - 'Default' = keep original ratio */
export type ImageAspectRatio = typeof IMAGE_ASPECT_RATIOS[number] | 'Default';

/** Resolution type for image output quality */
export type ImageResolution = typeof IMAGE_RESOLUTIONS[number];

/** Default values */
export const DEFAULT_IMAGE_ASPECT_RATIO: ImageAspectRatio = '3:4';
export const DEFAULT_IMAGE_RESOLUTION: ImageResolution = '2K';

// Backward compatible alias (use ImageAspectRatio for new code)
export type AspectRatio = ImageAspectRatio;

export type Quality = 'standard' | 'high';

export interface LookbookSet {
  id: string;
  createdAt: number;
  images: ImageFile[];
  spinImages?: ImageFile[];
}

export interface Pose {
    title: string;
    label: string;
    imageUrl: string;
}

export interface PoseCollection {
    title: string;
    poses: Pose[];
}

export type ImageEditModel = string;
export type ImageGenerateModel = string;
export type TextGenerateModel = string;

// ============================================
// SHARED BATCH PROCESSING TYPES
// ============================================

/** Shared processing status for feature-local batch image jobs */
export type BatchImageStatus = 'pending' | 'processing' | 'completed' | 'error';

export const VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES = ['clothing', 'shoes', 'bag', 'accessory'] as const;
export type VirtualTryOnSourceItemType = typeof VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES[number];

/** Shared clothing uploader state for Virtual Try-On */
export interface VirtualTryOnClothingItem {
  id: number;
  image: ImageFile | null;
  sourceItemType: VirtualTryOnSourceItemType;
  sourcePrompt: string;
}

/** One subject image job inside a Virtual Try-On batch run */
export interface VirtualTryOnBatchItem {
  id: string;
  subjectImage: ImageFile;
  status: BatchImageStatus;
  results: ImageFile[];
  error?: string;
}

// ============================================
// VIRTUAL TRY-ON WARDROBE MODE TYPES
// ============================================

export type VirtualTryOnMode = 'multi-model' | 'wardrobe';

export interface WardrobeSet {
  id: string;
  items: VirtualTryOnClothingItem[];
}

export interface WardrobeResultSet {
  setId: string;
  status: BatchImageStatus;
  results: ImageFile[];
  error?: string;
}

/** Shared reference uploader state for Clothing Transfer */
export interface ClothingTransferReferenceItem {
  id: number;
  image: ImageFile | null;
  label: string;
}

/** One concept image job inside a Clothing Transfer batch run */
export interface ClothingTransferBatchItem {
  id: string;
  conceptImage: ImageFile;
  status: BatchImageStatus;
  results: ImageFile[];
  error?: string;
}

/** One destination image job inside an Identity Transfer batch run */
export interface IdentityTransferBatchItem {
  id: string;
  destinationImage: ImageFile;
  status: BatchImageStatus;
  results: ImageFile[];
  error?: string;
}

// ============================================
// WATERMARK REMOVER TYPES
// ============================================

/** Processing status for a single batch item */
export type WatermarkItemStatus = 'pending' | 'processing' | 'completed' | 'error';

/**
 * Single item in watermark removal batch
 * Tracks individual image processing state and results
 */
export interface WatermarkBatchItem {
  /** Unique identifier for this item */
  id: string;
  /** Original image before processing */
  original: ImageFile;
  /** Processed result image (set after successful processing) */
  result?: ImageFile;
  /** Current processing status */
  status: WatermarkItemStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Retry count for failed items */
  retryCount: number;
}

/**
 * Configuration for watermark removal processing
 * Controls model selection, prompts, and batch processing behavior
 */
export interface WatermarkConfig {
  /** AI model to use for processing */
  model: string;
  /** Selected predefined prompt ID */
  promptId: string;
  /** Custom prompt text (used when promptId is 'custom') */
  customPrompt: string;
  /** Number of concurrent processing jobs (1-5) */
  concurrency: number;
}

// ============================================
// PROMPT LIBRARY TYPES
// ============================================

export interface SavedPrompt {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  isCurated?: boolean;
}

// ============================================
// MULTI-PERSON TRY-ON TYPES
// ============================================

/** Marker position for multi-person try-on targeting */
export interface MarkerPosition {
  /** Pixel X relative to the rendered image container */
  x: number;
  /** Pixel Y relative to the rendered image container */
  y: number;
  /** Normalized X (0–1) relative to image natural width — para uso en Phase 13 engine */
  relX: number;
  /** Normalized Y (0–1) relative to image natural height — para uso en Phase 13 engine */
  relY: number;
}
