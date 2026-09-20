/**
 * Prompt assembly format per image lane.
 *
 * Gemini takes interleaved content: a text label immediately before the image it
 * describes. The OpenAI-compatible lane has no interleaved content — its edit
 * endpoint takes one `prompt` plus an ordered `image[]`, and
 * `gptImageEngine.flattenInterleavedParts` folds the text parts into that single
 * prompt.
 *
 * Feature workflows migrated to independent prompt policies (Virtual Try-On,
 * Clothing Transfer) no longer use this lane selector.
 */

import type { Part } from '@google/genai';
import type { ImageEngineId, ImageFile } from '../types';

/** Common inline image part helper for interleaved Gemini/GPT requests. */
export const imagePart = (image: ImageFile): Part => ({
  inlineData: { data: image.base64, mimeType: image.mimeType },
});

/** How a builder assembles a request: interleaved parts, or one text block plus ordered images. */
export type PromptFormat = 'parts' | 'text';

/** Both lanes share one wording; only the assembly differs, and the lane picks it here. */
export const promptFormatFor = (engineId: ImageEngineId | undefined): PromptFormat =>
  engineId === 'gptImage' ? 'text' : 'parts';
