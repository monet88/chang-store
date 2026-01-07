/**
 * Watermark Removal Prompts Configuration
 * 
 * Defines available AI models and predefined prompts for batch watermark removal.
 * Used by useWatermarkRemover hook to process images.
 */

// ============================================
// MODEL CONFIGURATION
// ============================================

/** Available models for watermark removal */
export const WATERMARK_MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image' },
] as const;

export type WatermarkModel = typeof WATERMARK_MODELS[number]['id'];

/** Default model for watermark removal */
export const DEFAULT_WATERMARK_MODEL: WatermarkModel = 'gemini-2.5-flash-image';

// ============================================
// PROMPT CONFIGURATION
// ============================================

/** Predefined prompt configuration */
export interface WatermarkPrompt {
  /** Unique identifier */
  id: string;
  /** Display label key for i18n */
  labelKey: string;
  /** The actual prompt text sent to AI */
  prompt: string;
}

/**
 * Predefined prompts for watermark removal
 * Each prompt is optimized for different use cases
 */
export const WATERMARK_PROMPTS: WatermarkPrompt[] = [
  {
    id: 'text-logo',
    labelKey: 'watermarkRemover.prompts.textLogo',
    prompt: 'Remove all watermarks, logos, and text overlays from this image. Keep the original image content intact and fill the removed areas naturally.',
  },
  {
    id: 'clean',
    labelKey: 'watermarkRemover.prompts.clean',
    prompt: 'Clean this image by removing any watermarks or stamps. Preserve the original quality and details of the underlying image.',
  },
  {
    id: 'safe',
    labelKey: 'watermarkRemover.prompts.safe',
    prompt: 'Carefully remove watermarks from this image while being conservative. Only remove clearly visible watermarks and avoid modifying other parts of the image.',
  },
  {
    id: 'artistic',
    labelKey: 'watermarkRemover.prompts.artistic',
    prompt: 'Remove watermarks from this image and enhance the result artistically. Fill removed areas with contextually appropriate content that blends seamlessly.',
  },
  {
    id: 'quick',
    labelKey: 'watermarkRemover.prompts.quick',
    prompt: 'Remove watermarks from this image.',
  },
];

/** Default prompt ID */
export const DEFAULT_PROMPT_ID = 'text-logo';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get prompt text by ID
 * Returns the prompt text for predefined prompts or the custom prompt itself
 * 
 * @param promptId - The prompt ID to look up
 * @param customPrompt - Optional custom prompt text (used when promptId is 'custom')
 * @returns The prompt text to send to AI
 */
export function getPromptText(promptId: string, customPrompt?: string): string {
  // If custom prompt is requested and provided
  if (promptId === 'custom' && customPrompt) {
    return customPrompt;
  }
  
  // Find predefined prompt
  const predefined = WATERMARK_PROMPTS.find(p => p.id === promptId);
  if (predefined) {
    return predefined.prompt;
  }
  
  // Fallback to default prompt
  const defaultPrompt = WATERMARK_PROMPTS.find(p => p.id === DEFAULT_PROMPT_ID);
  return defaultPrompt?.prompt ?? 'Remove watermarks from this image.';
}

/**
 * Get prompt by ID
 * 
 * @param promptId - The prompt ID to look up
 * @returns The prompt configuration or undefined
 */
export function getPromptById(promptId: string): WatermarkPrompt | undefined {
  return WATERMARK_PROMPTS.find(p => p.id === promptId);
}
