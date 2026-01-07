export enum Feature {
  TryOn = 'try-on',
  Lookbook = 'lookbook',
  Background = 'background',
  Pose = 'pose',
  PhotoAlbum = 'photo-album',
  OutfitAnalysis = 'outfit-analysis',
  Relight = 'relight',
  Upscale = 'upscale',
  ImageEditor = 'image-editor',
  Video = 'video',
  AIEditor = 'ai-editor',
  GRWMVideo = 'grwm-video',
  WatermarkRemover = 'watermark-remover',
}

export interface ImageFile {
  base64: string;
  mimeType: string;
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
export const DEFAULT_IMAGE_ASPECT_RATIO: ImageAspectRatio = 'Default';
export const DEFAULT_IMAGE_RESOLUTION: ImageResolution = '1K';

// Backward compatible alias (use ImageAspectRatio for new code)
export type AspectRatio = ImageAspectRatio;

export interface AnalyzedItem {
  item: string;
  description: string;
  possibleBrands: string[];
}

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

export interface AIVideoAutoModel {
  id_base: string;
  name: string;
  description?: string;
  server: string;
  model: string;
  price: number;
  startText: boolean;
  startImage: boolean;
  startImageAndEnd?: boolean;
  withReference?: boolean;
  extendVideo?: boolean;
  withLipsync?: boolean;
  withMotion?: boolean;
  ratios?: Array<{ name: string; type: string }>;
  resolutions?: Array<{ name: string; type: string }>;
  durations?: Array<{ name: string; type: string }>;
  prices?: Array<any>;
  mode?: Array<{ type: string; name: string; description: string; price: number }>;
  videoTotalToday?: number;
  videoMaxToday?: number;
  [key: string]: any; // Allow additional fields from API
}

export type ImageEditModel = string;
export type ImageGenerateModel = string;
export type VideoGenerateModel = string;
export type TextGenerateModel = string;

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