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
  AIEditor = 'ai-editor',
  WatermarkRemover = 'watermark-remover',
  ClothingTransfer = 'clothing-transfer',
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

export type ImageEditModel = string;
export type ImageGenerateModel = string;
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

// ============================================
// UPSCALE SESSION TYPES
// ============================================

/** Mode toggle for the Upscale workspace */
export type UpscaleMode = 'quick' | 'studio';

/** Hardcoded Quick Upscale models — only these support imageSize for 2K/4K */
export const UPSCALE_QUICK_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] as const;
export type UpscaleQuickModel = typeof UPSCALE_QUICK_MODELS[number];

/** Short UI labels for Quick Upscale models */
export const UPSCALE_QUICK_MODEL_LABELS: Record<UpscaleQuickModel, string> = {
  'gemini-3.1-flash-image-preview': 'Flash',
  'gemini-3-pro-image-preview': 'Pro',
};

/** Default Quick Upscale model */
export const DEFAULT_UPSCALE_QUICK_MODEL: UpscaleQuickModel = 'gemini-3.1-flash-image-preview';

/** AI Studio guided steps — unlocked sequentially */
export enum UpscaleStudioStep {
  Analyze = 'analyze',
  Enhance = 'enhance',
  Export = 'export',
}

// ============================================
// UPSCALE ANALYSIS REPORT TYPES
// ============================================

/** Single garment identified in the fashion photograph */
export interface AnalysisGarmentItem {
  /** Garment name (e.g., "A-line midi dress") */
  name: string;
  /** Category (e.g., "dress", "jacket", "accessory") */
  type: string;
  /** Cut, construction, and styling details */
  description: string;
}

/** Material details for a specific garment */
export interface AnalysisMaterialItem {
  /** Which garment this material belongs to */
  garment: string;
  /** Fabric type (e.g., "silk", "denim") */
  fabric: string;
  /** Perceived texture description */
  texture: string;
  /** Fabric weight classification */
  weight: string;
  /** Surface sheen classification */
  sheen: string;
}

/** Background analysis of the photograph */
export interface AnalysisBackground {
  /** Environment description (e.g., "outdoor garden", "white studio") */
  environment: string;
  /** Visible surface textures */
  surfaces: string;
  /** Depth perception classification */
  depth: string;
  /** Overall background description */
  description: string;
}

/** Lighting analysis of the photograph */
export interface AnalysisLighting {
  /** Key light direction */
  direction: string;
  /** Light quality (e.g., "soft diffused", "hard directional") */
  quality: string;
  /** Color temperature classification */
  colorTemperature: string;
  /** Shadow behavior description */
  shadows: string;
}

/** Framing and composition analysis */
export interface AnalysisFraming {
  /** Shot type (e.g., "full-body", "half-body", "close-up") */
  shotType: string;
  /** Camera angle description */
  angle: string;
  /** Composition approach/rule */
  composition: string;
}

/** Subject pose analysis */
export interface AnalysisPose {
  /** Body position description */
  bodyPosition: string;
  /** Hand/arm gesture description */
  gesture: string;
  /** Facial expression description */
  expression: string;
  /** Movement quality ("static" or "implied motion") */
  movement: string;
}

/** Area at risk of detail loss during upscaling */
export interface PreservationRiskItem {
  /** Physical area at risk */
  area: string;
  /** Risk severity level */
  riskLevel: 'high' | 'medium' | 'low';
  /** Why this area needs special preservation */
  detail: string;
}

/** Complete structured analysis report for a fashion photograph */
export interface UpscaleAnalysisReport {
  garments: AnalysisGarmentItem[];
  materials: AnalysisMaterialItem[];
  background: AnalysisBackground;
  lighting: AnalysisLighting;
  framing: AnalysisFraming;
  pose: AnalysisPose;
  preservationRisks: PreservationRiskItem[];
}

/** Provider support status for AI Studio (Gemini-only) */
export type StudioSupportStatus = 'supported' | 'unsupported_provider' | 'no_api_key';

/** Per-image session state stored in the session array */
export interface UpscaleSessionImage {
  /** Stable identifier (crypto.randomUUID) */
  id: string;
  /** Original uploaded image */
  original: ImageFile;
  /** Quick Upscale result (null until upscaled) */
  quickResult: ImageFile | null;
  /** Selected quality for Quick Upscale */
  quickQuality: UpscaleQuality;
  /** Selected model for Quick Upscale (Flash or Pro) */
  quickModel: UpscaleQuickModel;
  /** Current AI Studio step for this image */
  studioStep: UpscaleStudioStep;
  /** Timestamp for ordering — newest first in rail */
  addedAt: number;
  /** AI Studio analysis report (null until analyzed) */
  analysisReport?: UpscaleAnalysisReport | null;
  /** Generated master prompt from analysis (null until composed) */
  studioPrompt?: string | null;
  /** Studio upscale result — after Enhance step (null until upscaled) */
  studioResult?: ImageFile | null;
  /** Simulated preview text describing expected improvements */
  studioPreview?: string | null;
}