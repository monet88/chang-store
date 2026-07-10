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
  { id: 'gemini-2.5-flash-image', name: 'Nano Banana' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro' },
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2' },
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
    prompt: 'Restore this image by removing only the added overlay artifact placed on top of it, then reconstruct the covered pixels naturally. Preserve the original subject, clothing, background, composition, colors, and lighting.',
  },
  {
    id: 'clean',
    labelKey: 'watermarkRemover.prompts.clean',
    prompt: 'Clean this image by erasing only the non-scene overlay artifact and repairing the exposed area so it matches the surrounding pixels. Keep every real object and detail unchanged.',
  },
  {
    id: 'safe',
    labelKey: 'watermarkRemover.prompts.safe',
    prompt: 'Conservatively restore this image. Only fix obvious added overlay marks that sit on top of the photo, and leave everything else exactly as it is.',
  },
  {
    id: 'artistic',
    labelKey: 'watermarkRemover.prompts.artistic',
    prompt: 'Restore this image by removing the added overlay artifact and rebuilding the hidden area with seamless, natural-looking detail that matches the surrounding image. Do not alter the real scene outside the covered area.',
  },
  {
    id: 'quick',
    labelKey: 'watermarkRemover.prompts.quick',
    prompt: 'Restore this image by removing only the added overlay artifact and matching the surrounding pixels.',
  },
];

/** Default prompt ID */
export const DEFAULT_PROMPT_ID = 'clean';

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
  return defaultPrompt?.prompt ?? 'Restore this image by removing only the added overlay artifact and matching the surrounding pixels.';
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
